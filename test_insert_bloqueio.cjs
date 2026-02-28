const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function testInsert() {
  try {
    console.log('🧪 Testando INSERT direto no banco...')
    const result = await pool.query(
      `INSERT INTO datas_bloqueadas 
        (prefeitura_id, data, motivo, tipo_bloqueio, horarios_bloqueados, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [1, '2026-01-30', 'Teste direto', 'full-day', null, 'Admin']
    )
    
    console.log('✅ INSERT bem-sucedido!')
    console.log('Dados:', result.rows[0])
  } catch (error) {
    console.error('❌ Erro no INSERT:', error.message)
    console.error('Detail:', error.detail)
  } finally {
    await pool.end()
  }
}

testInsert()
