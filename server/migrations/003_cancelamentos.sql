-- Migration: Tabela de cancelamentos
-- Criada em: 2026-02-01
-- Descrição: Armazena informações detalhadas sobre cancelamentos de agendamentos

CREATE TABLE IF NOT EXISTS cancelamentos (
  id SERIAL PRIMARY KEY,
  agendamento_id INTEGER NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  prefeitura_id INTEGER NOT NULL,
  
  -- Tipo de cancelamento
  cancelado_por VARCHAR(20) NOT NULL CHECK (cancelado_por IN ('cidadao', 'secretaria', 'sistema')),
  
  -- Informações do cidadão (se cancelado pelo cidadão)
  cidadao_ip VARCHAR(50),
  cidadao_user_agent TEXT,
  
  -- Informações do usuário da secretaria (se cancelado pela secretaria)
  usuario_id INTEGER REFERENCES usuarios(id),
  usuario_nome VARCHAR(255),
  usuario_email VARCHAR(255),
  
  -- Motivo e observações
  motivo TEXT,
  observacoes TEXT,
  
  -- Timestamps
  cancelado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Índices
  CONSTRAINT fk_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE,
  CONSTRAINT fk_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id)
);

-- Índices para melhorar performance
CREATE INDEX idx_cancelamentos_agendamento ON cancelamentos(agendamento_id);
CREATE INDEX idx_cancelamentos_prefeitura ON cancelamentos(prefeitura_id);
CREATE INDEX idx_cancelamentos_usuario ON cancelamentos(usuario_id);
CREATE INDEX idx_cancelamentos_data ON cancelamentos(cancelado_em);
CREATE INDEX idx_cancelamentos_tipo ON cancelamentos(cancelado_por);

-- Comentários
COMMENT ON TABLE cancelamentos IS 'Registro detalhado de cancelamentos de agendamentos';
COMMENT ON COLUMN cancelamentos.cancelado_por IS 'Tipo de cancelamento: cidadao, secretaria ou sistema';
COMMENT ON COLUMN cancelamentos.cidadao_ip IS 'IP do cidadão que cancelou (se aplicável)';
COMMENT ON COLUMN cancelamentos.usuario_nome IS 'Nome do usuário da secretaria que cancelou';
