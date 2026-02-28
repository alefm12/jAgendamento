const fetch = require('node-fetch')

async function testLocais() {
  try {
    const response = await fetch('http://localhost:4000/api/locais-atendimento', {
      headers: {
        'x-prefeitura-slug': 'iraucuba'
      }
    })

    console.log('Status:', response.status, response.statusText)
    const data = await response.json()
    console.log('Dados:', JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

testLocais()
