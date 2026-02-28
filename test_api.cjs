async function testAPI() {
  const tests = [
    {
      name: 'GET /locais-atendimento',
      url: 'http://localhost:4000/api/locais-atendimento',
      headers: { 'x-prefeitura-slug': 'iraucuba' }
    },
    {
      name: 'GET /localidades-origem',
      url: 'http://localhost:4000/api/localidades-origem',
      headers: { 'x-prefeitura-slug': 'iraucuba' }
    },
    {
      name: 'GET /agendamentos',
      url: 'http://localhost:4000/api/agendamentos',
      headers: { 'x-prefeitura-slug': 'iraucuba' }
    },
    {
      name: 'GET /datas-bloqueadas',
      url: 'http://localhost:4000/api/datas-bloqueadas',
      headers: { 'x-prefeitura-slug': 'iraucuba' }
    }
  ];

  for (const test of tests) {
    console.log(`\n\n========== ${test.name} ==========`);
    console.log('URL:', test.url);
    console.log('Headers:', JSON.stringify(test.headers, null, 2));
    
    try {
      const response = await fetch(test.url, { headers: test.headers });
      console.log('Status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ ERRO:', error.message);
    }
  }
}

testAPI();
