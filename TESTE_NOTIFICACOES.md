# 🧪 Teste de Notificações SMS/WhatsApp

## 📋 Visão Geral

Este sistema permite testar o envio de notificações por **Email**, **SMS** e **WhatsApp** ao criar agendamentos, sem precisar criar um agendamento real no sistema.

## 🎯 Como Acessar

1. **Faça login** como usuário da secretaria ou administrador
2. Na barra de navegação superior, clique na aba **"Testar Notificações"** (ícone de avião de papel 📧)

## 🔧 Como Usar o Painel de Teste

### 1. Preencher Dados do Teste

Preencha os seguintes campos com dados fictícios ou reais para teste:

- **Nome Completo**: Nome do cidadão que receberia a notificação
- **CPF**: CPF do cidadão (apenas para simulação)
- **Telefone/WhatsApp**: Número onde seria enviado SMS/WhatsApp
- **Email**: Endereço de email que receberia a notificação
- **Data do Agendamento**: Data fictícia do agendamento
- **Horário**: Horário fictício do agendamento
- **Tipo de CIN**: Escolha entre "1ª via" ou "2ª via"
- **Localidade**: Selecione uma das localidades cadastradas

### 2. Selecionar Canais de Notificação

Você pode habilitar ou desabilitar cada canal de notificação:

- ✉️ **Email**: Notificação por email
- 📱 **SMS**: Notificação por mensagem de texto SMS
- 💬 **WhatsApp**: Notificação via WhatsApp

**Dica**: Você pode testar os canais individualmente ou todos juntos!

### 3. Executar o Teste

Clique no botão **"Enviar Notificação de Teste"** para simular o envio.

### 4. Verificar Resultados

#### No Painel Web:
- O card **"Resultado do Último Teste"** mostrará quais canais foram enviados com sucesso
- Cada canal terá um indicador visual:
  - ✅ **Verde**: Enviado com sucesso
  - ❌ **Cinza**: Não enviado

#### No Console do Navegador (F12):
- Pressione **F12** para abrir o Console do navegador
- Você verá o conteúdo COMPLETO das mensagens que seriam enviadas por cada canal
- Formato de saída:

```
🧪 INICIANDO TESTE DE NOTIFICAÇÃO
============================================================
Canais habilitados:
  📧 Email: ✅ SIM
  📱 SMS: ✅ SIM
  💬 WhatsApp: ✅ SIM
============================================================

=== EMAIL NOTIFICATION ===
To: joao.silva@email.com
Subject: Agendamento Confirmado - CIN
Body: Olá João da Silva,

Seu agendamento foi confirmado!

📅 Data: 15 de janeiro de 2025
🕐 Horário: 09:00
📋 Protocolo: TEST-1234567890
📄 Tipo: 1ª via
...

=== SMS NOTIFICATION ===
To: (88) 99999-9999
Message: CIN 1ª via CONFIRMADO: 15/01/2025 às 09:00...

=== WHATSAPP NOTIFICATION ===
To: 88999999999
Message: *Sistema de Agendamento*

Olá *João da Silva*! 👋

✅ Seu agendamento foi *CONFIRMADO*!
...

============================================================
🎯 RESULTADO DO TESTE
  Status: ✅ SUCESSO
  Email enviado: ✅ SIM
  SMS enviado: ✅ SIM
  WhatsApp enviado: ✅ SIM
============================================================
```

## 📊 Histórico de Testes

O painel mantém um histórico dos últimos 10 testes executados, mostrando:
- ✅ Status do teste (sucesso/falha)
- 📅 Data e hora de execução
- 📡 Canais utilizados (Email, SMS, WhatsApp)

## 🎨 Conteúdo das Notificações

### Email
Contém informações detalhadas:
- Dados do agendamento (data, hora, protocolo, tipo de CIN)
- Localização com link do Google Maps
- Lista completa de documentos necessários para 1ª via ou 2ª via
- Instruções sobre retirada por terceiros
- Horário de funcionamento

### SMS
Mensagem compacta e direta:
- Tipo de CIN, data, hora e protocolo
- Lembrete sobre documentos
- Mensagem otimizada para 160 caracteres

### WhatsApp
Mensagem formatada com emojis:
- Uso de **negrito** para destaques
- Emojis apropriados (📅 📋 📍 etc.)
- Estrutura organizada em seções
- Link do Google Maps
- Instruções detalhadas

## 🔍 Casos de Uso

### Testar Email Individual
1. Habilite apenas o canal **Email**
2. Desabilite SMS e WhatsApp
3. Execute o teste
4. Verifique o conteúdo no console

### Testar SMS Individual
1. Habilite apenas o canal **SMS**
2. Execute o teste
3. Veja a mensagem compacta no console

### Testar WhatsApp Individual
1. Habilite apenas o canal **WhatsApp**
2. Execute o teste
3. Veja a mensagem formatada no console

### Testar Todos os Canais
1. Habilite Email, SMS e WhatsApp
2. Execute o teste
3. Compare as três versões da mensagem no console

### Testar com Diferentes Tipos de CIN
1. Selecione "1ª via" e execute o teste
2. Verifique a lista de documentos específica para 1ª via
3. Mude para "2ª via" e execute novamente
4. Compare as diferenças nos documentos exigidos

### Testar com Diferentes Localidades
1. Se você tem múltiplas localidades cadastradas
2. Selecione diferentes localidades
3. Veja como o endereço e link do Google Maps mudam nas notificações

## ⚙️ Configurações do Sistema

As notificações respeitam as configurações do painel administrativo:

- **Email habilitado/desabilitado** (Admin > Configurações de Email)
- **SMS habilitado/desabilitado** (Admin > Configurações de SMS)
- **WhatsApp habilitado/desabilitado** (Admin > Configurações de WhatsApp)

## 🚨 Observações Importantes

1. **Simulação apenas**: Este painel NÃO envia notificações reais. Ele apenas simula e exibe o que seria enviado.

2. **Console do navegador**: Para ver o conteúdo completo das mensagens, **sempre abra o console (F12)**.

3. **Localidades**: É necessário ter pelo menos uma localidade cadastrada para realizar testes.

4. **Dados fictícios**: Você pode usar dados completamente fictícios. O sistema não valida CPF, telefone ou email durante o teste.

5. **Tempo de resposta**: O sistema simula um pequeno atraso (300-500ms) para dar uma experiência mais realista.

## 💡 Dicas

- Use dados de teste consistentes para facilitar a verificação
- Experimente diferentes combinações de canais
- Teste com ambos os tipos de CIN (1ª via e 2ª via) para ver as diferenças
- Abra o console ANTES de executar o teste para não perder nenhuma saída
- Use "Clear console" (Ctrl+L) entre testes para facilitar a leitura

## 🐛 Solução de Problemas

### "Nenhum canal de notificação está habilitado"
- **Solução**: Habilite pelo menos um canal (Email, SMS ou WhatsApp) usando os switches

### "Não há dados para exportar"
- **Solução**: Preencha todos os campos obrigatórios (nome, telefone, email)

### "Nenhuma localidade cadastrada"
- **Solução**: Acesse a aba "Localidades" e cadastre pelo menos uma localidade

### Não vejo as mensagens completas
- **Solução**: Abra o Console do navegador (F12 ou Ctrl+Shift+J)

## 📈 Próximos Passos

Depois de testar as notificações:

1. **Configure os canais reais** no painel administrativo
2. **Crie um agendamento de verdade** para testar o fluxo completo
3. **Verifique os lembretes automáticos** (enviados 24h antes)
4. **Monitore o histórico de lembretes** na aba específica

## 📞 Suporte

Se encontrar problemas ou tiver dúvidas sobre o sistema de notificações, consulte o administrador do sistema.
