# Planning Guide

Sistema de agendamento online para emissão de CIN onde cidadãos podem agendar atendimento e a secretaria municipal pode visualizar e gerenciar todos os agendamentos do dia.

**Experience Qualities**: 
1. **Eficiente** - O processo de agendamento deve ser rápido e direto, permitindo que usuários completem o formulário em menos de 2 minutos
2. **Confiável** - Usuários devem ter certeza de que seu agendamento foi registrado com confirmação visual clara e a secretaria deve ter acesso em tempo real
3. **Acessível** - Interface simples e clara que funciona perfeitamente em dispositivos móveis para ambos os públicos (cidadãos e secretaria)

**Complexity Level**: Light Application (multiple features with basic state)
Este é um aplicativo de agendamento com funcionalidades distintas para dois tipos de usuários (cidadão e secretaria), incluindo formulários, listagem, filtros e persistência de dados, mas sem necessidade de autenticação complexa ou múltiplas views avançadas.

## Essential Features

### 1. Formulário de Agendamento (Usuário)
- **Functionality**: Formulário para o cidadão preencher dados pessoais (nome completo, CPF, CIN atual se houver, telefone, email) e selecionar data/horário desejado
- **Purpose**: Permitir que cidadãos agendem atendimento para emissão de CIN sem precisar ir presencialmente ou ligar
- **Trigger**: Usuário acessa o app e clica em "Agendar CIN"
- **Progression**: Visualiza tela inicial → Clica em "Agendar CIN" → Preenche dados pessoais → Seleciona data → Seleciona horário disponível → Revisa informações → Confirma → Recebe confirmação com detalhes
- **Success criteria**: Agendamento é salvo com sucesso, usuário recebe confirmação visual com número de protocolo, dados ficam disponíveis para a secretaria

### 2. Validação de Dados
- **Functionality**: Validação em tempo real de CPF, telefone, email e campos obrigatórios com mensagens de erro claras
- **Purpose**: Garantir que dados corretos sejam coletados e reduzir erros no agendamento
- **Trigger**: Usuário preenche ou sai de um campo do formulário
- **Progression**: Usuário digita → Sistema valida formato → Exibe erro se inválido → Usuário corrige → Campo validado com sucesso
- **Success criteria**: Apenas dados válidos podem ser submetidos, usuário recebe feedback imediato sobre erros

### 3. Painel da Secretaria
- **Functionality**: Visualização de todos os agendamentos com filtros por data, status e busca por nome/CPF
- **Purpose**: Permitir que a secretaria gerencie eficientemente os atendimentos do dia
- **Trigger**: Funcionário da secretaria acessa modo secretaria (verificação via spark.user().isOwner)
- **Progression**: Acessa painel → Visualiza lista de agendamentos → Filtra por data → Busca agendamento específico → Marca como atendido/cancelado → Status atualizado
- **Success criteria**: Secretaria consegue ver todos agendamentos, filtrar facilmente por data, buscar por nome/CPF e atualizar status

### 4. Seleção de Horários Disponíveis
- **Functionality**: Sistema mostra apenas horários disponíveis para agendamento baseado em data selecionada (horário comercial: 8h-17h, intervalos de 30min)
- **Purpose**: Evitar conflitos de horários e organizar o fluxo de atendimento
- **Trigger**: Usuário seleciona uma data no calendário
- **Progression**: Seleciona data → Sistema calcula horários disponíveis → Exibe grade de horários → Usuário escolhe horário → Horário reservado
- **Success criteria**: Apenas horários livres são exibidos, máximo de 2 agendamentos por horário

### 5. Confirmação e Protocolo
- **Functionality**: Geração de número de protocolo único e tela de confirmação com todos os detalhes do agendamento
- **Purpose**: Dar segurança ao usuário de que agendamento foi registrado e fornecer número de referência
- **Trigger**: Usuário confirma o agendamento após revisão
- **Progression**: Confirma dados → Sistema gera protocolo → Exibe tela de sucesso com protocolo, data, horário e local → Usuário pode fazer novo agendamento
- **Success criteria**: Protocolo único é gerado, informações completas são exibidas, usuário pode salvar/copiar protocolo

### 6. Notificações por Email, SMS e WhatsApp
- **Functionality**: Envio automático de notificações por email, SMS e WhatsApp quando agendamentos são confirmados, cancelados ou alterados, além de lembretes automáticos 24h antes do agendamento
- **Purpose**: Manter usuários informados sobre o status de seus agendamentos através de múltiplos canais, reduzir ausências e garantir que compareçam com documentos necessários
- **Trigger**: Quando usuário cria um novo agendamento, secretaria altera o status, ou quando faltam 24h para o agendamento
- **Progression**: Status alterado → Sistema gera mensagens personalizadas para cada canal → Envia email, SMS e WhatsApp simultaneamente → Registra log de envio → Exibe confirmação visual com canais utilizados
- **Success criteria**: Notificações são enviadas com conteúdo apropriado e formatação específica para cada canal (WhatsApp com emojis e formatação Markdown), incluindo endereço completo e link do Google Maps para lembretes, logs são mantidos para auditoria, secretaria pode visualizar histórico de notificações enviadas com indicação dos canais utilizados

### 7. Sistema de Notas e Comentários
- **Functionality**: Secretaria pode adicionar notas privadas aos agendamentos para registrar observações importantes
- **Purpose**: Permitir documentação detalhada de cada atendimento e comunicação interna
- **Trigger**: Funcionário clica no botão "Notas" em um agendamento
- **Progression**: Abre modal → Digite nota → Salva → Nota aparece no histórico com autor e timestamp
- **Success criteria**: Notas são salvas, editáveis apenas pela secretaria, com histórico completo

### 8. Reagendamento de Atendimentos
- **Functionality**: Secretaria pode reagendar um atendimento existente para nova data/horário (bloqueado para agendamentos já concluídos)
- **Purpose**: Facilitar ajustes em casos de conflito ou solicitação do usuário, mantendo integridade de registros concluídos
- **Trigger**: Secretaria clica em "Reagendar" em um agendamento não concluído
- **Progression**: Abre modal → Seleciona nova data → Seleciona novo horário → Confirma → Envia notificação
- **Success criteria**: Agendamento é movido, horários são atualizados, usuário é notificado da mudança, botão de reagendamento é desabilitado para status "completed"

### 9. Exportação e Impressão
- **Functionality**: Exportar agendamentos em múltiplos formatos (CSV, JSON) e gerar relatórios imprimíveis
- **Purpose**: Permitir análise externa de dados e documentação física
- **Trigger**: Secretaria clica no botão "Exportar"
- **Progression**: Seleciona formato → Download arquivo ou abre janela de impressão
- **Success criteria**: Dados são exportados corretamente, formatados adequadamente para impressão

### 10. Dashboard de Estatísticas
- **Functionality**: Visualização de métricas importantes (total de agendamentos, status, períodos)
- **Purpose**: Dar visibilidade rápida do volume e distribuição de agendamentos
- **Trigger**: Secretaria acessa painel
- **Progression**: Exibe cards com números de hoje, semana, mês → Gráficos de status → Percentuais
- **Success criteria**: Dados são calculados em tempo real, visual claro e informativo

### 11. Seleção Múltipla e Operações em Lote
- **Functionality**: Secretaria pode selecionar múltiplos agendamentos e executar ações em lote (excluir, exportar)
- **Purpose**: Aumentar eficiência em operações que afetam múltiplos registros
- **Trigger**: Secretaria marca checkboxes de agendamentos
- **Progression**: Seleciona itens → Clica em ação em lote → Confirma → Executa para todos
- **Success criteria**: Operações são executadas corretamente para todos os itens selecionados

### 12. Dashboard do Usuário
- **Functionality**: Usuários podem ver seus agendamentos anteriores e futuros ao iniciar novo agendamento, com opção de cancelar agendamentos não concluídos
- **Purpose**: Dar visibilidade do histórico pessoal, evitar duplicações e permitir que usuários gerenciem seus próprios agendamentos
- **Trigger**: Usuário digita CPF válido na tela inicial
- **Progression**: Sistema busca agendamentos do CPF → Exibe próximos e histórico → Permite cancelamento de agendamentos não concluídos
- **Success criteria**: Dados são exibidos organizados por status e data, fácil de entender, cancelamento bloqueado para status "completed"

### 13. Sistema Multi-Tenant (Super Administrador)
- **Functionality**: Super administrador pode criar e gerenciar múltiplas prefeituras/instituições, cada uma com seu próprio banco de dados isolado, logo, cores personalizadas, responsável e informações de contato
- **Purpose**: Permitir que o sistema seja usado por múltiplas prefeituras simultaneamente, cada uma com sua identidade visual e dados isolados
- **Trigger**: Super administrador faz login no sistema
- **Progression**: Login como superadmin → Visualiza lista de prefeituras cadastradas → Clica em "Nova Prefeitura" → Preenche nome, cidade e slug → Prefeitura criada → Clica em "Configurar" → Define logo (URL), cores (com paletas predefinidas ou manual), responsável (nome e cargo), contatos (telefone, email, endereço) → Salva configurações → Acessa sistema da prefeitura
- **Success criteria**: Cada prefeitura tem dados completamente isolados, logo aparece no header, cores são aplicadas em toda interface, informações de contato visíveis para o público, super admin pode ativar/desativar/excluir prefeituras

### 14. Personalização Visual por Prefeitura
- **Functionality**: Cada prefeitura pode ter logo próprio, paleta de cores customizada (primária, secundária, destaque) e informações institucionais (responsável, telefone, email, endereço)
- **Purpose**: Permitir que cada instituição tenha sua identidade visual própria sem necessitar modificação de código
- **Trigger**: Super administrador clica em "Configurar" em uma prefeitura
- **Progression**: Acessa painel de configuração → Aba "Visual & Logo": adiciona URL do logo e visualiza preview, seleciona paleta predefinida ou personaliza cores manualmente com preview em tempo real → Aba "Responsável": define nome completo e cargo do gestor → Aba "Contato": adiciona telefone, email e endereço → Aba "Preview": visualiza como ficará a interface → Salva configurações
- **Success criteria**: Logo é exibido no header da aplicação, cores são aplicadas dinamicamente (botões, destaques, focos), informações do responsável e contato aparecem em card na tela pública, alterações não requerem modificação de código

### 15. Sistema de Permissões Granulares
- **Functionality**: Administradores podem definir permissões específicas para cada usuário da secretaria, controlando quais ações podem realizar (confirmar agendamento, concluir atendimento, reagendar, cancelar, excluir, gerenciar localidades, bloquear datas, etc.)
- **Purpose**: Permitir controle de acesso granular baseado em funções e responsabilidades de cada funcionário, aumentando segurança e organização
- **Trigger**: Administrador cria ou edita um usuário da secretaria
- **Progression**: Acessa gerenciamento de usuários → Clica em adicionar/editar usuário → Preenche dados básicos → Define se é administrador ou usuário comum → Se comum, seleciona permissões básicas através de switches visuais (Confirmar Agendamentos, Concluir Atendimentos, Reagendar, Cancelar, Excluir, Alterar Prioridade, Adicionar Notas, Visualizar Relatórios, Exportar Dados, Bloquear Datas, Gerenciar Localidades, etc.) → Salva usuário
- **Success criteria**: Usuários só veem e podem executar ações para as quais têm permissão, interface adapta-se automaticamente ocultando botões/recursos não autorizados, administradores têm acesso total sem restrições, sistema mantém auditoria de quem executou cada ação

### 16. Fila de Entrega de CIN
- **Functionality**: Sistema completo de controle de entrega de CINs aos cidadãos após conclusão do atendimento, incluindo registro detalhado de quem recebeu, quando e quem entregou
- **Purpose**: Criar rastreabilidade completa do processo de emissão até a entrega final do documento ao cidadão, evitando perdas e garantindo controle total
- **Trigger**: Quando secretaria marca um atendimento como "Concluído", automaticamente passa para status "Aguardando Entrega"
- **Progression**: 
  - Atendimento concluído → Sistema move automaticamente para fila "Aguardando Entrega" → CIN aparece na aba "Entrega CIN" → Cidadão comparece para retirar → Secretaria abre diálogo de entrega → Preenche nome de quem está recebendo (pode ser o titular ou responsável) → Preenche documento (CPF/CIN) de quem recebe → Adiciona observações opcionais → Sistema registra automaticamente data/hora atual e nome do funcionário que entregou → Confirma entrega → Status muda para "Entregue" → Registro completo fica no histórico
- **Success criteria**: 
  - CINs concluídos aparecem automaticamente na fila de entrega com informações do cidadão e data de conclusão
  - Interface separada e dedicada para controle de entregas com busca e filtros
  - Registro completo salva: nome do recebedor, documento do recebedor, data/hora da entrega, nome do funcionário que entregou, observações adicionais
  - Histórico de CINs entregues mostra todos os detalhes da entrega de forma organizada
  - Sistema impede reagendamento/cancelamento de agendamentos nos status "Aguardando Entrega" e "Entregue"
  - Auditoria completa do processo desde agendamento até entrega final

### 17. Filtros de Pesquisa por Tipo de CIN
- **Functionality**: Secretaria pode filtrar agendamentos especificamente por tipo de CIN (1ª via ou 2ª via) nos filtros avançados
- **Purpose**: Permitir análise e gestão segmentada por tipo de documento, facilitando organização e planejamento de recursos
- **Trigger**: Secretaria acessa filtros avançados no painel
- **Progression**: Abre filtros avançados → Seleciona "Tipo de CIN" → Escolhe "1ª via", "2ª via" ou "Todos" → Sistema filtra lista → Exibe resultados
- **Success criteria**: Filtro funciona corretamente isoladamente e em combinação com outros filtros (data, localidade, bairro, status), contador de resultados atualiza dinamicamente, pode ser limpo facilmente

### 18. Relatório Comparativo de Tipos de CIN
- **Functionality**: Relatório analítico detalhado comparando quantidade de 1ª e 2ª vias emitidas por período (mensal ou anual), com gráficos, tabelas e exportação em PDF
- **Purpose**: Fornecer insights sobre demanda por tipo de documento, auxiliar no planejamento de recursos e identificar padrões de emissão
- **Trigger**: Secretaria acessa aba "Analytics" e visualiza seção de Relatório Comparativo
- **Progression**: 
  - Acessa aba Analytics → Rola até seção "Relatório Comparativo - 1ª via vs 2ª via" → Seleciona visualização (por ano ou por mês) → Seleciona ano → Se por mês, seleciona mês específico → Sistema calcula e exibe:
    - Cards com totais de 1ª via, 2ª via e percentuais
    - Gráfico de pizza mostrando distribuição
    - Barras comparativas de quantidade
    - Se anual: gráfico de barras por mês comparando 1ª e 2ª vias
    - Se mensal: gráfico de linha por dia comparando 1ª e 2ª vias
  - Clica em "Exportar PDF" → Sistema gera PDF profissional com:
    - Cabeçalho com nome do sistema e período
    - Tabela resumo com totais e percentuais
    - Tabela detalhada mensal ou diária
    - Data e hora de geração
- **Success criteria**: 
  - Dados são calculados corretamente e em tempo real
  - Gráficos são claros, coloridos e responsivos
  - PDF gerado é profissional, organizado e pronto para impressão
  - Visualização anual mostra evolução ao longo dos 12 meses
  - Visualização mensal mostra evolução dia a dia
  - Estado vazio é exibido quando não há dados no período

### 19. Notificações Diferenciadas por Tipo de CIN
- **Functionality**: Sistema envia notificações personalizadas (email, SMS, WhatsApp) com instruções específicas baseadas no tipo de CIN (1ª via ou 2ª via)
- **Purpose**: Garantir que cidadãos compareçam com documentação correta para cada tipo de emissão, reduzindo reagendamentos por falta de documentos
- **Trigger**: Quando agendamento é confirmado, alterado, ou CIN fica pronto para entrega
- **Progression**: 
  - Sistema identifica tipo de CIN do agendamento → Gera mensagens personalizadas para cada canal:
    - **Para 1ª via**: Lista certidão de nascimento/casamento, CPF, comprovante de residência, título de eleitor, informa que é obrigatório comparecer pessoalmente, menciona necessidade de responsável para menores de 18 anos
    - **Para 2ª via**: Lista CIN anterior (obrigatório), CPF, comprovante de residência, certidão, informa sobre Boletim de Ocorrência se perdido/roubado
  - Para notificações de CIN pronto:
    - **Para 1ª via**: Informa necessidade de trazer certidão original usada no atendimento, documento com foto para conferência
    - **Para 2ª via**: Informa necessidade de trazer CIN anterior (se possuir), documento com foto adicional
  - Todas as notificações incluem: tipo de CIN claramente identificado, protocolo, instruções de retirada por terceiros (procuração, documentos necessários)
  - Envia simultaneamente via email (formato completo), SMS (resumido) e WhatsApp (formatado com emojis e negrito)
- **Success criteria**: 
  - Mensagens contêm instruções precisas para cada tipo de CIN
  - Documentos necessários são listados de forma clara e completa
  - Informações sobre retirada por terceiros são incluídas
  - Formatação é adequada para cada canal (email HTML, SMS conciso, WhatsApp com markdown)
  - Tipo de CIN é claramente identificado em todas as notificações
  - Logs registram envio com sucesso para auditoria

### 22. Dashboard de Métricas de Logs de Auditoria
- **Functionality**: Dashboard visual interativo com gráficos detalhados mostrando análise de ações por usuário, severidade, tipo de ação, tendências temporais e atividade por hora do dia
- **Purpose**: Fornecer insights visuais sobre o uso do sistema, identificar padrões de comportamento, detectar ações críticas e permitir análise de segurança e conformidade
- **Trigger**: Administrador/Secretaria acessa aba de logs de auditoria e seleciona "Dashboard de Métricas"
- **Progression**: Acessa dashboard → Visualiza gráficos interativos → Filtra por período (hoje/semana/mês/todos) → Seleciona usuário específico → Analisa métricas por categoria → Identifica ações críticas → Exporta dados se necessário
- **Success criteria**: Gráficos são renderizados com dados em tempo real, filtros funcionam corretamente, ações críticas são destacadas visualmente, usuário consegue identificar facilmente padrões e anomalias no uso do sistema
- **Visualizações Incluídas**:
  - Cards de resumo: Total de ações, ações críticas, alta severidade, usuários ativos
  - Gráfico de pizza: Distribuição por severidade (baixa/média/alta/crítica) com cores distintivas
  - Gráfico de barras: Ações por categoria (agendamentos, localidades, usuários, bloqueios, etc.)
  - Gráfico de barras horizontais: Top 10 usuários mais ativos
  - Gráfico de barras: Tipos de ações mais frequentes
  - Gráfico de área: Tendência temporal de ações ao longo dos dias
  - Gráfico de linha: Atividade por hora do dia (0-23h)
  - Lista de ações críticas recentes com destaque visual
  - Gráfico de pizza: Distribuição de ações por perfil (admin/secretaria/usuário/sistema)

- **Data passada**: Sistema não permite seleção de datas anteriores ao dia atual
- **Horários esgotados**: Se todos horários de um dia estão ocupados, exibe mensagem informativa sugerindo outras datas
- **CPF duplicado no mesmo dia**: Alerta usuário que já existe agendamento para aquele CPF naquela data
- **Formulário incompleto**: Botão de confirmar fica desabilitado até todos campos obrigatórios serem preenchidos corretamente
- **Sem agendamentos**: Painel da secretaria exibe estado vazio amigável quando não há agendamentos
- **Conexão perdida**: Dados do formulário permanecem preenchidos se houver falha ao submeter
- **Falha no envio de notificações**: Sistema registra falhas de envio de notificações no log mas não bloqueia o agendamento
- **Seleção múltipla vazia**: Botões de ação em lote são desabilitados quando nenhum item está selecionado
- **Exportação sem dados**: Menu de exportação mostra botão desabilitado quando não há dados para exportar
- **Reagendamento para horário ocupado**: Sistema mostra apenas horários disponíveis na interface de reagendamento
- **Reagendamento de agendamento concluído**: Botão de reagendamento é desabilitado quando status é "completed", "ready-for-delivery" ou "delivered"
- **Cancelamento de agendamento concluído**: Botão de cancelamento não é exibido quando status é "completed", "ready-for-delivery" ou "delivered"
- **Lembrete já enviado**: Sistema marca agendamento quando lembrete é enviado para evitar envios duplicados
- **Notas muito longas**: Campo de nota tem limite de caracteres apropriado
- **Conflito de dados simultâneos**: Sistema usa timestamps para rastrear modificações e prevenir conflitos
- **Usuário sem permissão**: Interface adapta-se automaticamente ocultando botões e recursos não autorizados para o usuário
- **Fila de entrega vazia**: Tela de entrega de CIN mostra estado vazio amigável quando não há CINs aguardando entrega
- **Dados incompletos na entrega**: Botão de confirmar entrega fica desabilitado até nome e documento do recebedor serem preenchidos
- **Alteração de CIN já entregue**: Sistema não permite alteração de status ou dados de CINs já marcados como entregues

## Design Direction

O design deve transmitir seriedade e confiabilidade de um serviço público, mas com uma estética moderna e acessível que inspire confiança. Deve ser profissional sem ser intimidador, com hierarquia visual clara que guie o usuário naturalmente pelo processo de agendamento.

## Color Selection

Paleta inspirada em documentos oficiais brasileiros com toques modernos de verde-azulado para transmitir seriedade institucional mas com acessibilidade.

- **Primary Color**: Azul institucional profundo (oklch(0.35 0.08 250)) - Transmite confiança, autoridade governamental e seriedade do serviço público
- **Secondary Colors**: Verde-azulado suave (oklch(0.65 0.1 180)) para elementos secundários e Cinza neutro (oklch(0.5 0.01 250)) para texto e bordas
- **Accent Color**: Verde vibrante (oklch(0.6 0.15 145)) - Destaca ações importantes como "Confirmar Agendamento" e indicadores de sucesso
- **Foreground/Background Pairings**: 
  - Background principal (Branco Puro #FFFFFF): Texto principal oklch(0.2 0.01 250) - Ratio 14.8:1 ✓
  - Primary (Azul oklch(0.35 0.08 250)): Texto branco oklch(0.98 0 0) - Ratio 8.2:1 ✓
  - Accent (Verde oklch(0.6 0.15 145)): Texto branco oklch(0.98 0 0) - Ratio 4.9:1 ✓
  - Card (Cinza clarissimo oklch(0.97 0 0)): Texto principal oklch(0.2 0.01 250) - Ratio 13.9:1 ✓

## Font Selection

A tipografia deve ser clara e altamente legível em dispositivos móveis, transmitindo profissionalismo sem ser rígida demais.

- **Typographic Hierarchy**: 
  - H1 (Título Principal - "Agendamento de CIN"): Work Sans SemiBold/32px/tight tracking/-0.02em
  - H2 (Títulos de Seção - "Dados Pessoais"): Work Sans Medium/24px/normal tracking
  - H3 (Labels de Destaque): Work Sans Medium/18px/normal tracking
  - Body (Campos e texto): Inter Regular/16px/relaxed leading (1.6)
  - Small (Hints e ajuda): Inter Regular/14px/normal leading
  - Button Text: Work Sans Medium/16px/normal tracking/uppercase

## Animations

Animações devem reforçar a progressão do agendamento e fornecer feedback tátil satisfatório. Movimento sutil que comunica estado sem distrair.

- Transições de página suaves com slide lateral (300ms ease-out)
- Campos de formulário com micro-animação de foco (scale 1.01, border glow)
- Botões com efeito de press down e ripple ao clicar
- Calendário com fade-in dos horários disponíveis ao selecionar data
- Confirmação de agendamento com animação de check mark celebratória
- Cards de agendamento no painel com hover lift sutil (translateY -2px)

## Sistema de Notificações Multi-Canal

O sistema implementa notificações através de três canais principais (Email, SMS e WhatsApp), cada um com suas características específicas:

### Email
- **Formato**: HTML ou texto simples com formatação clara
- **Conteúdo**: Informações completas do agendamento, instruções detalhadas sobre documentos necessários
- **Uso**: Notificações de confirmação, atualizações de status, lembretes com 24h de antecedência
- **Configurável**: Administrador pode habilitar/desabilitar, definir nome do remetente e email de resposta

### SMS
- **Formato**: Mensagem de texto curta (até 160 caracteres)
- **Conteúdo**: Informações essenciais (data, hora, protocolo) em formato conciso
- **Uso**: Confirmações rápidas e lembretes urgentes
- **Configurável**: Administrador pode habilitar/desabilitar via painel

### WhatsApp
- **Formato**: Mensagem formatada com Markdown (negrito, emojis, listas)
- **Conteúdo**: Informações completas com formatação rica usando emojis para melhor visualização
- **Uso**: Confirmações detalhadas, atualizações de status, lembretes interativos com links do Google Maps
- **Características Especiais**:
  - Usa emojis específicos para cada tipo de informação (📅 Data, 🕐 Hora, 📋 Protocolo, 📍 Local)
  - Formatação em negrito para informações críticas usando asteriscos (*texto*)
  - Suporte a links clicáveis para Google Maps
  - Mensagens personalizadas por tipo de evento (confirmação, cancelamento, conclusão)
- **Configurável**: 
  - Habilitar/desabilitar envio automático
  - Configurar número do WhatsApp Business
  - Configurar chave API do provedor (Twilio, MessageBird, 360Dialog)

### Integração e Fluxo
- Todas as notificações são enviadas simultaneamente quando habilitadas
- Sistema mantém log de todas as notificações enviadas com timestamp e canal utilizado
- Interface exibe feedback visual indicando quais canais foram utilizados (ex: "Notificação enviada via 📧 Email, 📱 SMS, 💬 WhatsApp")
- Tela de confirmação mostra ícones dos três canais de notificação disponíveis
- Administrador tem controle granular sobre quais canais estão ativos

## Component Selection

- **Components**: 
  - Card (dados do agendamento, container de formulário, dashboard de estatísticas)
  - Input (campos de texto com validation states e ícones de confirmação)
  - Button (primary para ações principais, secondary para voltar, outline para ações secundárias)
  - Calendar (seleção de data do react-day-picker com indicadores visuais de dias com agendamentos)
  - Badge (status do agendamento - pendente/confirmado/cancelado/concluído com cores distintas)
  - Dialog (confirmação de cancelamento, histórico de notificações, notas de agendamento, reagendamento)
  - Tabs (alternar entre modo usuário e secretaria)
  - ScrollArea (lista de agendamentos no painel, histórico de notificações, notas)
  - Alert (mensagens de erro e sucesso)
  - Separator (divisão visual entre seções)
  - Toast (feedback de ações e confirmação de notificações enviadas)
  - Checkbox (seleção múltipla de agendamentos)
  - DropdownMenu (menu de exportação com múltiplas opções)
  - Progress bars (indicadores visuais de percentual de status)

- **Customizations**: 
  - Time slot selector personalizado (grid de botões para horários com animação de entrada)
  - Status indicator customizado com cores específicas por estado e ícones
  - Protocol card component para exibir número de protocolo de forma destacada
  - Notification indicator com animação para mostrar envio de notificações em tempo real
  - Notification log viewer para histórico de todas as notificações enviadas
  - Stats dashboard com cards de métricas e gráficos de progresso
  - User dashboard para exibir agendamentos do usuário atual
  - Export menu com múltiplas opções de formato
  - Notes viewer/editor com timestamp e autor
  - Reschedule dialog com calendário e seletor de horário integrado
  - Permissions manager com switches visuais para cada permissão
  - CIN Delivery Queue com lista de CINs aguardando entrega e histórico de entregues
  - Delivery confirmation dialog com formulário completo de registro de entrega

- **States**: 
  - Inputs: default com borda sutil, focus com border accent e shadow, error com border vermelha, success com check icon
  - Buttons: rest com shadow suave, hover com lift, active com scale down, disabled com opacity 50%
  - Time slots: available (primary outline), selected (primary filled), occupied (muted disabled)

- **Icon Selection**: 
  - CalendarBlank (seleção de data)
  - Clock (horários)
  - IdentificationCard (CIN/documento)
  - User (dados pessoais)
  - Phone (telefone)
  - EnvelopeSimple (email)
  - CheckCircle (confirmação/sucesso)
  - XCircle (erro/cancelamento)
  - MagnifyingGlass (busca no painel)
  - List (lista de agendamentos)
  - Bell (notificações)
  - Envelope (email de notificação)
  - DeviceMobile (SMS de notificação)
  - ChatCircleDots (WhatsApp de notificação)
  - Package (fila de entrega de CIN)
  - ShieldCheck (permissões e administrador)
  - MapPin (localidades)

- **Spacing**: 
  - Container padding: px-6 py-8
  - Form sections: space-y-6
  - Form fields: space-y-4
  - Button groups: gap-3
  - Card padding: p-6
  - Lista de agendamentos: gap-4

- **Mobile**: 
  - Single column layout em mobile
  - Bottom sheet para seleção de horários em telas pequenas
  - Inputs com fontSize 16px mínimo para evitar zoom no iOS
  - Tabs fixas no topo em mobile, sidebar em desktop
  - Cards empilhados verticalmente
  - Touch targets mínimos de 44x44px
