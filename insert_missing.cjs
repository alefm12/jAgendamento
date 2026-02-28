const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jagendamento',
  user: 'postgres',
  password: '123'
});

async function insertMissingData() {
  try {
    const prefeituraId = 1;
    
    // 1. Buscar ID da localidade Missi
    const missi = await pool.query(
      `SELECT id FROM localidades_origem WHERE prefeitura_id = $1 AND nome = $2`,
      [prefeituraId, 'Missi']
    );
    const missiId = missi.rows[0].id;
    console.log('ID de Missi:', missiId);
    
    // 2. Inserir bairro Bueno
    try {
      const bairro = await pool.query(
        `INSERT INTO bairros (prefeitura_id, localidade_id, nome)
         VALUES ($1, $2, $3)
         RETURNING id, nome`,
        [prefeituraId, missiId, 'Bueno']
      );
      console.log('\n✅ Bairro Bueno inserido:', bairro.rows[0]);
    } catch (e) {
      if (e.code === '23505') {
        console.log('\n⚠ Bairro Bueno já existe');
      } else throw e;
    }
    
    // 3. Bloquear data 28/01/2026
    try {
      const bloqueio = await pool.query(
        `INSERT INTO datas_bloqueadas (prefeitura_id, data, motivo, tipo_bloqueio, criado_por)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, data, motivo`,
        [prefeituraId, '2026-01-28', 'Teste de bloqueio - dia inteiro', 'completo', 'ALEF MATHEUS TEIXEIRA DE SOUSA']
      );
      console.log('\n✅ Data bloqueada:', bloqueio.rows[0]);
    } catch (e) {
      if (e.code === '23505') {
        console.log('\n⚠ Data 28/01/2026 já está bloqueada');
      } else throw e;
    }
    
    // 4. Buscar ou criar local de atendimento
    let localRes = await pool.query(
      `SELECT id FROM locais_atendimento WHERE prefeitura_id = $1 LIMIT 1`,
      [prefeituraId]
    );
    
    let localId;
    if (localRes.rows.length === 0) {
      const newLocal = await pool.query(
        `INSERT INTO locais_atendimento (prefeitura_id, nome, endereco)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [prefeituraId, 'Sede', 'Av. Principal, S/N']
      );
      localId = newLocal.rows[0].id;
      console.log('\n✅ Local de atendimento criado: ID', localId);
    } else {
      localId = localRes.rows[0].id;
      console.log('\nUsando local de atendimento existente: ID', localId);
    }
    
    // 5. Inserir agendamento
    try {
      const agendamento = await pool.query(
        `INSERT INTO agendamentos (
          prefeitura_id, local_id, cidadao_nome, cidadao_cpf, telefone, email, 
          data_agendamento, hora_agendamento, tipo_cin, regiao_tipo, regiao_nome, 
          endereco_rua, endereco_numero, bairro_nome, aceite_termos, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, protocolo, cidadao_nome, data_agendamento, hora_agendamento`,
        [
          prefeituraId,
          localId,
          'ALEF MATHEUS TEIXEIRA DE SOUSA',
          '09296467381',
          '(88) 99999-9999',
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
      console.log('\n✅ Agendamento inserido:');
      console.log(agendamento.rows[0]);
    } catch (e) {
      if (e.code === '23505') {
        console.log('\n⚠ Agendamento já existe');
      } else throw e;
    }
    
    console.log('\n✅✅ PROCESSO CONCLUÍDO! ✅✅\n');
    console.log('DADOS INSERIDOS:');
    console.log('✓ Localidade: Missi (distrito)');
    console.log('✓ Bairro: Bueno (vinculado a Missi)');
    console.log('✓ Data bloqueada: 28/01/2026');
    console.log('✓ Agendamento: ALEF MATHEUS - 29/01/2026 às 08:30');
    console.log('\nAgora verifique no sistema em http://localhost:5000/iraucuba/admin\n');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

insertMissingData();
