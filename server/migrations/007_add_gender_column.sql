-- Adicionar coluna de gênero na tabela agendamentos
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS genero VARCHAR(50);

COMMENT ON COLUMN agendamentos.genero IS 'Gênero do cidadão: Masculino, Feminino, Não binário, Prefiro não informar, ou valor customizado';
