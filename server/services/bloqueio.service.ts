import { pool } from '../config/db';

/**
 * Resultado da verificação de bloqueio
 */
export interface BloqueioStatus {
  bloqueado: boolean;
  dataDesbloqueio?: Date;
  motivo?: string;
  cancelamentosCount?: number;
}

/**
 * Verifica se um CPF está bloqueado temporariamente
 * @param cpf - CPF formatado ou sem formatação
 * @returns Objeto com status do bloqueio e data de desbloqueio se bloqueado
 */
export async function verificarBloqueioCP(cpf: string): Promise<BloqueioStatus> {
  try {
    // Remove formatação do CPF para comparação
    const cpfLimpo = cpf.replace(/[.-\s]/g, '');
    
    const result = await pool.query(
      `SELECT cpf, data_desbloqueio, motivo, cancelamentos_count, ativo
       FROM cpf_bloqueios
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1
       AND ativo = TRUE
       AND data_desbloqueio > NOW()
       ORDER BY data_bloqueio DESC
       LIMIT 1`,
      [cpfLimpo]
    );
    
    if (result.rows.length > 0) {
      const bloqueio = result.rows[0];
      return {
        bloqueado: true,
        dataDesbloqueio: bloqueio.data_desbloqueio,
        motivo: bloqueio.motivo,
        cancelamentosCount: bloqueio.cancelamentos_count
      };
    }
    
    return { bloqueado: false };
  } catch (error) {
    console.error('[BLOQUEIO] Erro ao verificar bloqueio:', error);
    return { bloqueado: false };
  }
}

/**
 * Registra um cancelamento e verifica se deve bloquear o CPF
 * @param cpf - CPF do cidadão
 * @param agendamentoId - ID do agendamento cancelado
 * @param prefeituraId - ID da prefeitura
 */
export async function registrarCancelamento(
  cpf: string, 
  agendamentoId: number, 
  prefeituraId: number
): Promise<void> {
  try {
    // 1. Registra o cancelamento na tabela de histórico
    await pool.query(
      `INSERT INTO cpf_cancelamentos (cpf, agendamento_id, prefeitura_id, data_cancelamento)
       VALUES ($1, $2, $3, NOW())`,
      [cpf, agendamentoId, prefeituraId]
    );
    
    console.log('[CANCELAMENTO] Registrado cancelamento para CPF:', cpf);
    
    // 2. Conta quantos cancelamentos esse CPF teve nos últimos 7 dias
    const cpfLimpo = cpf.replace(/[.-\s]/g, '');
    const result = await pool.query(
      `SELECT COUNT(*) as total
       FROM cpf_cancelamentos
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1
       AND data_cancelamento >= NOW() - INTERVAL '7 days'`,
      [cpfLimpo]
    );
    
    const totalCancelamentos = parseInt(result.rows[0].total);
    console.log('[CANCELAMENTO] Total de cancelamentos nos últimos 7 dias:', totalCancelamentos);
    
    // 3. Se atingiu 3 ou mais cancelamentos, bloqueia o CPF por 7 dias
    if (totalCancelamentos >= 3) {
      const dataDesbloqueio = new Date();
      dataDesbloqueio.setDate(dataDesbloqueio.getDate() + 7);
      
      // Desativa bloqueios antigos deste CPF
      await pool.query(
        `UPDATE cpf_bloqueios 
         SET ativo = FALSE 
         WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1`,
        [cpfLimpo]
      );
      
      // Cria novo bloqueio
      await pool.query(
        `INSERT INTO cpf_bloqueios (cpf, prefeitura_id, data_bloqueio, data_desbloqueio, motivo, cancelamentos_count, ativo)
         VALUES ($1, $2, NOW(), $3, $4, $5, TRUE)
         ON CONFLICT (cpf) DO UPDATE 
         SET data_bloqueio = NOW(), 
             data_desbloqueio = $3, 
             motivo = $4, 
             cancelamentos_count = $5, 
             ativo = TRUE,
             prefeitura_id = $2`,
        [
          cpf, 
          prefeituraId, 
          dataDesbloqueio,
          `Bloqueado automaticamente por ${totalCancelamentos} cancelamentos em 7 dias`,
          totalCancelamentos
        ]
      );
      
      console.log('🚫 [BLOQUEIO] CPF bloqueado até:', dataDesbloqueio.toLocaleString('pt-BR'));
    }
    
  } catch (error) {
    console.error('[CANCELAMENTO] Erro ao registrar cancelamento:', error);
    throw error;
  }
}

/**
 * Conta quantos cancelamentos um CPF teve nos últimos 7 dias
 * @param cpf - CPF formatado ou sem formatação
 * @returns Número de cancelamentos
 */
export async function contarCancelamentosRecentes(cpf: string): Promise<number> {
  try {
    const cpfLimpo = cpf.replace(/[.-\s]/g, '');
    const result = await pool.query(
      `SELECT COUNT(*) as total
       FROM cpf_cancelamentos
       WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1
       AND data_cancelamento >= NOW() - INTERVAL '7 days'`,
      [cpfLimpo]
    );
    
    return parseInt(result.rows[0].total);
  } catch (error) {
    console.error('[BLOQUEIO] Erro ao contar cancelamentos:', error);
    return 0;
  }
}
