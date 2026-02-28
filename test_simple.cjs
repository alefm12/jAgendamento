const http = require('http');

console.log('Testando conexão com servidor...');

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/health',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('✅ Servidor respondeu:', data);
    console.log('Status:', res.statusCode);
    
    // Agora testa a rota de cancelamento
    console.log('\nTestando rota de cancelamento...');
    const req2 = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/agendamentos/15/solicitar-cancelamento',
      method: 'POST',
      headers: {'Content-Type': 'application/json'}
    }, (res2) => {
      let data2 = '';
      res2.on('data', (chunk) => { data2 += chunk; });
      res2.on('end', () => {
        console.log('✅ Resposta:', data2);
        console.log('Status:', res2.statusCode);
      });
    });
    req2.on('error', (e) => {
      console.error('❌ Erro:', e.message);
    });
    req2.end();
  });
});

req.on('error', (e) => {
  console.error('❌ Erro:', e.message);
});

req.end();
