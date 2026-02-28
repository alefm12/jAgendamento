-- =====================================================
-- MIGRATION 014: HARDENING COMPLETO DO SCHEMA (SEM PERDA)
-- Objetivo: garantir todas as tabelas/colunas necessárias
-- sem usar DROP TABLE, preservando dados existentes.
-- =====================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------
-- BASE MULTI-TENANT
-- -----------------------------
CREATE TABLE IF NOT EXISTS prefeituras (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_branding (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color VARCHAR(30),
  secondary_color VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------
-- LOCAIS E ENDERECOS
-- -----------------------------
CREATE TABLE IF NOT EXISTS locais_atendimento (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  nome_local VARCHAR(150) NOT NULL,
  endereco TEXT,
  link_mapa TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE locais_atendimento ADD COLUMN IF NOT EXISTS link_mapa TEXT;
ALTER TABLE locais_atendimento ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE locais_atendimento ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS localidades_origem (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bairros (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  localidade_id INT NOT NULL REFERENCES localidades_origem(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE bairros ADD COLUMN IF NOT EXISTS prefeitura_id INT REFERENCES prefeituras(id) ON DELETE CASCADE;
ALTER TABLE bairros ADD COLUMN IF NOT EXISTS localidade_id INT REFERENCES localidades_origem(id) ON DELETE CASCADE;
ALTER TABLE bairros ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- -----------------------------
-- AGENDAMENTOS (MODELO PRINCIPAL EM PORTUGUES)
-- -----------------------------
CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  local_id INT REFERENCES locais_atendimento(id) ON DELETE SET NULL,
  protocolo VARCHAR(80) UNIQUE,
  cidadao_nome VARCHAR(255) NOT NULL,
  cidadao_cpf VARCHAR(20) NOT NULL,
  telefone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  genero VARCHAR(30),
  tipo_cin VARCHAR(50),
  numero_cin VARCHAR(60),
  endereco_rua VARCHAR(255),
  endereco_numero VARCHAR(60),
  regiao_tipo VARCHAR(60),
  regiao_nome VARCHAR(120),
  bairro_nome VARCHAR(150),
  data_agendamento DATE NOT NULL,
  hora_agendamento TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  aceite_termos BOOLEAN DEFAULT FALSE,
  aceite_notificacoes BOOLEAN DEFAULT FALSE,
  notas JSONB DEFAULT '[]'::jsonb,
  prioridade VARCHAR(20) DEFAULT 'normal',
  historico_status JSONB DEFAULT '[]'::jsonb,
  cancelado_por VARCHAR(30),
  motivo_cancelamento TEXT,
  concluido_em TIMESTAMP,
  concluido_por VARCHAR(255),
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS protocolo VARCHAR(80);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS genero VARCHAR(30);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS tipo_cin VARCHAR(50);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS numero_cin VARCHAR(60);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS endereco_rua VARCHAR(255);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS endereco_numero VARCHAR(60);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS regiao_tipo VARCHAR(60);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS regiao_nome VARCHAR(120);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS bairro_nome VARCHAR(150);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS notas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'normal';
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS historico_status JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(30);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMP;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS concluido_por VARCHAR(255);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agendamentos_protocolo_unique'
  ) THEN
    ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_protocolo_unique UNIQUE (protocolo);
  END IF;
END $$;

-- -----------------------------
-- BLOQUEIOS E CANCELAMENTOS
-- -----------------------------
CREATE TABLE IF NOT EXISTS datas_bloqueadas (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  motivo TEXT NOT NULL,
  tipo_bloqueio VARCHAR(50) DEFAULT 'full-day',
  horarios_bloqueados JSONB,
  criado_por VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cancelamentos (
  id SERIAL PRIMARY KEY,
  agendamento_id INT NOT NULL,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  cancelado_por VARCHAR(20) NOT NULL,
  cidadao_ip VARCHAR(50),
  cidadao_user_agent TEXT,
  usuario_id INT,
  usuario_nome VARCHAR(255),
  usuario_email VARCHAR(255),
  motivo TEXT,
  observacoes TEXT,
  cancelado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpf_cancelamentos (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(20) NOT NULL,
  agendamento_id INT,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  data_cancelamento TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpf_bloqueios (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(20) NOT NULL,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  data_bloqueio TIMESTAMPTZ DEFAULT NOW(),
  data_desbloqueio TIMESTAMPTZ,
  motivo TEXT,
  cancelamentos_count INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE
);

ALTER TABLE cpf_bloqueios ADD COLUMN IF NOT EXISTS cancelamentos_count INT DEFAULT 0;
ALTER TABLE cpf_bloqueios ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

-- -----------------------------
-- USUARIOS
-- -----------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  cpf VARCHAR(20),
  telefone VARCHAR(25),
  senha_hash TEXT NOT NULL,
  perfil VARCHAR(50) NOT NULL DEFAULT 'secretaria',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(25);

CREATE TABLE IF NOT EXISTS usuarios_secretaria (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  nome_completo VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cpf VARCHAR(20),
  telefone VARCHAR(25),
  usuario VARCHAR(120),
  senha_hash TEXT,
  eh_admin BOOLEAN DEFAULT FALSE,
  permissoes JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios_permissoes (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  secretaria_visualizar BOOLEAN DEFAULT TRUE,
  secretaria_confirmar_agendamento BOOLEAN DEFAULT TRUE,
  secretaria_adicionar_notas BOOLEAN DEFAULT TRUE,
  secretaria_filtrar_datas BOOLEAN DEFAULT TRUE,
  secretaria_exportar BOOLEAN DEFAULT FALSE,
  atendimento_visualizar BOOLEAN DEFAULT TRUE,
  atendimento_chamar BOOLEAN DEFAULT TRUE,
  atendimento_concluir BOOLEAN DEFAULT FALSE,
  atendimento_marcar_cin_pronta BOOLEAN DEFAULT FALSE,
  atendimento_marcar_cin_entregue BOOLEAN DEFAULT FALSE,
  analytics_visualizar BOOLEAN DEFAULT FALSE,
  analytics_exportar BOOLEAN DEFAULT FALSE,
  entrega_cin_visualizar BOOLEAN DEFAULT FALSE,
  entrega_cin_marcar_entregue BOOLEAN DEFAULT FALSE,
  admin_gerenciar_usuarios BOOLEAN DEFAULT FALSE,
  admin_configurar_sistema BOOLEAN DEFAULT FALSE,
  admin_bloquear_datas BOOLEAN DEFAULT FALSE,
  admin_gerenciar_locais BOOLEAN DEFAULT FALSE,
  admin_visualizar_logs BOOLEAN DEFAULT FALSE,
  locais_permitidos JSONB,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (usuario_id, prefeitura_id)
);

-- -----------------------------
-- CONFIGURACOES
-- -----------------------------
CREATE TABLE IF NOT EXISTS layout_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  area VARCHAR(50) NOT NULL,
  cor_primaria VARCHAR(7) DEFAULT '#059669',
  cor_secundaria VARCHAR(7) DEFAULT '#1d4ed8',
  cor_destaque VARCHAR(7) DEFAULT '#f59e0b',
  cor_fundo VARCHAR(7) DEFAULT '#ffffff',
  cor_texto VARCHAR(7) DEFAULT '#1f2937',
  cor_texto_secundario VARCHAR(7) DEFAULT '#6b7280',
  cor_botao_principal VARCHAR(7) DEFAULT '#2563eb',
  cor_botao_principal_hover VARCHAR(7) DEFAULT '#1d4ed8',
  cor_botao_secundario VARCHAR(7) DEFAULT '#10b981',
  cor_botao_secundario_hover VARCHAR(7) DEFAULT '#059669',
  cor_botao_cancelar VARCHAR(7) DEFAULT '#ef4444',
  cor_botao_cancelar_hover VARCHAR(7) DEFAULT '#dc2626',
  cor_status_pendente VARCHAR(7) DEFAULT '#f59e0b',
  cor_status_confirmado VARCHAR(7) DEFAULT '#10b981',
  cor_status_chamado VARCHAR(7) DEFAULT '#3b82f6',
  cor_status_concluido VARCHAR(7) DEFAULT '#059669',
  cor_status_cancelado VARCHAR(7) DEFAULT '#ef4444',
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INT,
  UNIQUE(prefeitura_id, area)
);

CREATE TABLE IF NOT EXISTS horarios_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
  horarios_disponiveis TEXT NOT NULL DEFAULT '08:00,08:30,09:00,09:30,10:00,10:30,11:00,11:30,13:00,13:30,14:00,14:30,15:00,15:30,16:00,16:30,17:00',
  max_agendamentos_por_horario INT DEFAULT 2,
  periodo_liberado_dias INT DEFAULT 60,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INT
);

CREATE TABLE IF NOT EXISTS notificacoes_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  email_ativo BOOLEAN DEFAULT TRUE,
  whatsapp_ativo BOOLEAN DEFAULT FALSE,
  sms_ativo BOOLEAN DEFAULT FALSE,
  lembrete_antecedencia_dias INT,
  email_assunto TEXT,
  email_corpo TEXT,
  whatsapp_mensagem TEXT,
  sms_mensagem TEXT,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INT,
  UNIQUE(prefeitura_id, tipo)
);

CREATE TABLE IF NOT EXISTS chamadas_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
  voz_tipo VARCHAR(50) DEFAULT 'google',
  voz_idioma VARCHAR(10) DEFAULT 'pt-BR',
  voz_genero VARCHAR(20) DEFAULT 'feminino',
  voz_velocidade DECIMAL(3,1) DEFAULT 1.0,
  voz_volume DECIMAL(3,1) DEFAULT 1.0,
  voz_tom DECIMAL(3,1) DEFAULT 1.0,
  template_chamada TEXT DEFAULT 'Senha {protocol}, {name}, comparecer ao guichê {guiche}',
  repetir_chamada BOOLEAN DEFAULT TRUE,
  numero_repeticoes INT DEFAULT 2,
  intervalo_repeticoes_segundos INT DEFAULT 5,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INT
);

CREATE TABLE IF NOT EXISTS geral_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
  nome_secretaria VARCHAR(255),
  endereco_completo TEXT,
  telefone_contato VARCHAR(20),
  email_contato VARCHAR(255),
  site_url VARCHAR(500),
  horario_funcionamento TEXT,
  relatorios_ativos TEXT[],
  backup_ativo BOOLEAN DEFAULT TRUE,
  backup_periodicidade VARCHAR(20) DEFAULT 'diario',
  backup_horario TIME DEFAULT '02:00:00',
  backup_retencao_dias INT DEFAULT 30,
  backup_email_notificacao VARCHAR(255),
  log_auditoria_ativo BOOLEAN DEFAULT TRUE,
  log_auditoria_retencao_dias INT DEFAULT 90,
  smtp_host VARCHAR(255),
  smtp_port INT DEFAULT 587,
  smtp_user VARCHAR(255),
  smtp_password VARCHAR(255),
  smtp_from_name VARCHAR(255),
  smtp_from_email VARCHAR(255),
  smtp_secure BOOLEAN DEFAULT TRUE,
  whatsapp_api_url VARCHAR(500),
  whatsapp_api_token TEXT,
  whatsapp_instance_id VARCHAR(255),
  whatsapp_from_number VARCHAR(30),
  whatsapp_enabled BOOLEAN DEFAULT FALSE,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INT
);

CREATE TABLE IF NOT EXISTS campos_personalizados (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  nome_campo VARCHAR(100) NOT NULL,
  label_campo VARCHAR(255) NOT NULL,
  tipo_campo VARCHAR(50) NOT NULL,
  placeholder TEXT,
  texto_ajuda TEXT,
  obrigatorio BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  opcoes JSONB,
  ordem INT DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smtp_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
  smtp_host VARCHAR(255),
  smtp_port INT DEFAULT 587,
  smtp_user VARCHAR(255),
  smtp_password VARCHAR(255),
  smtp_from_name VARCHAR(255),
  smtp_from_email VARCHAR(255),
  smtp_secure BOOLEAN DEFAULT TRUE,
  ativo BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INT
);

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
  api_url VARCHAR(500),
  api_token TEXT,
  instance_id VARCHAR(255),
  numero_origem VARCHAR(30),
  ativo BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INT
);

-- -----------------------------
-- RELATORIOS E AUDITORIA
-- -----------------------------
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(100),
  filters JSONB,
  columns JSONB,
  sort_config JSONB,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  frequency VARCHAR(50),
  recipients JSONB,
  format VARCHAR(20) DEFAULT 'pdf',
  is_active BOOLEAN DEFAULT TRUE,
  last_execution TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  template_name VARCHAR(255),
  status VARCHAR(50),
  records_count INT,
  error_message TEXT,
  file_path TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  description TEXT,
  performed_by VARCHAR(255),
  performed_by_role VARCHAR(50),
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  target_name VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  changes JSONB,
  metadata JSONB,
  tags TEXT[],
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------
-- TABELAS LEGADAS (EN)
-- -----------------------------
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  google_maps_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol VARCHAR(80) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  cpf VARCHAR(20) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  reason TEXT NOT NULL,
  block_type VARCHAR(50) DEFAULT 'full-day',
  blocked_times JSONB,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------
-- INDICES
-- -----------------------------
CREATE INDEX IF NOT EXISTS idx_agendamentos_prefeitura ON agendamentos(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_local_data ON agendamentos(local_id, data_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cpf ON agendamentos(cidadao_cpf);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);

CREATE INDEX IF NOT EXISTS idx_bloqueios_prefeitura_data ON datas_bloqueadas(prefeitura_id, data);
CREATE INDEX IF NOT EXISTS idx_cancelamentos_prefeitura ON cancelamentos(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_cpf_cancelamentos_cpf ON cpf_cancelamentos(cpf);
CREATE INDEX IF NOT EXISTS idx_cpf_bloqueios_cpf_ativo ON cpf_bloqueios(cpf, ativo);

CREATE INDEX IF NOT EXISTS idx_locais_prefeitura ON locais_atendimento(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_localidades_prefeitura ON localidades_origem(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_bairros_localidade ON bairros(localidade_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_prefeitura ON usuarios(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_secretaria_prefeitura ON usuarios_secretaria(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_layout_prefeitura_area ON layout_config(prefeitura_id, area);
CREATE INDEX IF NOT EXISTS idx_notificacoes_prefeitura_tipo ON notificacoes_config(prefeitura_id, tipo);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- -----------------------------
-- DADOS PADRAO MINIMOS
-- -----------------------------
INSERT INTO prefeituras (nome, slug, ativo)
SELECT 'Prefeitura de Irauçuba', 'iraucuba', TRUE
WHERE NOT EXISTS (SELECT 1 FROM prefeituras WHERE slug = 'iraucuba');

INSERT INTO locais_atendimento (prefeitura_id, nome_local, endereco, ativo)
SELECT 1, 'Secretaria Municipal', 'Rua Principal, 100', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM locais_atendimento WHERE prefeitura_id = 1
);

INSERT INTO horarios_config (prefeitura_id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM horarios_config WHERE prefeitura_id = 1);

INSERT INTO geral_config (prefeitura_id, nome_secretaria)
SELECT 1, 'Secretaria Municipal'
WHERE NOT EXISTS (SELECT 1 FROM geral_config WHERE prefeitura_id = 1);

COMMIT;

