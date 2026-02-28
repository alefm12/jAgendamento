const fetch = require('node-fetch')

async function testBlockDate() {
  try {
    console.log('📅 Testando bloqueio de data...')
    const response = await fetch('http://localhost:4000/api/agendamentos/datas-bloqueadas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-prefeitura-slug': 'iraucuba'
      },
      body: JSON.stringify({
        date: '2026-01-29',
        reason: 'Teste de bloqueio',
        blockType: 'full-day',
        createdBy: 'Admin'
      })
    })

    console.log('Status:', response.status, response.statusText)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Data bloqueada com sucesso!')
      console.log('Resposta:', JSON.stringify(data, null, 2))
    } else {
      const error = await response.text()
      console.log('❌ Erro:', error)
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message)
  }
}

testBlockDate()
