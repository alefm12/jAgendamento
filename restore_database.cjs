require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');
const {
  createBackup,
  getLatestBackupFile,
  getPgBin,
  runCommand,
  ensureDatabaseUrl
} = require('./db_backup_utils.cjs');

function usage() {
  console.log('Uso: node restore_database.cjs [caminho_do_backup.sql] [--force]');
  console.log('Se não informar arquivo, usa o último backup (latest.txt).');
}

function resolveBackupArg() {
  const args = process.argv.slice(2).filter((a) => a !== '--force');
  if (args.length === 0) return getLatestBackupFile();
  const candidate = path.resolve(process.cwd(), args[0]);
  return fs.existsSync(candidate) ? candidate : null;
}

async function runRestoreFallback(databaseUrl, restoreFile) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  try {
    const sql = fs.readFileSync(restoreFile, 'utf8');
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

function hasPsqlBinary(psqlBinary) {
  try {
    execSync(`"${psqlBinary}" --version`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  try {
  ensureDatabaseUrl();
  const force = process.argv.includes('--force');

  if (!force) {
    console.error('⚠️ Restauração bloqueada: use --force para confirmar.');
    usage();
    process.exit(1);
  }

  const restoreFile = resolveBackupArg();
  if (!restoreFile) {
    console.error('❌ Arquivo de backup não encontrado.');
    usage();
    process.exit(1);
  }

  console.log('📦 Criando backup de segurança antes do restore...');
  const safetyBackup = await createBackup('pre_restore');
  console.log(`✅ Backup de segurança: ${safetyBackup}`);

  const databaseUrl = process.env.DATABASE_URL;
  const psql = getPgBin('psql');
  const command = `"${psql}" "${databaseUrl}" -v ON_ERROR_STOP=1 -f "${restoreFile}"`;

  console.log(`♻️ Restaurando backup: ${restoreFile}`);
  if (!hasPsqlBinary(psql)) {
    console.warn('⚠️ psql não encontrado. Usando restore fallback via node/pg...');
    await runRestoreFallback(databaseUrl, restoreFile);
  } else {
    runCommand(command);
  }
  console.log('✅ Restore concluído com sucesso.');
}
  catch (error) {
    console.error(`❌ Falha no restore: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
