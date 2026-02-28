const fetch = require('node-fetch')

async function testLogin() {
  try {
    console.log('🔐 Testando login...')
    const response = await fetch('http://localhost:4000/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-prefeitura-slug': 'iraucuba'
      },
      body: JSON.stringify({
        identifier: 'alefifce@gmail.com',
        senha: 'admin123'
      })
    })

    console.log('Status:', response.status, response.statusText)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Login bem-sucedido!')
      console.log('Dados:', JSON.stringify(data, null, 2))
    } else {
      const error = await response.json()
      console.log('❌ Erro no login:', error)
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message)
  }
}

testLogin()
