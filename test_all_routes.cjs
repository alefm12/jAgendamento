const fetch = require('node-fetch')

async function testAll() {
  try {
    console.log('📍 Testando /api/locais-atendimento')
    let response = await fetch('http://localhost:4000/api/locais-atendimento')
    console.log('Status:', response.status)
    let data = await response.json()
    console.log('Locais:', data.length, 'registros\n')

    console.log('🏘️ Testando /api/localidades-origem')
    response = await fetch('http://localhost:4000/api/localidades-origem')
    console.log('Status:', response.status)
    data = await response.json()
    console.log('Localidades:', JSON.stringify(data, null, 2))

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

testAll()
