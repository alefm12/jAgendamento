const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

pool.query('SELECT id, protocolo, cidadao_nome FROM agendamentos WHERE id = 8')
  .then(result => {
    if (result.rows.length > 0) {
      console.log('Agendamento ID 8 no banco:')
      console.log('  ID:', result.rows[0].id)
      console.log('  Protocolo:', result.rows[0].protocolo)
      console.log('  Nome:', result.rows[0].cidadao_nome)
    } else {
      console.log('Agendamento ID 8 não encontrado')
    }
    pool.end()
  })
  .catch(err => {
    console.error('Erro:', err.message)
    pool.end()
  })
