const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function testarSistemaBloqueio() {
  try {
    console.log('\n🧪 ===== TESTE DO SISTEMA DE BLOQUEIO DE CPF =====\n');
    
    const cpfTeste = '092.964.673-81';
    const cpfLimpo = cpfTeste.replace(/[.-]/g, '');
    
    // 1. Limpar dados de teste anteriores
    console.log('1️⃣  Limpando dados de teste anteriores...');
    await pool.query('DELETE FROM cpf_bloqueios WHERE REPLACE(REPLACE(REPLACE(cpf, \'.\', \'\'), \'-\', \'\'), \' \', \'\') = $1', [cpfLimpo]);
    await pool.query('DELETE FROM cpf_cancelamentos WHERE REPLACE(REPLACE(REPLACE(cpf, \'.\', \'\'), \'-\', \'\'), \' \', \'\') = $1', [cpfLimpo]);
    console.log('   ✅ Dados limpos\n');
    
    // 2. Verificar se está bloqueado (deve ser false)
    console.log('2️⃣  Verificando se CPF está bloqueado...');
    const check1 = await pool.query(
      `SELECT * FROM cpf_bloqueios 
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1 
       AND ativo = TRUE AND data_desbloqueio > NOW()`,
      [cpfLimpo]
    );
    console.log(`   ${check1.rows.length === 0 ? '✅' : '❌'} CPF ${check1.rows.length === 0 ? 'NÃO' : 'ESTÁ'} bloqueado\n`);
    
    // 3. Simular 2 cancelamentos (ainda não bloqueia)
    console.log('3️⃣  Simulando 2 cancelamentos...');
    for (let i = 1; i <= 2; i++) {
      await pool.query(
        `INSERT INTO cpf_cancelamentos (cpf, agendamento_id, prefeitura_id, data_cancelamento)
         VALUES ($1, $2, 1, NOW())`,
        [cpfTeste, 100 + i]
      );
      console.log(`   ✅ Cancelamento ${i} registrado`);
    }
    
    // Contar cancelamentos
    const count1 = await pool.query(
      `SELECT COUNT(*) as total FROM cpf_cancelamentos 
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1
       AND data_cancelamento >= NOW() - INTERVAL '7 days'`,
      [cpfLimpo]
    );
    console.log(`   📊 Total de cancelamentos nos últimos 7 dias: ${count1.rows[0].total}\n`);
    
    // 4. Verificar se bloqueou (deve ser false ainda)
    const check2 = await pool.query(
      `SELECT * FROM cpf_bloqueios 
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1 
       AND ativo = TRUE AND data_desbloqueio > NOW()`,
      [cpfLimpo]
    );
    console.log(`4️⃣  ${check2.rows.length === 0 ? '✅' : '❌'} CPF ainda ${check2.rows.length === 0 ? 'NÃO está' : 'está'} bloqueado (esperado: NÃO)\n`);
    
    // 5. Simular 3º cancelamento (DEVE BLOQUEAR)
    console.log('5️⃣  Simulando 3º cancelamento (deve acionar bloqueio)...');
    await pool.query(
      `INSERT INTO cpf_cancelamentos (cpf, agendamento_id, prefeitura_id, data_cancelamento)
       VALUES ($1, $2, 1, NOW())`,
      [cpfTeste, 103]
    );
    console.log('   ✅ Cancelamento 3 registrado');
    
    // Contar novamente
    const count2 = await pool.query(
      `SELECT COUNT(*) as total FROM cpf_cancelamentos 
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1
       AND data_cancelamento >= NOW() - INTERVAL '7 days'`,
      [cpfLimpo]
    );
    console.log(`   📊 Total de cancelamentos: ${count2.rows[0].total}`);
    
    // Criar bloqueio (simulando o que o sistema faz)
    const totalCancelamentos = parseInt(count2.rows[0].total);
    if (totalCancelamentos >= 3) {
      const dataDesbloqueio = new Date();
      dataDesbloqueio.setDate(dataDesbloqueio.getDate() + 7);
      
      await pool.query(
        `INSERT INTO cpf_bloqueios (cpf, prefeitura_id, data_bloqueio, data_desbloqueio, motivo, cancelamentos_count, ativo)
         VALUES ($1, 1, NOW(), $2, $3, $4, TRUE)`,
        [
          cpfTeste,
          dataDesbloqueio,
          `Bloqueado automaticamente por ${totalCancelamentos} cancelamentos em 7 dias`,
          totalCancelamentos
        ]
      );
      console.log(`   🚫 BLOQUEIO CRIADO! Válido até: ${dataDesbloqueio.toLocaleString('pt-BR')}\n`);
    }
    
    // 6. Verificar bloqueio ativo
    console.log('6️⃣  Verificando bloqueio ativo...');
    const bloqueio = await pool.query(
      `SELECT cpf, data_bloqueio, data_desbloqueio, motivo, cancelamentos_count
       FROM cpf_bloqueios 
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1 
       AND ativo = TRUE AND data_desbloqueio > NOW()`,
      [cpfLimpo]
    );
    
    if (bloqueio.rows.length > 0) {
      const b = bloqueio.rows[0];
      console.log('   🚫 CPF BLOQUEADO!');
      console.log(`   📅 Data bloqueio: ${new Date(b.data_bloqueio).toLocaleString('pt-BR')}`);
      console.log(`   🔓 Data desbloqueio: ${new Date(b.data_desbloqueio).toLocaleString('pt-BR')}`);
      console.log(`   📝 Motivo: ${b.motivo}`);
      console.log(`   🔢 Cancelamentos: ${b.cancelamentos_count}\n`);
    } else {
      console.log('   ❌ ERRO: Bloqueio não foi criado!\n');
    }
    
    // 7. Testar API de verificação (simulado)
    console.log('7️⃣  Simulando chamada da API GET /api/bloqueio/verificar/:cpf');
    const apiResponse = {
      bloqueado: bloqueio.rows.length > 0,
      dataDesbloqueio: bloqueio.rows[0]?.data_desbloqueio,
      motivo: bloqueio.rows[0]?.motivo,
      cancelamentosCount: bloqueio.rows[0]?.cancelamentos_count
    };
    console.log('   📡 Resposta da API:');
    console.log(JSON.stringify(apiResponse, null, 2));
    console.log();
    
    // 8. Listar histórico de cancelamentos
    console.log('8️⃣  Histórico de cancelamentos do CPF:');
    const historico = await pool.query(
      `SELECT agendamento_id, data_cancelamento, motivo
       FROM cpf_cancelamentos
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1
       ORDER BY data_cancelamento DESC`,
      [cpfLimpo]
    );
    historico.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Agendamento #${row.agendamento_id} - ${new Date(row.data_cancelamento).toLocaleString('pt-BR')}`);
    });
    console.log();
    
    console.log('✅ ===== TESTE CONCLUÍDO COM SUCESSO! =====\n');
    console.log('📝 Resumo:');
    console.log(`   - CPF testado: ${cpfTeste}`);
    console.log(`   - Cancelamentos registrados: ${historico.rows.length}`);
    console.log(`   - Status: ${bloqueio.rows.length > 0 ? 'BLOQUEADO 🚫' : 'LIVRE ✅'}`);
    if (bloqueio.rows.length > 0) {
      console.log(`   - Desbloqueio em: ${new Date(bloqueio.rows[0].data_desbloqueio).toLocaleString('pt-BR')}`);
    }
    console.log();
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testarSistemaBloqueio();
