const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jagendamento',
  user: 'postgres',
  password: '123'
});

async function testInsertData() {
  try {
    // 1. Verificar ID da prefeitura Irauçuba
    const prefRes = await pool.query(`SELECT id, nome, slug FROM prefeituras WHERE slug = 'iraucuba'`);
    console.log('\n=== PREFEITURA ===');
    console.log(prefRes.rows);
    
    if (prefRes.rows.length === 0) {
      console.log('ERRO: Prefeitura Irauçuba não encontrada!');
      return;
    }
    
    const prefeituraId = prefRes.rows[0].id;
    console.log(`\nUsando prefeitura_id: ${prefeituraId}`);
    
    // 2. Inserir localidade de origem "Missi" (distrito)
    const localidadeRes = await pool.query(
      `INSERT INTO localidades_origem (prefeitura_id, nome, tipo)
       VALUES ($1, $2, $3)
       RETURNING id, nome, tipo`,
      [prefeituraId, 'Missi', 'distrito']
    );
    console.log('\n=== LOCALIDADE INSERIDA ===');
    console.log(localidadeRes.rows[0]);
    
    const localidadeId = localidadeRes.rows[0].id;
    
    // 3. Inserir bairro "Bueno" vinculado a Missi
    const bairroRes = await pool.query(
      `INSERT INTO bairros (prefeitura_id, localidade_id, nome)
       VALUES ($1, $2, $3)
       RETURNING id, nome`,
      [prefeituraId, localidadeId, 'Bueno']
    );
    console.log('\n=== BAIRRO INSERIDO ===');
    console.log(bairroRes.rows[0]);
    
    // 4. Bloquear data 28/01/2026 (dia inteiro - sem local específico, tipo_bloqueio = 'completo')
    const bloqueioRes = await pool.query(
      `INSERT INTO datas_bloqueadas (prefeitura_id, data, motivo, tipo_bloqueio, criado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, data, motivo, tipo_bloqueio`,
      [prefeituraId, '2026-01-28', 'Teste de bloqueio - dia inteiro', 'completo', 'ALEF MATHEUS TEIXEIRA DE SOUSA']
    );
    console.log('\n=== DATA BLOQUEADA ===');
    console.log(bloqueioRes.rows[0]);
    
    // 5. Precisamos de um local_id válido primeiro. Vamos buscar ou criar um local
    let localIdRes = await pool.query(
      `SELECT id, nome FROM locais_atendimento WHERE prefeitura_id = $1 LIMIT 1`,
      [prefeituraId]
    );
    
    let localId;
    if (localIdRes.rows.length === 0) {
      // Criar local padrão
      const newLocal = await pool.query(
        `INSERT INTO locais_atendimento (prefeitura_id, nome, endereco)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [prefeituraId, 'Sede', 'Av. Principal, S/N']
      );
      localId = newLocal.rows[0].id;
      console.log('\n=== LOCAL DE ATENDIMENTO CRIADO ===');
      console.log({ id: localId, nome: 'Sede' });
    } else {
      localId = localIdRes.rows[0].id;
      console.log('\n=== LOCAL DE ATENDIMENTO EXISTENTE ===');
      console.log(localIdRes.rows[0]);
    }
    
    // 6. Inserir agendamento para 29/01/2026 08:30
    const agendamentoRes = await pool.query(
      `INSERT INTO agendamentos (
        prefeitura_id, local_id, cidadao_nome, cidadao_cpf, email, 
        data_agendamento, hora_agendamento, tipo_cin, regiao_tipo, regiao_nome, 
        endereco_rua, endereco_numero, bairro_nome, aceite_termos, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, protocolo, cidadao_nome, data_agendamento, hora_agendamento, status`,
      [
        prefeituraId,
        localId,
        'ALEF MATHEUS TEIXEIRA DE SOUSA',
        '09296467381',
        'alefifce@gmail.com',
        '2026-01-29',
        '08:30:00',
        '1ª VIA CIN',
        'distrito',
        'Missi',
        'Rua 10',
        '20',
        'Bueno',
        true,
        'pendente'
      ]
    );
    console.log('\n=== AGENDAMENTO INSERIDO ===');
    console.log(agendamentoRes.rows[0]);
    
    console.log('\n✅ TODOS OS DADOS FORAM INSERIDOS COM SUCESSO!\n');
    console.log('RESUMO:');
    console.log('- Localidade "Missi" (distrito) criada');
    console.log('- Bairro "Bueno" vinculado a Missi');
    console.log('- Data 28/01/2026 bloqueada');
    console.log('- Agendamento para 29/01/2026 às 08:30 criado');
    console.log('\nAgora você pode verificar no sistema!');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testInsertData();
