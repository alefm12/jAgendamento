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
      `INSERT INTO localidades_origem (prefeitura_id, nome, tipo, ativo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, tipo`,
      [prefeituraId, 'Missi', 'distrito', true]
    );
    console.log('\n=== LOCALIDADE INSERIDA ===');
    console.log(localidadeRes.rows[0]);
    
    const localidadeId = localidadeRes.rows[0].id;
    
    // 3. Inserir bairro "Bueno" vinculado a Missi
    const bairroRes = await pool.query(
      `INSERT INTO bairros (localidade_id, nome, ativo)
       VALUES ($1, $2, $3)
       RETURNING id, nome`,
      [localidadeId, 'Bueno', true]
    );
    console.log('\n=== BAIRRO INSERIDO ===');
    console.log(bairroRes.rows[0]);
    
    // 4. Bloquear data 28/01/2026
    const bloqueioRes = await pool.query(
      `INSERT INTO datas_bloqueadas (prefeitura_id, data, motivo, bloqueio_total, criado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, data, motivo`,
      [prefeituraId, '2026-01-28', 'Teste de bloqueio - dia inteiro', true, 'ALEF MATHEUS TEIXEIRA DE SOUSA']
    );
    console.log('\n=== DATA BLOQUEADA ===');
    console.log(bloqueioRes.rows[0]);
    
    // 5. Inserir agendamento para 29/01/2026 08:30
    const agendamentoRes = await pool.query(
      `INSERT INTO agendamentos (
        prefeitura_id, nome_completo, cpf, email, telefone, data_agendamento, 
        horario, tipo_documento, local_atendimento, regiao_tipo, regiao_nome, 
        endereco_completo, bairro, termos_aceitos, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, nome_completo, data_agendamento, horario, status`,
      [
        prefeituraId,
        'ALEF MATHEUS TEIXEIRA DE SOUSA',
        '09296467381',
        'alefifce@gmail.com',
        '',  // telefone vazio
        '2026-01-29',
        '08:30',
        '1ª VIA CIN',
        'Sede',  // local_atendimento
        'distrito',  // regiao_tipo
        'Missi',  // regiao_nome
        'Rua 10, 20',  // endereco_completo
        'Bueno',
        true,  // termos_aceitos
        'pendente'
      ]
    );
    console.log('\n=== AGENDAMENTO INSERIDO ===');
    console.log(agendamentoRes.rows[0]);
    
    console.log('\n✅ TODOS OS DADOS FORAM INSERIDOS COM SUCESSO!\n');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testInsertData();
