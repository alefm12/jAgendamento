# Assistente Virtual Ayla - Instruções

## 📋 Descrição

Ayla é a assistente virtual inteligente do Sistema de Agendamento CIN. Ela oferece suporte interativo aos cidadãos através de um chat intuitivo e amigável.

## 🎯 Funcionalidades

### 1. **Agendar Atendimento**
- Seleção de local de atendimento
- Redirecionamento para o fluxo completo de agendamento
- Integração com o sistema principal

### 2. **Consultar Status do CIN**
- Consulta por CPF
- Visualização de informações do agendamento
- Status do CIN (Pendente, Confirmado, Pronto para retirada, etc.)

### 3. **Cancelar Agendamento**
- Busca de agendamento por CPF
- Verificação de agendamentos pendentes
- Redirecionamento para página de cancelamento

### 4. **Locais de Atendimento**
- Listagem de todos os locais ativos
- Endereços completos
- Informações de contato

## 🎨 Personalização

### Avatar da Ayla

Para personalizar o avatar da Ayla, substitua o arquivo:

```
public/ayla-avatar.png
```

**Recomendações:**
- Formato: PNG com fundo transparente
- Tamanho: 400x400 pixels
- Estilo: 3D ou ilustração moderna

### Cores e Tema

As cores seguem o esquema do sistema:
- **Principal**: Gradiente roxo-para-azul
- **Botão**: Efeito de flutuação animado
- **Chat**: Fundo branco com mensagens estilizadas

## 📱 Responsividade

A Ayla é totalmente responsiva e se adapta a:
- Desktop (botão no canto inferior direito)
- Tablet (chat ajustado)
- Mobile (fullscreen em dispositivos pequenos)

## 🚀 Integração

A Ayla está integrada em:
- ✅ Página inicial pública
- ✅ Página de agendamento
- ✅ Página de consulta de status

## 🔧 Componentes

### AylaAvatar.tsx
Avatar animado com efeito de flutuação e indicador de status online.

### AylaButton.tsx
Botão flutuante com animações de entrada e tooltip.

### AylaChat.tsx
Interface completa do chat com:
- Sistema de mensagens
- Menus interativos
- Integração com APIs
- Validações de dados

## 💡 Melhorias Futuras

- [ ] Suporte a múltiplos idiomas
- [ ] Histórico de conversas
- [ ] Respostas mais inteligentes com IA
- [ ] Notificações push
- [ ] Integração com WhatsApp
- [ ] Voice chat

## 📝 Notas Técnicas

- **Framework**: React + TypeScript
- **Animações**: Framer Motion
- **Ícones**: Lucide React
- **Validações**: Funções customizadas de validação
- **API**: Integração com o backend existente

## 🎭 Personalidade da Ayla

Ayla foi projetada para ser:
- 😊 **Amigável**: Tom de conversa casual e acolhedor
- 🎯 **Objetiva**: Respostas diretas e claras
- 💼 **Profissional**: Mantém formalidade quando necessário
- 🚀 **Eficiente**: Resolve problemas rapidamente
