-- Cria tabelas de localidades de origem e bairros e adiciona link do mapa aos locais de atendimento

ALTER TABLE locais_atendimento
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'sede',
  ADD COLUMN IF NOT EXISTS link_mapa TEXT,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS localidades_origem (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT localidades_origem_unique UNIQUE (prefeitura_id, nome)
);

CREATE TABLE IF NOT EXISTS bairros (
  id SERIAL PRIMARY KEY,
  prefeitura_id INT NOT NULL REFERENCES prefeituras(id) ON DELETE CASCADE,
  localidade_id INT NOT NULL REFERENCES localidades_origem(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bairros_unique UNIQUE (localidade_id, nome)
);
