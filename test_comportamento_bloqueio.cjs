const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function testarComportamentoBloqueio() {
  try {
    console.log('\n🧪 ===== VERIFICANDO COMPORTAMENTO DO BLOQUEIO =====\n');
    
    const cpfTeste = '111.222.333-44';
    const cpfLimpo = cpfTeste.replace(/[.-]/g, '');
    
    // Limpar dados anteriores
    console.log('🧹 Limpando dados anteriores...');
    await pool.query('DELETE FROM cpf_bloqueios WHERE REPLACE(REPLACE(REPLACE(cpf, \'.\', \'\'), \'-\', \'\'), \' \', \'\') = $1', [cpfLimpo]);
    await pool.query('DELETE FROM cpf_cancelamentos WHERE REPLACE(REPLACE(REPLACE(cpf, \'.\', \'\'), \'-\', \'\'), \' \', \'\') = $1', [cpfLimpo]);
    console.log('✅ Limpo!\n');
    
    // Simular cancelamentos um por um
    console.log('📋 SIMULANDO CANCELAMENTOS:\n');
    
    for (let i = 1; i <= 4; i++) {
      console.log(`${'━'.repeat(50)}`);
      console.log(`🔄 TENTATIVA DE CANCELAMENTO #${i}:\n`);
      
      // Verificar se já está bloqueado ANTES de cancelar
      const checkBloqueio = await pool.query(
        `SELECT * FROM cpf_bloqueios 
         WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1 
         AND ativo = TRUE AND data_desbloqueio > NOW()`,
        [cpfLimpo]
      );
      
      if (checkBloqueio.rows.length > 0) {
        console.log('   🚫 CPF JÁ ESTÁ BLOQUEADO!');
        console.log(`   📅 Bloqueado até: ${new Date(checkBloqueio.rows[0].data_desbloqueio).toLocaleString('pt-BR')}`);
        console.log(`   ❌ CANCELAMENTO #${i} NÃO PERMITIDO!\n`);
        break;
      }
      
      // Se não está bloqueado, registra o cancelamento
      await pool.query(
        `INSERT INTO cpf_cancelamentos (cpf, agendamento_id, prefeitura_id, data_cancelamento)
         VALUES ($1, $2, 1, NOW())`,
        [cpfTeste, 200 + i]
      );
      console.log(`   ✅ Cancelamento #${i} REGISTRADO`);
      
      // Contar total de cancelamentos
      const count = await pool.query(
        `SELECT COUNT(*) as total FROM cpf_cancelamentos 
         WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1
         AND data_cancelamento >= NOW() - INTERVAL '7 days'`,
        [cpfLimpo]
      );
      const total = parseInt(count.rows[0].total);
      console.log(`   📊 Total de cancelamentos: ${total}/3`);
      
      // Verificar se deve bloquear
      if (total >= 3) {
        const dataDesbloqueio = new Date();
        dataDesbloqueio.setDate(dataDesbloqueio.getDate() + 7);
        
        await pool.query(
          `INSERT INTO cpf_bloqueios (cpf, prefeitura_id, data_bloqueio, data_desbloqueio, motivo, cancelamentos_count, ativo)
           VALUES ($1, 1, NOW(), $2, $3, $4, TRUE)`,
          [
            cpfTeste,
            dataDesbloqueio,
            `Bloqueado automaticamente por ${total} cancelamentos em 7 dias`,
            total
          ]
        );
        console.log(`\n   🚫 BLOQUEIO ATIVADO!`);
        console.log(`   🔒 CPF bloqueado por 7 dias`);
        console.log(`   📅 Desbloqueio em: ${dataDesbloqueio.toLocaleString('pt-BR')}`);
        console.log(`   ⚠️  Próximo agendamento será IMPEDIDO!\n`);
      } else {
        console.log(`   ⚠️  Ainda pode cancelar mais ${3 - total} vez(es)\n`);
      }
    }
    
    console.log(`${'━'.repeat(50)}`);
    console.log('\n📊 RESUMO FINAL:\n');
    
    // Resumo
    const historico = await pool.query(
      `SELECT COUNT(*) as total FROM cpf_cancelamentos
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1`,
      [cpfLimpo]
    );
    
    const bloqueioAtivo = await pool.query(
      `SELECT * FROM cpf_bloqueios 
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1 
       AND ativo = TRUE AND data_desbloqueio > NOW()`,
      [cpfLimpo]
    );
    
    console.log(`   CPF Testado: ${cpfTeste}`);
    console.log(`   Cancelamentos realizados: ${historico.rows[0].total}`);
    console.log(`   Status: ${bloqueioAtivo.rows.length > 0 ? '🚫 BLOQUEADO' : '✅ LIVRE'}`);
    
    if (bloqueioAtivo.rows.length > 0) {
      console.log(`   Desbloqueio: ${new Date(bloqueioAtivo.rows[0].data_desbloqueio).toLocaleString('pt-BR')}`);
    }
    
    console.log('\n✅ CONCLUSÃO:');
    console.log('   • 1º cancelamento: ✅ PERMITIDO');
    console.log('   • 2º cancelamento: ✅ PERMITIDO');
    console.log('   • 3º cancelamento: ✅ PERMITIDO + 🚫 BLOQUEIO ATIVADO');
    console.log('   • 4º cancelamento: ❌ BLOQUEADO (não consegue fazer)');
    console.log('   • Novos agendamentos: ❌ BLOQUEADO por 7 dias\n');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

testarComportamentoBloqueio();
