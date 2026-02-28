import { Router } from 'express';
import { pool } from '../config/db';
import { type AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

const ensureGeralBackupColumns = async () => {
  await pool.query(`ALTER TABLE geral_config ADD COLUMN IF NOT EXISTS backup_output_dir TEXT`)
  await pool.query(`ALTER TABLE geral_config ADD COLUMN IF NOT EXISTS backup_ultimo_em TIMESTAMPTZ`)
}

// ==================== CHAMADAS CONFIG ====================

// GET configurações de chamadas
router.get('/chamadas/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    const { prefeituraId } = req.params;
    
    const result = await pool.query(
      `SELECT id, prefeitura_id as "prefeituraId",
              voz_tipo as "vozTipo", voz_idioma as "vozIdioma",
              voz_genero as "vozGenero", voz_velocidade as "vozVelocidade",
              voz_volume as "vozVolume", voz_tom as "vozTom",
              cor_fundo_chamada as "corFundoChamada", cor_texto_chamada as "corTextoChamada",
              cor_destaque_chamada as "corDestaqueChamada",
              cor_botao_chamar as "corBotaoChamar", cor_botao_chamar_hover as "corBotaoChamarHover",
              template_chamada as "templateChamada", repetir_chamada as "repetirChamada",
              numero_repeticoes as "numeroRepeticoes", intervalo_repeticoes_segundos as "intervaloRepeticoesSegundos",
              atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"
       FROM chamadas_config
       WHERE prefeitura_id = $1`,
      [prefeituraId]
    );
    
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Erro ao buscar configurações de chamadas:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações de chamadas' });
  }
});

// PUT atualizar configurações de chamadas
router.put('/chamadas/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    const { prefeituraId } = req.params;
    const config = req.body;
    
    const result = await pool.query(
      `INSERT INTO chamadas_config (
        prefeitura_id, voz_tipo, voz_idioma, voz_genero, voz_velocidade,
        voz_volume, voz_tom, cor_fundo_chamada, cor_texto_chamada,
        cor_destaque_chamada, cor_botao_chamar, cor_botao_chamar_hover,
        template_chamada, repetir_chamada, numero_repeticoes,
        intervalo_repeticoes_segundos, atualizado_por
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (prefeitura_id) 
       DO UPDATE SET
        voz_tipo = $2, voz_idioma = $3, voz_genero = $4, voz_velocidade = $5,
        voz_volume = $6, voz_tom = $7, cor_fundo_chamada = $8, cor_texto_chamada = $9,
        cor_destaque_chamada = $10, cor_botao_chamar = $11, cor_botao_chamar_hover = $12,
        template_chamada = $13, repetir_chamada = $14, numero_repeticoes = $15,
        intervalo_repeticoes_segundos = $16, atualizado_em = CURRENT_TIMESTAMP,
        atualizado_por = $17
       RETURNING id, prefeitura_id as "prefeituraId",
                 voz_tipo as "vozTipo", voz_idioma as "vozIdioma",
                 voz_genero as "vozGenero", voz_velocidade as "vozVelocidade",
                 voz_volume as "vozVolume", voz_tom as "vozTom",
                 cor_fundo_chamada as "corFundoChamada", cor_texto_chamada as "corTextoChamada",
                 cor_destaque_chamada as "corDestaqueChamada",
                 cor_botao_chamar as "corBotaoChamar", cor_botao_chamar_hover as "corBotaoChamarHover",
                 template_chamada as "templateChamada", repetir_chamada as "repetirChamada",
                 numero_repeticoes as "numeroRepeticoes", intervalo_repeticoes_segundos as "intervaloRepeticoesSegundos",
                 atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"`,
      [
        prefeituraId, config.vozTipo, config.vozIdioma, config.vozGenero,
        config.vozVelocidade, config.vozVolume, config.vozTom,
        config.corFundoChamada, config.corTextoChamada, config.corDestaqueChamada,
        config.corBotaoChamar, config.corBotaoChamarHover, config.templateChamada,
        config.repetirChamada, config.numeroRepeticoes, config.intervaloRepeticoesSegundos,
        req.user?.id || null
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar configurações de chamadas:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações de chamadas' });
  }
});

// ==================== GERAL CONFIG ====================

// GET configurações gerais
router.get('/geral/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    const { prefeituraId } = req.params;
    await ensureGeralBackupColumns()
    
    const result = await pool.query(
      `SELECT id, prefeitura_id as "prefeituraId",
              nome_secretaria as "nomeSecretaria", endereco_completo as "enderecoCompleto",
              telefone_contato as "telefoneContato", email_contato as "emailContato",
              site_url as "siteUrl", horario_funcionamento as "horarioFuncionamento",
              relatorios_ativos as "relatoriosAtivos", backup_ativo as "backupAtivo",
              backup_periodicidade as "backupPeriodicidade", backup_horario as "backupHorario",
              backup_retencao_dias as "backupRetencaoDias",
              backup_email_notificacao as "backupEmailNotificacao",
              backup_output_dir as "backupOutputDir",
              backup_ultimo_em as "backupUltimoEm",
              log_auditoria_ativo as "logAuditoriaAtivo",
              log_auditoria_retencao_dias as "logAuditoriaRetencaoDias",
              atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"
       FROM geral_config
       WHERE prefeitura_id = $1`,
      [prefeituraId]
    );
    
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Erro ao buscar configurações gerais:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações gerais' });
  }
});

// PUT atualizar configurações gerais
router.put('/geral/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    const { prefeituraId } = req.params;
    const config = req.body;
    await ensureGeralBackupColumns()

    const backupAtivo = Boolean(config.backupAtivo)
    const backupOutputDir = String(config.backupOutputDir || '').trim()
    if (backupAtivo && !backupOutputDir) {
      return res.status(400).json({ error: 'A pasta de destino do backup automático é obrigatória.' })
    }
    
    const result = await pool.query(
      `INSERT INTO geral_config (
        prefeitura_id, nome_secretaria, endereco_completo, telefone_contato,
        email_contato, site_url, horario_funcionamento, relatorios_ativos,
        backup_ativo, backup_periodicidade, backup_horario, backup_retencao_dias,
        backup_email_notificacao, backup_output_dir,
        log_auditoria_ativo, log_auditoria_retencao_dias,
        atualizado_por
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (prefeitura_id) 
       DO UPDATE SET
        nome_secretaria = $2, endereco_completo = $3, telefone_contato = $4,
        email_contato = $5, site_url = $6, horario_funcionamento = $7,
        relatorios_ativos = $8, backup_ativo = $9, backup_periodicidade = $10,
        backup_horario = $11, backup_retencao_dias = $12, backup_email_notificacao = $13,
        backup_output_dir = $14,
        log_auditoria_ativo = $15, log_auditoria_retencao_dias = $16,
        atualizado_em = CURRENT_TIMESTAMP, atualizado_por = $17
       RETURNING id, prefeitura_id as "prefeituraId",
                 nome_secretaria as "nomeSecretaria", endereco_completo as "enderecoCompleto",
                 telefone_contato as "telefoneContato", email_contato as "emailContato",
                 site_url as "siteUrl", horario_funcionamento as "horarioFuncionamento",
                 relatorios_ativos as "relatoriosAtivos", backup_ativo as "backupAtivo",
                 backup_periodicidade as "backupPeriodicidade", backup_horario as "backupHorario",
                 backup_retencao_dias as "backupRetencaoDias",
                 backup_email_notificacao as "backupEmailNotificacao",
                 backup_output_dir as "backupOutputDir",
                 backup_ultimo_em as "backupUltimoEm",
                 log_auditoria_ativo as "logAuditoriaAtivo",
                 log_auditoria_retencao_dias as "logAuditoriaRetencaoDias",
                 atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"`,
      [
        prefeituraId, config.nomeSecretaria, config.enderecoCompleto,
        config.telefoneContato, config.emailContato, config.siteUrl,
        config.horarioFuncionamento, config.relatoriosAtivos,
        config.backupAtivo, config.backupPeriodicidade, config.backupHorario,
        config.backupRetencaoDias, config.backupEmailNotificacao, backupOutputDir,
        config.logAuditoriaAtivo, config.logAuditoriaRetencaoDias,
        req.user?.id || null
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar configurações gerais:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações gerais' });
  }
});

// ==================== PERMISSÕES ====================

// GET permissões de um usuário em uma prefeitura específica
router.get('/permissoes/:usuarioId/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    const { usuarioId, prefeituraId } = req.params;
    
    const result = await pool.query(
      `SELECT id, usuario_id as "usuarioId", prefeitura_id as "prefeituraId",
              secretaria_visualizar as "secretariaVisualizar",
              secretaria_criar as "secretariaCriar",
              secretaria_editar as "secretariaEditar",
              secretaria_excluir as "secretariaExcluir",
              atendimento_visualizar as "atendimentoVisualizar",
              atendimento_chamar as "atendimentoChamar",
              atendimento_concluir as "atendimentoConcluir",
              atendimento_cancelar as "atendimentoCancelar",
              atendimento_reagendar as "atendimentoReagendar",
              analytics_visualizar as "analyticsVisualizar",
              analytics_exportar as "analyticsExportar",
              entrega_cin_visualizar as "entregaCinVisualizar",
              entrega_cin_registrar as "entregaCinRegistrar",
              entrega_cin_editar as "entregaCinEditar",
              admin_config_sistema as "adminConfigSistema",
              admin_usuarios as "adminUsuarios",
              admin_permissoes as "adminPermissoes",
              admin_backup as "adminBackup",
              locais_permitidos as "locaisPermitidos",
              atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"
       FROM usuarios_permissoes
       WHERE usuario_id = $1 AND prefeitura_id = $2`,
      [usuarioId, prefeituraId]
    );
    
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Erro ao buscar permissões do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar permissões do usuário' });
  }
});

// PUT atualizar permissões de um usuário
router.put('/permissoes/:usuarioId/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    const { usuarioId, prefeituraId } = req.params;
    const perm = req.body;
    
    const result = await pool.query(
      `INSERT INTO usuarios_permissoes (
        usuario_id, prefeitura_id,
        secretaria_visualizar, secretaria_criar, secretaria_editar, secretaria_excluir,
        atendimento_visualizar, atendimento_chamar, atendimento_concluir,
        atendimento_cancelar, atendimento_reagendar,
        analytics_visualizar, analytics_exportar,
        entrega_cin_visualizar, entrega_cin_registrar, entrega_cin_editar,
        admin_config_sistema, admin_usuarios, admin_permissoes, admin_backup,
        locais_permitidos, atualizado_por
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       ON CONFLICT (usuario_id, prefeitura_id) 
       DO UPDATE SET
        secretaria_visualizar = $3, secretaria_criar = $4, secretaria_editar = $5,
        secretaria_excluir = $6, atendimento_visualizar = $7, atendimento_chamar = $8,
        atendimento_concluir = $9, atendimento_cancelar = $10, atendimento_reagendar = $11,
        analytics_visualizar = $12, analytics_exportar = $13,
        entrega_cin_visualizar = $14, entrega_cin_registrar = $15, entrega_cin_editar = $16,
        admin_config_sistema = $17, admin_usuarios = $18, admin_permissoes = $19,
        admin_backup = $20, locais_permitidos = $21,
        atualizado_em = CURRENT_TIMESTAMP, atualizado_por = $22
       RETURNING id, usuario_id as "usuarioId", prefeitura_id as "prefeituraId",
                 secretaria_visualizar as "secretariaVisualizar",
                 secretaria_criar as "secretariaCriar",
                 secretaria_editar as "secretariaEditar",
                 secretaria_excluir as "secretariaExcluir",
                 atendimento_visualizar as "atendimentoVisualizar",
                 atendimento_chamar as "atendimentoChamar",
                 atendimento_concluir as "atendimentoConcluir",
                 atendimento_cancelar as "atendimentoCancelar",
                 atendimento_reagendar as "atendimentoReagendar",
                 analytics_visualizar as "analyticsVisualizar",
                 analytics_exportar as "analyticsExportar",
                 entrega_cin_visualizar as "entregaCinVisualizar",
                 entrega_cin_registrar as "entregaCinRegistrar",
                 entrega_cin_editar as "entregaCinEditar",
                 admin_config_sistema as "adminConfigSistema",
                 admin_usuarios as "adminUsuarios",
                 admin_permissoes as "adminPermissoes",
                 admin_backup as "adminBackup",
                 locais_permitidos as "locaisPermitidos",
                 atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"`,
      [
        usuarioId, prefeituraId,
        perm.secretariaVisualizar, perm.secretariaCriar, perm.secretariaEditar,
        perm.secretariaExcluir, perm.atendimentoVisualizar, perm.atendimentoChamar,
        perm.atendimentoConcluir, perm.atendimentoCancelar, perm.atendimentoReagendar,
        perm.analyticsVisualizar, perm.analyticsExportar,
        perm.entregaCinVisualizar, perm.entregaCinRegistrar, perm.entregaCinEditar,
        perm.adminConfigSistema, perm.adminUsuarios, perm.adminPermissoes,
        perm.adminBackup, JSON.stringify(perm.locaisPermitidos || []),
        req.user?.id || null
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    res.status(500).json({ error: 'Erro ao atualizar permissões' });
  }
});

// GET todas as permissões de um usuário em todas as prefeituras
router.get('/permissoes/usuario/:usuarioId', async (req: AuthRequest, res) => {
  try {
    const { usuarioId } = req.params;
    
    const result = await pool.query(
      `SELECT id, usuario_id as "usuarioId", prefeitura_id as "prefeituraId",
              secretaria_visualizar as "secretariaVisualizar",
              secretaria_criar as "secretariaCriar",
              secretaria_editar as "secretariaEditar",
              secretaria_excluir as "secretariaExcluir",
              atendimento_visualizar as "atendimentoVisualizar",
              atendimento_chamar as "atendimentoChamar",
              atendimento_concluir as "atendimentoConcluir",
              atendimento_cancelar as "atendimentoCancelar",
              atendimento_reagendar as "atendimentoReagendar",
              analytics_visualizar as "analyticsVisualizar",
              analytics_exportar as "analyticsExportar",
              entrega_cin_visualizar as "entregaCinVisualizar",
              entrega_cin_registrar as "entregaCinRegistrar",
              entrega_cin_editar as "entregaCinEditar",
              admin_config_sistema as "adminConfigSistema",
              admin_usuarios as "adminUsuarios",
              admin_permissoes as "adminPermissoes",
              admin_backup as "adminBackup",
              locais_permitidos as "locaisPermitidos",
              atualizado_em as "atualizadoEm", atualizado_por as "atualizadoPor"
       FROM usuarios_permissoes
       WHERE usuario_id = $1
       ORDER BY prefeitura_id`,
      [usuarioId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar permissões do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar permissões do usuário' });
  }
});

export default router;
