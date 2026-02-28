-- Estrutura de usuários multi-tenant
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    senha_hash TEXT NOT NULL,
    perfil VARCHAR(50) NOT NULL DEFAULT 'secretaria',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuarios_email_unique UNIQUE (prefeitura_id, email)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_prefeitura ON usuarios (prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios (prefeitura_id, ativo);

CREATE TABLE IF NOT EXISTS usuario_metadata (
    usuario_id INT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
    username VARCHAR(80) NOT NULL,
    permissions JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuario_metadata_username_unique UNIQUE (prefeitura_id, username)
);
