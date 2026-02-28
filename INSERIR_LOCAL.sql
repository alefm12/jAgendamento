-- Verificar se já existe local cadastrado
SELECT * FROM locais_atendimento WHERE prefeitura_id = 1;

-- Se não existir, inserir manualmente
INSERT INTO locais_atendimento (prefeitura_id, nome_local, endereco, tipo, ativo)
VALUES (1, 'SIPS - Secretaria de Identific', 'Rua Principal, 100 - Centro', 'sede', true)
ON CONFLICT DO NOTHING;

-- Verificar novamente
SELECT id, prefeitura_id, nome_local, endereco, ativo FROM locais_atendimento;
