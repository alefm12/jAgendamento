# Sistema de Auditoria - jAgendamento

## 📋 Visão Geral

Sistema completo de auditoria de logs implementado para rastrear todas as ações dos **usuários autenticados do sistema** (não inclui ações da página pública do cidadão).

## 🗄️ Estrutura da Tabela

A tabela `audit_logs` foi criada com a migration `008_audit_logs_system.sql` e contém:

### Identificação do Usuário
- `user_id` - ID do usuário
- `user_email` - Email do usuário
- `user_name` - Nome do usuário
- `user_role` - Role (SUPER_ADMIN, SECRETARY, etc.)

### Informações da Ação
- `action` - Tipo de ação (LOGIN, LOGOUT, CREATE_APPOINTMENT, etc.)
- `action_category` - Categoria (AUTH, APPOINTMENT, USER_MANAGEMENT, SYSTEM_CONFIG)
- `description` - Descrição detalhada da ação
- `severity` - Nível de severidade (LOW, MEDIUM, HIGH, CRITICAL)

### Dados Modificados
- `entity_type` - Tipo da entidade (appointment, user, location, etc.)
- `entity_id` - ID da entidade afetada
- `old_values` - Valores anteriores (JSONB)
- `new_values` - Novos valores (JSONB)

### Informações de Rede e Dispositivo
- `ip_address` - IP real do usuário
- `user_agent` - String do navegador/dispositivo
- `device_type` - desktop, mobile ou tablet
- `browser` - Nome do navegador
- `os` - Sistema operacional

### Geolocalização
- `country` - País
- `region` - Estado/Região
- `city` - Cidade
- `latitude` / `longitude` - Coordenadas

### Outros
- `session_id` / `request_id` - IDs de rastreamento
- `tenant_id` / `tenant_name` - Prefeitura
- `status` - success, failed ou error
- `error_message` - Mensagem de erro (se aplicável)
- `created_at` - Timestamp da ação

## 🔧 Implementação

### Arquivos Criados

1. **`server/migrations/008_audit_logs_system.sql`**
   - Migration executada com sucesso
   - Cria tabela `audit_logs` com todos os índices

2. **`server/services/audit.service.ts`**
   - Serviço completo de auditoria
   - Funções auxiliares para logs específicos
   - Parser de User-Agent
   - Integração com API de geolocalização (ip-api.com)

3. **`server/middleware/auth.middleware.ts`**
   - Middleware que extrai usuário do token JWT
   - Adiciona `req.user` em todas as requisições autenticadas
   - Não bloqueia requisições não autenticadas

### Rotas Já Integradas

#### 1. Autenticação (`server/routes/auth.routes.ts`)
- ✅ Login bem-sucedido: `logLogin()`
- ✅ Login falho: `logLoginFailed()`

#### 2. Operações Administrativas (`server/index.ts`)
- ✅ Criação de prefeitura
- ✅ Atualização de prefeitura
- ✅ Exclusão de prefeitura

## 📝 Como Integrar em Outras Rotas

### Passo 1: Importar o Serviço

No início do arquivo de rota:

```typescript
import { 
  logAppointmentCreate,
  logAppointmentUpdate,
  logAppointmentStatusChange,
  logAppointmentDelete,
  logUserCreate,
  logUserUpdate,
  logUserDelete,
  logSystemConfigChange
} from '../services/audit.service';
```

### Passo 2: Usar AuthRequest

Trocar `Request` por `AuthRequest` nas funções de rota:

```typescript
import { type AuthRequest } from '../middleware/auth.middleware';

router.post('/endpoint', async (req: AuthRequest, res) => {
  // Agora req.user está disponível se houver token JWT válido
});
```

### Passo 3: Adicionar Logs

#### Exemplo 1: Criação de Agendamento

```typescript
router.post('/', async (req: AuthRequest, res) => {
  try {
    // ... criar agendamento ...
    const result = await pool.query(insertQuery, values);
    
    // Log apenas se for usuário autenticado (não público)
    if (req.user) {
      await logAppointmentCreate(req.user, result.rows[0], req);
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    // ...
  }
});
```

#### Exemplo 2: Atualização de Agendamento

```typescript
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const appointmentId = req.params.id;
    
    // Buscar dados antigos
    const oldData = await pool.query('SELECT * FROM agendamentos WHERE id = $1', [appointmentId]);
    
    // Atualizar
    const result = await pool.query(updateQuery, values);
    
    // Log apenas se for usuário autenticado
    if (req.user && oldData.rows[0]) {
      await logAppointmentUpdate(
        req.user,
        appointmentId,
        oldData.rows[0],
        result.rows[0],
        req
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    // ...
  }
});
```

#### Exemplo 3: Mudança de Status

```typescript
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const appointmentId = req.params.id;
    const newStatus = req.body.status;
    
    // Buscar status antigo
    const oldData = await pool.query('SELECT status FROM agendamentos WHERE id = $1', [appointmentId]);
    const oldStatus = oldData.rows[0]?.status;
    
    // Atualizar status
    await pool.query('UPDATE agendamentos SET status = $1 WHERE id = $2', [newStatus, appointmentId]);
    
    // Log
    if (req.user) {
      await logAppointmentStatusChange(req.user, appointmentId, oldStatus, newStatus, req);
    }
    
    res.json({ success: true });
  } catch (error) {
    // ...
  }
});
```

#### Exemplo 4: Exclusão

```typescript
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const appointmentId = req.params.id;
    
    // Buscar dados antes de excluir
    const oldData = await pool.query('SELECT * FROM agendamentos WHERE id = $1', [appointmentId]);
    
    // Excluir
    await pool.query('DELETE FROM agendamentos WHERE id = $1', [appointmentId]);
    
    // Log
    if (req.user && oldData.rows[0]) {
      await logAppointmentDelete(req.user, appointmentId, oldData.rows[0], req);
    }
    
    res.status(204).send();
  } catch (error) {
    // ...
  }
});
```

## 🚫 Rotas que NÃO Devem Ter Log

Todas as rotas em `server/routes/public.ts` (prefixo `/api/public`) **não devem** registrar logs, pois são usadas pela página pública do cidadão.

## 📋 Rotas Pendentes de Integração

### Prioridade Alta
- [ ] `server/routes/agendamentos.ts`
  - [ ] POST `/` - Criar agendamento (verificar se é público ou administrativo)
  - [ ] DELETE `/:id` - Excluir agendamento
  - [ ] POST `/datas-bloqueadas` - Bloquear datas
  - [ ] DELETE `/datas-bloqueadas/:id` - Desbloquear datas

- [ ] `server/routes/appointments.routes.ts` / `appointments-new.ts`
  - [ ] Criar agendamento (administrativo)
  - [ ] Atualizar agendamento
  - [ ] Mudanças de status
  - [ ] Exclusões

- [ ] `server/routes/users.ts` / `secretaryUsers.ts`
  - [ ] Criar usuário
  - [ ] Atualizar usuário
  - [ ] Excluir usuário
  - [ ] Alterações de permissões

### Prioridade Média
- [ ] `server/routes/locations.ts` / `locations-new.ts` / `locations.routes.ts`
  - [ ] Criar local
  - [ ] Atualizar local
  - [ ] Excluir local

- [ ] `server/routes/systemConfig.ts`
  - [ ] Atualizar configurações do sistema

- [ ] `server/routes/tenants.ts`
  - [ ] Operações de tenant (se não estiverem em `server/index.ts`)

## 🔍 Consultando Logs

### Logs de um usuário específico
```sql
SELECT * FROM audit_logs 
WHERE user_email = 'usuario@exemplo.com' 
ORDER BY created_at DESC;
```

### Logs de uma ação específica
```sql
SELECT * FROM audit_logs 
WHERE action = 'LOGIN_FAILED' 
ORDER BY created_at DESC 
LIMIT 50;
```

### Logs críticos das últimas 24h
```sql
SELECT * FROM audit_logs 
WHERE severity IN ('HIGH', 'CRITICAL') 
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Logs de uma entidade específica
```sql
SELECT * FROM audit_logs 
WHERE entity_type = 'appointment' 
  AND entity_id = '123'
ORDER BY created_at DESC;
```

### Tentativas de login por IP
```sql
SELECT ip_address, COUNT(*) as tentativas, 
       MAX(created_at) as ultima_tentativa
FROM audit_logs 
WHERE action = 'LOGIN_FAILED'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 3
ORDER BY tentativas DESC;
```

## 🎯 Próximos Passos

1. **Integrar logs nas rotas de alta prioridade** (agendamentos e usuários)
2. **Criar painel de auditoria no frontend** para visualizar logs
3. **Implementar alertas automáticos** para ações críticas
4. **Adicionar retenção de logs** (política de limpeza após X dias)
5. **Exportação de logs** para análise externa

## 📚 Referências

- **Geolocalização**: [ip-api.com](http://ip-api.com/docs/)
- **User-Agent Parser**: Implementado manualmente em `audit.service.ts`
- **JWT**: Tokens decodificados em `auth.middleware.ts`
