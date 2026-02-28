const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createBackup } = require('./db_backup_utils.cjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('📦 Criando backup automático antes da migration...');
    const backupFile = await createBackup('pre_migration_014');
    console.log(`✅ Backup criado: ${backupFile}\n`);

    console.log('📋 Executando migration 014_schema_full_safe.sql...\n');

    const sql = fs.readFileSync(
      path.join(__dirname, 'server/migrations/014_schema_full_safe.sql'),
      'utf8'
    );

    await pool.query(sql);

    console.log('✅ Migration 014 aplicada com sucesso!');
    console.log('✅ Estrutura completa garantida sem apagar dados.');
  } catch (error) {
    console.error('❌ Erro ao executar migration 014:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();

