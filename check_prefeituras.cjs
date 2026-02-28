const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function checkPrefeituras() {
  try {
    const result = await pool.query('SELECT * FROM prefeituras')
    console.log('📋 Prefeituras cadastradas:')
    result.rows.forEach(p => {
      console.log(`  ID ${p.id}: ${p.nome || p.nome_prefeitura} (slug: "${p.slug}") - ${p.ativo ? 'ATIVA' : 'INATIVA'}`)
    })

    if (result.rows.length === 0) {
      console.log('\n❌ Nenhuma prefeitura cadastrada!')
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

checkPrefeituras()
