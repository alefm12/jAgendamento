const { Pool } = require('pg')
const pool = new Pool({connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'})
pool.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='datas_bloqueadas' AND column_name='local_id'`).then(r => {
  console.log('Coluna local_id:', r.rows[0])
  pool.end()
})
