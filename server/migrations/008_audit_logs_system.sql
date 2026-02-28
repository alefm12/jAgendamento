-- Migration 008: Sistema de Auditoria Completo
-- Tabela de logs de auditoria para rastrear todas as ações dos usuários do sistema

DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  
  -- Identificação do usuário
  user_id INTEGER,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  user_role VARCHAR(50), -- 'SUPER_ADMIN', 'SECRETARY', etc.
  
  -- Informações da ação
  action VARCHAR(100) NOT NULL, -- 'LOGIN', 'LOGOUT', 'CREATE_APPOINTMENT', 'UPDATE_APPOINTMENT', 'DELETE_APPOINTMENT', 'LOGIN_FAILED', etc.
  action_category VARCHAR(50), -- 'AUTH', 'APPOINTMENT', 'USER_MANAGEMENT', 'SYSTEM_CONFIG', etc.
  description TEXT, -- Descrição detalhada da ação
  severity VARCHAR(20) DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  
  -- Dados modificados
  entity_type VARCHAR(50), -- 'appointment', 'user', 'location', etc.
  entity_id VARCHAR(100), -- ID da entidade afetada
  old_values JSONB, -- Valores anteriores
  new_values JSONB, -- Novos valores
  
  -- Informações de rede
  ip_address VARCHAR(50),
  user_agent TEXT, -- Informações do navegador/dispositivo
  device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
  browser VARCHAR(100),
  os VARCHAR(100),
  
  -- Geolocalização
  country VARCHAR(100),
  region VARCHAR(100),
  city VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Informações de sessão
  session_id VARCHAR(255),
  request_id VARCHAR(255),
  
  -- Tenant/Prefeitura
  tenant_id INTEGER,
  tenant_name VARCHAR(255),
  
  -- Status e resultado
  status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed', 'error'
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices para performance
  CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES prefeituras(id) ON DELETE SET NULL
);

-- Índices para otimizar consultas
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Comentários
COMMENT ON TABLE audit_logs IS 'Registro completo de auditoria de todas as ações dos usuários do sistema';
COMMENT ON COLUMN audit_logs.action IS 'Tipo de ação realizada';
COMMENT ON COLUMN audit_logs.severity IS 'Nível de severidade: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN audit_logs.old_values IS 'Valores anteriores em formato JSON';
COMMENT ON COLUMN audit_logs.new_values IS 'Novos valores em formato JSON';
