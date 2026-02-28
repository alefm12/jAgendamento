require('dotenv').config();
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { Pool } = require('pg');
const { createBackup, ensureDatabaseUrl } = require('./db_backup_utils.cjs');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureSystemBackupDir() {
  const dir = path.join(process.cwd(), 'backups', 'system');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function zipDirectory(sourceDir, outFile) {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.cp(source, target, { recursive: true });
  return true;
}

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
}

async function createDatabaseJsonSnapshot(filePath) {
  const pool = getPool();
  try {
    const tableList = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = [];

    for (const entry of tableList.rows) {
      const tableName = entry.table_name;
      const colRes = await pool.query(
        `SELECT column_name, udt_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position`,
        [tableName]
      );

      const columns = colRes.rows.map((col) => ({
        name: col.column_name,
        type: col.udt_name
      }));

      const rowsRes = await pool.query(`SELECT * FROM "${tableName}"`);

      tables.push({
        name: tableName,
        columns,
        rows: rowsRes.rows
      });
    }

    const snapshot = {
      version: 1,
      generatedAt: new Date().toISOString(),
      type: 'jagendamento-db-json-snapshot',
      tables
    };

    await fsp.writeFile(filePath, JSON.stringify(snapshot), 'utf8');
  } finally {
    await pool.end();
  }
}

async function createFullBackup(label = 'manual') {
  ensureDatabaseUrl();
  const systemBackupDir = ensureSystemBackupDir();

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'jag-full-backup-'));
  const dbDir = path.join(workDir, 'database');
  const uploadsDir = path.join(workDir, 'uploads');
  const configDir = path.join(workDir, 'config');
  const metaDir = path.join(workDir, 'meta');

  await Promise.all([
    fsp.mkdir(dbDir, { recursive: true }),
    fsp.mkdir(uploadsDir, { recursive: true }),
    fsp.mkdir(configDir, { recursive: true }),
    fsp.mkdir(metaDir, { recursive: true }),
  ]);

  let dbBackupPath = null;
  const included = {
    database: null,
    uploads: [],
    configFiles: []
  };

  try {
    dbBackupPath = await createBackup(`full_${label}`);
    const dbTarget = path.join(dbDir, 'database.sql');
    await fsp.copyFile(dbBackupPath, dbTarget);
    included.database = 'database/database.sql';

    const dbJsonTarget = path.join(dbDir, 'database.json');
    await createDatabaseJsonSnapshot(dbJsonTarget);
    included.databaseJson = 'database/database.json';

    const uploadCandidates = [
      {
        source: path.join(process.cwd(), 'client', 'public', 'uploads'),
        target: path.join(uploadsDir, 'client-public-uploads')
      },
      {
        source: path.join(process.cwd(), 'public', 'uploads'),
        target: path.join(uploadsDir, 'public-uploads')
      }
    ];

    for (const item of uploadCandidates) {
      const copied = await copyIfExists(item.source, item.target);
      if (copied) {
        included.uploads.push(path.relative(workDir, item.target).replace(/\\/g, '/'));
      }
    }

    const configCandidates = [
      '.env',
      'runtime.config.json',
      'theme.json',
      'tailwind.config.js',
      'components.json'
    ];

    for (const fileName of configCandidates) {
      const source = path.join(process.cwd(), fileName);
      const target = path.join(configDir, fileName);
      if (fs.existsSync(source)) {
        await fsp.copyFile(source, target);
        included.configFiles.push(`config/${fileName}`);
      }
    }

    const meta = {
      version: 1,
      type: 'jagendamento-full-backup',
      createdAt: new Date().toISOString(),
      label,
      includes: included
    };

    await fsp.writeFile(path.join(metaDir, 'manifest.json'), JSON.stringify(meta, null, 2), 'utf8');

    const zipName = `full_backup_${label}_${timestamp()}.zip`;
    const zipPath = path.join(systemBackupDir, zipName);
    await zipDirectory(workDir, zipPath);

    await fsp.writeFile(path.join(systemBackupDir, 'latest_full.txt'), zipPath, 'utf8');
    return zipPath;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    const labelArg = String(process.argv[2] || 'manual').trim().toLowerCase();
    const safeLabel = labelArg.replace(/[^a-z0-9_-]/g, '') || 'manual';
    const backupPath = await createFullBackup(safeLabel);
    console.log(`✅ Backup completo gerado: ${backupPath}`);
  } catch (error) {
    console.error(`❌ Falha no backup completo: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createFullBackup,
  ensureSystemBackupDir
};
