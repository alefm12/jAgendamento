import { pool } from '../config/db'

const MIGRATION_SQL = `
-- Função de timestamp (precisa ser criada antes dos triggers)
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- TABELA 1: SUPER_ADMINS
CREATE TABLE IF NOT EXISTS super_admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA 2: PREFEITURAS
CREATE TABLE IF NOT EXISTS prefeituras (
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

-- TABELA 3: CONFIGURACOES_PREFEITURA
CREATE TABLE IF NOT EXISTS configuracoes_prefeitura (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    nome_sistema VARCHAR(255) DEFAULT 'Agendamento CIN',
    logo_url TEXT,
    brasao_url TEXT,
    imagem_fundo_url TEXT,
    favicon_url TEXT,
    cor_primaria VARCHAR(50) DEFAULT '#2563eb',
    cor_secundaria VARCHAR(50) DEFAULT '#10b981',
    cor_destaque VARCHAR(50) DEFAULT '#f59e0b',
    cor_fundo VARCHAR(50) DEFAULT '#ffffff',
    cor_texto VARCHAR(50) DEFAULT '#1f2937',
    texto_boas_vindas TEXT,
    texto_rodape TEXT,
    mensagem_lembrete TEXT,
    telefone VARCHAR(50),
    email VARCHAR(255),
    endereco TEXT,
    site_url TEXT,
    facebook_url TEXT,
    instagram_url TEXT,
    dias_janela_agendamento INTEGER DEFAULT 60,
    horarios_trabalho JSONB,
    max_agendamentos_por_horario INTEGER DEFAULT 2,
    config_email JSONB,
    config_sms JSONB,
    config_whatsapp JSONB,
    config_lgpd JSONB,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(prefeitura_id)
);

-- TABELA 4: LOCAIS_ATENDIMENTO
CREATE TABLE IF NOT EXISTS locais_atendimento (
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

-- TABELA 5: LOCALIDADES_ORIGEM
CREATE TABLE IF NOT EXISTS localidades_origem (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'distrito',
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT localidades_origem_unique UNIQUE (prefeitura_id, nome)
);

-- TABELA 6: BAIRROS
CREATE TABLE IF NOT EXISTS bairros (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    localidade_id INTEGER NOT NULL REFERENCES localidades_origem(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bairros_unique UNIQUE (localidade_id, nome)
);

-- TABELA 7: USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
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

-- TABELA 8: USUARIO_METADATA
CREATE TABLE IF NOT EXISTS usuario_metadata (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    username VARCHAR(80) NOT NULL,
    permissions JSONB,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuario_metadata_username_unique UNIQUE (prefeitura_id, username)
);

-- TABELA 9: AGENDAMENTOS
CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    local_id INTEGER NOT NULL REFERENCES locais_atendimento(id),
    protocolo VARCHAR(50) UNIQUE,
    cidadao_nome VARCHAR(255) NOT NULL,
    cidadao_cpf VARCHAR(20) NOT NULL,
    telefone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    data_nascimento DATE,
    tipo_cin VARCHAR(50),
    numero_cin VARCHAR(50),
    endereco_rua VARCHAR(255),
    endereco_numero VARCHAR(50),
    regiao_tipo VARCHAR(50),
    regiao_nome VARCHAR(100),
    bairro_nome VARCHAR(100),
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    prioridade VARCHAR(20) DEFAULT 'normal',
    cancelado_por VARCHAR(50),
    motivo_cancelamento TEXT,
    concluido_em TIMESTAMPTZ,
    concluido_por VARCHAR(255),
    consentimento_lgpd JSONB,
    entrega_rg JSONB,
    notas JSONB,
    historico_status JSONB,
    lembrete_enviado BOOLEAN DEFAULT FALSE,
    lembrete_enviado_em TIMESTAMPTZ,
    aceite_termos BOOLEAN DEFAULT FALSE,
    aceite_notificacoes BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_agendamento UNIQUE (local_id, data_agendamento, hora_agendamento)
);

-- TABELA 10: DATAS_BLOQUEADAS
CREATE TABLE IF NOT EXISTS datas_bloqueadas (
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

-- TABELA 11: LOGS_AUDITORIA
CREATE TABLE IF NOT EXISTS logs_auditoria (
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

-- TABELA 12: HISTORICO_LEMBRETES
CREATE TABLE IF NOT EXISTS historico_lembretes (
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

-- TABELA 13: TEMPLATES_RELATORIOS
CREATE TABLE IF NOT EXISTS templates_relatorios (
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

-- TABELA 14: RELATORIOS_AGENDADOS (extra)
CREATE TABLE IF NOT EXISTS relatorios_agendados (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER REFERENCES prefeituras(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES templates_relatorios(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    frequencia VARCHAR(50),
    proximo_envio TIMESTAMPTZ,
    destinatarios JSONB,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA 15: LOGS_EXECUCAO_RELATORIOS (extra)
CREATE TABLE IF NOT EXISTS logs_execucao_relatorios (
    id SERIAL PRIMARY KEY,
    relatorio_id INTEGER REFERENCES relatorios_agendados(id) ON DELETE CASCADE,
    prefeitura_id INTEGER REFERENCES prefeituras(id) ON DELETE CASCADE,
    status VARCHAR(50),
    mensagem_erro TEXT,
    executado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: USUARIOS_SECRETARIA (extra)
CREATE TABLE IF NOT EXISTS usuarios_secretaria (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER REFERENCES prefeituras(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    senha_hash TEXT NOT NULL,
    cargo VARCHAR(100),
    ativo BOOLEAN DEFAULT TRUE,
    permissions JSONB,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: TENANT_BRANDING (Identidade visual por prefeitura)
CREATE TABLE IF NOT EXISTS tenant_branding (
    prefeitura_id INT PRIMARY KEY REFERENCES prefeituras(id) ON DELETE CASCADE,
    nome_exibicao TEXT,
    subtitulo TEXT,
    telefone_contato TEXT,
    cor_principal TEXT,
    cor_botao_agendar TEXT,
    cor_botao_consultar TEXT,
    logo_path TEXT,
    fundo_path TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABELA: WHATSAPP_CONFIG
CREATE TABLE IF NOT EXISTS whatsapp_config (
    id SERIAL PRIMARY KEY,
    prefeitura_id INTEGER UNIQUE REFERENCES prefeituras(id) ON DELETE CASCADE,
    api_url TEXT,
    api_token TEXT,
    instance_id TEXT,
    numero_origem TEXT,
    ativo BOOLEAN DEFAULT FALSE,
    atualizado_por INTEGER,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: SYSTEM_CONFIG (configurações gerais do sistema)
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_prefeituras_slug ON prefeituras(slug);
CREATE INDEX IF NOT EXISTS idx_prefeituras_ativo ON prefeituras(ativo);
CREATE INDEX IF NOT EXISTS idx_locais_prefeitura ON locais_atendimento(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_locais_ativo ON locais_atendimento(ativo);
CREATE INDEX IF NOT EXISTS idx_usuarios_prefeitura ON usuarios(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_prefeitura ON agendamentos(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cpf ON agendamentos(cidadao_cpf);
CREATE INDEX IF NOT EXISTS idx_agendamentos_protocolo ON agendamentos(protocolo);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_local ON agendamentos(local_id);
CREATE INDEX IF NOT EXISTS idx_datas_bloqueadas_prefeitura ON datas_bloqueadas(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_datas_bloqueadas_data ON datas_bloqueadas(data);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_prefeitura ON logs_auditoria(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_criado_em ON logs_auditoria(criado_em);
CREATE INDEX IF NOT EXISTS idx_historico_lembretes_prefeitura ON historico_lembretes(prefeitura_id);

-- DADOS INICIAIS
INSERT INTO super_admins (name, email, password)
VALUES ('Administrador Master', 'admin@admin.com', 'admin123')
ON CONFLICT (email) DO NOTHING;

INSERT INTO prefeituras (nome, slug, cidade, estado, ativo)
VALUES ('Prefeitura de Irauçuba', 'iraucuba', 'Irauçuba', 'CE', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO configuracoes_prefeitura (
    prefeitura_id, nome_sistema, texto_boas_vindas, telefone,
    mensagem_lembrete, cor_primaria, cor_secundaria, cor_destaque
)
SELECT 
    p.id,
    'Agendamento CIN - Irauçuba',
    'Bem-vindo ao sistema de agendamento online para emissão de CIN',
    '(85) 3331-1234',
    'Olá {nome}, você tem agendamento para {data} às {hora}. Local: {endereco}.',
    '#2563eb', '#10b981', '#f59e0b'
FROM prefeituras p
WHERE p.slug = 'iraucuba'
  AND NOT EXISTS (SELECT 1 FROM configuracoes_prefeitura WHERE prefeitura_id = p.id);

INSERT INTO locais_atendimento (prefeitura_id, nome_local, endereco, tipo, ativo)
SELECT p.id, 'Secretaria Municipal', 'Rua Principal, 100 - Centro', 'sede', true
FROM prefeituras p
WHERE p.slug = 'iraucuba'
  AND NOT EXISTS (SELECT 1 FROM locais_atendimento WHERE prefeitura_id = p.id);
`

export async function runMigrations(): Promise<void> {
  console.log('[migration] Verificando e criando tabelas...')
  try {
    await pool.query(MIGRATION_SQL)
    console.log('[migration] ✅ Tabelas verificadas/criadas com sucesso!')
  } catch (err: any) {
    console.error('[migration] ❌ Erro na migração:', err.message)
    // Não lança erro para não impedir o servidor de subir
  }
}
