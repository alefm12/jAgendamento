-- Migration 009: Adicionar coluna configuracoes na tabela prefeituras
-- Armazena configurações gerais do sistema em formato JSON

ALTER TABLE prefeituras 
ADD COLUMN IF NOT EXISTS configuracoes JSONB DEFAULT '{
  "systemName": "Sistema de Agendamento",
  "primaryColor": "#3b82f6",
  "secondaryColor": "#1e40af",
  "accentColor": "#6366f1",
  "nomeSecretaria": "Secretaria Municipal",
  "enderecoCompleto": "",
  "telefoneContato": "",
  "emailContato": "",
  "horarioFuncionamento": "08:00 às 17:00",
  "backupAtivo": true,
  "backupPeriodicidade": "diario",
  "backupHorario": "02:00:00",
  "backupRetencaoDias": 30,
  "emailContato": "",
  "logAuditoriaAtivo": true,
  "logAuditoriaRetencaoDias": 90
}'::jsonb;

-- Criar índice para consultas rápidas em campos JSON específicos
CREATE INDEX IF NOT EXISTS idx_prefeituras_configuracoes ON prefeituras USING gin(configuracoes);

COMMENT ON COLUMN prefeituras.configuracoes IS 'Configurações gerais do sistema em formato JSON (cores, nome, secretaria, backups, etc.)';
