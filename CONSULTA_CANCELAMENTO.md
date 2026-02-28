# Funcionalidade de Consulta de Agendamento com Cancelamento

## 📋 Resumo das Implementações

Esta atualização adiciona uma funcionalidade completa de consulta de agendamentos com validação de CPF e cancelamento seguro via código WhatsApp.

## 🎯 Funcionalidades Implementadas

### 1. Consulta de Agendamento por CPF
- **Validação de CPF**: Sistema valida se o CPF é válido antes de fazer a consulta
- **Busca no Banco**: Consulta todos os agendamentos vinculados ao CPF
- **Exibição de Status**: Mostra status atual de cada agendamento (Pendente, Confirmado, Concluído, etc.)
- **Mensagem para CPF não encontrado**: Quando não há agendamentos, exibe mensagem amigável com botão para realizar agendamento

### 2. Cancelamento Seguro com Código WhatsApp
- **Validação de Status**: Apenas agendamentos com status "pendente" podem ser cancelados
- **Código de 6 Dígitos**: Sistema gera código aleatório de 6 dígitos
- **Envio via WhatsApp**: Código é enviado para o telefone cadastrado no agendamento
- **Validação em 2 Etapas**: 
  1. Cidadão solicita cancelamento
  2. Sistema envia código via WhatsApp
  3. Cidadão confirma com o código recebido
- **Expiração**: Código válido por 15 minutos

## 📁 Arquivos Criados/Modificados

### Backend (Servidor)

#### Novos Arquivos:
1. **`server/services/whatsapp.service.ts`**
   - Serviço de envio de mensagens WhatsApp
   - Gerenciamento de códigos de cancelamento
   - Validação de códigos com expiração

#### Arquivos Modificados:
2. **`server/routes/agendamentos.ts`**
   - Adicionado: `GET /api/agendamentos/consultar/:cpf` - Consulta agendamentos por CPF
   - Adicionado: `POST /api/agendamentos/:id/solicitar-cancelamento` - Gera e envia código
   - Adicionado: `POST /api/agendamentos/:id/confirmar-cancelamento` - Valida código e cancela

### Frontend (Cliente)

#### Novos Arquivos:
3. **`src/components/public/PublicCancelDialog.tsx`**
   - Diálogo de cancelamento com verificação em 2 etapas
   - Interface para digitação do código de 6 dígitos
   - Feedback visual do processo

#### Arquivos Modificados:
4. **`src/components/public/ConsultationStatus.tsx`**
   - Interface completa de consulta de agendamentos
   - Validação de CPF
   - Listagem de agendamentos com status
   - Integração com diálogo de cancelamento
   - Botão "Realizar Agendamento" quando não há agendamentos

5. **`src/AppMultiTenant.tsx`**
   - Adicionada rota: `/:tenantSlug/consultar`
   - Adicionada rota: `/consultar`
   - Criado componente `ConsultPortal`

## 🚀 Como Testar

### 1. Configuração do WhatsApp (Opcional)
Para testar o envio real de códigos via WhatsApp, configure na tabela `whatsapp_config`:

```sql
INSERT INTO whatsapp_config (prefeitura_id, api_url, api_token, instance_id, numero_origem, ativo)
VALUES (1, 'https://sua-api-whatsapp.com/send', 'seu-token-api', 'sua-instancia', '5588999999999', true);
```

**Nota**: Em modo desenvolvimento, o código é exibido no toast para facilitar testes sem WhatsApp configurado.

### 2. Testar Consulta de Agendamento

#### Acesso via URL:
- Com tenant: `http://localhost:5000/iraucuba/consultar`
- Sem tenant: `http://localhost:5000/consultar`

#### Ou via Botão "Consultar Agendamento" na página inicial

#### Fluxo de Teste:
1. Digite um CPF válido que tenha agendamento cadastrado
2. Clique em "Consultar"
3. Sistema deve exibir todos os agendamentos daquele CPF com:
   - Nome do cidadão
   - Protocolo
   - Status (com ícone colorido)
   - Data e horário
   - Local de atendimento
   - Botão de cancelamento (apenas se status = "pendente")

#### Testar CPF sem Agendamento:
1. Digite um CPF válido que NÃO tenha agendamento
2. Clique em "Consultar"
3. Sistema deve exibir:
   - Mensagem: "Nenhum agendamento encontrado"
   - Texto: "Não encontramos nenhum agendamento vinculado a este CPF."
   - Botão: "Realizar Agendamento" (redireciona para tela de agendamento)

### 3. Testar Cancelamento com Código

#### Pré-requisito:
- Ter um agendamento com status "pendente"

#### Fluxo de Teste:
1. Consulte um CPF com agendamento pendente
2. Clique no botão "Cancelar Agendamento"
3. Confirme a ação no diálogo
4. Clique em "Solicitar Cancelamento"
5. Sistema envia código via WhatsApp (ou exibe no toast em dev)
6. Digite o código de 6 dígitos recebido
7. Clique em "Confirmar Cancelamento"
8. Sistema valida e cancela o agendamento
9. Status atualiza automaticamente para "Cancelado"

#### Testar Código Inválido:
- Digite um código errado → Sistema exibe erro "Código inválido ou expirado"

#### Testar Expiração:
- Aguarde 15 minutos após solicitar o código
- Tente confirmar → Sistema exibe erro de código expirado

## 🎨 Recursos Visuais

### Status com Cores e Ícones:
- 🟡 **Pendente**: Amarelo/Âmbar com ícone de relógio
- 🔵 **Confirmado**: Azul com ícone de check
- 🟢 **Concluído**: Verde com ícone de check
- 🔴 **Cancelado**: Vermelho com ícone de X
- 🟣 **Aguardando Emissão**: Roxo com ícone de relógio
- 🟢 **CIN Pronta**: Verde com ícone de check
- 🟢 **CIN Entregue**: Verde esmeralda com ícone de check

### Validações:
- ✅ CPF formatado automaticamente (000.000.000-00)
- ✅ Código aceita apenas números (6 dígitos)
- ✅ Botões desabilitados durante carregamento
- ✅ Feedback visual com spinners e toasts

## 🔒 Segurança

1. **Validação de CPF**: Algoritmo completo de validação de dígitos verificadores
2. **Código Temporário**: Códigos expiram em 15 minutos
3. **Verificação em 2 Etapas**: Exige posse do telefone cadastrado
4. **Apenas Status Pendente**: Não permite cancelar agendamentos já confirmados/concluídos
5. **Código de Uso Único**: Cada código só pode ser usado uma vez

## 📊 Estrutura do Banco de Dados

### Campos Necessários na Tabela `agendamentos`:
```sql
- id (integer)
- cidadao_nome (text)
- cidadao_cpf (text)
- telefone (text)
- email (text)
- data_agendamento (date)
- hora_agendamento (time)
- status (text) -- 'pendente', 'confirmado', 'concluido', 'cancelado', etc.
- tipo_cin (text)
- protocolo (text)
- local_id (integer)
```

### Tabela `whatsapp_config` (Para envio de códigos):
```sql
- prefeitura_id (integer)
- api_url (text)
- api_token (text)
- instance_id (text)
- numero_origem (text)
- ativo (boolean)
```

## 🐛 Troubleshooting

### Problema: Código não está sendo enviado via WhatsApp
**Solução**: 
- Verifique se a tabela `whatsapp_config` está configurada
- Verifique se `ativo = true` na configuração
- Em desenvolvimento, o código aparece no toast (mensagem verde no topo)

### Problema: CPF válido mas não encontra agendamentos
**Solução**:
- Verifique se o CPF está salvo sem pontos e traço no banco
- Sistema remove formatação automaticamente antes de buscar

### Problema: Não consigo cancelar um agendamento
**Solução**:
- Apenas agendamentos com status "pendente" podem ser cancelados
- Verifique o status atual do agendamento

## 📝 Notas Técnicas

- **Armazenamento de Códigos**: Atualmente em memória (Map). Para produção com múltiplos servidores, considere usar Redis
- **API WhatsApp**: Código genérico que pode precisar ajustes conforme a API específica utilizada
- **Timeout**: Requisição WhatsApp tem timeout de 10 segundos
- **Internacionalização**: Mensagens em PT-BR, telefone preparado para Brasil (código 55)

## ✨ Melhorias Futuras Sugeridas

1. Armazenar códigos de cancelamento no Redis em vez de memória
2. Adicionar log de tentativas de cancelamento
3. Implementar rate limiting para evitar abuso
4. Adicionar histórico de cancelamentos no banco
5. Permitir reagendamento após cancelamento
6. Enviar confirmação por e-mail além do WhatsApp
7. Adicionar opção de cancelamento com motivo

---

**Data de Implementação**: 30/01/2026
**Versão**: 1.0.0
