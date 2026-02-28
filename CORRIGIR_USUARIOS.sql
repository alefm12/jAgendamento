-- =====================================================
-- CORRIGIR TABELA USUARIOS - ADICIONAR COLUNAS FALTANTES
-- Execute este SQL no pgAdmin
-- =====================================================

-- Adicionar colunas que faltam na tabela usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
ADD COLUMN IF NOT EXISTS telefone VARCHAR(50);

-- Verificar a estrutura da tabela
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

SELECT '✅ Colunas adicionadas com sucesso!' as status;
