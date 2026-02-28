const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function checkProtocols() {
  try {
    const result = await pool.query('SELECT id, protocolo, cidadao_nome FROM agendamentos ORDER BY id DESC LIMIT 5')
    console.log('📋 Últimos protocolos gerados:')
    result.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.protocolo} - ${row.cidadao_nome}`)
    })
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

checkProtocols()
