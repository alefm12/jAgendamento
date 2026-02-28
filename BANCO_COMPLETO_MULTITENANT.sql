-- =====================================================
-- SISTEMA COMPLETO MULTI-TENANT (MULTI-PREFEITURAS)
-- Execute tudo de uma vez no pgAdmin
-- =====================================================

-- 1. DELETAR TABELAS ANTIGAS (se existirem)
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS locais_atendimento CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS usuarios_secretaria CASCADE;
DROP TABLE IF EXISTS secretary_users CASCADE;
DROP TABLE IF EXISTS datas_bloqueadas CASCADE;
DROP TABLE IF EXISTS blocked_dates CASCADE;
DROP TABLE IF EXISTS logs_auditoria CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS historico_lembretes CASCADE;
DROP TABLE IF EXISTS reminder_history CASCADE;
DROP TABLE IF EXISTS configuracoes_sistema CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS templates_relatorios CASCADE;
DROP TABLE IF EXISTS report_templates CASCADE;
DROP TABLE IF EXISTS relatorios_agendados CASCADE;
DROP TABLE IF EXISTS scheduled_reports CASCADE;
DROP TABLE IF EXISTS logs_execucao_relatorios CASCADE;
DROP TABLE IF EXISTS report_execution_logs CASCADE;
DROP TABLE IF EXISTS prefeituras CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS configuracoes_prefeitura CASCADE;
DROP TABLE IF EXISTS super_admins CASCADE;

-- =====================================================
-- TABELA 1: SUPER ADMINISTRADORES (Acesso Global)
-- =====================================================
CREATE TABLE super_admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 2: PREFEITURAS (TENANTS)
-- =====================================================
CREATE TABLE prefeituras (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL,
    cnpj VARCHAR(20),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 3: CONFIGURAÇÕES DA PÁGINA PÚBLICA DE CADA PREFEITURA
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
    
    -- LGPD
    config_lgpd JSONB,
    
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(prefeitura_id)
);

-- =====================================================
-- TABELA 4: LOCAIS DE ATENDIMENTO (por prefeitura)
-- =====================================================
CREATE TABLE locais_atendimento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    
    nome VARCHAR(255) NOT NULL,
    endereco TEXT,
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(20),
    telefone VARCHAR(50),
    email VARCHAR(255),
    tipo VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    url_google_maps TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    horarios_funcionamento JSONB,
    max_agendamentos_por_horario INTEGER DEFAULT 2,
    
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 5: USUÁRIOS DA SECRETARIA (por prefeitura)
-- =====================================================
CREATE TABLE usuarios_secretaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    
    usuario VARCHAR(100) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(50),
    administrador BOOLEAN DEFAULT FALSE,
    permissoes JSONB,
    ativo BOOLEAN DEFAULT TRUE,
    
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(prefeitura_id, usuario)
);

-- =====================================================
-- TABELA 6: AGENDAMENTOS (por prefeitura)
-- =====================================================
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    local_id UUID REFERENCES locais_atendimento(id) ON DELETE SET NULL,
    
    protocolo VARCHAR(50) UNIQUE NOT NULL,
    
    -- Dados Pessoais
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(20) NOT NULL,
    rg VARCHAR(50),
    telefone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    data_nascimento DATE,
    
    -- Endereço
    rua VARCHAR(255),
    numero VARCHAR(50),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(20),
    tipo_regiao VARCHAR(50),
    sede_id VARCHAR(50),
    distrito_id VARCHAR(50),
    bairro_id VARCHAR(50),
    
    -- Dados do Agendamento
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    prioridade VARCHAR(20) DEFAULT 'normal',
    
    -- Informações da CIN
    tipo_cin VARCHAR(50),
    numero_cin VARCHAR(50),
    
    -- Controle de Cancelamento
    cancelado_por VARCHAR(50),
    motivo_cancelamento TEXT,
    categoria_cancelamento VARCHAR(100),
    
    -- Controle de Atendimento
    concluido_em TIMESTAMPTZ,
    concluido_por VARCHAR(255),
    
    -- LGPD
    consentimento_lgpd JSONB,
    
    -- Entrega do RG
    entrega_rg JSONB,
    
    -- Notas
    notas JSONB,
    
    -- Histórico de Status
    historico_status JSONB,
    
    -- Lembretes
    lembrete_enviado BOOLEAN DEFAULT FALSE,
    lembrete_enviado_em TIMESTAMPTZ,
    
    -- Auditoria
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    ultima_modificacao TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 7: DATAS BLOQUEADAS (por prefeitura e local)
-- =====================================================
CREATE TABLE datas_bloqueadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    local_id UUID REFERENCES locais_atendimento(id) ON DELETE CASCADE,
    
    data DATE NOT NULL,
    motivo TEXT NOT NULL,
    tipo_bloqueio VARCHAR(50) DEFAULT 'dia-completo',
    horarios_bloqueados JSONB,
    
    criado_por VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 8: LOGS DE AUDITORIA (por prefeitura)
-- =====================================================
CREATE TABLE logs_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- TABELA 9: HISTÓRICO DE LEMBRETES (por prefeitura)
-- =====================================================
CREATE TABLE historico_lembretes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    agendamento_id UUID REFERENCES agendamentos(id) ON DELETE CASCADE,
    
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
-- TABELA 10: TEMPLATES DE RELATÓRIOS (por prefeitura)
-- =====================================================
CREATE TABLE templates_relatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- TABELA 11: RELATÓRIOS AGENDADOS (por prefeitura)
-- =====================================================
CREATE TABLE relatorios_agendados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates_relatorios(id) ON DELETE CASCADE,
    
    nome VARCHAR(255) NOT NULL,
    frequencia VARCHAR(50) NOT NULL,
    destinatarios JSONB,
    formato VARCHAR(20) DEFAULT 'pdf',
    ativo BOOLEAN DEFAULT TRUE,
    ultima_execucao TIMESTAMPTZ,
    proxima_execucao TIMESTAMPTZ,
    
    criado_por VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA 12: LOGS DE EXECUÇÃO DE RELATÓRIOS (por prefeitura)
-- =====================================================
CREATE TABLE logs_execucao_relatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    relatorio_agendado_id UUID REFERENCES relatorios_agendados(id) ON DELETE CASCADE,
    
    nome_template VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    quantidade_registros INTEGER,
    mensagem_erro TEXT,
    caminho_arquivo TEXT,
    
    executado_em TIMESTAMPTZ DEFAULT NOW(),
    executado_por VARCHAR(255)
);

-- =====================================================
-- ÍNDICES PARA MELHOR PERFORMANCE
-- =====================================================

-- Prefeituras
CREATE INDEX idx_prefeituras_slug ON prefeituras(slug);
CREATE INDEX idx_prefeituras_ativo ON prefeituras(ativo);

-- Agendamentos
CREATE INDEX idx_agendamentos_prefeitura ON agendamentos(prefeitura_id);
CREATE INDEX idx_agendamentos_cpf ON agendamentos(cpf);
CREATE INDEX idx_agendamentos_protocolo ON agendamentos(protocolo);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_agendamentos_local ON agendamentos(local_id);

-- Locais de Atendimento
CREATE INDEX idx_locais_prefeitura ON locais_atendimento(prefeitura_id);
CREATE INDEX idx_locais_ativo ON locais_atendimento(ativo);

-- Usuários da Secretaria
CREATE INDEX idx_usuarios_prefeitura ON usuarios_secretaria(prefeitura_id);
CREATE INDEX idx_usuarios_ativo ON usuarios_secretaria(ativo);

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
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_prefeituras_atualizado
BEFORE UPDATE ON prefeituras
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_configuracoes_prefeitura_atualizado
BEFORE UPDATE ON configuracoes_prefeitura
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_locais_atendimento_atualizado
BEFORE UPDATE ON locais_atendimento
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_usuarios_secretaria_atualizado
BEFORE UPDATE ON usuarios_secretaria
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_agendamentos_atualizado
BEFORE UPDATE ON agendamentos
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_templates_relatorios_atualizado
BEFORE UPDATE ON templates_relatorios
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_relatorios_agendados_atualizado
BEFORE UPDATE ON relatorios_agendados
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Criar super admin padrão
INSERT INTO super_admins (name, email, password)
SELECT 'Administrador Master', 'admin@admin.com', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM super_admins WHERE email = 'admin@admin.com');

-- Criar prefeitura de exemplo (IRAUÇUBA)
INSERT INTO prefeituras (nome, slug, cidade, estado, ativo)
SELECT 'Prefeitura de Irauçuba', 'iraucuba', 'Irauçuba', 'CE', true
WHERE NOT EXISTS (SELECT 1 FROM prefeituras WHERE slug = 'iraucuba');

-- Criar configuração padrão para Irauçuba
INSERT INTO configuracoes_prefeitura (
    prefeitura_id,
    nome_sistema,
    texto_boas_vindas,
    telefone,
    mensagem_lembrete
)
SELECT 
    p.id,
    'Agendamento CIN - Irauçuba',
    'Bem-vindo ao sistema de agendamento online da Prefeitura de Irauçuba',
    '(85) 3331-1234',
    'Olá {nome}, lembramos que você tem agendamento para {data} às {hora} para emissão de CIN. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!'
FROM prefeituras p
WHERE p.slug = 'iraucuba'
  AND NOT EXISTS (SELECT 1 FROM configuracoes_prefeitura WHERE prefeitura_id = p.id);

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

SELECT '✅ SUCESSO! Banco MULTI-TENANT criado em PORTUGUÊS!' as status;

SELECT 
    table_name as nome_tabela,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as total_colunas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'super_admins',
    'prefeituras',
    'configuracoes_prefeitura',
    'agendamentos',
    'locais_atendimento', 
    'usuarios_secretaria',
    'datas_bloqueadas',
    'logs_auditoria',
    'historico_lembretes',
    'templates_relatorios',
    'relatorios_agendados',
    'logs_execucao_relatorios'
  )
ORDER BY table_name;

SELECT '📊 Total de tabelas criadas: ' || COUNT(*)::text as resumo
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

SELECT '🏛️ Prefeituras cadastradas:' as info;
SELECT id, nome, slug, cidade, estado, ativo FROM prefeituras;
