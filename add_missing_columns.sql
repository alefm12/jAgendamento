-- Adicionar colunas faltantes na tabela agendamentos
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS notas JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS historico_status JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ultima_modificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Gerar protocolo automaticamente se não existir
UPDATE agendamentos SET protocolo = 'AGD-' || id WHERE protocolo IS NULL;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_protocolo ON agendamentos(protocolo);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendamento);

COMMENT ON COLUMN agendamentos.notas IS 'Notas do agendamento em formato JSON array';
COMMENT ON COLUMN agendamentos.prioridade IS 'Prioridade: normal, high, urgent';
COMMENT ON COLUMN agendamentos.historico_status IS 'Histórico de mudanças de status em formato JSON';
