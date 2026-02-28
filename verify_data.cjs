const { Pool } = require('pg')

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'agendamento_cin',
  password: 'alefmatheus10',
  port: 5432
})

async function verify() {
  try {
    console.log('\n🔍 VERIFICANDO DADOS NO POSTGRESQL\n')

    // Verificar prefeitura
    const prefRes = await pool.query('SELECT id, nome, slug, ativa FROM prefeituras LIMIT 5')
    console.log('📍 Prefeituras:')
    prefRes.rows.forEach(p => console.log(`   ID ${p.id}: ${p.nome} (${p.slug}) - Ativa: ${p.ativa}`))

    // Verificar agendamentos
    const agendRes = await pool.query(`
      SELECT id, prefeitura_id, cidadao_nome, data_agendamento, hora_agendamento, status, protocolo
      FROM agendamentos 
      ORDER BY criado_em DESC
      LIMIT 10
    `)
    console.log('\n📅 Agendamentos:')
    if (agendRes.rows.length === 0) {
      console.log('   ⚠️ Nenhum agendamento encontrado!')
    } else {
      agendRes.rows.forEach(a => {
        console.log(`   ID ${a.id} [Pref ${a.prefeitura_id}]: ${a.cidadao_nome} - ${a.data_agendamento} ${a.hora_agendamento} - ${a.status}`)
      })
    }

    // Verificar datas bloqueadas
    const blockRes = await pool.query(`
      SELECT id, prefeitura_id, data, motivo, tipo_bloqueio
      FROM datas_bloqueadas
      ORDER BY data DESC
      LIMIT 10
    `)
    console.log('\n🚫 Datas Bloqueadas:')
    if (blockRes.rows.length === 0) {
      console.log('   ⚠️ Nenhuma data bloqueada!')
    } else {
      blockRes.rows.forEach(d => {
        console.log(`   ID ${d.id} [Pref ${d.prefeitura_id}]: ${d.data} - ${d.motivo}`)
      })
    }

    // Verificar locais
    const locaisRes = await pool.query('SELECT id, prefeitura_id, nome_local, ativo FROM locais_atendimento LIMIT 10')
    console.log('\n📍 Locais de Atendimento:')
    locaisRes.rows.forEach(l => console.log(`   ID ${l.id} [Pref ${l.prefeitura_id}]: ${l.nome_local} - Ativo: ${l.ativo}`))

    console.log('\n')
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

verify()
