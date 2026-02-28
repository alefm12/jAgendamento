-- =====================================================
-- CRIAÇÃO DE TODAS AS TABELAS EM PORTUGUÊS
-- Execute tudo de uma vez no pgAdmin
-- =====================================================

-- 1. DELETAR TABELAS ANTIGAS EM INGLÊS (se existirem)
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS secretary_users CASCADE;
DROP TABLE IF EXISTS blocked_dates CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS reminder_history CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS report_templates CASCADE;
DROP TABLE IF EXISTS scheduled_reports CASCADE;
DROP TABLE IF EXISTS report_execution_logs CASCADE;

-- =====================================================
-- 1. TABELA DE AGENDAMENTOS
-- =====================================================
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    local_id VARCHAR(100),
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
-- 2. TABELA DE LOCAIS DE ATENDIMENTO
-- =====================================================
CREATE TABLE locais_atendimento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(20),
    telefone VARCHAR(50),
    email VARCHAR(255),
    tipo VARCHAR(50),
    url_google_maps TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    horarios_funcionamento JSONB,
    max_agendamentos_por_horario INTEGER DEFAULT 2,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. TABELA DE USUÁRIOS DA SECRETARIA
-- =====================================================
CREATE TABLE usuarios_secretaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    administrador BOOLEAN DEFAULT FALSE,
    permissoes JSONB,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. TABELA DE DATAS BLOQUEADAS
-- =====================================================
CREATE TABLE datas_bloqueadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    motivo TEXT NOT NULL,
    tipo_bloqueio VARCHAR(50) DEFAULT 'dia-completo',
    horarios_bloqueados JSONB,
    local_id UUID,
    criado_por VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. TABELA DE LOGS DE AUDITORIA
-- =====================================================
CREATE TABLE logs_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 6. TABELA DE HISTÓRICO DE LEMBRETES
-- =====================================================
CREATE TABLE historico_lembretes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id UUID,
    protocolo_agendamento VARCHAR(50),
    nome_cidadao VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    email VARCHAR(255),
    tipo_lembrete VARCHAR(50) NOT NULL,
    canais JSONB,
    status VARCHAR(50) NOT NULL,
    enviado_em TIMESTAMPTZ DEFAULT NOW(),
    mensagem_erro TEXT
);

-- =====================================================
-- 7. TABELA DE CONFIGURAÇÕES DO SISTEMA
-- =====================================================
CREATE TABLE configuracoes_sistema (
    id SERIAL PRIMARY KEY,
    nome_sistema VARCHAR(255) DEFAULT 'Agendamento CIN',
    cor_primaria VARCHAR(50) DEFAULT 'oklch(0.45 0.15 145)',
    cor_secundaria VARCHAR(50) DEFAULT 'oklch(0.65 0.1 180)',
    cor_destaque VARCHAR(50) DEFAULT 'oklch(0.55 0.18 145)',
    logo TEXT,
    tamanho_logo INTEGER DEFAULT 40,
    fonte_titulo VARCHAR(100),
    fonte_corpo VARCHAR(100),
    borda_raio INTEGER,
    mensagem_lembrete TEXT,
    dias_janela_agendamento INTEGER DEFAULT 60,
    tema_padrao VARCHAR(20) DEFAULT 'light',
    horarios_trabalho JSONB,
    max_agendamentos_por_horario INTEGER DEFAULT 2,
    config_secretaria JSONB,
    config_lgpd JSONB,
    config_entrega_rg JSONB,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. TABELA DE TEMPLATES DE RELATÓRIOS
-- =====================================================
CREATE TABLE templates_relatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 9. TABELA DE RELATÓRIOS AGENDADOS
-- =====================================================
CREATE TABLE relatorios_agendados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
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
-- 10. TABELA DE LOGS DE EXECUÇÃO DE RELATÓRIOS
-- =====================================================
CREATE TABLE logs_execucao_relatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relatorio_agendado_id UUID,
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

-- Agendamentos
CREATE INDEX idx_agendamentos_cpf ON agendamentos(cpf);
CREATE INDEX idx_agendamentos_protocolo ON agendamentos(protocolo);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_agendamentos_criado_em ON agendamentos(criado_em);

-- Datas Bloqueadas
CREATE INDEX idx_datas_bloqueadas_data ON datas_bloqueadas(data);

-- Logs de Auditoria
CREATE INDEX idx_logs_auditoria_criado_em ON logs_auditoria(criado_em);
CREATE INDEX idx_logs_auditoria_acao ON logs_auditoria(acao);
CREATE INDEX idx_logs_auditoria_realizado_por ON logs_auditoria(realizado_por);

-- Histórico de Lembretes
CREATE INDEX idx_historico_lembretes_enviado_em ON historico_lembretes(enviado_em);

-- Locais de Atendimento
CREATE INDEX idx_locais_atendimento_ativo ON locais_atendimento(ativo);

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

-- Trigger para agendamentos
CREATE TRIGGER trigger_agendamentos_atualizado
BEFORE UPDATE ON agendamentos
FOR EACH ROW 
EXECUTE FUNCTION atualizar_timestamp();

-- Trigger para locais de atendimento
CREATE TRIGGER trigger_locais_atendimento_atualizado
BEFORE UPDATE ON locais_atendimento
FOR EACH ROW 
EXECUTE FUNCTION atualizar_timestamp();

-- Trigger para usuários da secretaria
CREATE TRIGGER trigger_usuarios_secretaria_atualizado
BEFORE UPDATE ON usuarios_secretaria
FOR EACH ROW 
EXECUTE FUNCTION atualizar_timestamp();

-- Trigger para configurações do sistema
CREATE TRIGGER trigger_config_sistema_atualizado
BEFORE UPDATE ON configuracoes_sistema
FOR EACH ROW 
EXECUTE FUNCTION atualizar_timestamp();

-- Trigger para templates de relatórios
CREATE TRIGGER trigger_templates_relatorios_atualizado
BEFORE UPDATE ON templates_relatorios
FOR EACH ROW 
EXECUTE FUNCTION atualizar_timestamp();

-- Trigger para relatórios agendados
CREATE TRIGGER trigger_relatorios_agendados_atualizado
BEFORE UPDATE ON relatorios_agendados
FOR EACH ROW 
EXECUTE FUNCTION atualizar_timestamp();

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

INSERT INTO configuracoes_sistema (
    nome_sistema,
    cor_primaria,
    cor_secundaria,
    cor_destaque,
    dias_janela_agendamento,
    mensagem_lembrete
) 
SELECT 
    'Agendamento CIN',
    'oklch(0.45 0.15 145)',
    'oklch(0.65 0.1 180)',
    'oklch(0.55 0.18 145)',
    60,
    'Olá {nome}, lembramos que você tem agendamento para {data} às {hora} para emissão de CIN. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes_sistema LIMIT 1);

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

SELECT '✅ SUCESSO! Todas as tabelas foram criadas em PORTUGUÊS!' as status;

SELECT 
    table_name as nome_tabela,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as total_colunas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'agendamentos',
    'locais_atendimento', 
    'usuarios_secretaria',
    'datas_bloqueadas',
    'logs_auditoria',
    'historico_lembretes',
    'configuracoes_sistema',
    'templates_relatorios',
    'relatorios_agendados',
    'logs_execucao_relatorios'
  )
ORDER BY table_name;

SELECT 'Total de tabelas criadas: ' || COUNT(*)::text as resumo
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'agendamentos',
    'locais_atendimento', 
    'usuarios_secretaria',
    'datas_bloqueadas',
    'logs_auditoria',
    'historico_lembretes',
    'configuracoes_sistema',
    'templates_relatorios',
    'relatorios_agendados',
    'logs_execucao_relatorios'
  );
