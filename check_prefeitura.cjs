const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jagendamento',
  user: 'postgres',
  password: '123'
});

async function checkPrefeitura() {
  try {
    const result = await pool.query(`
      SELECT id, nome, slug, ativo, criado_em 
      FROM prefeituras 
      WHERE slug = 'iraucuba'
    `);
    
    console.log('\n=== PREFEITURA IRAUÇUBA ===');
    console.log(result.rows);
    
    if (result.rows.length > 0) {
      const pref = result.rows[0];
      console.log('\nStatus:');
      console.log('- ID:', pref.id);
      console.log('- Nome:', pref.nome);
      console.log('- Slug:', pref.slug);
      console.log('- Ativo:', pref.ativo);
      console.log('- Criado:', pref.criado_em);
      
      if (!pref.ativo) {
        console.log('\n⚠️  PROBLEMA: Prefeitura está INATIVA!');
        console.log('Ativando prefeitura...');
        
        await pool.query(`UPDATE prefeituras SET ativo = true WHERE id = $1`, [pref.id]);
        console.log('✅ Prefeitura ativada com sucesso!');
      } else {
        console.log('\n✅ Prefeitura está ATIVA');
      }
    }
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkPrefeitura();
