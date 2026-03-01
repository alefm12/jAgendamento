import { Router } from 'express';
import { pool } from '../config/db';
import { type AuthRequest } from '../middlewares/auth.middleware';
import { createAuditLog as createServerAuditLog } from '../services/audit.service';

const router = Router();

const ensureWhatsappConfigColumns = async () => {
  await pool.query(`ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS client_token TEXT`)
}

const ensureSmtpConfigTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS smtp_config (
      id SERIAL PRIMARY KEY,
      prefeitura_id INTEGER NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
      smtp_host VARCHAR(255),
      smtp_port INTEGER DEFAULT 587,
      smtp_user VARCHAR(255),
      smtp_password VARCHAR(255),
      smtp_from_name VARCHAR(255),
      smtp_from_email VARCHAR(255),
      smtp_secure BOOLEAN DEFAULT true,
      ativo BOOLEAN DEFAULT true,
      atualizado_por INTEGER,
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// =================================================================================================
// ROTAS DE CONFIGURAÇÃO DE SMTP
// =================================================================================================

// GET - Obter configuração SMTP de uma prefeitura
router.get('/smtp/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureSmtpConfigTable()
    const { prefeituraId } = req.params;
    const result = await pool.query(
      `SELECT id, prefeitura_id, smtp_host, smtp_port, smtp_user, smtp_password, 
              smtp_from_name, smtp_from_email, smtp_secure, ativo
       FROM smtp_config 
       WHERE prefeitura_id = $1`,
      [prefeituraId]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Erro ao buscar configuração SMTP:', error);
    res.status(500).json({ error: 'Erro interno ao buscar configuração SMTP.' });
  }
});

// PUT - Atualizar ou criar configuração SMTP de uma prefeitura
router.put('/smtp/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureSmtpConfigTable()
    const { prefeituraId } = req.params;
    const { 
      smtp_host, smtp_port, smtp_user, smtp_password, 
      smtp_from_name, smtp_from_email, smtp_secure, ativo 
    } = req.body;
    const atualizado_por = req.user?.id || null;
    const before = await pool.query(
      `SELECT * FROM smtp_config WHERE prefeitura_id = $1`,
      [prefeituraId]
    )

    const result = await pool.query(
      `INSERT INTO smtp_config 
        (prefeitura_id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure, ativo, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (prefeitura_id) DO UPDATE SET
         smtp_host = EXCLUDED.smtp_host,
         smtp_port = EXCLUDED.smtp_port,
         smtp_user = EXCLUDED.smtp_user,
         smtp_password = EXCLUDED.smtp_password,
         smtp_from_name = EXCLUDED.smtp_from_name,
         smtp_from_email = EXCLUDED.smtp_from_email,
         smtp_secure = EXCLUDED.smtp_secure,
         ativo = EXCLUDED.ativo,
         atualizado_em = CURRENT_TIMESTAMP,
         atualizado_por = EXCLUDED.atualizado_por
      RETURNING *`,
      [
        prefeituraId, smtp_host, smtp_port, smtp_user, smtp_password, 
        smtp_from_name, smtp_from_email, smtp_secure, ativo, atualizado_por
      ]
    );
    const updated = result.rows[0]
    await createServerAuditLog({
      userId: req.user?.id,
      userEmail: req.user?.email || null,
      userName: req.user?.name || req.user?.email || 'Administrador',
      userRole: req.user?.role || 'SUPER_ADMIN',
      action: 'UPDATE_SYSTEM_CONFIG',
      actionCategory: 'SYSTEM_CONFIG',
      description: 'Alterou configurações de SMTP na aba de Configurações Administrativas.',
      severity: 'HIGH',
      entityType: 'system_config',
      entityId: `smtp:${prefeituraId}`,
      oldValues: before.rows[0] || null,
      newValues: updated,
      status: 'success'
    }, req)

    res.status(200).json(updated);
  } catch (error) {
    console.error('Erro ao salvar configuração SMTP:', error);
    res.status(500).json({ error: 'Erro interno ao salvar configuração SMTP.' });
  }
});

// =================================================================================================
// ROTAS DE CONFIGURAÇÃO DE WHATSAPP
// =================================================================================================

// GET - Obter configuração WhatsApp de uma prefeitura
router.get('/whatsapp/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureWhatsappConfigColumns()
    const { prefeituraId } = req.params;
    const result = await pool.query(
      `SELECT id, prefeitura_id, api_url, api_token, client_token, instance_id, numero_origem, ativo
       FROM whatsapp_config 
       WHERE prefeitura_id = $1`,
      [prefeituraId]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Erro ao buscar configuração WhatsApp:', error);
    res.status(500).json({ error: 'Erro interno ao buscar configuração WhatsApp.' });
  }
});

// PUT - Atualizar ou criar configuração WhatsApp de uma prefeitura
router.put('/whatsapp/:prefeituraId', async (req: AuthRequest, res) => {
  try {
    await ensureWhatsappConfigColumns()
    const { prefeituraId } = req.params;
    const { 
      api_url, api_token, client_token, instance_id, numero_origem, ativo 
    } = req.body;
    const atualizado_por = req.user?.id || null;
    const before = await pool.query(
      `SELECT * FROM whatsapp_config WHERE prefeitura_id = $1`,
      [prefeituraId]
    )

    const result = await pool.query(
      `INSERT INTO whatsapp_config
        (prefeitura_id, api_url, api_token, client_token, instance_id, numero_origem, ativo, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (prefeitura_id) DO UPDATE SET
         api_url = EXCLUDED.api_url,
         api_token = EXCLUDED.api_token,
         client_token = EXCLUDED.client_token,
         instance_id = EXCLUDED.instance_id,
         numero_origem = EXCLUDED.numero_origem,
         ativo = EXCLUDED.ativo,
         atualizado_em = CURRENT_TIMESTAMP,
         atualizado_por = EXCLUDED.atualizado_por
      RETURNING *`,
      [
        prefeituraId, api_url, api_token, client_token, instance_id, numero_origem, ativo, atualizado_por
      ]
    );
    const updated = result.rows[0]
    await createServerAuditLog({
      userId: req.user?.id,
      userEmail: req.user?.email || null,
      userName: req.user?.name || req.user?.email || 'Administrador',
      userRole: req.user?.role || 'SUPER_ADMIN',
      action: 'UPDATE_SYSTEM_CONFIG',
      actionCategory: 'SYSTEM_CONFIG',
      description: 'Alterou configurações de WhatsApp na aba de Configurações Administrativas.',
      severity: 'HIGH',
      entityType: 'system_config',
      entityId: `whatsapp:${prefeituraId}`,
      oldValues: before.rows[0] || null,
      newValues: updated,
      status: 'success'
    }, req)

    res.status(200).json(updated);
  } catch (error) {
    console.error('Erro ao salvar configuração WhatsApp:', error);
    res.status(500).json({ error: 'Erro interno ao salvar configuração WhatsApp.' });
  }
});

export default router;