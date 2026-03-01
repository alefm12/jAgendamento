import { Router } from 'express';
import { pool } from '../config/db';
import { type AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

const ensureLayoutConfigTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS layout_config (
      id SERIAL PRIMARY KEY,
      prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
      area VARCHAR(100) DEFAULT 'geral',
      cor_primaria VARCHAR(20) DEFAULT '#2563eb',
      cor_secundaria VARCHAR(20) DEFAULT '#10b981',
      cor_destaque VARCHAR(20) DEFAULT '#f59e0b',
      cor_fundo VARCHAR(20) DEFAULT '#ffffff',
      cor_texto VARCHAR(20) DEFAULT '#1f2937',
      cor_texto_secundario VARCHAR(20) DEFAULT '#6b7280',
      cor_botao_principal VARCHAR(20) DEFAULT '#2563eb',
      cor_botao_principal_hover VARCHAR(20) DEFAULT '#1d4ed8',
      cor_botao_secundario VARCHAR(20) DEFAULT '#10b981',
      cor_botao_secundario_hover VARCHAR(20) DEFAULT '#059669',
      cor_botao_cancelar VARCHAR(20) DEFAULT '#ef4444',
      cor_botao_cancelar_hover VARCHAR(20) DEFAULT '#dc2626',
      cor_status_pendente VARCHAR(20) DEFAULT '#f59e0b',
      cor_status_confirmado VARCHAR(20) DEFAULT '#10b981',
      cor_status_chamado VARCHAR(20) DEFAULT '#3b82f6',
      cor_status_concluido VARCHAR(20) DEFAULT '#059669',
      cor_status_cancelado VARCHAR(20) DEFAULT '#ef4444',
      atualizado_por INTEGER,
      atualizado_em TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(prefeitura_id, area)
    )
  `)
}

const ensureHorariosConfigTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS horarios_config (
      id SERIAL PRIMARY KEY,
      prefeitura_id INTEGER NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
      horarios_disponiveis TEXT,
      max_agendamentos_por_horario INTEGER DEFAULT 2,
      periodo_liberado_dias INTEGER DEFAULT 60,
      atualizado_por INTEGER,
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

const ensureCamposPersonalizadosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campos_personalizados (
      id SERIAL PRIMARY KEY,
      prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
      nome_campo VARCHAR(100) NOT NULL,
      label_campo VARCHAR(255) NOT NULL,
      tipo_campo VARCHAR(50) DEFAULT 'text',
      placeholder TEXT,
      texto_ajuda TEXT,
      obrigatorio BOOLEAN DEFAULT false,
      ativo BOOLEAN DEFAULT true,
      opcoes JSONB,
      ordem INTEGER DEFAULT 0,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// ==================== LAYOUT CONFIG ====================

// GET todas as configurações de layout de uma prefeitura
router.get('/layout/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureLayoutConfigTable()
    const { prefeituraId } = req.params;
    
    const result = await pool.query(
      `SELECT id, prefeitura_id as "prefeituraId", area,
              cor_primaria as "corPrimaria", cor_secundaria as "corSecundaria",
              cor_destaque as "corDestaque", cor_fundo as "corFundo",
              cor_texto as "corTexto", cor_texto_secundario as "corTextoSecundario",
              cor_botao_principal as "corBotaoPrincipal",
              cor_botao_principal_hover as "corBotaoPrincipalHover",
              cor_botao_secundario as "corBotaoSecundario",
              cor_botao_secundario_hover as "corBotaoSecundarioHover",
              cor_botao_cancelar as "corBotaoCancelar",
              cor_botao_cancelar_hover as "corBotaoCancelarHover",
              cor_status_pendente as "corStatusPendente",
              cor_status_confirmado as "corStatusConfirmado",
              cor_status_chamado as "corStatusChamado",
              cor_status_concluido as "corStatusConcluido",
              cor_status_cancelado as "corStatusCancelado",
              atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"
       FROM layout_config
       WHERE prefeitura_id = $1
       ORDER BY area`,
      [prefeituraId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar configurações de layout:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações de layout' });
  }
});

// PUT atualizar configuração de layout
router.put('/layout/:id', async (req: AuthRequest, res) => {
  try {
    await ensureLayoutConfigTable()
    const { id } = req.params;
    const config = req.body;
    
    const result = await pool.query(
      `UPDATE layout_config SET
        cor_primaria = $1, cor_secundaria = $2, cor_destaque = $3,
        cor_fundo = $4, cor_texto = $5, cor_texto_secundario = $6,
        cor_botao_principal = $7, cor_botao_principal_hover = $8,
        cor_botao_secundario = $9, cor_botao_secundario_hover = $10,
        cor_botao_cancelar = $11, cor_botao_cancelar_hover = $12,
        cor_status_pendente = $13, cor_status_confirmado = $14,
        cor_status_chamado = $15, cor_status_concluido = $16,
        cor_status_cancelado = $17, atualizado_em = CURRENT_TIMESTAMP,
        atualizado_por = $18
       WHERE id = $19
       RETURNING *`,
      [
        config.corPrimaria, config.corSecundaria, config.corDestaque,
        config.corFundo, config.corTexto, config.corTextoSecundario,
        config.corBotaoPrincipal, config.corBotaoPrincipalHover,
        config.corBotaoSecundario, config.corBotaoSecundarioHover,
        config.corBotaoCancelar, config.corBotaoCancelarHover,
        config.corStatusPendente, config.corStatusConfirmado,
        config.corStatusChamado, config.corStatusConcluido,
        config.corStatusCancelado, req.user?.id || null, id
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar layout:', error);
    res.status(500).json({ error: 'Erro ao atualizar layout' });
  }
});

// POST restaurar padrões de layout
router.post('/layout/:prefeituraId/restaurar', async (req: AuthRequest, res) => {
  try {
    await ensureLayoutConfigTable()
    const { prefeituraId } = req.params;
    const { area } = req.body;
    
    await pool.query(
      `UPDATE layout_config SET
        cor_primaria = '#059669', cor_secundaria = '#1d4ed8',
        cor_destaque = '#f59e0b', cor_fundo = '#ffffff',
        cor_texto = '#1f2937', cor_texto_secundario = '#6b7280',
        cor_botao_principal = '#2563eb', cor_botao_principal_hover = '#1d4ed8',
        cor_botao_secundario = '#10b981', cor_botao_secundario_hover = '#059669',
        cor_botao_cancelar = '#ef4444', cor_botao_cancelar_hover = '#dc2626',
        cor_status_pendente = '#f59e0b', cor_status_confirmado = '#10b981',
        cor_status_chamado = '#3b82f6', cor_status_concluido = '#059669',
        cor_status_cancelado = '#ef4444', atualizado_em = CURRENT_TIMESTAMP,
        atualizado_por = $1
       WHERE prefeitura_id = $2 AND area = $3`,
      [req.user?.id || null, prefeituraId, area]
    );
    
    res.json({ success: true, message: 'Layout restaurado para os padrões' });
  } catch (error) {
    console.error('Erro ao restaurar layout:', error);
    res.status(500).json({ error: 'Erro ao restaurar layout' });
  }
});

// ==================== HORÁRIOS CONFIG ====================

// GET configurações de horários
router.get('/horarios/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureHorariosConfigTable()
    const { prefeituraId } = req.params;
    
    const result = await pool.query(
      `SELECT id, prefeitura_id as "prefeituraId",
              horarios_disponiveis as "horariosDisponiveis",
              max_agendamentos_por_horario as "maxAgendamentosPorHorario",
              periodo_liberado_dias as "periodoLiberadoDias",
              atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"
       FROM horarios_config
       WHERE prefeitura_id = $1`,
      [prefeituraId]
    );

    if (result.rows[0]) {
      return res.json(result.rows[0]);
    }

    // Fallback: lê da system_config e retorna no mesmo formato
    const scResult = await pool.query(
      `SELECT working_hours, max_appointments_per_slot, booking_window_days
       FROM system_config ORDER BY id ASC LIMIT 1`
    );
    if (scResult.rows[0]) {
      const sc = scResult.rows[0];
      const hours = Array.isArray(sc.working_hours)
        ? sc.working_hours
        : (sc.working_hours || []);
      return res.json({
        horariosDisponiveis: hours.join(', '),
        maxAgendamentosPorHorario: sc.max_appointments_per_slot || 2,
        periodoLiberadoDias: sc.booking_window_days || 60
      });
    }

    res.json(null);
  } catch (error) {
    console.error('Erro ao buscar configurações de horários:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações de horários' });
  }
});

// PUT atualizar configurações de horários
router.put('/horarios/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureHorariosConfigTable()
    const { prefeituraId } = req.params;
    const { horariosDisponiveis, maxAgendamentosPorHorario, periodoLiberadoDias } = req.body;

    // 1. Salva na tabela horarios_config (fonte de verdade do painel admin)
    const result = await pool.query(
      `INSERT INTO horarios_config (
        prefeitura_id, horarios_disponiveis, max_agendamentos_por_horario,
        periodo_liberado_dias, atualizado_por
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (prefeitura_id) 
       DO UPDATE SET
        horarios_disponiveis = $2,
        max_agendamentos_por_horario = $3,
        periodo_liberado_dias = $4,
        atualizado_em = CURRENT_TIMESTAMP,
        atualizado_por = $5
       RETURNING *`,
      [prefeituraId, horariosDisponiveis, maxAgendamentosPorHorario, periodoLiberadoDias, req.user?.id || null]
    );

    // 2. Converte horários de string para array e sincroniza em system_config
    //    para que o componente público sempre use os dados atualizados
    const workingHoursArray = (horariosDisponiveis || '')
      .split(',')
      .map((h: string) => h.trim())
      .filter(Boolean)

    await pool.query(
      `UPDATE system_config SET
        working_hours = $1,
        max_appointments_per_slot = $2,
        booking_window_days = $3
       WHERE id = (SELECT id FROM system_config ORDER BY id ASC LIMIT 1)`,
      [
        JSON.stringify(workingHoursArray),
        maxAgendamentosPorHorario || 2,
        periodoLiberadoDias || 60
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar horários:', error);
    res.status(500).json({ error: 'Erro ao atualizar horários' });
  }
});

// ==================== CAMPOS PERSONALIZADOS ====================

// GET campos personalizados
router.get('/campos/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureCamposPersonalizadosTable()
    const { prefeituraId } = req.params;
    
    const result = await pool.query(
      `SELECT id, prefeitura_id as "prefeituraId",
              nome_campo as "nomeCampo", label_campo as "labelCampo",
              tipo_campo as "tipoCampo", placeholder, texto_ajuda as "textoAjuda",
              obrigatorio, ativo, opcoes, ordem,
              criado_em as "criadoEm", atualizado_em as "atualizadoEm"
       FROM campos_personalizados
       WHERE prefeitura_id = $1
       ORDER BY ordem, id`,
      [prefeituraId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar campos personalizados:', error);
    res.status(500).json({ error: 'Erro ao buscar campos personalizados' });
  }
});

// POST criar campo personalizado
router.post('/campos/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureCamposPersonalizadosTable()
    const { prefeituraId } = req.params;
    const { nomeCampo, labelCampo, tipoCampo, placeholder, textoAjuda, obrigatorio, ativo, opcoes, ordem } = req.body;
    
    const result = await pool.query(
      `INSERT INTO campos_personalizados (
        prefeitura_id, nome_campo, label_campo, tipo_campo,
        placeholder, texto_ajuda, obrigatorio, ativo, opcoes, ordem
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [prefeituraId, nomeCampo, labelCampo, tipoCampo, placeholder, textoAjuda, obrigatorio, ativo, JSON.stringify(opcoes || []), ordem]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar campo personalizado:', error);
    res.status(500).json({ error: 'Erro ao criar campo personalizado' });
  }
});

// PUT atualizar campo personalizado
router.put('/campos/:id', async (req: AuthRequest, res) => {
  try {
    await ensureCamposPersonalizadosTable()
    const { id } = req.params;
    const { labelCampo, tipoCampo, placeholder, textoAjuda, obrigatorio, ativo, opcoes, ordem } = req.body;
    
    const result = await pool.query(
      `UPDATE campos_personalizados SET
        label_campo = $1, tipo_campo = $2, placeholder = $3,
        texto_ajuda = $4, obrigatorio = $5, ativo = $6,
        opcoes = $7, ordem = $8, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [labelCampo, tipoCampo, placeholder, textoAjuda, obrigatorio, ativo, JSON.stringify(opcoes || []), ordem, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar campo personalizado:', error);
    res.status(500).json({ error: 'Erro ao atualizar campo personalizado' });
  }
});

// DELETE excluir campo personalizado
router.delete('/campos/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM campos_personalizados WHERE id = $1', [id]);
    
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir campo personalizado:', error);
    res.status(500).json({ error: 'Erro ao excluir campo personalizado' });
  }
});

export default router;
