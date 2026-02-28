DROP TABLE IF EXISTS agendamentos CASCADE;

CREATE TABLE agendamentos (
    id SERIAL PRIMARY KEY,

    -- Vínculos
    prefeitura_id INTEGER NOT NULL DEFAULT 1,
    local_id INTEGER NOT NULL DEFAULT 1,

    -- Dados Pessoais
    cidadao_nome VARCHAR(255) NOT NULL,
    cidadao_cpf VARCHAR(20) NOT NULL,
    telefone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,

    -- Dados da CIN
    tipo_cin VARCHAR(50), -- '1ª via' ou '2ª via'
    numero_cin VARCHAR(50),

    -- Endereço
    endereco_rua VARCHAR(255),
    endereco_numero VARCHAR(50),
    regiao_tipo VARCHAR(50), -- 'Sede' ou 'Distrito'
    regiao_nome VARCHAR(100), -- Nome do Distrito
    bairro_nome VARCHAR(100), -- Nome do Bairro

    -- Agendamento
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',

    -- Termos
    aceite_termos BOOLEAN DEFAULT FALSE,
    aceite_notificacoes BOOLEAN DEFAULT FALSE,

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Proteção para não salvar sem Local
    CONSTRAINT fk_agendamento_local FOREIGN KEY (local_id) REFERENCES locais_atendimento(id),
    CONSTRAINT fk_agendamento_prefeitura FOREIGN KEY (prefeitura_id) REFERENCES prefeituras(id)
);
CREATE INDEX idx_agendamentos_prefeitura ON agendamentos (prefeitura_id);