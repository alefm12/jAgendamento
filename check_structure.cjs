const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jagendamento',
  user: 'postgres',
  password: '123'
});

async function checkTables() {
  try {
    // Verificar estrutura de localidades_origem
    const loc = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'localidades_origem'
      ORDER BY ordinal_position
    `);
    console.log('\n=== COLUNAS DE localidades_origem ===');
    console.log(loc.rows);
    
    // Verificar estrutura de bairros
    const bairros = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bairros'
      ORDER BY ordinal_position
    `);
    console.log('\n=== COLUNAS DE bairros ===');
    console.log(bairros.rows);
    
    // Verificar estrutura de datas_bloqueadas
    const bloq = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'datas_bloqueadas'
      ORDER BY ordinal_position
    `);
    console.log('\n=== COLUNAS DE datas_bloqueadas ===');
    console.log(bloq.rows);
    
    // Verificar estrutura de agendamentos
    const agend = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agendamentos'
      ORDER BY ordinal_position
    `);
    console.log('\n=== COLUNAS DE agendamentos ===');
    console.log(agend.rows);
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
