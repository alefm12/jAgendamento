import { Router } from 'express';
import { pool } from '../config/db';
import { type AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

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

// GET Configurações de SMTP
router.get('/system-config/smtp/:prefeituraId', async (req, res) => {
  const { prefeituraId } = req.params;
  try {
    await ensureSmtpConfigTable()
    const result = await pool.query('SELECT * FROM smtp_config WHERE prefeitura_id = $1', [prefeituraId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Configuração SMTP não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar configuração SMTP:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// POST ou PUT (upsert) Configurações de SMTP
router.post('/system-config/smtp/:prefeituraId', async (req: AuthRequest, res) => {
  const { prefeituraId } = req.params;
  const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure, ativo } = req.body;
  const atualizado_por = req.user?.id;

  try {
    await ensureSmtpConfigTable()
    const result = await pool.query(
      `INSERT INTO smtp_config (prefeitura_id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure, ativo, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (prefeitura_id)
       DO UPDATE SET
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
      [prefeituraId, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure, ativo, atualizado_por]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar configuração SMTP:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// GET Configurações do WhatsApp
router.get('/system-config/whatsapp/:prefeituraId', async (req, res) => {
  const { prefeituraId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM whatsapp_config WHERE prefeitura_id = $1', [prefeituraId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Configuração do WhatsApp não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar configuração do WhatsApp:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// POST ou PUT (upsert) Configurações do WhatsApp
router.post('/system-config/whatsapp/:prefeituraId', async (req: AuthRequest, res) => {
  const { prefeituraId } = req.params;
  const { api_url, api_token, instance_id, numero_origem, ativo } = req.body;
  const atualizado_por = req.user?.id;

  try {
    const result = await pool.query(
      `INSERT INTO whatsapp_config (prefeitura_id, api_url, api_token, instance_id, numero_origem, ativo, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (prefeitura_id)
       DO UPDATE SET
         api_url = EXCLUDED.api_url,
         api_token = EXCLUDED.api_token,
         instance_id = EXCLUDED.instance_id,
         numero_origem = EXCLUDED.numero_origem,
         ativo = EXCLUDED.ativo,
         atualizado_em = CURRENT_TIMESTAMP,
         atualizado_por = EXCLUDED.atualizado_por
       RETURNING *`,
      [prefeituraId, api_url, api_token, instance_id, numero_origem, ativo, atualizado_por]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar configuração do WhatsApp:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

export default router;