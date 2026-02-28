-- =====================================================
-- BANCO COMPLETO - 13 TABELAS - MULTI-TENANT
-- Sistema de Agendamento de CIN para Prefeituras
-- EXECUTE TUDO NO PGADMIN
-- =====================================================

-- Limpar tabelas antigas
DROP TABLE IF EXISTS usuario_metadata CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS logs_execucao_relatorios CASCADE;
DROP TABLE IF EXISTS relatorios_agendados CASCADE;
DROP TABLE IF EXISTS templates_relatorios CASCADE;
DROP TABLE IF EXISTS historico_lembretes CASCADE;
DROP TABLE IF EXISTS logs_auditoria CASCADE;
DROP TABLE IF EXISTS datas_bloqueadas CASCADE;
DROP TABLE IF EXISTS usuarios_secretaria CASCADE;
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS bairros CASCADE;
DROP TABLE IF EXISTS localidades_origem CASCADE;
DROP TABLE IF EXISTS locais_atendimento CASCADE;
DROP TABLE IF EXISTS configuracoes_prefeitura CASCADE;
DROP TABLE IF EXISTS prefeituras CASCADE;
DROP TABLE IF EXISTS super_admins CASCADE;

-- =====================================================
-- TABELA 1: SUPER_ADMINS (Administradores Globais)
-- =====================================================
CREATE TABLE super_admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 2: PREFEITURAS (Tenants)
-- =====================================================
CREATE TABLE prefeituras (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cnpj VARCHAR(20),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 3: CONFIGURACOES_PREFEITURA (Página Pública)
-- =====================================================
CREATE TABLE configuracoes_prefeitura (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    
    -- Visual da Página Pública
    nome_sistema VARCHAR(255) DEFAULT 'Agendamento CIN',
    logo_url TEXT,
    brasao_url TEXT,
    imagem_fundo_url TEXT,
    favicon_url TEXT,
    
    -- Cores
    cor_primaria VARCHAR(50) DEFAULT '#2563eb',
    cor_secundaria VARCHAR(50) DEFAULT '#10b981',
    cor_destaque VARCHAR(50) DEFAULT '#f59e0b',
    cor_fundo VARCHAR(50) DEFAULT '#ffffff',
    cor_texto VARCHAR(50) DEFAULT '#1f2937',
    
    -- Textos
    texto_boas_vindas TEXT,
    texto_rodape TEXT,
    mensagem_lembrete TEXT,
    
    -- Contato
    telefone VARCHAR(50),
    email VARCHAR(255),
    endereco TEXT,
    site_url TEXT,
    facebook_url TEXT,
    instagram_url TEXT,
    
    -- Configurações de Agendamento
    dias_janela_agendamento INTEGER DEFAULT 60,
    horarios_trabalho JSONB,
    max_agendamentos_por_horario INTEGER DEFAULT 2,
    
    -- Configurações de Notificação
    config_email JSONB,
    config_sms JSONB,
    config_whatsapp JSONB,
    config_lgpd JSONB,
    
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(prefeitura_id)
);

-- =====================================================
-- TABELA 4: LOCAIS_ATENDIMENTO (Locais de Atendimento)
-- =====================================================
CREATE TABLE locais_atendimento (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    
    nome_local VARCHAR(100) NOT NULL,
    endereco TEXT,
    tipo VARCHAR(50) DEFAULT 'sede',
    link_mapa TEXT,
    
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(20),
    telefone VARCHAR(50),
    email VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    ativo BOOLEAN DEFAULT TRUE,
    horarios_funcionamento JSONB,
    max_agendamentos_por_horario INTEGER DEFAULT 2,
    
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 5: LOCALIDADES_ORIGEM (Distritos/Sedes)
-- =====================================================
CREATE TABLE localidades_origem (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'distrito',
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT localidades_origem_unique UNIQUE (prefeitura_id, nome)
);

-- =====================================================
-- TABELA 6: BAIRROS (Bairros das Localidades)
-- =====================================================
CREATE TABLE bairros (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    localidade_id INTEGER NOT NULL REFERENCES localidades_origem(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bairros_unique UNIQUE (localidade_id, nome)
);

-- =====================================================
-- TABELA 7: USUARIOS (Usuários do Sistema Multi-Tenant)
-- =====================================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    senha_hash TEXT NOT NULL,
    perfil VARCHAR(50) NOT NULL DEFAULT 'secretaria',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT usuarios_email_unique UNIQUE (prefeitura_id, email)
);

-- =====================================================
-- TABELA 8: USUARIO_METADATA (Metadados de Usuários)
-- =====================================================
CREATE TABLE usuario_metadata (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    username VARCHAR(80) NOT NULL,
    permissions JSONB,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuario_metadata_username_unique UNIQUE (prefeitura_id, username)
);

-- =====================================================
-- TABELA 9: AGENDAMENTOS (Agendamentos de Cidadãos)
-- =====================================================
CREATE TABLE agendamentos (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    local_id INTEGER NOT NULL REFERENCES locais_atendimento(id),
    
    protocolo VARCHAR(50) UNIQUE,
    
    -- Dados Pessoais
    cidadao_nome VARCHAR(255) NOT NULL,
    cidadao_cpf VARCHAR(20) NOT NULL,
    telefone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    data_nascimento DATE,
    
    -- Dados CIN
    tipo_cin VARCHAR(50),
    numero_cin VARCHAR(50),
    
    -- Endereço
    endereco_rua VARCHAR(255),
    endereco_numero VARCHAR(50),
    regiao_tipo VARCHAR(50),
    regiao_nome VARCHAR(100),
    bairro_nome VARCHAR(100),
    
    -- Agendamento
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    prioridade VARCHAR(20) DEFAULT 'normal',
    
    -- Controle
    cancelado_por VARCHAR(50),
    motivo_cancelamento TEXT,
    concluido_em TIMESTAMPTZ,
    concluido_por VARCHAR(255),
    
    -- LGPD e Dados Extras
    consentimento_lgpd JSONB,
    entrega_rg JSONB,
    notas JSONB,
    historico_status JSONB,
    
    -- Lembretes
    lembrete_enviado BOOLEAN DEFAULT FALSE,
    lembrete_enviado_em TIMESTAMPTZ,
    
    -- Termos
    aceite_termos BOOLEAN DEFAULT FALSE,
    aceite_notificacoes BOOLEAN DEFAULT FALSE,
    
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_agendamento UNIQUE (local_id, data_agendamento, hora_agendamento)
);

-- =====================================================
-- TABELA 10: DATAS_BLOQUEADAS (Bloqueio de Agendamentos)
-- =====================================================
CREATE TABLE datas_bloqueadas (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    local_id INTEGER REFERENCES locais_atendimento(id) ON DELETE CASCADE,
    
    data DATE NOT NULL,
    motivo TEXT NOT NULL,
    tipo_bloqueio VARCHAR(50) DEFAULT 'dia-completo',
    horarios_bloqueados JSONB,
    
    criado_por VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 11: LOGS_AUDITORIA (Auditoria do Sistema)
-- =====================================================
CREATE TABLE logs_auditoria (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER REFERENCES prefeituras(id) ON DELETE CASCADE,
    
    acao VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    realizado_por VARCHAR(255) NOT NULL,
    papel_usuario VARCHAR(50),
    tipo_alvo VARCHAR(50),
    id_alvo VARCHAR(255),
    nome_alvo VARCHAR(255),
    
    valor_antigo JSONB,
    valor_novo JSONB,
    mudancas JSONB,
    metadados JSONB,
    tags TEXT[],
    
    endereco_ip VARCHAR(50),
    user_agent TEXT,
    
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 12: HISTORICO_LEMBRETES (Lembretes Enviados)
-- =====================================================
CREATE TABLE historico_lembretes (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE CASCADE,
    
    protocolo_agendamento VARCHAR(50),
    nome_cidadao VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    email VARCHAR(255),
    tipo_lembrete VARCHAR(50) NOT NULL,
    canais JSONB,
    status VARCHAR(50) NOT NULL,
    mensagem_erro TEXT,
    
    enviado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 13: TEMPLATES_RELATORIOS (Templates de Relatórios)
-- =====================================================
CREATE TABLE templates_relatorios (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    tipo_template VARCHAR(100) NOT NULL,
    filtros JSONB,
    colunas JSONB,
    config_ordenacao JSONB,
    
    criado_por VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Prefeituras
CREATE INDEX idx_prefeituras_slug ON prefeituras(slug);
CREATE INDEX idx_prefeituras_ativo ON prefeituras(ativo);

-- Locais de Atendimento
CREATE INDEX idx_locais_prefeitura ON locais_atendimento(prefeitura_id);
CREATE INDEX idx_locais_ativo ON locais_atendimento(ativo);

-- Usuários
CREATE INDEX idx_usuarios_prefeitura ON usuarios(prefeitura_id);
CREATE INDEX idx_usuarios_ativo ON usuarios(prefeitura_id, ativo);

-- Agendamentos
CREATE INDEX idx_agendamentos_prefeitura ON agendamentos(prefeitura_id);
CREATE INDEX idx_agendamentos_cpf ON agendamentos(cidadao_cpf);
CREATE INDEX idx_agendamentos_protocolo ON agendamentos(protocolo);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_agendamentos_local ON agendamentos(local_id);

-- Datas Bloqueadas
CREATE INDEX idx_datas_bloqueadas_prefeitura ON datas_bloqueadas(prefeitura_id);
CREATE INDEX idx_datas_bloqueadas_data ON datas_bloqueadas(data);

-- Logs de Auditoria
CREATE INDEX idx_logs_auditoria_prefeitura ON logs_auditoria(prefeitura_id);
CREATE INDEX idx_logs_auditoria_criado_em ON logs_auditoria(criado_em);
CREATE INDEX idx_logs_auditoria_acao ON logs_auditoria(acao);

-- Histórico de Lembretes
CREATE INDEX idx_historico_lembretes_prefeitura ON historico_lembretes(prefeitura_id);
CREATE INDEX idx_historico_lembretes_enviado_em ON historico_lembretes(enviado_em);

-- =====================================================
-- TRIGGERS DE ATUALIZAÇÃO AUTOMÁTICA
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_prefeituras_atualizado
BEFORE UPDATE ON prefeituras FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_configuracoes_prefeitura_atualizado
BEFORE UPDATE ON configuracoes_prefeitura FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_locais_atendimento_atualizado
BEFORE UPDATE ON locais_atendimento FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_usuarios_atualizado
BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_agendamentos_atualizado
BEFORE UPDATE ON agendamentos FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_templates_relatorios_atualizado
BEFORE UPDATE ON templates_relatorios FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Super Admin (login: admin@admin.com / senha: admin)
INSERT INTO super_admins (name, email, password)
VALUES ('Administrador Master', 'admin@admin.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Prefeitura Padrão: Irauçuba
INSERT INTO prefeituras (nome, slug, cidade, estado, ativo)
VALUES ('Prefeitura de Irauçuba', 'iraucuba', 'Irauçuba', 'CE', true)
ON CONFLICT (slug) DO NOTHING;

-- Configuração da Página Pública de Irauçuba
INSERT INTO configuracoes_prefeitura (
    prefeitura_id,
    nome_sistema,
    texto_boas_vindas,
    telefone,
    mensagem_lembrete,
    cor_primaria,
    cor_secundaria,
    cor_destaque
)
SELECT 
    p.id,
    'Agendamento CIN - Irauçuba',
    'Bem-vindo ao sistema de agendamento online para emissão de CIN da Prefeitura de Irauçuba',
    '(85) 3331-1234',
    'Olá {nome}, lembramos que você tem agendamento para {data} às {hora} para emissão de CIN. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!',
    '#2563eb',
    '#10b981',
    '#f59e0b'
FROM prefeituras p
WHERE p.slug = 'iraucuba'
  AND NOT EXISTS (SELECT 1 FROM configuracoes_prefeitura WHERE prefeitura_id = p.id);

-- Local de Atendimento Padrão
INSERT INTO locais_atendimento (prefeitura_id, nome_local, endereco, tipo, ativo)
SELECT 
    p.id,
    'Secretaria Municipal',
    'Rua Principal, 100 - Centro',
    'sede',
    true
FROM prefeituras p
WHERE p.slug = 'iraucuba'
  AND NOT EXISTS (SELECT 1 FROM locais_atendimento WHERE prefeitura_id = p.id);

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

SELECT '✅ SUCESSO! Banco de dados criado com 13 TABELAS!' as status;

SELECT 
    table_name as tabela,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name AND table_schema = 'public') as colunas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT '🏛️ Prefeituras cadastradas:' as info;
SELECT id, nome, slug, cidade, estado, ativo FROM prefeituras;

SELECT '📊 Total de tabelas: ' || COUNT(*)::text as total
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
