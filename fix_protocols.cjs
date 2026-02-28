const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function updateProtocols() {
  try {
    const result = await pool.query(`UPDATE agendamentos SET protocolo = 'AGD-' || id WHERE protocolo IS NULL`)
    console.log('✅ Protocolos atualizados:', result.rowCount, 'registros')
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

updateProtocols()
