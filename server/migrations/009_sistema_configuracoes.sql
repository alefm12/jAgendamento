-- Migration 009: Sistema de Configurações Completo
-- Tabelas para armazenar todas as configurações do sistema

-- 1. Configurações de Layout (Cores)
DROP TABLE IF EXISTS layout_config CASCADE;

CREATE TABLE layout_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  area VARCHAR(50) NOT NULL, -- 'public', 'secretary', 'attendance'
  
  -- Cores principais
  cor_primaria VARCHAR(7) DEFAULT '#059669',
  cor_secundaria VARCHAR(7) DEFAULT '#1d4ed8',
  cor_destaque VARCHAR(7) DEFAULT '#f59e0b',
  cor_fundo VARCHAR(7) DEFAULT '#ffffff',
  cor_texto VARCHAR(7) DEFAULT '#1f2937',
  cor_texto_secundario VARCHAR(7) DEFAULT '#6b7280',
  
  -- Cores de botões
  cor_botao_principal VARCHAR(7) DEFAULT '#2563eb',
  cor_botao_principal_hover VARCHAR(7) DEFAULT '#1d4ed8',
  cor_botao_secundario VARCHAR(7) DEFAULT '#10b981',
  cor_botao_secundario_hover VARCHAR(7) DEFAULT '#059669',
  cor_botao_cancelar VARCHAR(7) DEFAULT '#ef4444',
  cor_botao_cancelar_hover VARCHAR(7) DEFAULT '#dc2626',
  
  -- Cores de status
  cor_status_pendente VARCHAR(7) DEFAULT '#f59e0b',
  cor_status_confirmado VARCHAR(7) DEFAULT '#10b981',
  cor_status_chamado VARCHAR(7) DEFAULT '#3b82f6',
  cor_status_concluido VARCHAR(7) DEFAULT '#059669',
  cor_status_cancelado VARCHAR(7) DEFAULT '#ef4444',
  
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INTEGER,
  
  UNIQUE(prefeitura_id, area),
  CONSTRAINT fk_layout_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- 2. Configurações de Horários
DROP TABLE IF EXISTS horarios_config CASCADE;

CREATE TABLE horarios_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  
  -- Horários disponíveis (separados por vírgula)
  horarios_disponiveis TEXT NOT NULL DEFAULT '08:00,08:30,09:00,09:30,10:00,10:30,11:00,11:30,13:00,13:30,14:00,14:30,15:00,15:30,16:00,16:30,17:00',
  
  -- Máximo de agendamentos por horário
  max_agendamentos_por_horario INTEGER DEFAULT 2,
  
  -- Período liberado para agendamentos (em dias)
  periodo_liberado_dias INTEGER DEFAULT 60,
  
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INTEGER,
  
  UNIQUE(prefeitura_id),
  CONSTRAINT fk_horarios_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- 3. Configurações de Notificações
DROP TABLE IF EXISTS notificacoes_config CASCADE;

CREATE TABLE notificacoes_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'agendamento', 'lembrete', 'cancelamento', 'concluido', 'cin_pronta', 'cin_entregue'
  
  -- Configurações de envio
  email_ativo BOOLEAN DEFAULT true,
  whatsapp_ativo BOOLEAN DEFAULT false,
  sms_ativo BOOLEAN DEFAULT false,
  
  -- Timing para lembretes
  lembrete_antecedencia_dias INTEGER, -- null para outros tipos, preenchido para 'lembrete'
  
  -- Templates de mensagem
  email_assunto TEXT,
  email_corpo TEXT,
  whatsapp_mensagem TEXT,
  sms_mensagem TEXT,
  
  -- Configurações de servidor (email)
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_usuario VARCHAR(255),
  smtp_senha VARCHAR(255),
  smtp_de_email VARCHAR(255),
  smtp_de_nome VARCHAR(255),
  
  -- Configurações de WhatsApp
  whatsapp_api_url VARCHAR(500),
  whatsapp_api_token TEXT,
  whatsapp_numero_origem VARCHAR(20),
  
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INTEGER,
  
  UNIQUE(prefeitura_id, tipo),
  CONSTRAINT fk_notificacoes_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- 4. Configurações de Chamadas (Voz e Layout)
DROP TABLE IF EXISTS chamadas_config CASCADE;

CREATE TABLE chamadas_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  
  -- Configurações de voz
  voz_tipo VARCHAR(50) DEFAULT 'google', -- 'google', 'azure', 'aws'
  voz_idioma VARCHAR(10) DEFAULT 'pt-BR',
  voz_genero VARCHAR(20) DEFAULT 'feminino', -- 'masculino', 'feminino'
  voz_velocidade DECIMAL(3,1) DEFAULT 1.0, -- 0.5 a 2.0
  voz_volume DECIMAL(3,1) DEFAULT 1.0, -- 0.0 a 1.0
  voz_tom DECIMAL(3,1) DEFAULT 1.0, -- 0.5 a 2.0
  
  -- Layout da interface de chamada
  cor_fundo_chamada VARCHAR(7) DEFAULT '#1f2937',
  cor_texto_chamada VARCHAR(7) DEFAULT '#ffffff',
  cor_destaque_chamada VARCHAR(7) DEFAULT '#3b82f6',
  cor_botao_chamar VARCHAR(7) DEFAULT '#10b981',
  cor_botao_chamar_hover VARCHAR(7) DEFAULT '#059669',
  
  -- Template de mensagem de chamada
  template_chamada TEXT DEFAULT 'Senha {protocol}, {name}, comparecer ao guichê {guiche}',
  
  -- Repetições
  repetir_chamada BOOLEAN DEFAULT true,
  numero_repeticoes INTEGER DEFAULT 2,
  intervalo_repeticoes_segundos INTEGER DEFAULT 5,
  
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INTEGER,
  
  UNIQUE(prefeitura_id),
  CONSTRAINT fk_chamadas_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- 5. Configurações Gerais
DROP TABLE IF EXISTS geral_config CASCADE;

CREATE TABLE geral_config (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  
  -- Informações da secretaria
  nome_secretaria VARCHAR(255),
  endereco_completo TEXT,
  telefone_contato VARCHAR(20),
  email_contato VARCHAR(255),
  site_url VARCHAR(500),
  horario_funcionamento TEXT,
  
  -- Relatórios disponíveis (array de strings)
  relatorios_ativos TEXT[] DEFAULT ARRAY[
    'agendamentos', 'localidade', 'bairro', 'status', 
    'periodo', 'regiao', 'genero', 'tipo_cin'
  ],
  
  -- Backup
  backup_ativo BOOLEAN DEFAULT true,
  backup_periodicidade VARCHAR(20) DEFAULT 'diario', -- 'diario', 'semanal', 'mensal'
  backup_horario TIME DEFAULT '02:00:00',
  backup_retencao_dias INTEGER DEFAULT 30,
  backup_email_notificacao VARCHAR(255),
  
  -- Logs de auditoria
  log_auditoria_ativo BOOLEAN DEFAULT true,
  log_auditoria_retencao_dias INTEGER DEFAULT 90,
  
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por INTEGER,
  
  UNIQUE(prefeitura_id),
  CONSTRAINT fk_geral_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- 6. Permissões de Usuários (detalhadas por recurso)
DROP TABLE IF EXISTS usuarios_permissoes CASCADE;

CREATE TABLE usuarios_permissoes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  prefeitura_id INTEGER NOT NULL,
  
  -- Permissões da Secretaria
  secretaria_visualizar BOOLEAN DEFAULT true,
  secretaria_confirmar_agendamento BOOLEAN DEFAULT true,
  secretaria_adicionar_notas BOOLEAN DEFAULT true,
  secretaria_filtrar_datas BOOLEAN DEFAULT true,
  secretaria_exportar BOOLEAN DEFAULT false,
  
  -- Permissões de Atendimento
  atendimento_visualizar BOOLEAN DEFAULT true,
  atendimento_chamar BOOLEAN DEFAULT true,
  atendimento_concluir BOOLEAN DEFAULT false,
  atendimento_marcar_cin_pronta BOOLEAN DEFAULT false,
  atendimento_marcar_cin_entregue BOOLEAN DEFAULT false,
  
  -- Permissões de Analytics
  analytics_visualizar BOOLEAN DEFAULT false,
  analytics_exportar BOOLEAN DEFAULT false,
  
  -- Permissões de Entrega CIN
  entrega_cin_visualizar BOOLEAN DEFAULT false,
  entrega_cin_marcar_entregue BOOLEAN DEFAULT false,
  
  -- Permissões Administrativas
  admin_gerenciar_usuarios BOOLEAN DEFAULT false,
  admin_configurar_sistema BOOLEAN DEFAULT false,
  admin_bloquear_datas BOOLEAN DEFAULT false,
  admin_gerenciar_locais BOOLEAN DEFAULT false,
  admin_visualizar_logs BOOLEAN DEFAULT false,
  
  -- Acesso por local (JSON array de IDs de locais)
  -- null = acesso a todos os locais
  -- [1, 2, 3] = acesso apenas aos locais 1, 2 e 3
  locais_permitidos JSONB,
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(usuario_id, prefeitura_id),
  CONSTRAINT fk_permissoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_permissoes_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- 7. Campos Personalizados (já existe, apenas garantir estrutura)
DROP TABLE IF EXISTS campos_personalizados CASCADE;

CREATE TABLE campos_personalizados (
  id SERIAL PRIMARY KEY,
  prefeitura_id INTEGER NOT NULL,
  
  nome_campo VARCHAR(100) NOT NULL, -- identificador técnico (ex: 'nome_mae')
  label_campo VARCHAR(255) NOT NULL, -- texto exibido (ex: 'Nome da Mãe')
  tipo_campo VARCHAR(50) NOT NULL, -- 'text', 'number', 'email', 'tel', 'date', 'select', 'checkbox', 'textarea'
  placeholder TEXT,
  texto_ajuda TEXT,
  
  -- Validação
  obrigatorio BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  
  -- Opções para select (JSON array)
  opcoes JSONB,
  
  -- Ordem de exibição
  ordem INTEGER DEFAULT 0,
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_campos_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_layout_config_prefeitura ON layout_config(prefeitura_id);
CREATE INDEX idx_horarios_config_prefeitura ON horarios_config(prefeitura_id);
CREATE INDEX idx_notificacoes_config_prefeitura ON notificacoes_config(prefeitura_id);
CREATE INDEX idx_chamadas_config_prefeitura ON chamadas_config(prefeitura_id);
CREATE INDEX idx_geral_config_prefeitura ON geral_config(prefeitura_id);
CREATE INDEX idx_usuarios_permissoes_usuario ON usuarios_permissoes(usuario_id);
CREATE INDEX idx_usuarios_permissoes_prefeitura ON usuarios_permissoes(prefeitura_id);
CREATE INDEX idx_campos_personalizados_prefeitura ON campos_personalizados(prefeitura_id);

-- Inserir configurações padrão para a prefeitura 1
INSERT INTO layout_config (prefeitura_id, area) VALUES 
  (1, 'public'),
  (1, 'secretary'),
  (1, 'attendance');

INSERT INTO horarios_config (prefeitura_id) VALUES (1);

INSERT INTO notificacoes_config (prefeitura_id, tipo, email_assunto, email_corpo) VALUES 
  (1, 'agendamento', 'Agendamento Confirmado - {systemName}', 'Olá {name},\n\nSeu agendamento foi realizado com sucesso!\n\nData: {date}\nHorário: {time}\nProtocolo: {protocol}\n\nAtenciosamente,\n{systemName}'),
  (1, 'lembrete', 'Lembrete - Agendamento Amanhã', 'Olá {name},\n\nLembramos que você tem um agendamento amanhã:\n\nData: {date}\nHorário: {time}\nLocal: {location}\n\nNão esqueça seus documentos!'),
  (1, 'cancelamento', 'Agendamento Cancelado', 'Olá {name},\n\nSeu agendamento foi cancelado.\n\nProtocolo: {protocol}\n\nQualquer dúvida, entre em contato conosco.'),
  (1, 'concluido', 'Atendimento Concluído', 'Olá {name},\n\nSeu atendimento foi concluído com sucesso!\n\nProtocolo: {protocol}'),
  (1, 'cin_pronta', 'CIN Pronta para Retirada', 'Olá {name},\n\nSua CIN está pronta para retirada!\n\nCompareça ao local com seus documentos.\n\nProtocolo: {protocol}'),
  (1, 'cin_entregue', 'CIN Entregue', 'Olá {name},\n\nSua CIN foi entregue com sucesso!\n\nProtocolo: {protocol}');

INSERT INTO chamadas_config (prefeitura_id) VALUES (1);

INSERT INTO geral_config (prefeitura_id, nome_secretaria) VALUES (1, 'Secretaria Municipal');

-- Comentários
COMMENT ON TABLE layout_config IS 'Configurações de cores e layout por área do sistema';
COMMENT ON TABLE horarios_config IS 'Configurações de horários disponíveis para agendamento';
COMMENT ON TABLE notificacoes_config IS 'Configurações de notificações por email, WhatsApp e SMS';
COMMENT ON TABLE chamadas_config IS 'Configurações do sistema de chamadas de voz';
COMMENT ON TABLE geral_config IS 'Configurações gerais da secretaria e prefeitura';
COMMENT ON TABLE usuarios_permissoes IS 'Permissões detalhadas por usuário e recurso do sistema';
COMMENT ON TABLE campos_personalizados IS 'Campos personalizados para o formulário de agendamento';
