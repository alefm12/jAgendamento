require('dotenv').config();
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const unzipper = require('unzipper');
const { Pool } = require('pg');
const { execFileSync } = require('child_process');
const { ensureSystemBackupDir } = require('./system_backup_full.cjs');

function usage() {
  console.log('Uso: node system_restore_full.cjs [caminho_do_backup.zip] --force');
  console.log('Sem caminho, usa backups/system/latest_full.txt');
}

function resolveLatestBackup() {
  const backupsDir = ensureSystemBackupDir();
  const latestPathFile = path.join(backupsDir, 'latest_full.txt');
  if (!fs.existsSync(latestPathFile)) return null;
  const backupPath = fs.readFileSync(latestPathFile, 'utf8').trim();
  if (!backupPath || !fs.existsSync(backupPath)) return null;
  return backupPath;
}

function resolveBackupArg() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--force');
  if (args.length === 0) return resolveLatestBackup();
  const candidate = path.resolve(process.cwd(), args[0]);
  return fs.existsSync(candidate) ? candidate : null;
}

async function extractZip(zipPath, targetDir) {
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: targetDir }))
    .promise();
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function backupExistingFiles(destinations) {
  const backupsDir = ensureSystemBackupDir();
  const snapshotDir = path.join(backupsDir, `pre_restore_files_${timestamp()}`);
  await fsp.mkdir(snapshotDir, { recursive: true });

  for (const item of destinations) {
    if (!fs.existsSync(item.source)) continue;
    const target = path.join(snapshotDir, item.name);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.cp(item.source, target, { recursive: true });
  }

  return snapshotDir;
}

async function restoreFiles(extractedDir) {
  const uploadMappings = [
    {
      from: path.join(extractedDir, 'uploads', 'client-public-uploads'),
      to: path.join(process.cwd(), 'client', 'public', 'uploads'),
      name: 'uploads/client-public-uploads'
    },
    {
      from: path.join(extractedDir, 'uploads', 'public-uploads'),
      to: path.join(process.cwd(), 'public', 'uploads'),
      name: 'uploads/public-uploads'
    }
  ];

  const configMappings = [
    { from: path.join(extractedDir, 'config', '.env'), to: path.join(process.cwd(), '.env'), name: 'config/.env' },
    { from: path.join(extractedDir, 'config', 'runtime.config.json'), to: path.join(process.cwd(), 'runtime.config.json'), name: 'config/runtime.config.json' },
    { from: path.join(extractedDir, 'config', 'theme.json'), to: path.join(process.cwd(), 'theme.json'), name: 'config/theme.json' },
    { from: path.join(extractedDir, 'config', 'tailwind.config.js'), to: path.join(process.cwd(), 'tailwind.config.js'), name: 'config/tailwind.config.js' },
    { from: path.join(extractedDir, 'config', 'components.json'), to: path.join(process.cwd(), 'components.json'), name: 'config/components.json' }
  ];

  const existingTargets = [
    ...uploadMappings.map((item) => ({ source: item.to, name: item.name })),
    ...configMappings.map((item) => ({ source: item.to, name: item.name }))
  ];

  const snapshotDir = await backupExistingFiles(existingTargets);

  for (const item of uploadMappings) {
    if (!fs.existsSync(item.from)) continue;
    await fsp.rm(item.to, { recursive: true, force: true });
    await fsp.mkdir(path.dirname(item.to), { recursive: true });
    await fsp.cp(item.from, item.to, { recursive: true });
  }

  for (const item of configMappings) {
    if (!fs.existsSync(item.from)) continue;
    await fsp.mkdir(path.dirname(item.to), { recursive: true });
    await fsp.copyFile(item.from, item.to);
  }

  return snapshotDir;
}

function restoreDatabase(extractedDir) {
  const jsonPath = path.join(extractedDir, 'database', 'database.json');
  if (fs.existsSync(jsonPath)) {
    return restoreDatabaseFromJson(jsonPath);
  }

  const sqlPath = path.join(extractedDir, 'database', 'database.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error('Arquivo database/database.sql não encontrado no backup.');
  }

  const restoreScript = path.join(process.cwd(), 'restore_database.cjs');
  if (!fs.existsSync(restoreScript)) {
    throw new Error('Script restore_database.cjs não encontrado.');
  }

  execFileSync(process.execPath, [restoreScript, sqlPath, '--force'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });
}

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
}

function normalizeValueForColumn(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'json' || type === 'jsonb') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (type && type.startsWith('_') && Array.isArray(value)) {
    return value;
  }
  return value;
}

async function restoreDatabaseFromJson(snapshotPath) {
  const raw = await fsp.readFile(snapshotPath, 'utf8');
  const snapshot = JSON.parse(raw);
  if (!snapshot || !Array.isArray(snapshot.tables)) {
    throw new Error('Snapshot JSON do banco inválido.');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET session_replication_role = replica');

    const tableNames = snapshot.tables.map((table) => `"${table.name}"`);
    if (tableNames.length > 0) {
      await client.query(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`);
    }

    for (const table of snapshot.tables) {
      if (!Array.isArray(table.columns) || table.columns.length === 0 || !Array.isArray(table.rows) || table.rows.length === 0) {
        continue;
      }

      const columnNames = table.columns.map((column) => `"${column.name}"`);
      const placeholders = table.columns.map((_, index) => `$${index + 1}`);
      const insertQuery = `INSERT INTO "${table.name}" (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;

      for (const row of table.rows) {
        const values = table.columns.map((column) => normalizeValueForColumn(row[column.name], column.type));
        await client.query(insertQuery, values);
      }
    }

    await client.query('SET session_replication_role = DEFAULT');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function restoreFullBackup(backupPath) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'jag-full-restore-'));
  try {
    await extractZip(backupPath, tempDir);
    await restoreDatabase(tempDir);
    const filesBackupDir = await restoreFiles(tempDir);

    const backupsDir = ensureSystemBackupDir();
    await fsp.writeFile(path.join(backupsDir, 'latest_restored_full.txt'), backupPath, 'utf8');

    return { filesBackupDir };
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    const force = process.argv.includes('--force');
    if (!force) {
      console.error('⚠️ Restauração bloqueada: use --force para confirmar.');
      usage();
      process.exit(1);
    }

    const backupPath = resolveBackupArg();
    if (!backupPath) {
      console.error('❌ Backup completo não encontrado.');
      usage();
      process.exit(1);
    }

    console.log(`♻️ Restaurando backup completo: ${backupPath}`);
    const result = await restoreFullBackup(backupPath);
    console.log(`✅ Restauração completa concluída. Snapshot pré-restore de arquivos: ${result.filesBackupDir}`);
  } catch (error) {
    console.error(`❌ Falha na restauração completa: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  restoreFullBackup,
  resolveLatestBackup
};
