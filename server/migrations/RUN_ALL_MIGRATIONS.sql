-- Script consolidado e SEGURO (sem DROP TABLE)
-- Use este arquivo para bootstrap sem perder dados existentes.

\c jagendamento;

-- Base
\i 001_create_tenants.sql
\i 002_prefeituras_base.sql
\i 003_super_admins.sql
\i 003_enderecos_e_locais.sql
\i 004_usuarios.sql

-- Não executar legacy destrutivas:
-- \i 005_agendamentos_completo.sql
-- \i 008_audit_logs_system.sql
-- \i 009_sistema_configuracoes.sql
-- \i 011_smtp_whatsapp_config_tables.sql

-- Ajustes incrementais já existentes
\i 003_cancelamentos.sql
\i 006_sistema_agendamento_completo.sql
\i 007_add_gender_column.sql
\i 009_add_configuracoes_column.sql
\i 010_add_config_geral_column.sql
\i 012_cpf_cancelamentos_bloqueios.sql
\i 013_add_sala_guiche.sql

-- Hardening final (idempotente e sem perda)
\i 014_schema_full_safe.sql

-- Verificação final
SELECT 'Migrations seguras executadas com sucesso!' AS status;
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
 ORDER BY table_name;
