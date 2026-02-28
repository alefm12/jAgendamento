const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jagendamento',
  user: 'postgres',
  password: '123'
});

async function checkLocaisTable() {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'locais_atendimento'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== COLUNAS DE locais_atendimento ===');
    console.log(cols.rows);
    
    const data = await pool.query(`SELECT * FROM locais_atendimento LIMIT 5`);
    console.log('\n=== DADOS ===');
    console.log(data.rows);
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

checkLocaisTable();
