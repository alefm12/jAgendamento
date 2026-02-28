const http = require('http')

const makeRequest = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-prefeitura-slug': 'iraucuba'
      }
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(body ? JSON.parse(body) : null)
          } catch {
            resolve(body)
          }
        } else {
          reject(new Error(`${res.statusCode}: ${body}`))
        }
      })
    })

    req.on('error', reject)
    if (data) req.write(JSON.stringify(data))
    req.end()
  })
}

async function test() {
  console.log('\n🔍 TESTANDO INTEGRAÇÃO FRONTEND-BACKEND POSTGRESQL\n')

  try {
    // 1. Testar GET /agendamentos
    console.log('1️⃣ Testando GET /agendamentos...')
    const appointments = await makeRequest('GET', '/agendamentos')
    console.log(`   ✅ ${appointments.length} agendamentos encontrados`)
    if (appointments.length > 0) {
      console.log(`   📋 Primeiro agendamento: ${appointments[0].name || appointments[0].fullName} - ${appointments[0].date}`)
    }

    // 2. Testar GET /datas-bloqueadas
    console.log('\n2️⃣ Testando GET /datas-bloqueadas...')
    const blockedDates = await makeRequest('GET', '/datas-bloqueadas')
    console.log(`   ✅ ${blockedDates.length} datas bloqueadas encontradas`)
    if (blockedDates.length > 0) {
      console.log(`   📅 Primeira data: ${blockedDates[0].date} - ${blockedDates[0].reason}`)
    }

    // 3. Testar GET /locais-atendimento
    console.log('\n3️⃣ Testando GET /locais-atendimento...')
    const locations = await makeRequest('GET', '/locais-atendimento')
    console.log(`   ✅ ${locations.length} locais encontrados`)
    if (locations.length > 0) {
      console.log(`   📍 Primeiro local: ${locations[0].nome}`)
    }

    // 4. Testar GET /localidades-origem
    console.log('\n4️⃣ Testando GET /localidades-origem...')
    const origins = await makeRequest('GET', '/localidades-origem')
    console.log(`   ✅ ${origins.length} localidades encontradas`)
    console.log(`   🏘️ Distritos: ${origins.filter(l => l.tipo === 'distrito').length}`)
    console.log(`   🏘️ Bairros: ${origins.filter(l => l.tipo === 'bairro').length}`)

    // 5. Testar GET /system-config
    console.log('\n5️⃣ Testando GET /system-config...')
    const config = await makeRequest('GET', '/system-config')
    console.log(`   ✅ Configuração carregada: ${config.systemName}`)

    // 6. Testar GET /secretary-users
    console.log('\n6️⃣ Testando GET /secretary-users...')
    const users = await makeRequest('GET', '/secretary-users')
    console.log(`   ✅ ${users.length} usuários encontrados`)

    console.log('\n✅ TODOS OS TESTES PASSARAM! Frontend está integrado com PostgreSQL\n')
  } catch (error) {
    console.error('\n❌ ERRO:', error.message)
    process.exit(1)
  }
}

test()
