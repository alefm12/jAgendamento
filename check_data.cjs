const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jagendamento',
  user: 'postgres',
  password: '123'
});

async function checkData() {
  try {
    const prefeituraId = 1;
    
    // 1. Verificar localidades
    const loc = await pool.query(
      `SELECT id, nome, tipo FROM localidades_origem WHERE prefeitura_id = $1`,
      [prefeituraId]
    );
    console.log('\n=== LOCALIDADES ===');
    console.log(loc.rows);
    
    // 2. Verificar bairros
    const bairros = await pool.query(
      `SELECT b.id, b.nome, l.nome as localidade 
       FROM bairros b 
       JOIN localidades_origem l ON b.localidade_id = l.id
       WHERE b.prefeitura_id = $1`,
      [prefeituraId]
    );
    console.log('\n=== BAIRROS ===');
    console.log(bairros.rows);
    
    // 3. Verificar datas bloqueadas
    const bloq = await pool.query(
      `SELECT id, data, motivo, tipo_bloqueio FROM datas_bloqueadas WHERE prefeitura_id = $1`,
      [prefeituraId]
    );
    console.log('\n=== DATAS BLOQUEADAS ===');
    console.log(bloq.rows);
    
    // 4. Verificar agendamentos
    const agend = await pool.query(
      `SELECT id, protocolo, cidadao_nome, data_agendamento, hora_agendamento, status 
       FROM agendamentos WHERE prefeitura_id = $1`,
      [prefeituraId]
    );
    console.log('\n=== AGENDAMENTOS ===');
    console.log(agend.rows);
    
    console.log('\n✅ Dados verificados com sucesso!\n');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();
