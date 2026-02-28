const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jagendamento',
  user: 'postgres',
  password: '123'
});

async function cleanupDuplicates() {
  try {
    const prefeituraId = 1;
    
    console.log('\n=== LOCAIS ATUAIS ===');
    const locais = await pool.query(`
      SELECT id, nome_local, endereco, tipo, ativo, criado_em 
      FROM locais_atendimento 
      WHERE prefeitura_id = $1
      ORDER BY id
    `, [prefeituraId]);
    
    console.log(locais.rows);
    
    // Manter apenas o primeiro registro (ID 1) e remover os duplicados (IDs 2, 3, 4)
    console.log('\n=== VERIFICANDO AGENDAMENTOS VINCULADOS ===');
    const agendamentos = await pool.query(`
      SELECT local_id, COUNT(*) as total
      FROM agendamentos
      WHERE prefeitura_id = $1 AND local_id IN (1, 2, 3, 4)
      GROUP BY local_id
    `, [prefeituraId]);
    
    console.log(agendamentos.rows);
    
    // Se houver agendamentos nos locais 2, 3, 4, vamos movê-los para o local 1
    if (agendamentos.rows.some(row => [2, 3, 4].includes(row.local_id))) {
      console.log('\n=== MOVENDO AGENDAMENTOS PARA LOCAL ID 1 ===');
      await pool.query(`
        UPDATE agendamentos 
        SET local_id = 1 
        WHERE prefeitura_id = $1 AND local_id IN (2, 3, 4)
      `, [prefeituraId]);
      console.log('✅ Agendamentos movidos!');
    }
    
    // Agora podemos excluir os locais duplicados
    console.log('\n=== REMOVENDO LOCAIS DUPLICADOS (IDs 2, 3, 4) ===');
    const result = await pool.query(`
      DELETE FROM locais_atendimento 
      WHERE prefeitura_id = $1 AND id IN (2, 3, 4)
      RETURNING id, nome_local
    `, [prefeituraId]);
    
    console.log('Removidos:', result.rows);
    
    console.log('\n=== LOCAIS FINAIS ===');
    const locaisFinais = await pool.query(`
      SELECT id, nome_local, endereco, tipo, ativo 
      FROM locais_atendimento 
      WHERE prefeitura_id = $1
      ORDER BY id
    `, [prefeituraId]);
    
    console.log(locaisFinais.rows);
    
    console.log('\n✅ LIMPEZA CONCLUÍDA!');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

cleanupDuplicates();
