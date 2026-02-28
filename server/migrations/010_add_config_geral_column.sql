-- Migration 010: Adicionar coluna config_geral para configurações SMTP e WhatsApp
-- Adiciona coluna JSONB para armazenar configurações gerais da prefeitura

ALTER TABLE prefeituras 
ADD COLUMN IF NOT EXISTS config_geral JSONB DEFAULT '{}'::jsonb;

-- Comentário
COMMENT ON COLUMN prefeituras.config_geral IS 'Configurações gerais incluindo SMTP, WhatsApp API, informações da secretaria, relatórios e backup';
