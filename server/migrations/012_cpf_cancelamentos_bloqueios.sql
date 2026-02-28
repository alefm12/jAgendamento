-- Migration 012: Sistema de Rastreamento de Cancelamentos e Bloqueio de CPF
-- Impede que usuários que cancelarem 3 vezes em 7 dias façam novos agendamentos por 7 dias

-- Tabela para registrar histórico de cancelamentos por CPF
CREATE TABLE IF NOT EXISTS cpf_cancelamentos (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL,  -- Formato: XXX.XXX.XXX-XX
    agendamento_id INTEGER,
    prefeitura_id INTEGER,
    data_cancelamento TIMESTAMP DEFAULT NOW(),
    motivo TEXT DEFAULT 'Cancelamento pelo cidadão',
    FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- Índices para otimizar consultas
CREATE INDEX idx_cpf_cancelamentos_cpf ON cpf_cancelamentos(cpf);
CREATE INDEX idx_cpf_cancelamentos_data ON cpf_cancelamentos(data_cancelamento);
CREATE INDEX idx_cpf_cancelamentos_cpf_data ON cpf_cancelamentos(cpf, data_cancelamento);

-- Tabela para registrar bloqueios temporários de CPF
CREATE TABLE IF NOT EXISTS cpf_bloqueios (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,  -- Formato: XXX.XXX.XXX-XX
    prefeitura_id INTEGER,
    data_bloqueio TIMESTAMP DEFAULT NOW(),
    data_desbloqueio TIMESTAMP NOT NULL,
    motivo TEXT NOT NULL,
    cancelamentos_count INTEGER DEFAULT 3,
    ativo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- Índices para otimizar consultas
CREATE INDEX idx_cpf_bloqueios_cpf ON cpf_bloqueios(cpf);
CREATE INDEX idx_cpf_bloqueios_ativo ON cpf_bloqueios(ativo);
CREATE INDEX idx_cpf_bloqueios_cpf_ativo ON cpf_bloqueios(cpf, ativo);

-- Comentários nas tabelas
COMMENT ON TABLE cpf_cancelamentos IS 'Registra histórico de todos os cancelamentos de agendamentos por CPF';
COMMENT ON TABLE cpf_bloqueios IS 'Registra bloqueios temporários de CPF devido a excesso de cancelamentos';

COMMENT ON COLUMN cpf_cancelamentos.cpf IS 'CPF do cidadão que cancelou (com formatação)';
COMMENT ON COLUMN cpf_cancelamentos.agendamento_id IS 'ID do agendamento cancelado';
COMMENT ON COLUMN cpf_cancelamentos.data_cancelamento IS 'Data e hora do cancelamento';

COMMENT ON COLUMN cpf_bloqueios.cpf IS 'CPF bloqueado temporariamente';
COMMENT ON COLUMN cpf_bloqueios.data_bloqueio IS 'Data e hora em que o bloqueio foi aplicado';
COMMENT ON COLUMN cpf_bloqueios.data_desbloqueio IS 'Data e hora em que o bloqueio será removido automaticamente';
COMMENT ON COLUMN cpf_bloqueios.cancelamentos_count IS 'Quantidade de cancelamentos que causaram o bloqueio';
COMMENT ON COLUMN cpf_bloqueios.ativo IS 'Se TRUE, o bloqueio está ativo. Se FALSE, já expirou';
