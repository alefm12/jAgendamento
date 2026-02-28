# 📱 Notificações SMS e WhatsApp - Guia Completo

## 🎯 Visão Geral

O Sistema de Agendamento Multi-Prefeituras oferece **3 canais de notificação** para garantir que todos os cidadãos recebam lembretes e atualizações sobre seus agendamentos:

- 📧 **Email** - Notificações detalhadas com informações completas
- 📱 **SMS** - Mensagens curtas e diretas para qualquer celular
- 💬 **WhatsApp** - Mensagens ricas com formatação e emojis

---

## ✨ Recursos das Notificações

### 📧 Email
- ✅ Envio de mensagens detalhadas com todas as informações
- ✅ Inclui links para Google Maps
- ✅ Lista completa de documentos necessários
- ✅ Diferenciação entre 1ª via e 2ª via de CIN
- ✅ Funciona para qualquer endereço de email

### 📱 SMS
- ✅ **Alta taxa de leitura:** 98% dos SMS são lidos em até 3 minutos
- ✅ **Funciona em qualquer celular:** Não precisa de smartphone ou internet
- ✅ **Entrega instantânea:** Mensagens chegam em segundos
- ✅ **Mensagens otimizadas:** Conteúdo resumido em ~160 caracteres
- ✅ **Ideal para lembretes urgentes:** Perfeito para notificações de última hora

**Exemplo de SMS:**
```
João Silva, lembrete: agendamento AMANHÃ 15/01/2025 às 09:00. 
Traga documentos pessoais! Protocolo: CIN-20250114-ABC123
```

### 💬 WhatsApp
- ✅ **Formato rico:** Emojis, negrito, quebras de linha
- ✅ **Confirmação de leitura:** Veja quando a mensagem foi entregue e lida (✓✓)
- ✅ **Sem limite de caracteres:** Envie informações completas
- ✅ **Links clicáveis:** Google Maps e outras URLs
- ✅ **Mais usado no Brasil:** 96% dos brasileiros usam WhatsApp diariamente

**Exemplo de WhatsApp:**
```
*Sistema de Agendamento da Carteira de Identidade Nacional - CIN*

Olá *João Silva*! 👋

🔔 *LEMBRETE* - Seu agendamento é *AMANHÃ*!

📅 *Data:* 15 de janeiro de 2025 (AMANHÃ)
🕐 *Horário:* 09:00
📋 *Protocolo:* CIN-20250114-ABC123

📍 *Local:* Avenida Paulo Bastos, 100, Centro
🗺️ *Ver no mapa:* [Google Maps]

⚠️ *NÃO ESQUEÇA DE TRAZER:* 📄
• Documento de identidade atual (CIN antigo)
• CPF original
• Comprovante de residência recente
• Certidão de nascimento ou casamento

⏰ Chegue com *10 minutos de antecedência*.

Se não puder comparecer, cancele pelo sistema! 🙏
```

---

## 🔔 Quando as Notificações são Enviadas

O sistema envia notificações automaticamente nos seguintes momentos:

| Evento | Email | SMS | WhatsApp | Descrição |
|--------|-------|-----|----------|-----------|
| **Confirmação de Agendamento** | ✅ | ✅ | ✅ | Enviado imediatamente após o cidadão criar um agendamento |
| **Lembrete Automático** | ✅ | ✅ | ✅ | Enviado 24h antes do horário agendado (configurável) |
| **CIN Pronto para Retirada** | ✅ | ✅ | ✅ | Notifica quando o CIN estiver disponível |
| **Lembrete de CIN Pronto** | ✅ | ✅ | ✅ | Enviado 7 dias após o CIN ficar pronto (se não retirado) |
| **Cancelamento** | ✅ | ✅ | ✅ | Confirmação de cancelamento do agendamento |
| **Reagendamento** | ✅ | ✅ | ✅ | Confirmação da nova data e horário |
| **CIN Entregue** | ✅ | ✅ | ✅ | Confirmação de que o CIN foi retirado |

---

## ⚙️ Como Configurar

### 1. Acessar o Painel Administrativo

1. Faça login como **Administrador**
2. Clique na aba **"Admin"**
3. Navegue até a seção **"Notificações e Lembretes"**

### 2. Configurar Email

✅ **Já está pronto para uso!** O email está habilitado por padrão.

**Configurações disponíveis:**
- Ativar/Desativar envio de emails
- Nome do remetente
- Email de resposta
- Mensagem de lembrete personalizada

### 3. Configurar SMS

1. Marque o checkbox **"Enviar SMS automáticos"**
2. As notificações por SMS serão enviadas automaticamente

**Observação:** O sistema está preparado para integração com provedores de SMS como:
- Twilio
- Zenvia
- TotalVoice
- AWS SNS

### 4. Configurar WhatsApp

Para usar o WhatsApp, você precisa de uma conta **WhatsApp Business API**:

#### 📌 Provedores Recomendados:

| Provedor | Preço Aproximado | Site |
|----------|------------------|------|
| **Twilio** | R$ 0,40/msg | twilio.com |
| **MessageBird** | R$ 0,35/msg | messagebird.com |
| **360Dialog** | R$ 0,38/msg | 360dialog.com |
| **Zenvia** | R$ 0,42/msg | zenvia.com |

#### 🚀 Passos para Ativar:

1. **Escolha um provedor** da lista acima
2. **Crie uma conta** e solicite acesso à API do WhatsApp Business
3. **Configure seu número** de telefone no provedor
4. **Obtenha sua chave de API** (token de autenticação)
5. No sistema, vá para **Admin > Notificações**
6. Marque **"Enviar mensagens automáticas por WhatsApp"**
7. Preencha:
   - **Número do WhatsApp Business:** `+5585999999999` (com código do país)
   - **Chave API:** Cole a chave fornecida pelo provedor
8. Clique em **"Salvar Notificações"**

#### ⚠️ Diferença entre WhatsApp Business App e WhatsApp Business API

| WhatsApp Business App | WhatsApp Business API |
|-----------------------|----------------------|
| ❌ Não permite envio automático | ✅ Permite envio automático |
| ✅ Gratuito | 💰 Pago (por mensagem) |
| ❌ Precisa de ação manual | ✅ Totalmente automatizado |
| ✅ Instalado no celular | ☁️ API na nuvem |

**Para este sistema, você precisa do WhatsApp Business API.**

---

## 🎛️ Configurar Lembretes Automáticos

### Ativando Lembretes

1. Vá para **Admin > Notificações e Lembretes**
2. Na seção **"Lembretes Automáticos"**, ative o switch
3. Configure **"Tempo de Antecedência"**:
   - **24 horas** (padrão) - 1 dia antes
   - **48 horas** - 2 dias antes
   - **72 horas** - 3 dias antes
   - Ou qualquer valor entre 1 e 168 horas

### Selecionar Canais

Marque os canais que deseja usar para enviar lembretes:
- ✅ **Email** - Sempre recomendado
- ✅ **SMS** - Ótima taxa de leitura
- ✅ **WhatsApp** - Mais completo e interativo

**💡 Recomendação:** Ative os 3 canais simultaneamente para garantir que todos os cidadãos recebam as notificações.

### Preview dos Lembretes

O painel mostra uma **visualização em tempo real** de como cada tipo de mensagem aparecerá para o cidadão:
- 📧 **Preview do Email** - Assunto e corpo completo
- 📱 **Preview do SMS** - Mensagem curta otimizada
- 💬 **Preview do WhatsApp** - Mensagem formatada com emojis

---

## 📊 Monitoramento de Notificações

### Histórico de Lembretes

1. Vá para a aba **"Histórico de Lembretes"**
2. Visualize todas as notificações enviadas:
   - Data e hora do envio
   - Cidadão que recebeu
   - Canais utilizados (Email, SMS, WhatsApp)
   - Status da entrega

### Logs de Auditoria

Todas as notificações ficam registradas nos **Logs de Auditoria**:
1. Acesse **"Logs de Auditoria"**
2. Filtre por ação: **"reminder_sent"** ou **"notification_sent"**
3. Veja detalhes completos de cada envio

---

## 🛠️ Solução de Problemas

### SMS não está sendo enviado

**Possíveis causas:**
- SMS está desativado nas configurações
- Número de telefone inválido no cadastro
- Provedor de SMS não configurado

**Solução:**
1. Verifique se o SMS está ativado em **Admin > Notificações**
2. Confirme que o telefone do cidadão está no formato correto: `(85) 99999-9999`
3. Configure a integração com um provedor de SMS

### WhatsApp não está sendo enviado

**Possíveis causas:**
- WhatsApp está desativado
- Chave API incorreta ou expirada
- Número do WhatsApp Business inválido

**Solução:**
1. Verifique se o WhatsApp está ativado em **Admin > Notificações**
2. Confirme que a chave API está correta
3. Teste a chave API no painel do provedor
4. Verifique se o número está no formato internacional: `+5585999999999`

### Lembretes não estão sendo enviados automaticamente

**Possíveis causas:**
- Lembretes automáticos desativados
- Nenhum canal ativado (Email, SMS, WhatsApp)
- Tempo de antecedência muito curto ou muito longo

**Solução:**
1. Acesse **Admin > Notificações e Lembretes**
2. Ative **"Lembretes Automáticos"**
3. Ative pelo menos um canal (Email, SMS ou WhatsApp)
4. Verifique o tempo de antecedência (recomendado: 24 horas)
5. O sistema verifica a cada hora - aguarde até 60 minutos para o primeiro envio

---

## 💡 Melhores Práticas

### ✅ Recomendações

1. **Ative os 3 canais** (Email + SMS + WhatsApp)
   - Garante que todos recebam, independente de preferências
   - Aumenta a taxa de comparecimento em até 40%

2. **Configure o tempo ideal de lembrete**
   - 24 horas é o padrão e funciona bem
   - Para serviços urgentes, considere 12 horas
   - Para planejamento, considere 48-72 horas

3. **Monitore o histórico regularmente**
   - Verifique se as notificações estão sendo entregues
   - Identifique problemas rapidamente

4. **Teste antes de lançar**
   - Crie um agendamento de teste com seu próprio número
   - Verifique se recebe notificações em todos os canais

### ⚠️ O que Evitar

- ❌ Desativar todos os canais de notificação
- ❌ Configurar lembretes com menos de 6 horas de antecedência
- ❌ Enviar lembretes com mais de 7 dias de antecedência
- ❌ Usar WhatsApp Business App ao invés da API

---

## 📈 Estatísticas de Eficácia

Baseado em estudos de sistemas similares:

| Canal | Taxa de Entrega | Taxa de Leitura | Tempo Médio de Leitura |
|-------|-----------------|-----------------|------------------------|
| **Email** | 95% | 20-30% | 2-6 horas |
| **SMS** | 98% | 95-98% | 1-3 minutos |
| **WhatsApp** | 99% | 90-95% | 5-15 minutos |

**Impacto dos Lembretes:**
- ✅ Redução de 35-45% em faltas
- ✅ Aumento de 40% na taxa de comparecimento
- ✅ Diminuição de 50% em reagendamentos

---

## 🎯 Exemplos de Uso

### Exemplo 1: Configuração Básica (Somente Email)

**Quando usar:** Orçamento limitado, público com bom acesso à internet

```
✅ Email: Ativado
❌ SMS: Desativado
❌ WhatsApp: Desativado

Lembrete: 24 horas antes
```

### Exemplo 2: Configuração Intermediária (Email + SMS)

**Quando usar:** Garantir maior cobertura, público misto

```
✅ Email: Ativado
✅ SMS: Ativado
❌ WhatsApp: Desativado

Lembrete: 24 horas antes
```

### Exemplo 3: Configuração Completa (Todos os Canais)

**Quando usar:** Máxima eficácia, reduzir faltas ao mínimo

```
✅ Email: Ativado
✅ SMS: Ativado
✅ WhatsApp: Ativado

Lembrete: 24 horas antes
```

---

## 📞 Suporte

Para dúvidas sobre configuração de SMS ou WhatsApp:

1. Consulte a documentação do seu provedor
2. Entre em contato com o suporte técnico do provedor
3. Verifique os logs de auditoria para diagnóstico

---

## 🔄 Atualizações Futuras

Funcionalidades planejadas:
- [ ] Suporte a múltiplos lembretes (ex: 48h + 24h + 2h antes)
- [ ] Notificações por push (app mobile)
- [ ] Templates personalizados por tipo de serviço
- [ ] Análise de taxa de abertura por canal
- [ ] Integração com Telegram
- [ ] Envio de comprovante em PDF via WhatsApp

---

**Última atualização:** Janeiro 2025  
**Versão do Sistema:** 2.0
