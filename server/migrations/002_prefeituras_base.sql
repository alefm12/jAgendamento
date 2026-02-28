-- Estrutura multi-tenant baseada em prefeituras
CREATE TABLE IF NOT EXISTS prefeituras (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locais_atendimento (
    id SERIAL PRIMARY KEY,
    prefeitura_id INT NOT NULL REFERENCES prefeituras(id),
    nome_local VARCHAR(100) NOT NULL,
    endereco TEXT,
    ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    prefeitura_id INT NOT NULL REFERENCES prefeituras(id),
    local_id INT NOT NULL REFERENCES locais_atendimento(id),
    cidadao_nome VARCHAR(100) NOT NULL,
    cidadao_cpf VARCHAR(14) NOT NULL,
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_agendamento UNIQUE (local_id, data_agendamento, hora_agendamento)
);

-- Registros base para testes
INSERT INTO prefeituras (nome, slug)
VALUES ('Prefeitura de Irauçuba', 'iraucuba')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO locais_atendimento (prefeitura_id, nome_local, endereco)
VALUES (1, 'Secretaria Municipal', 'Rua Principal, 100')
ON CONFLICT DO NOTHING;
