const http = require('http');

console.log('\n=== TESTE DE VALIDAÇÃO DE CÓDIGO ===\n');

// Função helper para fazer requisições
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function test() {
  try {
    // 1. Solicitar código
    console.log('1️⃣  Solicitando código de cancelamento para agendamento ID 15...');
    const res1 = await makeRequest('POST', '/api/agendamentos/15/solicitar-cancelamento');
    console.log('   Status:', res1.statusCode);
    console.log('   Resposta:', JSON.stringify(res1.data, null, 2));
    
    const codigoGerado = res1.data.developmentCode;
    console.log(`\n✅ Código gerado: ${codigoGerado}\n`);
    
    // 2. Tentar com código ERRADO
    console.log('2️⃣  Tentando cancelar com código ERRADO (123456)...');
    try {
      const res2 = await makeRequest('POST', '/api/agendamentos/15/confirmar-cancelamento', { code: '123456' });
      console.log('   Status:', res2.statusCode);
      console.log('   Resposta:', JSON.stringify(res2.data, null, 2));
      
      if (res2.statusCode === 400) {
        console.log('✅ CORRETO: Sistema rejeitou código errado!\n');
      } else {
        console.log('❌ FALHA: Sistema aceitou código errado!\n');
      }
    } catch (error) {
      console.log('✅ CORRETO: Requisição rejeitada\n');
    }
    
    // 3. Tentar com código CORRETO
    console.log(`3️⃣  Tentando cancelar com código CORRETO (${codigoGerado})...`);
    const res3 = await makeRequest('POST', '/api/agendamentos/15/confirmar-cancelamento', { code: codigoGerado });
    console.log('   Status:', res3.statusCode);
    console.log('   Resposta:', JSON.stringify(res3.data, null, 2));
    
    if (res3.statusCode === 200 && res3.data.success) {
      console.log('\n✅ SUCESSO: Agendamento cancelado com o código correto!\n');
    } else {
      console.log('\n❌ FALHA: Não conseguiu cancelar com código correto\n');
    }
    
    console.log('=== FIM DO TESTE ===\n');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message, '\n');
    console.log('Verifique se o servidor está rodando na porta 4000\n');
  }
}

test();
