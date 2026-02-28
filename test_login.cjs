const fetch = require('node-fetch')

async function testLogin() {
  try {
    const response = await fetch('http://localhost:4000/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-prefeitura-slug': 'iraucuba'
      },
      body: JSON.stringify({
        identifier: 'alefifce@gmail.com',
        senha: 'senha123'
      })
    })

    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Login bem-sucedido!')
      console.log('Dados retornados:', JSON.stringify(data, null, 2))
    } else {
      console.log('❌ Falha no login:', response.status, response.statusText)
      console.log('Mensagem:', data.message || data)
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

testLogin()
