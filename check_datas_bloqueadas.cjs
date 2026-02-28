const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function checkTable() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'datas_bloqueadas' 
      ORDER BY ordinal_position
    `)
    
    if (result.rows.length === 0) {
      console.log('❌ Tabela datas_bloqueadas não existe!')
    } else {
      console.log('✅ Tabela datas_bloqueadas existe com colunas:')
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`)
      })
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

checkTable()
