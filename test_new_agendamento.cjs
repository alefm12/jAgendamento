const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function testNewAgendamento() {
  console.log('🔍 Testando criação de agendamento com notas, prioridade e histórico...\n')

  try {
    // Criar agendamento completo
    const insertQuery = `
      INSERT INTO agendamentos (
        prefeitura_id, local_id,
        cidadao_nome, cidadao_cpf, telefone, email,
        tipo_cin, numero_cin,
        endereco_rua, endereco_numero,
        regiao_tipo, regiao_nome, bairro_nome,
        data_agendamento, hora_agendamento, status,
        aceite_termos, aceite_notificacoes,
        notas, prioridade, historico_status
      ) VALUES (
        1, 1,
        'JOSE DA SILVA TESTE', '12345678901', '(88) 98888-8888', 'jose@teste.com',
        'RG', '1234567',
        'Rua Teste', '123',
        'sede', 'Sede Irauçuba', 'Centro',
        '2026-02-10', '14:00:00', 'pendente',
        true, true,
        $1, 'urgente', $2
      )
      RETURNING id, protocolo, notas, prioridade, historico_status, status
    `

    const notas = [
      { text: 'Cliente solicitou prioridade por questões de saúde', timestamp: new Date().toISOString(), addedBy: 'sistema' }
    ]

    const historico = [
      { status: 'pendente', timestamp: new Date().toISOString(), user: 'sistema', note: 'Agendamento criado com prioridade urgente' }
    ]

    const result = await pool.query(insertQuery, [JSON.stringify(notas), JSON.stringify(historico)])
    const agendamento = result.rows[0]

    console.log('✅ Agendamento criado com sucesso!')
    console.log('📋 ID:', agendamento.id)
    console.log('📋 Protocolo:', agendamento.protocolo)
    console.log('📋 Status:', agendamento.status)
    console.log('📋 Prioridade:', agendamento.prioridade)
    console.log('📋 Notas:', JSON.stringify(agendamento.notas, null, 2))
    console.log('📋 Histórico:', JSON.stringify(agendamento.historico_status, null, 2))

    console.log('\n🔍 Verificando todos os agendamentos no banco...')
    const checkQuery = `
      SELECT id, protocolo, cidadao_nome, status, prioridade, 
             notas, historico_status, data_agendamento, hora_agendamento
      FROM agendamentos
      ORDER BY id DESC
      LIMIT 5
    `
    const checkResult = await pool.query(checkQuery)
    
    console.log(`\n📊 Total de agendamentos: ${checkResult.rows.length}`)
    checkResult.rows.forEach(apt => {
      console.log(`\n  ID: ${apt.id}`)
      console.log(`  Protocolo: ${apt.protocolo}`)
      console.log(`  Nome: ${apt.cidadao_nome}`)
      console.log(`  Data: ${apt.data_agendamento} às ${apt.hora_agendamento}`)
      console.log(`  Status: ${apt.status}`)
      console.log(`  Prioridade: ${apt.prioridade}`)
      console.log(`  Notas: ${apt.notas ? JSON.stringify(apt.notas) : 'sem notas'}`)
      console.log(`  Histórico: ${apt.historico_status ? JSON.stringify(apt.historico_status).substring(0, 100) + '...' : 'sem histórico'}`)
    })

  } catch (error) {
    console.error('❌ Erro ao testar:', error.message)
  } finally {
    await pool.end()
  }
}

testNewAgendamento()
