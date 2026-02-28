# 🏛️ Sistema Multi-Prefeituras - Agendamento Online

Sistema completo de agendamento online para emissão de CIN, projetado para gerenciar múltiplas prefeituras em uma única plataforma.

## 🚀 Características Principais

### Sistema Multi-Tenant
- **Super Admin**: Gerencia todas as prefeituras
- **Isolamento de Dados**: Cada prefeitura tem seu banco de dados separado
- **Gestão Centralizada**: Crie, edite e exclua prefeituras facilmente

### Para o Público
- ✅ Agendamento sem necessidade de cadastro
- 📅 Seleção de data e horário disponível
- 📧 **Notificações por Email, SMS e WhatsApp** 
- 🔔 **Lembretes automáticos 24h antes** por múltiplos canais
- 📱 Interface responsiva para mobile
- 📋 Visualização de agendamentos por CPF
- ❌ Cancelamento de agendamentos (quando permitido)
- 💬 Assistente IA para dúvidas comuns

### Para a Secretaria
- 👥 Sistema de login com permissões configuráveis
- 📊 Dashboard com estatísticas e relatórios
- 🔍 Busca e filtros avançados
- ✏️ Gerenciamento de status dos agendamentos
- 📝 Notas e comentários privados
- 🔄 Reagendamento de atendimentos
- 🚫 Bloqueio de datas (feriados/facultativos)
- 📤 Exportação em múltiplos formatos (CSV, JSON)
- 📍 Relatórios por localidade e bairro

### Para o Administrador Local
- 🎨 Customização visual (cores, logo, nome)
- 👤 Gerenciamento de usuários da secretaria
- 🔐 Controle granular de permissões
- 📍 Cadastro de localidades (sede, distritos)
- ➕ Campos customizados no formulário
- ⚙️ Configuração de horários de atendimento
- 📊 Definição de tipos de relatórios disponíveis

## 🔑 Acesso ao Sistema

### Super Administrador (Administrador Geral)

**Credenciais Padrão:**
```
Usuário: admin
Senha: admin123
```

⚠️ **IMPORTANTE**: Altere a senha padrão após o primeiro acesso!

Veja o arquivo [CREDENCIAIS.md](./CREDENCIAIS.md) para mais detalhes.

## 📖 Como Usar

### 1. Primeiro Acesso (Super Admin)

1. Acesse o sistema
2. Faça login com as credenciais do Super Admin
3. Crie sua primeira prefeitura:
   - Nome da prefeitura
   - Nome da cidade
   - Slug (identificador único)

### 2. Acessando uma Prefeitura

1. No painel do Super Admin, clique em "Acessar" na prefeitura desejada
2. Você será direcionado para o sistema daquela prefeitura

### 3. Configuração Inicial da Prefeitura

**Como Admin Local:**

1. Clique na aba "Admin"
2. Configure o sistema:
   - Nome do sistema
   - Cores da interface
   - Logo (opcional)
   - Horários de atendimento
   - Mensagem de lembrete
   - Campos customizados

3. Crie usuários da secretaria:
   - Nome completo
   - Usuário e senha
   - Defina se é administrador
   - Configure permissões específicas

4. Cadastre localidades:
   - Nome (ex: Sede, Distrito Norte)
   - Endereço completo

### 4. Uso pela Secretaria

1. Faça login com usuário da secretaria
2. Visualize todos os agendamentos
3. Gerencie status (Pendente → Confirmado → Concluído)
4. Adicione notas privadas
5. Reagende quando necessário
6. Bloqueie datas de feriados
7. Exporte relatórios

### 5. Uso pelo Público

1. Acesse a aba "Agendar"
2. Aceite os termos LGPD
3. Selecione uma data disponível
4. Escolha um horário livre
5. Preencha seus dados pessoais
6. Confirme o agendamento
7. Receba o número de protocolo
8. **Aguarde notificações por Email, SMS e WhatsApp**

## 🗄️ Configuração do Banco (PgAdmin)

As prefeituras cadastradas agora ficam salvas em um banco PostgreSQL, facilitando o uso em múltiplas máquinas e impedindo que os dados sumam após recarregar a página.

1. No PgAdmin, crie o banco `jagendamento`.
2. Execute os scripts [`server/migrations/002_prefeituras_base.sql`](./server/migrations/002_prefeituras_base.sql) e [`server/migrations/003_super_admins.sql`](./server/migrations/003_super_admins.sql).
3. Copie `.env.example` para `.env` e atualize `DATABASE_URL`, `SERVER_PORT` e `VITE_API_URL` conforme sua instância Postgres. Se estiver rodando localmente, mantenha `VITE_ENABLE_REMOTE_SPARK=false` para evitar chamadas ao runtime remoto do Spark e eliminar erros de rate limit.
4. Em terminais separados rode `npm run server:dev` (API Express) e `npm run dev` (frontend Vite).
5. Depois que a API estiver no ar, rode uma vez `curl -X POST http://localhost:4000/api/setup-admin` para criar o Super Admin padrão (`admin@admin.com` / `admin`).

O passo a passo completo está descrito em [DATABASE_SETUP.md](./DATABASE_SETUP.md).

## 📱 Sistema de Notificações Multi-Canal

O sistema oferece **3 canais de notificação** para garantir que todos os cidadãos recebam os lembretes:

### 📧 Email
- Mensagens detalhadas com todas as informações
- Links para Google Maps
- Lista completa de documentos necessários
- Diferenciação entre 1ª via e 2ª via de CIN

### 📱 SMS
- **Alta taxa de leitura:** 98% em até 3 minutos
- Funciona em qualquer celular (não precisa de smartphone)
- Entrega instantânea
- Mensagens otimizadas (~160 caracteres)

### 💬 WhatsApp
- Formato rico com emojis e formatação
- Confirmação de leitura (✓✓)
- Sem limite de caracteres
- Links clicáveis
- 96% dos brasileiros usam diariamente

### 🔔 Quando as Notificações são Enviadas

| Evento | Canais |
|--------|--------|
| Confirmação de Agendamento | 📧 📱 💬 |
| Lembrete Automático (24h antes) | 📧 📱 💬 |
| CIN Pronto para Retirada | 📧 📱 💬 |
| Lembrete de CIN Pronto (7 dias) | 📧 📱 💬 |
| Cancelamento | 📧 📱 💬 |
| Reagendamento | 📧 📱 💬 |

### ⚙️ Configurar SMS e WhatsApp

Veja o guia completo em: **[NOTIFICACOES-SMS-WHATSAPP.md](./NOTIFICACOES-SMS-WHATSAPP.md)**

**Resumo rápido:**
- **Email**: ✅ Já está pronto para uso
- **SMS**: Marque o checkbox nas configurações
- **WhatsApp**: Requer conta WhatsApp Business API (Twilio, Zenvia, etc.)

## 🏗️ Estrutura de Dados

### Hierarquia

```
Super Admin
└── Prefeituras (Tenants)
    ├── Configurações do Sistema
    ├── Usuários da Secretaria
    ├── Localidades
    ├── Datas Bloqueadas
    └── Agendamentos
        ├── Dados do Cidadão
        ├── Data e Horário
        ├── Status
        ├── Notas
        └── Histórico de Alterações
```

### Níveis de Permissão

1. **Super Admin**: Controle total de todas as prefeituras
2. **Admin Local**: Configurações e usuários de uma prefeitura
3. **Secretaria com Permissões**: Acesso limitado conforme configurado
4. **Secretaria Padrão**: Apenas visualização e alteração de status
5. **Público**: Criar e visualizar próprios agendamentos

## 🛠️ Tecnologias

- **Frontend**: React 19 + TypeScript
- **UI**: Shadcn/ui + Tailwind CSS
- **Backend API**: Express + Node.js
- **Ícones**: Phosphor Icons
- **Formulários**: React Hook Form
- **Notificações**: Sonner
- **Datas**: date-fns
- **Persistência**: PostgreSQL (prefeituras) + Spark KV (dados de cada tenant)
- **Validação**: Zod

## 📱 Recursos Avançados

### Notificações Inteligentes
- Email e SMS na confirmação
- Notificação de alterações de status
- Lembrete automático 24h antes
- Confirmação de cancelamento

### Auditoria Completa
- Histórico de todas as alterações
- Registro de quem fez cada ação
- Timestamp de cada operação
- Rastreamento de reagendamentos

### Relatórios Personalizados
- Por localidade
- Por bairro/comunidade
- Por status
- Por período
- Log de auditoria

### Segurança
- Isolamento de dados por prefeitura
- Controle de permissões granular
- Validação de CPF
- Prevenção de agendamentos duplicados

## 🎨 Personalização

Cada prefeitura pode personalizar:
- Cores primária, secundária e de destaque
- Logo da prefeitura
- Nome do sistema
- Mensagem de lembrete
- Campos do formulário
- Horários de atendimento
- Número de agendamentos por horário

## 📄 Documentação Adicional

- [CREDENCIAIS.md](./CREDENCIAIS.md) - Informações de acesso
- [PRD.md](./PRD.md) - Documento de requisitos do produto
- [SECURITY.md](./SECURITY.md) - Políticas de segurança
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Passo a passo do PostgreSQL/PgAdmin

## 🤝 Suporte

Para dúvidas sobre:
- **Credenciais**: Consulte [CREDENCIAIS.md](./CREDENCIAIS.md)
- **Funcionalidades**: Consulte [PRD.md](./PRD.md)
- **Problemas técnicos**: Entre em contato com o suporte

## 📄 License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
