const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('📋 Executando migration 012_cpf_cancelamentos_bloqueios.sql...\n');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'server/migrations/012_cpf_cancelamentos_bloqueios.sql'),
      'utf8'
    );
    
    await pool.query(sql);
    
    console.log('✅ Tabelas criadas com sucesso!');
    console.log('   - cpf_cancelamentos');
    console.log('   - cpf_bloqueios');
    console.log('\n✅ Migration concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
