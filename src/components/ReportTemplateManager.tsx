import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  Plus, 
  Trash, 
  Pencil, 
  Copy, 
  FileText, 
  Funnel, 
  Columns, 
  ChartBar,
  Download,
  Tag,
  Play,
  Star,
  Share
} from '@phosphor-icons/react'
import type { ReportTemplate, ReportFilter, ReportColumn, Appointment, Location } from '@/lib/types'
import { logReportExecutionSafe } from '@/lib/report-logger'

interface ReportTemplateManagerProps {
  appointments: Appointment[]
  locations: Location[]
  currentUser: string
  onRunTemplate: (template: ReportTemplate) => void
}

const DEFAULT_COLUMNS: ReportColumn[] = [
  { id: 'protocol', label: 'Protocolo', field: 'protocol', enabled: true },
  { id: 'fullName', label: 'Nome Completo', field: 'fullName', enabled: true },
  { id: 'cpf', label: 'CPF', field: 'cpf', enabled: true },
  { id: 'date', label: 'Data', field: 'date', enabled: true },
  { id: 'time', label: 'Horário', field: 'time', enabled: true },
  { id: 'status', label: 'Status', field: 'statusLabel', enabled: true },
  { id: 'location', label: 'Local', field: 'locationName', enabled: true },
  { id: 'phone', label: 'Telefone', field: 'phone', enabled: false },
  { id: 'email', label: 'Email', field: 'email', enabled: false },
  { id: 'neighborhood', label: 'Bairro', field: 'neighborhood', enabled: false },
  { id: 'rgType', label: 'Tipo de CIN', field: 'rgTypeLabel', enabled: false },
  { id: 'priority', label: 'Prioridade', field: 'priorityLabel', enabled: false },
]

export function ReportTemplateManager({ appointments, locations, currentUser, onRunTemplate }: ReportTemplateManagerProps) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null)
  const [currentTab, setCurrentTab] = useState<'list' | 'create' | 'edit'>('list')
  const TEMPLATE_STORAGE_KEY = 'report-templates-v1'

  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<ReportFilter[]>([])
  const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>(DEFAULT_COLUMNS)
  const [sortBy, setSortBy] = useState({ field: 'date', order: 'desc' as 'asc' | 'desc' })
  const [groupBy, setGroupBy] = useState<'location' | 'neighborhood' | 'status' | 'rgType' | 'date' | 'none'>('none')
  const [includeCharts, setIncludeCharts] = useState(true)
  const [chartTypes, setChartTypes] = useState<('pie' | 'bar' | 'line' | 'donut')[]>(['bar', 'pie'])
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv' | 'json'>('pdf')
  const [isPublic, setIsPublic] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as ReportTemplate[]
      if (Array.isArray(parsed)) {
        setTemplates(parsed)
      }
    } catch (error) {
      console.error('[ReportTemplateManager] Erro ao carregar templates salvos:', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates || []))
      window.dispatchEvent(new CustomEvent('report-templates-updated'))
    } catch (error) {
      console.error('[ReportTemplateManager] Erro ao salvar templates:', error)
    }
  }, [templates])

  const handleCreateTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Digite um nome para o template')
      return
    }

    const newTemplate: ReportTemplate = {
      id: crypto.randomUUID(),
      name: templateName,
      description: templateDescription,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      filters: selectedFilters,
      columns: selectedColumns,
      sortBy,
      groupBy,
      includeCharts,
      chartTypes,
      exportFormat,
      isPublic,
      tags
    }

    setTemplates(current => [...(current || []), newTemplate])
    void logReportExecutionSafe({
      reportId: newTemplate.id,
      reportName: newTemplate.name,
      reportType: 'template',
      executedBy: currentUser,
      status: 'success',
      trigger: 'manual',
      totalRecords: appointments.length,
      recordsProcessed: 1,
      format: newTemplate.exportFormat,
      executionDuration: 0,
      metadata: { action: 'create-template' }
    })
    toast.success('Template criado com sucesso!')
    resetForm()
    setShowCreateDialog(false)
    setCurrentTab('list')
  }

  const handleUpdateTemplate = () => {
    if (!editingTemplate || !templateName.trim()) {
      toast.error('Digite um nome para o template')
      return
    }

    const updatedTemplate: ReportTemplate = {
      ...editingTemplate,
      name: templateName,
      description: templateDescription,
      lastModified: new Date().toISOString(),
      filters: selectedFilters,
      columns: selectedColumns,
      sortBy,
      groupBy,
      includeCharts,
      chartTypes,
      exportFormat,
      isPublic,
      tags
    }

    setTemplates(current => (current || []).map(t => t.id === editingTemplate.id ? updatedTemplate : t))
    void logReportExecutionSafe({
      reportId: updatedTemplate.id,
      reportName: updatedTemplate.name,
      reportType: 'template',
      executedBy: currentUser,
      status: 'success',
      trigger: 'manual',
      totalRecords: appointments.length,
      recordsProcessed: 1,
      format: updatedTemplate.exportFormat,
      executionDuration: 0,
      metadata: { action: 'update-template' }
    })
    toast.success('Template atualizado com sucesso!')
    resetForm()
    setEditingTemplate(null)
    setCurrentTab('list')
  }

  const handleDeleteTemplate = (id: string) => {
    const template = templates.find(t => t.id === id)
    setTemplates(current => (current || []).filter(t => t.id !== id))
    void logReportExecutionSafe({
      reportId: id,
      reportName: template?.name || 'Template',
      reportType: 'template',
      executedBy: currentUser,
      status: 'success',
      trigger: 'manual',
      totalRecords: appointments.length,
      recordsProcessed: 1,
      format: (template?.exportFormat || 'pdf'),
      executionDuration: 0,
      metadata: { action: 'delete-template' }
    })
    toast.success('Template excluído')
  }

  const handleDuplicateTemplate = (template: ReportTemplate) => {
    const duplicated: ReportTemplate = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (Cópia)`,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      lastModified: undefined
    }

    setTemplates(current => [...(current || []), duplicated])
    void logReportExecutionSafe({
      reportId: duplicated.id,
      reportName: duplicated.name,
      reportType: 'template',
      executedBy: currentUser,
      status: 'success',
      trigger: 'manual',
      totalRecords: appointments.length,
      recordsProcessed: 1,
      format: duplicated.exportFormat,
      executionDuration: 0,
      metadata: { action: 'duplicate-template', sourceTemplateId: template.id }
    })
    toast.success('Template duplicado com sucesso!')
  }

  const handleEditTemplate = (template: ReportTemplate) => {
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateDescription(template.description || '')
    setSelectedFilters(template.filters)
    setSelectedColumns(template.columns)
    setSortBy(template.sortBy || { field: 'date', order: 'desc' })
    setGroupBy(template.groupBy || 'none')
    setIncludeCharts(template.includeCharts || false)
    setChartTypes(template.chartTypes || [])
    setExportFormat(template.exportFormat || 'pdf')
    setIsPublic(template.isPublic || false)
    setTags(template.tags || [])
    setCurrentTab('edit')
  }

  const resetForm = () => {
    setTemplateName('')
    setTemplateDescription('')
    setSelectedFilters([])
    setSelectedColumns(DEFAULT_COLUMNS)
    setSortBy({ field: 'date', order: 'desc' })
    setGroupBy('none')
    setIncludeCharts(true)
    setChartTypes(['bar', 'pie'])
    setExportFormat('pdf')
    setIsPublic(false)
    setTags([])
    setTagInput('')
  }

  const handleAddFilter = (type: string, value: any, label: string) => {
    const newFilter: ReportFilter = {
      type: type as any,
      value,
      label
    }
    setSelectedFilters(current => [...current, newFilter])
  }

  const handleRemoveFilter = (index: number) => {
    setSelectedFilters(current => current.filter((_, i) => i !== index))
  }

  const handleToggleColumn = (columnId: string) => {
    setSelectedColumns(current =>
      current.map(col =>
        col.id === columnId ? { ...col, enabled: !col.enabled } : col
      )
    )
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(current => [...current, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(current => current.filter(t => t !== tag))
  }

  const toggleChartType = (type: 'pie' | 'bar' | 'line' | 'donut') => {
    setChartTypes(current =>
      current.includes(type)
        ? current.filter(t => t !== type)
        : [...current, type]
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <FileText size={28} weight="duotone" />
              Templates de Relatórios
            </CardTitle>
            <CardDescription>
              Crie, salve e reutilize configurações personalizadas de relatórios
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setCurrentTab('create') }} className="gap-2">
            <Plus size={20} weight="bold" />
            Novo Template
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list" className="gap-2">
              <FileText size={16} />
              Meus Templates
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <Plus size={16} />
              Criar Novo
            </TabsTrigger>
            {editingTemplate && (
              <TabsTrigger value="edit" className="gap-2">
                <Pencil size={16} />
                Editar Template
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="list" className="space-y-4 mt-6">
            {(!templates || templates.length === 0) ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Nenhum template criado ainda</p>
                <p className="text-sm">Crie seu primeiro template para começar</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {templates.map(template => (
                    <Card key={template.id} className="interactive-hover">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-bold">{template.name}</h3>
                              {template.isPublic && (
                                <Badge variant="secondary" className="gap-1">
                                  <Share size={12} />
                                  Público
                                </Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                            )}
                            
                            <div className="flex flex-wrap gap-2 mb-3">
                              {template.tags && template.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="gap-1">
                                  <Tag size={12} />
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Filtros:</span>{' '}
                                <span className="font-medium">{template.filters.length}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Colunas:</span>{' '}
                                <span className="font-medium">
                                  {template.columns.filter(c => c.enabled).length}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Agrupamento:</span>{' '}
                                <span className="font-medium capitalize">{template.groupBy || 'Nenhum'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Formato:</span>{' '}
                                <span className="font-medium uppercase">{template.exportFormat}</span>
                              </div>
                            </div>

                            <div className="mt-3 text-xs text-muted-foreground">
                              Criado por {template.createdBy} em{' '}
                              {new Date(template.createdAt).toLocaleDateString('pt-BR')}
                              {template.lastModified && (
                                <> · Modificado em {new Date(template.lastModified).toLocaleDateString('pt-BR')}</>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              onClick={() => onRunTemplate(template)}
                              className="gap-2 w-full"
                            >
                              <Play size={16} weight="fill" />
                              Executar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleEditTemplate(template)}
                              className="gap-2 w-full"
                            >
                              <Pencil size={16} />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleDuplicateTemplate(template)}
                              className="gap-2 w-full"
                            >
                              <Copy size={16} />
                              Duplicar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="gap-2 w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash size={16} />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-6 mt-6">
            <TemplateForm
              name={templateName}
              description={templateDescription}
              filters={selectedFilters}
              columns={selectedColumns}
              sortBy={sortBy}
              groupBy={groupBy}
              includeCharts={includeCharts}
              chartTypes={chartTypes}
              exportFormat={exportFormat}
              isPublic={isPublic}
              tags={tags}
              tagInput={tagInput}
              locations={locations}
              onNameChange={setTemplateName}
              onDescriptionChange={setTemplateDescription}
              onAddFilter={handleAddFilter}
              onRemoveFilter={handleRemoveFilter}
              onToggleColumn={handleToggleColumn}
              onSortByChange={setSortBy}
              onGroupByChange={setGroupBy}
              onIncludeChartsChange={setIncludeCharts}
              onToggleChartType={toggleChartType}
              onExportFormatChange={setExportFormat}
              onIsPublicChange={setIsPublic}
              onTagInputChange={setTagInput}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              onSubmit={handleCreateTemplate}
              onCancel={() => { resetForm(); setCurrentTab('list') }}
              submitLabel="Criar Template"
            />
          </TabsContent>

          {editingTemplate && (
            <TabsContent value="edit" className="space-y-6 mt-6">
              <TemplateForm
                name={templateName}
                description={templateDescription}
                filters={selectedFilters}
                columns={selectedColumns}
                sortBy={sortBy}
                groupBy={groupBy}
                includeCharts={includeCharts}
                chartTypes={chartTypes}
                exportFormat={exportFormat}
                isPublic={isPublic}
                tags={tags}
                tagInput={tagInput}
                locations={locations}
                onNameChange={setTemplateName}
                onDescriptionChange={setTemplateDescription}
                onAddFilter={handleAddFilter}
                onRemoveFilter={handleRemoveFilter}
                onToggleColumn={handleToggleColumn}
                onSortByChange={setSortBy}
                onGroupByChange={setGroupBy}
                onIncludeChartsChange={setIncludeCharts}
                onToggleChartType={toggleChartType}
                onExportFormatChange={setExportFormat}
                onIsPublicChange={setIsPublic}
                onTagInputChange={setTagInput}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onSubmit={handleUpdateTemplate}
                onCancel={() => {
                  setEditingTemplate(null)
                  resetForm()
                  setCurrentTab('list')
                }}
                submitLabel="Salvar Alterações"
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}

interface TemplateFormProps {
  name: string
  description: string
  filters: ReportFilter[]
  columns: ReportColumn[]
  sortBy: { field: string; order: 'asc' | 'desc' }
  groupBy: 'location' | 'neighborhood' | 'status' | 'rgType' | 'date' | 'none'
  includeCharts: boolean
  chartTypes: ('pie' | 'bar' | 'line' | 'donut')[]
  exportFormat: 'pdf' | 'excel' | 'csv' | 'json'
  isPublic: boolean
  tags: string[]
  tagInput: string
  locations: Location[]
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onAddFilter: (type: string, value: any, label: string) => void
  onRemoveFilter: (index: number) => void
  onToggleColumn: (columnId: string) => void
  onSortByChange: (value: { field: string; order: 'asc' | 'desc' }) => void
  onGroupByChange: (value: 'location' | 'neighborhood' | 'status' | 'rgType' | 'date' | 'none') => void
  onIncludeChartsChange: (value: boolean) => void
  onToggleChartType: (type: 'pie' | 'bar' | 'line' | 'donut') => void
  onExportFormatChange: (value: 'pdf' | 'excel' | 'csv' | 'json') => void
  onIsPublicChange: (value: boolean) => void
  onTagInputChange: (value: string) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
}

function TemplateForm(props: TemplateFormProps) {
  const [filterType, setFilterType] = useState<string>('status')
  const [filterValue, setFilterValue] = useState<string>('')

  const STATUS_LABELS_PT: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    'awaiting-issuance': 'Aguardando Emissão',
    'cin-ready': 'CIN Pronta',
    'cin-delivered': 'CIN Entregue',
  }

  const PRIORITY_LABELS_PT: Record<string, string> = {
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
  }

  const handleAddFilter = () => {
    if (!filterValue) {
      toast.error('Selecione um valor para o filtro')
      return
    }

    let label = ''
    switch (filterType) {
      case 'status': {
        const statusLabel = STATUS_LABELS_PT[filterValue] || filterValue
        label = `Status: ${statusLabel}`
        break
      }
      case 'location': {
        const location = props.locations.find(l => l.id === filterValue)
        label = `Local: ${location?.name || filterValue}`
        break
      }
      case 'rgType':
        label = `Tipo de CIN: ${filterValue}`
        break
      case 'priority': {
        const priorityLabel = PRIORITY_LABELS_PT[filterValue] || filterValue
        label = `Prioridade: ${priorityLabel}`
        break
      }
      default:
        label = `${filterType}: ${filterValue}`
    }

    props.onAddFilter(filterType, filterValue, label)
    setFilterValue('')
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-name">Nome do Template *</Label>
            <Input
              id="template-name"
              value={props.name}
              onChange={(e) => props.onNameChange(e.target.value)}
              placeholder="Ex: Relatório Mensal de CINs Emitidos"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="template-description">Descrição</Label>
            <Textarea
              id="template-description"
              value={props.description}
              onChange={(e) => props.onDescriptionChange(e.target.value)}
              placeholder="Descreva o propósito deste template..."
              className="mt-2"
              rows={3}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Funnel size={20} weight="duotone" />
            <h3 className="text-lg font-semibold">Filtros</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="location">Local</SelectItem>
                <SelectItem value="rgType">Tipo de CIN</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o valor" />
              </SelectTrigger>
              <SelectContent>
                {filterType === 'status' && (
                  <>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="awaiting-issuance">Aguardando Emissão</SelectItem>
                    <SelectItem value="cin-ready">CIN Pronta</SelectItem>
                    <SelectItem value="cin-delivered">CIN Entregue</SelectItem>
                  </>
                )}
                {filterType === 'location' && props.locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
                {filterType === 'rgType' && (
                  <>
                    <SelectItem value="1ª via">1ª via</SelectItem>
                    <SelectItem value="2ª via">2ª via</SelectItem>
                  </>
                )}
                {filterType === 'priority' && (
                  <>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            <Button onClick={handleAddFilter} variant="outline" className="gap-2">
              <Plus size={16} />
              Adicionar
            </Button>
          </div>

          {props.filters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {props.filters.map((filter, index) => (
                <Badge key={index} variant="secondary" className="gap-2 pr-1">
                  {filter.label}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => props.onRemoveFilter(index)}
                  >
                    <Trash size={12} />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Columns size={20} weight="duotone" />
            <h3 className="text-lg font-semibold">Colunas</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {props.columns.map(column => (
              <div key={column.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`column-${column.id}`}
                  checked={column.enabled}
                  onCheckedChange={() => props.onToggleColumn(column.id)}
                />
                <Label
                  htmlFor={`column-${column.id}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Organização</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ordenar por</Label>
              <Select
                value={props.sortBy.field}
                onValueChange={(field) => props.onSortByChange({ ...props.sortBy, field })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="time">Horário</SelectItem>
                  <SelectItem value="fullName">Nome</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="protocol">Protocolo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ordem</Label>
              <Select
                value={props.sortBy.order}
                onValueChange={(order) => props.onSortByChange({ ...props.sortBy, order: order as 'asc' | 'desc' })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Crescente</SelectItem>
                  <SelectItem value="desc">Decrescente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Agrupar por</Label>
            <Select value={props.groupBy} onValueChange={props.onGroupByChange}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="location">Local</SelectItem>
                <SelectItem value="neighborhood">Bairro</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="rgType">Tipo de CIN</SelectItem>
                <SelectItem value="date">Data</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ChartBar size={20} weight="duotone" />
            <h3 className="text-lg font-semibold">Gráficos e Visualizações</h3>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-charts"
              checked={props.includeCharts}
              onCheckedChange={props.onIncludeChartsChange}
            />
            <Label htmlFor="include-charts" className="cursor-pointer">
              Incluir gráficos no relatório
            </Label>
          </div>

          {props.includeCharts && (
            <div className="ml-6 space-y-3">
              <Label>Tipos de gráficos</Label>
              <div className="grid grid-cols-2 gap-3">
                {['bar', 'pie', 'line', 'donut'].map(type => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`chart-${type}`}
                      checked={props.chartTypes.includes(type as any)}
                      onCheckedChange={() => props.onToggleChartType(type as any)}
                    />
                    <Label
                      htmlFor={`chart-${type}`}
                      className="text-sm font-normal cursor-pointer capitalize"
                    >
                      {type === 'bar' ? 'Barras' : type === 'pie' ? 'Pizza' : type === 'line' ? 'Linha' : 'Rosca'}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Download size={20} weight="duotone" />
            <h3 className="text-lg font-semibold">Exportação</h3>
          </div>

          <div>
            <Label>Formato padrão de exportação</Label>
            <Select value={props.exportFormat} onValueChange={props.onExportFormatChange}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag size={20} weight="duotone" />
            <h3 className="text-lg font-semibold">Tags e Organização</h3>
          </div>

          <div className="flex gap-2">
            <Input
              value={props.tagInput}
              onChange={(e) => props.onTagInputChange(e.target.value)}
              placeholder="Adicionar tag..."
              onKeyPress={(e) => e.key === 'Enter' && props.onAddTag()}
            />
            <Button onClick={props.onAddTag} variant="outline" className="gap-2">
              <Plus size={16} />
              Adicionar
            </Button>
          </div>

          {props.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {props.tags.map(tag => (
                <Badge key={tag} variant="outline" className="gap-2 pr-1">
                  {tag}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => props.onRemoveTag(tag)}
                  >
                    <Trash size={12} />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="is-public"
              checked={props.isPublic}
              onCheckedChange={props.onIsPublicChange}
            />
            <Label htmlFor="is-public" className="cursor-pointer">
              Tornar este template público (visível para outros usuários)
            </Label>
          </div>
        </div>

        <Separator />

        <div className="flex gap-3 pt-4">
          <Button onClick={props.onCancel} variant="outline" className="flex-1">
            Cancelar
          </Button>
          <Button onClick={props.onSubmit} className="flex-1 gap-2">
            <FileText size={18} />
            {props.submitLabel}
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
