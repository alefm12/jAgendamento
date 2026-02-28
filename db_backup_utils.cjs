const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');

function ensureDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definida no .env');
  }
  return databaseUrl;
}

function getPgBin(command) {
  const customBin = process.env.PG_BIN;
  if (!customBin) return command;
  return path.join(customBin, command);
}

function runCommand(command) {
  execSync(command, { stdio: 'inherit', shell: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureBackupDir() {
  const backupDir = path.join(__dirname, 'backups', 'database');
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toPgArrayLiteral(arr) {
  const escaped = arr.map((item) => {
    if (item === null || item === undefined) return 'NULL';
    const text = String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${text}"`;
  });
  return `'{${escaped.join(',')}}'`;
}

function toSqlLiteral(value, columnType) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return quoteLiteral(value.toISOString());

  const type = (columnType || '').toLowerCase();

  if (Array.isArray(value)) {
    if (type === 'json' || type === 'jsonb') {
      return `${quoteLiteral(JSON.stringify(value))}::${type}`;
    }

    if (type.startsWith('_') && value.length === 1 && typeof value[0] === 'string') {
      let possibleArrayLiteral = String(value[0]).trim();
      while (
        possibleArrayLiteral.length >= 2 &&
        (
          (possibleArrayLiteral.startsWith("'") && possibleArrayLiteral.endsWith("'")) ||
          (possibleArrayLiteral.startsWith('"') && possibleArrayLiteral.endsWith('"'))
        )
      ) {
        possibleArrayLiteral = possibleArrayLiteral.slice(1, -1).trim();
      }

      if (possibleArrayLiteral.startsWith('{') && possibleArrayLiteral.endsWith('}')) {
        return `${quoteLiteral(possibleArrayLiteral)}::${type}`;
      }
    }

    return `${quoteLiteral(toPgArrayLiteral(value))}::${type || 'text[]'}`;
  }

  if (typeof value === 'object') {
    if (type === 'json' || type === 'jsonb') {
      return `${quoteLiteral(JSON.stringify(value))}::${type}`;
    }
    return quoteLiteral(JSON.stringify(value));
  }

  if (type.startsWith('_')) {
    let normalized = String(value).trim();
    while (
      normalized.length >= 2 &&
      (
        (normalized.startsWith("'") && normalized.endsWith("'")) ||
        (normalized.startsWith('"') && normalized.endsWith('"'))
      )
    ) {
      normalized = normalized.slice(1, -1).trim();
    }
    return `${quoteLiteral(normalized)}::${type}`;
  }

  if (type === 'json' || type === 'jsonb') {
    return `${quoteLiteral(String(value))}::${type}`;
  }

  return quoteLiteral(value);
}

async function createSqlBackupFallback(filePath) {
  const pool = getPool();
  try {
    const tableList = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const lines = [];
    lines.push('-- Backup SQL fallback (gerado via node/pg)');
    lines.push(`-- Gerado em: ${new Date().toISOString()}`);
    lines.push('BEGIN;');
    lines.push('SET session_replication_role = replica;');

    const tableNames = tableList.rows.map((r) => r.table_name);
    if (tableNames.length > 0) {
      const truncates = tableNames.map((t) => `"${t}"`).join(', ');
      lines.push(`TRUNCATE TABLE ${truncates} RESTART IDENTITY CASCADE;`);
    }

    for (const tableName of tableNames) {
      const colRes = await pool.query(
        `SELECT column_name, udt_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position`,
        [tableName]
      );

      const columns = colRes.rows.map((r) => r.column_name);
      const types = colRes.rows.map((r) => r.udt_name);
      if (columns.length === 0) continue;

      const rowsRes = await pool.query(`SELECT * FROM "${tableName}"`);
      if (rowsRes.rowCount === 0) continue;

      const colSql = columns.map((c) => `"${c}"`).join(', ');

      for (const row of rowsRes.rows) {
        const valuesSql = columns
          .map((col, idx) => toSqlLiteral(row[col], types[idx]))
          .join(', ');
        lines.push(`INSERT INTO "${tableName}" (${colSql}) VALUES (${valuesSql});`);
      }
    }

    lines.push('SET session_replication_role = DEFAULT;');
    lines.push('COMMIT;');

    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  } finally {
    await pool.end();
  }
}

async function createBackup(label = 'manual') {
  const databaseUrl = ensureDatabaseUrl();
  const backupDir = ensureBackupDir();
  const fileName = `backup_${label}_${timestamp()}.sql`;
  const backupFile = path.join(backupDir, fileName);

  const pgDump = getPgBin('pg_dump');
  const command = `"${pgDump}" --no-owner --no-privileges --encoding=UTF8 --format=plain --file "${backupFile}" "${databaseUrl}"`;

  try {
    runCommand(command);
  } catch (error) {
    console.warn('⚠️ Falha no pg_dump. Usando fallback via node/pg...');
    await createSqlBackupFallback(backupFile);
  }

  fs.writeFileSync(path.join(backupDir, 'latest.txt'), backupFile, 'utf8');
  return backupFile;
}

function getLatestBackupFile() {
  const backupDir = ensureBackupDir();
  const latestFile = path.join(backupDir, 'latest.txt');
  if (!fs.existsSync(latestFile)) return null;
  const filePath = fs.readFileSync(latestFile, 'utf8').trim();
  if (!filePath || !fs.existsSync(filePath)) return null;
  return filePath;
}

module.exports = {
  createBackup,
  getLatestBackupFile,
  getPgBin,
  runCommand,
  ensureDatabaseUrl
};

