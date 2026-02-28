-- Migration 011: Tabelas para Configurações de SMTP e WhatsApp
-- Cria tabelas específicas para armazenar configurações de envio de notificações

-- Tabela de Configuração SMTP
DROP TABLE IF EXISTS smtp_config CASCADE;

CREATE TABLE smtp_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  
  -- Configurações do Servidor
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_user VARCHAR(255),
  smtp_password VARCHAR(255),
  smtp_from_name VARCHAR(255),
  smtp_from_email VARCHAR(255),
  smtp_secure BOOLEAN DEFAULT true,
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  
  -- Auditoria
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INTEGER,
  
  UNIQUE(prefeitura_id),
  CONSTRAINT fk_smtp_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- Tabela de Configuração WhatsApp API
DROP TABLE IF EXISTS whatsapp_config CASCADE;

CREATE TABLE whatsapp_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  
  -- Configurações da API
  api_url VARCHAR(500),
  api_token TEXT,
  instance_id VARCHAR(255),
  numero_origem VARCHAR(20),
  
  -- Status
  ativo BOOLEAN DEFAULT false,
  
  -- Auditoria
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INTEGER,
  
  UNIQUE(prefeitura_id),
  CONSTRAINT fk_whatsapp_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_smtp_config_prefeitura ON smtp_config(prefeitura_id);
CREATE INDEX idx_whatsapp_config_prefeitura ON whatsapp_config(prefeitura_id);

-- Comentários
COMMENT ON TABLE smtp_config IS 'Configurações de servidor SMTP para envio de e-mails automáticos';
COMMENT ON TABLE whatsapp_config IS 'Configurações de API do WhatsApp para envio de mensagens automáticas';

-- Inserir configurações padrão para prefeitura ID 1
INSERT INTO smtp_config (prefeitura_id, smtp_host, smtp_port, smtp_secure, ativo)
VALUES (1, '', 587, true, false)
ON CONFLICT (prefeitura_id) DO NOTHING;

INSERT INTO whatsapp_config (prefeitura_id, api_url, ativo)
VALUES (1, '', false)
ON CONFLICT (prefeitura_id) DO NOTHING;
