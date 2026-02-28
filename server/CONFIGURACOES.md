# Sistema de Configurações - jAgendamento

## 📋 Visão Geral

Sistema completo de configurações implementado conforme especificação, permitindo ao administrador controlar todos os aspectos do sistema através de uma interface intuitiva organizada em abas.

## 🗄️ Banco de Dados

### Migration Executada: `009_sistema_configuracoes.sql`

Tabelas criadas:

1. **`layout_config`** - Configurações de cores por área (pública, secretaria, atendimento)
2. **`horarios_config`** - Horários disponíveis e regras de agendamento
3. **`notificacoes_config`** - Templates e configurações de email/WhatsApp/SMS
4. **`chamadas_config`** - Configurações de voz e layout do sistema de chamadas
5. **`geral_config`** - Informações da secretaria, backup e relatórios
6. **`usuarios_permissoes`** - Permissões detalhadas por usuário e recurso
7. **`campos_personalizados`** - Campos customizados para o formulário

## 🎨 1. Layout (Cores do Sistema)

### Áreas Configuráveis
- **Página Pública**: Cores da interface do cidadão
- **Secretaria**: Cores do painel administrativo
- **Atendimento**: Cores da interface de atendimento

### Cores Disponíveis
- Cores principais (primária, secundária, destaque, fundo, textos)
- Cores de botões (principal, secundário, cancelar + hover)
- Cores de status (pendente, confirmado, chamado, concluído, cancelado)

### Endpoints
```
GET    /api/config/layout/:prefeituraId
PUT    /api/config/layout/:id
POST   /api/config/layout/:prefeituraId/restaurar
```

## ⏰ 2. Horários

### Configurações
- Horários disponíveis (lista separada por vírgula)
- Máximo de agendamentos por horário
- Período liberado para agendamentos (em dias)

### Endpoints
```
GET    /api/config/horarios/:prefeituraId
PUT    /api/config/horarios/:prefeituraId
```

## 📝 3. Campos Personalizados

### Tipos Suportados
- text, number, email, tel, date
- select (com opções), checkbox, textarea

### Configurações por Campo
- Nome técnico e label de exibição
- Placeholder e texto de ajuda
- Obrigatório / Ativo
- Ordem de exibição

### Endpoints
```
GET    /api/config/campos/:prefeituraId
POST   /api/config/campos/:prefeituraId
PUT    /api/config/campos/:id
DELETE /api/config/campos/:id
```

## 🔔 4. Notificações

### Tipos de Notificação
1. **Agendamento** - Confirmação imediata
2. **Lembrete** - Enviado X dias/horas antes
3. **Cancelamento** - Quando cidadão cancela
4. **Concluído** - Após atendimento ser marcado como concluído
5. **CIN Pronta** - Quando documento está pronto para retirada
6. **CIN Entregue** - Confirmação de entrega

### Canais
- **Email**: Configuração SMTP completa
- **WhatsApp**: API externa configurável
- **SMS**: Suporte para integração

### Templates
- Assunto e corpo de email
- Mensagem de WhatsApp
- Mensagem de SMS
- Variáveis disponíveis: `{name}`, `{date}`, `{time}`, `{protocol}`, `{location}`, `{systemName}`

### Endpoints
```
GET /api/config/notificacoes/:prefeituraId
GET /api/config/notificacoes/:prefeituraId/:tipo
PUT /api/config/notificacoes/:id
```

## 📢 5. Chamadas (Sistema de Voz)

### Configurações de Voz
- Tipo de voz (Google, Azure, AWS)
- Idioma, gênero, velocidade, volume, tom
- Repetições automáticas

### Layout da Interface
- Cores personalizáveis (fundo, texto, destaque, botões)
- Template de mensagem customizável

### Endpoints
```
GET /api/config/chamadas/:prefeituraId
PUT /api/config/chamadas/:prefeituraId
```

## ⚙️ 6. Geral

### Informações da Secretaria
- Nome, endereço completo
- Telefone, email, site, horário de funcionamento

### Relatórios
- Ativação/desativação por tipo
- Tipos: agendamentos, localidade, bairro, status, período, região, gênero, tipo_cin

### Backup
- Periodicidade (diário, semanal, mensal)
- Horário de execução
- Retenção (dias)
- Email para notificações

### Logs de Auditoria
- Ativação/desativação
- Período de retenção (dias)

### Endpoints
```
GET /api/config/geral/:prefeituraId
PUT /api/config/geral/:prefeituraId
```

## 👥 7. Usuários e Permissões

### Permissões por Aba

#### Secretaria
- ✅ Visualizar
- ✅ Confirmar agendamento
- ✅ Adicionar notas
- ✅ Filtrar por data
- ✅ Exportar relatórios

#### Atendimento
- ✅ Visualizar
- ✅ Chamar cidadão
- ✅ Marcar como concluído
- ✅ Marcar CIN pronta
- ✅ Marcar CIN entregue

#### Analytics
- ✅ Visualizar relatórios
- ✅ Exportar dados

#### Entrega CIN
- ✅ Visualizar lista
- ✅ Marcar como entregue

#### Administrativo
- ✅ Gerenciar usuários
- ✅ Configurar sistema
- ✅ Bloquear datas
- ✅ Gerenciar locais
- ✅ Visualizar logs de auditoria

### Controle por Local de Atendimento

**Acesso Geral** (locaisPermitidos = null):
- Visualiza todos os agendamentos de todos os locais
- Acesso total ao "banco de dados" da prefeitura

**Acesso Específico** (locaisPermitidos = [1, 3, 5]):
- Visualiza apenas agendamentos dos locais permitidos
- Funciona como "sub-banco de dados" filtrado
- Ideal para atendentes de locais específicos

### Sistema de Visibilidade de Abas

Se o usuário NÃO tem permissão para uma aba inteira (todas as permissões daquela aba são false), a aba fica **OCULTA** na interface, como se não existisse.

Exemplos:
- Se `atendimentoVisualizar = false` → Aba Atendimento não aparece
- Se `analyticsVisualizar = false` → Aba Analytics não aparece
- Se `adminGerenciarUsuarios = false` E todas as outras permissões admin são false → Aba Administração não aparece

### Endpoints
```
GET /api/config/permissoes/:usuarioId/:prefeituraId
PUT /api/config/permissoes/:usuarioId/:prefeituraId
GET /api/config/permissoes/usuario/:usuarioId
```

## 🔐 Segurança

- Todas as rotas usam `AuthRequest` (middleware de autenticação)
- Logs de auditoria registram quem fez cada alteração (`atualizado_por`)
- Senhas SMTP criptografadas no banco
- Tokens de API armazenados com segurança

## 🎯 Próximos Passos

### Backend (Completo ✅)
- ✅ Migrations criadas e executadas
- ✅ Tipos TypeScript definidos
- ✅ Rotas de API implementadas
- ✅ Integração com servidor principal

### Frontend (Pendente)

1. **Criar componente `SystemConfigTabs`**
   - Tabs: Layout, Campos, Horários, Notificações, Chamadas, Geral, Usuários
   - Navegação entre abas

2. **Implementar aba LAYOUT**
   - Sub-tabs: Página Pública, Secretaria, Atendimento
   - Color pickers para cada cor
   - Preview em tempo real
   - Botão "Restaurar Padrões"

3. **Implementar aba CAMPOS**
   - Lista de campos personalizados
   - Formulário de criação/edição
   - Drag & drop para reordenar
   - Toggle ativo/inativo

4. **Implementar aba HORÁRIOS**
   - Input de horários (comma-separated ou time picker múltiplo)
   - Input de máximo por horário
   - Slider de período liberado

5. **Implementar aba NOTIFICAÇÕES**
   - Sub-tabs: Agendamento, Lembrete, Cancelamento, Concluído, CIN Pronta, CIN Entregue
   - Toggles: Email, WhatsApp, SMS
   - Inputs de configuração SMTP
   - Inputs de configuração WhatsApp
   - Rich text editor para templates

6. **Implementar aba CHAMADAS**
   - Selects para configurações de voz
   - Sliders para velocidade, volume, tom
   - Color pickers para layout
   - Input de template
   - Controles de repetição

7. **Implementar aba GERAL**
   - Formulário de informações da secretaria
   - Checkboxes de relatórios disponíveis
   - Configurações de backup
   - Configurações de logs

8. **Implementar aba USUÁRIOS**
   - Lista de usuários
   - Formulário de criação/edição
   - Grid de permissões (checkboxes por recurso)
   - Select múltiplo de locais permitidos
   - Botão "Acesso Total"

9. **Lógica de Visibilidade de Abas**
   - Implementar no componente principal de layout
   - Verificar permissões do usuário logado
   - Ocultar abas sem permissão

## 📚 Exemplos de Uso

### Obter cores da página pública
```typescript
const response = await fetch('/api/config/layout/1');
const layouts = await response.json();
const publicLayout = layouts.find(l => l.area === 'public');
```

### Atualizar horários
```typescript
await fetch('/api/config/horarios/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    horariosDisponiveis: '08:00,08:30,09:00,09:30,10:00',
    maxAgendamentosPorHorario: 3,
    periodoLiberadoDias: 90
  })
});
```

### Criar campo personalizado
```typescript
await fetch('/api/config/campos/1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nomeCampo: 'nome_mae',
    labelCampo: 'Nome da Mãe',
    tipoCampo: 'text',
    placeholder: 'Digite o nome completo da mãe',
    obrigatorio: true,
    ativo: true,
    ordem: 10
  })
});
```

### Configurar permissões de usuário
```typescript
await fetch('/api/config/permissoes/5/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secretariaVisualizar: true,
    secretariaConfirmarAgendamento: true,
    atendimentoVisualizar: false,
    analyticsVisualizar: false,
    adminGerenciarUsuarios: false,
    locaisPermitidos: [1, 3] // Apenas locais 1 e 3
  })
});
```

## 🔄 Integração com Sistema Existente

### Como aplicar as configurações de layout
```typescript
// No componente principal, carregar configurações
const layoutConfig = await fetch(`/api/config/layout/${prefeituraId}`);
const colors = await layoutConfig.json();

// Aplicar cores via CSS variables
const publicColors = colors.find(c => c.area === 'public');
document.documentElement.style.setProperty('--cor-primaria', publicColors.corPrimaria);
document.documentElement.style.setProperty('--cor-secundaria', publicColors.corSecundaria);
// ... etc
```

### Como renderizar campos personalizados
```typescript
const campos = await fetch(`/api/config/campos/${prefeituraId}`);
const camposAtivos = (await campos.json()).filter(c => c.ativo);

camposAtivos.forEach(campo => {
  renderField(campo);
});
```

### Como verificar permissões
```typescript
const permissoes = await fetch(`/api/config/permissoes/${usuarioId}/${prefeituraId}`);
const perms = await permissoes.json();

if (perms.analyticsVisualizar) {
  // Mostrar aba Analytics
} else {
  // Ocultar aba Analytics
}

if (perms.locaisPermitidos) {
  // Filtrar agendamentos apenas dos locais permitidos
  const agendamentos = await fetch(`/api/agendamentos?locais=${perms.locaisPermitidos.join(',')}`);
} else {
  // Buscar todos os agendamentos
  const agendamentos = await fetch(`/api/agendamentos`);
}
```

---

✅ **Sistema de configurações completo implementado e pronto para integração no frontend!**
