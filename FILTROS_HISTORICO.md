# Filtros do Histórico de Execução de Relatórios

## Funcionalidades Implementadas

O componente **ReportExecutionHistory** já possui um sistema completo de filtros para visualizar os logs de execução de relatórios.

### 🔍 Filtros Disponíveis

#### 1. **Busca por Texto**
- Campo de pesquisa livre que filtra por:
  - Nome do relatório
  - Usuário que executou
  - ID da execução
- Busca case-insensitive
- Filtragem em tempo real

#### 2. **Filtro por Status**
Opções disponíveis:
- ✅ **Sucesso** - Execuções concluídas com sucesso
- ❌ **Falhou** - Execuções que falharam
- ⚠️ **Parcial** - Execuções parcialmente concluídas
- 🚫 **Cancelado** - Execuções canceladas
- 📋 **Todos Status** - Remove o filtro

#### 3. **Filtro por Tipo de Relatório**
Opções disponíveis:
- 📅 **Agendado** - Relatórios executados automaticamente
- 📄 **Template** - Relatórios criados a partir de templates
- ✏️ **Personalizado** - Relatórios personalizados
- 📥 **Exportação** - Exportações de dados
- 📋 **Todos Tipos** - Remove o filtro

#### 4. **Filtro por Gatilho de Execução**
Opções disponíveis:
- 👤 **Manual** - Executado manualmente por usuário
- ⏰ **Agendado** - Executado automaticamente pelo sistema
- 🔌 **API** - Executado via API
- 📋 **Template** - Executado a partir de template
- 📋 **Todos Gatilhos** - Remove o filtro

### 📊 Estatísticas em Tempo Real

O componente exibe 4 cards com métricas que se atualizam conforme os filtros:

1. **Total de Execuções** - Quantidade total de logs
2. **Bem-sucedidas** - Quantidade e percentual de sucessos
3. **Falhadas** - Quantidade e percentual de falhas
4. **Duração Média** - Tempo médio de processamento

### 🎯 Funcionalidades Adicionais

#### Limpeza de Filtros
- Botão "Limpar Filtros" aparece quando algum filtro está ativo
- Remove todos os filtros de uma vez

#### Combinação de Filtros
- Todos os filtros podem ser combinados
- Exemplo: buscar "Janeiro" + Status "Sucesso" + Tipo "Agendado"
- Filtros trabalham em conjunto (AND logic)

#### Ordenação
- Logs sempre ordenados por data/hora (mais recentes primeiro)
- Mantém a ordenação após aplicar filtros

### 📋 Tabela de Resultados

A tabela exibe as seguintes colunas:
- Status (com ícone e badge colorido)
- Nome do Relatório (com ID abreviado)
- Tipo (badge colorido)
- Gatilho (badge colorido)
- Executado Por
- Data/Hora
- Duração
- Registros Processados
- Formato de Exportação
- Ações (Visualizar detalhes, Download)

### 🎨 Indicadores Visuais

#### Badges de Status
- ✅ Verde: Sucesso
- ❌ Vermelho: Falhou
- ⚠️ Amarelo: Parcial
- ⚪ Cinza: Cancelado

#### Badges de Tipo
- 🟣 Roxo: Agendado
- 🔵 Azul: Template
- 🔷 Ciano: Personalizado
- 🟢 Verde: Exportação

#### Badges de Gatilho
- 🔵 Azul: Manual
- 🟣 Roxo: Agendado
- 🔷 Ciano: API
- 🟦 Índigo: Template

### 📱 Responsividade

- Layout adaptável para diferentes tamanhos de tela
- Filtros se reorganizam em dispositivos móveis
- Scroll horizontal na tabela quando necessário

### 🔄 Estado Vazio

Quando não há logs ou filtros não retornam resultados:
- Mensagem informativa
- Botão para gerar dados de exemplo (quando não há logs)
- Sugestão para limpar filtros (quando filtros não retornam resultados)

### 💡 Exemplos de Uso

#### Exemplo 1: Ver apenas execuções bem-sucedidas deste mês
1. Digite "Janeiro" na busca
2. Selecione Status: "Sucesso"
3. Resultado: apenas logs bem-sucedidos de Janeiro

#### Exemplo 2: Ver relatórios agendados que falharam
1. Selecione Tipo: "Agendado"
2. Selecione Status: "Falhou"
3. Resultado: apenas relatórios automáticos que falharam

#### Exemplo 3: Ver execuções manuais de um usuário
1. Digite o nome do usuário na busca
2. Selecione Gatilho: "Manual"
3. Resultado: apenas execuções manuais daquele usuário

### 🎯 Detalhes da Implementação

#### Localização do Código
- Componente: `/src/components/ReportExecutionHistory.tsx`
- Tipos: `/src/lib/types.ts`
- Dados de exemplo: `/src/lib/sample-execution-logs.ts`

#### Performance
- Filtros implementados com `useMemo` para otimização
- Filtros aplicados em memória (sem necessidade de backend)
- Atualização em tempo real sem lag

#### Extensibilidade
O sistema de filtros pode ser facilmente estendido para incluir:
- Filtro por período (hoje, semana, mês)
- Filtro por formato de exportação (PDF, Excel, CSV)
- Filtro por destinatários
- Filtro por duração de execução

---

## 🚀 Como Usar

1. Acesse a aba **"Histórico"** no menu principal
2. Use os filtros na parte superior da tela
3. Combine múltiplos filtros para refinar a busca
4. Clique em "Limpar Filtros" para resetar
5. Clique no ícone 👁️ para ver detalhes completos
6. Clique no ícone ⬇️ para baixar o relatório (quando disponível)

---

## ✅ Status: Implementado e Funcional

Todos os filtros estão implementados e funcionais:
- ✅ Filtro por Status
- ✅ Filtro por Tipo de Relatório
- ✅ Filtro por Gatilho de Execução
- ✅ Busca por texto livre
- ✅ Combinação de filtros
- ✅ Limpeza de filtros
- ✅ Estatísticas dinâmicas
- ✅ Interface responsiva
- ✅ Dados de exemplo
