const fetch = require('node-fetch')

async function testDelete() {
  try {
    // Aguardar backend iniciar
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log('🗑️ Testando DELETE de agendamento...')
    console.log('Tentando excluir agendamento ID: 6')
    
    const response = await fetch('http://localhost:4000/api/agendamentos/6', {
      method: 'DELETE',
      headers: {
        'x-prefeitura-slug': 'iraucuba'
      }
    })

    console.log('Status:', response.status, response.statusText)
    
    if (response.status === 204) {
      console.log('✅ Agendamento excluído com sucesso!')
    } else if (response.status === 404) {
      console.log('⚠️ Agendamento não encontrado (já foi excluído ou ID inválido)')
    } else {
      const error = await response.text()
      console.log('❌ Erro:', error)
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message)
  }
}

testDelete()
