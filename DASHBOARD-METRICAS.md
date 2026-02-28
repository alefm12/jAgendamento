# Dashboard de Métricas de Logs de Auditoria

## Visão Geral

O Dashboard de Métricas de Logs de Auditoria é uma ferramenta visual interativa que fornece insights detalhados sobre todas as ações realizadas no sistema. Com gráficos ricos e filtros inteligentes, permite análise profunda de segurança, conformidade e padrões de uso.

## Acesso

**Caminho**: Secretaria/Admin → Aba "Logs de Auditoria" → Tab "Dashboard de Métricas"

**Permissões**: Disponível para usuários com perfil de Secretaria ou Administrador

## Funcionalidades Principais

### 1. Filtros Globais

Dois filtros principais no topo do dashboard:

- **Período de Tempo**:
  - Hoje: Ações das últimas 24 horas
  - Esta Semana: Ações dos últimos 7 dias
  - Este Mês: Ações dos últimos 30 dias
  - Todos: Histórico completo

- **Usuário Específico**:
  - Todos os usuários (padrão)
  - Lista de todos os usuários que realizaram ações no sistema
  - Filtra todos os gráficos para mostrar apenas ações do usuário selecionado

### 2. Cards de Resumo

Quatro cards de métricas principais na parte superior:

#### Total de Ações
- **Ícone**: Pulso (azul)
- **Valor**: Número total de ações registradas no período selecionado
- **Descrição**: "registradas no período"

#### Ações Críticas
- **Ícone**: Escudo de Aviso (vermelho)
- **Valor**: Número de ações com severidade crítica
- **Descrição**: "requerem atenção especial"
- **Cor**: Vermelho (#ef4444) para destacar urgência

#### Alta Severidade
- **Ícone**: Tendência de Alta (laranja)
- **Valor**: Soma de ações críticas + alta severidade
- **Descrição**: "ações de alta importância"
- **Cor**: Laranja (#f59e0b)

#### Usuários Ativos
- **Ícone**: Usuário (roxo)
- **Valor**: Número de usuários únicos que realizaram ações
- **Descrição**: "realizaram ações"

### 3. Painel de Ações Críticas (quando aplicável)

Exibido automaticamente quando há ações críticas no período:

- **Visual**: Card destacado com borda vermelha e fundo vermelho claro
- **Conteúdo**: Lista das 5 ações críticas mais recentes
- **Informações por ação**:
  - Badge de severidade (colorido)
  - Tipo de ação (ex: "Exclusão em Massa de Agendamentos")
  - Descrição detalhada
  - Usuário que realizou
  - Data e hora com formatação brasileira

### 4. Sistema de Tabs com Visualizações

#### Tab 1: Visão Geral
Contém 3 gráficos principais:

**Distribuição por Severidade** (Gráfico de Pizza)
- Mostra proporção de ações por nível de severidade
- Cores:
  - Baixa: Verde (#10b981)
  - Média: Amarelo (#f59e0b)
  - Alta: Laranja/Vermelho (#ef4444)
  - Crítica: Vermelho Escuro (#dc2626)
- Labels mostram nome e percentual
- Apenas severidades com valores > 0 são exibidas

**Ações por Categoria** (Gráfico de Barras)
- Agrupa ações por tipo de entidade afetada:
  - Agendamentos
  - Localidades
  - Usuários
  - Bloqueios
  - Configurações
  - Dados
  - Relatórios
  - CIN
  - Sistema
- Barras na cor índigo (#6366f1)
- Labels rotacionados 45° para melhor legibilidade
- Ordenado por volume (maior para menor)

**Ações por Perfil** (Gráfico de Pizza)
- Mostra distribuição entre perfis de usuário:
  - Administrador
  - Secretaria
  - Usuário
  - Sistema
- Cores variadas (roxo, ciano, verde, amarelo)
- Inclui legenda para identificação

#### Tab 2: Por Usuário

**Top 10 Usuários Mais Ativos** (Gráfico de Barras Horizontal)
- Lista os 10 usuários com mais ações registradas
- Barras horizontais na cor roxa (#8b5cf6)
- Ordenado por quantidade (maior no topo)
- Nomes dos usuários no eixo Y
- Quantidade de ações no eixo X
- Altura do gráfico: 500px para boa visualização

#### Tab 3: Por Ação

**Tipos de Ações Mais Frequentes** (Gráfico de Barras)
- Mostra as 8 ações mais realizadas no sistema
- Exemplos:
  - "Agendamento Criado"
  - "Status do Agendamento Alterado"
  - "Login Realizado"
  - "Dados Exportados"
- Barras na cor ciano (#06b6d4)
- Labels rotacionados 45°
- Altura: 500px

#### Tab 4: Tendências

**Tendência de Ações ao Longo do Tempo** (Gráfico de Área)
- Mostra evolução temporal das ações
- Duas séries de dados:
  1. **Total de Ações**: Área azul índigo com gradiente
  2. **Ações Críticas**: Área vermelha com gradiente
- Eixo X: Datas formatadas (ex: "15/Jan", "16/Jan")
- Permite identificar picos de atividade
- Útil para detectar anomalias temporais
- Altura: 400px

**Dinâmica por Período**:
- Semana: Mostra 7 dias
- Mês: Mostra 30 dias
- Hoje: Mostra apenas o dia atual
- Todos: Não limitado, mostra todo histórico

#### Tab 5: Atividade

**Atividade por Hora do Dia** (Gráfico de Linha)
- Mostra distribuição de ações nas 24 horas do dia
- Eixo X: Horas formatadas (00h até 23h)
- Eixo Y: Quantidade de ações
- Linha na cor verde (#10b981)
- Pontos destacados (bolinhas) em cada hora
- Permite identificar horários de pico
- Útil para planejamento de recursos e manutenção

## Níveis de Severidade

### Baixa (Low)
**Cor**: Azul (#10b981)
**Exemplos**:
- Agendamento Criado
- Login Realizado
- Logout Realizado
- Nota Adicionada ao Agendamento
- Relatório Gerado

### Média (Medium)
**Cor**: Amarelo (#f59e0b)
**Exemplos**:
- Status do Agendamento Alterado
- Agendamento Reagendado
- Agendamento Cancelado
- Localidade Criada
- Data Bloqueada
- CIN Marcado como Entregue

### Alta (High)
**Cor**: Laranja (#ef4444)
**Exemplos**:
- Agendamento Excluído
- Localidade Excluída
- Usuário Excluído
- Configuração Atualizada
- Dados Importados

### Crítica (Critical)
**Cor**: Vermelho Escuro (#dc2626)
**Exemplos**:
- Exclusão em Massa de Agendamentos
- Configurações do Sistema Alteradas

## Interatividade

### Tooltips
Todos os gráficos incluem tooltips ao passar o mouse sobre os elementos:
- Fundo branco com borda cinza
- Bordas arredondadas (8px)
- Mostram valores exatos e labels descritivos

### Responsividade
- Gráficos se adaptam automaticamente ao tamanho da tela
- Uso de `ResponsiveContainer` com width="100%" e height fixo
- Grid responsivo nos cards de resumo (1 coluna em mobile, 4 em desktop)

### Animações
- Transição suave ao trocar de tab
- Cards aparecem com animação de fade-in
- Gráficos renderizam com animação progressiva

## Casos de Uso

### 1. Auditoria de Segurança
**Cenário**: Identificar ações suspeitas ou não autorizadas

**Passos**:
1. Acesse o dashboard
2. Selecione período "Esta Semana" ou "Este Mês"
3. Verifique o painel de "Ações Críticas" (se houver)
4. Vá para tab "Por Usuário" para ver usuários mais ativos
5. Filtre por usuário específico se necessário
6. Analise tipos de ações na tab "Por Ação"

### 2. Análise de Conformidade
**Cenário**: Verificar se processos estão sendo seguidos corretamente

**Passos**:
1. Filtre por período relevante (ex: "Este Mês")
2. Na tab "Visão Geral", verifique distribuição por severidade
3. Altos números de ações críticas podem indicar problemas
4. Use tab "Por Ação" para identificar ações específicas
5. Exporte dados da lista de logs se necessário para relatório

### 3. Identificação de Padrões de Uso
**Cenário**: Entender como o sistema está sendo utilizado

**Passos**:
1. Selecione período "Todos" para visão completa
2. Tab "Visão Geral": veja categorias mais usadas
3. Tab "Tendências": identifique períodos de maior atividade
4. Tab "Atividade": descubra horários de pico
5. Use essas informações para otimizar recursos e planejamento

### 4. Investigação de Incidentes
**Cenário**: Rastrear quem fez determinada alteração

**Passos**:
1. Defina o período aproximado do incidente
2. Filtre por usuário suspeito (se souber)
3. Verifique ações críticas no painel destacado
4. Use a lista de logs (tab "Lista de Logs") para detalhes
5. Clique na ação específica para ver informações completas

### 5. Monitoramento de Performance
**Cenário**: Avaliar eficiência da equipe

**Passos**:
1. Período: "Esta Semana"
2. Tab "Por Usuário": veja ranking de atividade
3. Compare ações entre usuários
4. Tab "Atividade": identifique horários produtivos
5. Use dados para feedback e treinamento

## Boas Práticas

### Para Administradores
- ✅ Revise ações críticas diariamente
- ✅ Monitore usuários com atividade anormal
- ✅ Use filtros de período para análises específicas
- ✅ Exporte dados periodicamente para arquivamento
- ✅ Configure alertas para ações críticas (futuro)

### Para Secretaria
- ✅ Consulte antes de fazer ações em massa
- ✅ Use o dashboard para auditar suas próprias ações
- ✅ Verifique padrões antes de reportar problemas
- ✅ Compare sua atividade com outros usuários

### Análise de Dados
- 📊 Compare períodos diferentes para identificar tendências
- 📊 Cruze dados de severidade com tipos de ação
- 📊 Use filtro de usuário para análise individual
- 📊 Observe horários de pico para otimização

## Limitações Conhecidas

- Gráficos não são imprimíveis diretamente (use screenshot ou exporte dados)
- Não há drill-down direto dos gráficos para logs específicos
- Filtros não são combinados (ou/ou, não e/e)
- Exportação de gráficos como imagem não está disponível

## Próximas Melhorias Planejadas

1. **Alertas Automáticos**: Notificações quando ações críticas são detectadas
2. **Comparação de Períodos**: Compare semana atual vs semana anterior
3. **Exportação de Gráficos**: Baixar gráficos como PNG/PDF
4. **Filtros Avançados**: Combinar múltiplos filtros simultaneamente
5. **Drill-down Interativo**: Clicar em gráfico para ver logs relacionados
6. **Dashboard Personalizável**: Usuário escolhe quais gráficos exibir
7. **Relatórios Agendados**: Receber dashboard por email semanalmente

## Suporte Técnico

Para dúvidas ou sugestões sobre o Dashboard de Métricas:
- Consulte a documentação completa em `/PRD.md`
- Verifique os logs de auditoria detalhados na tab "Lista de Logs"
- Entre em contato com o administrador do sistema
