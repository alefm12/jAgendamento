# Guia de Configuração do Banco de Dados

## 🎯 Objetivo
Este guia explica como configurar o banco de dados PostgreSQL para o sistema de agendamento CIN.

## 📋 Pré-requisitos
- PostgreSQL instalado (versão 12 ou superior)
- Acesso ao terminal/prompt de comando
- Credenciais de administrador do PostgreSQL

## 🚀 Passo a Passo

### 1. Criar o Banco de Dados

Abra o terminal do PostgreSQL (psql) ou use o pgAdmin:

```sql
-- Conectar como usuário postgres
psql -U postgres

-- Criar o banco de dados
CREATE DATABASE jagendamento;

-- Sair do psql
\q
```

### 2. Executar as Migrations

**Opção A: Executar todas as migrations de uma vez**

```bash
cd server/migrations
psql -U postgres -d jagendamento -f RUN_ALL_MIGRATIONS.sql
```

**Opção B: Executar apenas a migration principal (recomendado para novos projetos)**

```bash
cd server/migrations
psql -U postgres -d jagendamento -f 006_sistema_agendamento_completo.sql
```

### 3. Verificar a Instalação

```sql
-- Conectar ao banco
psql -U postgres -d jagendamento

-- Listar todas as tabelas criadas
\dt

-- Você deve ver as seguintes tabelas:
-- - system_config
-- - secretary_users
-- - locations
-- - appointments
-- - blocked_dates
-- - report_templates
-- - scheduled_reports
-- - report_execution_logs
-- - audit_logs
-- - reminder_history
```

### 4. Configurar o arquivo .env

Crie um arquivo `.env` na raiz do projeto (se não existir):

```env
# Backend API
DATABASE_URL=postgres://postgres:123@localhost:5432/jagendamento
DATABASE_SSL=false
SERVER_PORT=4000

# Frontend
VITE_API_URL=http://localhost:4000/api
VITE_ENABLE_REMOTE_SPARK=false
```

**⚠️ IMPORTANTE**: Ajuste a senha do banco de dados (`123` no exemplo) para a senha correta do seu PostgreSQL.

### 5. Atualizar o arquivo db.ts (se necessário)

O arquivo `server/db.ts` deve estar configurado assim:

```typescript
import { Pool } from 'pg';

export const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'jagendamento',
  password: '123', // ALTERE para sua senha
  port: 5432,
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no Banco de Dados:', err);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
```

## 🧪 Testar a Conexão

1. Inicie o servidor backend:
```bash
npm run server:dev
```

2. Você deve ver a mensagem:
```
[server] API running on 4000
```

3. Teste a conexão:
```bash
curl http://localhost:4000/api/health
```

Resposta esperada:
```json
{"status":"ok"}
```

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

1. **appointments** - Armazena todos os agendamentos
2. **locations** - Locais de atendimento
3. **secretary_users** - Usuários do sistema (secretaria/admin)
4. **blocked_dates** - Datas bloqueadas para agendamento
5. **audit_logs** - Registro de auditoria de todas as ações
6. **reminder_history** - Histórico de lembretes enviados
7. **system_config** - Configurações gerais do sistema
8. **report_templates** - Templates de relatórios personalizados
9. **scheduled_reports** - Relatórios agendados
10. **report_execution_logs** - Log de execução de relatórios

## 🔧 Solução de Problemas

### Erro: "database does not exist"
Execute:
```sql
CREATE DATABASE jagendamento;
```

### Erro: "password authentication failed"
Verifique a senha no arquivo `server/db.ts` e no `.env`

### Erro: "relation already exists"
O banco já foi criado. Você pode:
- Continuar usando o banco existente
- Ou recriá-lo com:
```sql
DROP DATABASE jagendamento;
CREATE DATABASE jagendamento;
```

### Erro: "could not connect to server"
Verifique se o PostgreSQL está rodando:
```bash
# Windows
net start postgresql-x64-14

# Linux/Mac
sudo systemctl status postgresql
```

## 🎉 Próximos Passos

Após configurar o banco de dados:

1. Inicie o servidor backend:
```bash
npm run server:dev
```

2. Inicie o frontend:
```bash
npm run dev
```

3. Acesse o sistema em: `http://localhost:5173`

4. Faça login como admin (será criado automaticamente na primeira execução)

## 📝 Notas Importantes

- ✅ Os dados agora serão **persistidos permanentemente** no PostgreSQL
- ✅ Não há mais perda de dados ao reiniciar o sistema
- ✅ Todas as tabelas têm índices otimizados para performance
- ✅ Sistema de auditoria completo está ativo
- ✅ Triggers automáticos para updated_at estão configurados

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs do servidor backend no terminal
2. Verifique os logs do PostgreSQL
3. Confirme que todas as credenciais estão corretas
