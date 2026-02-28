-- Adicionar campos sala e guiche na tabela agendamentos
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS sala VARCHAR(50),
ADD COLUMN IF NOT EXISTS guiche VARCHAR(50);

-- Criar índice para facilitar buscas
CREATE INDEX IF NOT EXISTS idx_agendamentos_sala ON agendamentos(sala);
CREATE INDEX IF NOT EXISTS idx_agendamentos_guiche ON agendamentos(guiche);
