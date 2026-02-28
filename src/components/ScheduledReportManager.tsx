import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar as CalendarIcon, Clock, Plus, Trash, PencilSimple, Play, Pause, Copy, Users, Download, Envelope, Tag, ChartBar, CalendarCheck, FileText, Files, File, Paperclip } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, addDays, addWeeks, addMonths, addYears, parseISO, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ScheduledReport, ScheduledReportFrequency, ScheduledReportFormat, ScheduledReportDeliveryMethod, ScheduledReportRecipient, ReportTemplate, ReportFilter, ReportColumn, Location, AttachedReportConfig } from '@/lib/types'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { logReportExecutionSafe } from '@/lib/report-logger'

interface ScheduledReportManagerProps {
  templates: ReportTemplate[]
  currentUser: string
  locations: Location[]
}

const FREQUENCY_LABELS: Record<ScheduledReportFrequency, string> = {
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  biweekly: 'Quinzenalmente',
  monthly: 'Mensalmente',
  quarterly: 'Trimestralmente',
  yearly: 'Anualmente'
}

const FORMAT_LABELS: Record<ScheduledReportFormat, string> = {
  pdf: 'PDF',
  excel: 'Excel (XLSX)',
  csv: 'CSV',
  json: 'JSON'
}

const DELIVERY_LABELS: Record<ScheduledReportDeliveryMethod, string> = {
  email: 'Email',
  download: 'Download no Sistema',
  both: 'Email e Download'
}

const DAY_OF_WEEK_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
]

function calculateNextExecution(
  startDate: string,
  frequency: ScheduledReportFrequency,
  timeOfDay: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  lastExecuted?: string
): string {
  const now = new Date()
  let baseDate = lastExecuted ? parseISO(lastExecuted) : parseISO(startDate)
  
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  
  let nextDate: Date
  
  switch (frequency) {
    case 'daily':
      nextDate = addDays(baseDate, 1)
      break
    case 'weekly':
      nextDate = addWeeks(baseDate, 1)
      if (dayOfWeek !== undefined) {
        while (nextDate.getDay() !== dayOfWeek) {
          nextDate = addDays(nextDate, 1)
        }
      }
      break
    case 'biweekly':
      nextDate = addWeeks(baseDate, 2)
      break
    case 'monthly':
      nextDate = addMonths(baseDate, 1)
      if (dayOfMonth !== undefined) {
        nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))
      }
      break
    case 'quarterly':
      nextDate = addMonths(baseDate, 3)
      break
    case 'yearly':
      nextDate = addYears(baseDate, 1)
      break
    default:
      nextDate = addDays(baseDate, 1)
  }
  
  nextDate.setHours(hours, minutes, 0, 0)
  
  if (isBefore(nextDate, now)) {
    return calculateNextExecution(
      format(nextDate, 'yyyy-MM-dd'),
      frequency,
      timeOfDay,
      dayOfWeek,
      dayOfMonth,
      format(nextDate, 'yyyy-MM-dd')
    )
  }
  
  return nextDate.toISOString()
}

export function ScheduledReportManager({ templates, currentUser, locations }: ScheduledReportManagerProps) {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null)
  
  const [formData, setFormData] = useState<Partial<ScheduledReport>>({
    name: '',
    description: '',
    frequency: 'weekly',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    timeOfDay: '08:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    format: 'pdf',
    deliveryMethod: 'email',
    recipients: [],
    filters: [],
    columns: [],
    includeCharts: true,
    chartTypes: ['bar', 'pie'],
    isActive: true,
    emailSubject: '',
    emailBody: '',
    attachedReports: [],
    combineIntoSingleFile: false
  })
  
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '', role: '' })
  const [isAddingAttachedReport, setIsAddingAttachedReport] = useState(false)
  const [newAttachedReport, setNewAttachedReport] = useState<Partial<AttachedReportConfig>>({
    name: '',
    filters: [],
    columns: [],
    includeCharts: false,
    chartTypes: [],
    format: 'pdf'
  })

  const normalizeReport = useCallback((report: ScheduledReport): ScheduledReport => ({
    ...report,
    recipients: Array.isArray(report.recipients) ? report.recipients : [],
    filters: Array.isArray(report.filters) ? report.filters : [],
    columns: Array.isArray(report.columns) ? report.columns : [],
    chartTypes: Array.isArray(report.chartTypes) ? report.chartTypes : [],
    attachedReports: Array.isArray(report.attachedReports) ? report.attachedReports : [],
    tags: Array.isArray(report.tags) ? report.tags : []
  }), [])

  const loadScheduledReports = useCallback(async () => {
    try {
      setIsLoadingReports(true)
      const data = await api.get<ScheduledReport[]>('/scheduled-reports')
      setScheduledReports((data || []).map(normalizeReport))
    } catch (error) {
      console.error('[ScheduledReportManager] Erro ao carregar agendamentos:', error)
      toast.error('Não foi possível carregar os agendamentos salvos')
      setScheduledReports([])
    } finally {
      setIsLoadingReports(false)
    }
  }, [normalizeReport])

  useEffect(() => {
    loadScheduledReports()
  }, [loadScheduledReports])

  // Polling a cada 30s para detectar novos relatórios prontos para download/email
  useEffect(() => {
    const interval = setInterval(() => { loadScheduledReports() }, 30_000)
    return () => clearInterval(interval)
  }, [loadScheduledReports])

  // Ref para rastrear quais lastReportReadyAt já foram baixados (evita re-download)
  const seenDownloadsRef = useRef<Map<string, string>>(new Map())

  // Detectar relatórios prontos para download e acionar automaticamente
  useEffect(() => {
    for (const report of scheduledReports) {
      const deliveryMethod = (report as any).deliveryMethod as string | undefined
      if (!deliveryMethod || (deliveryMethod !== 'download' && deliveryMethod !== 'both')) continue
      const readyAt: string | undefined = (report as any).lastReportReadyAt
      if (!readyAt) continue
      if (seenDownloadsRef.current.get(report.id) === readyAt) continue
      // Novo relatório disponível — marcar e baixar
      seenDownloadsRef.current.set(report.id, readyAt)
      ;(async () => {
        try {
          const data = await api.get<{ data?: string; filename?: string; mimeType?: string; html?: string; readyAt: string; name: string }>(
            `/scheduled-reports/${report.id}/download`
          )
          if (!data) return
          let blob: Blob
          let filename: string
          if (data.data && data.filename && data.mimeType) {
            // Novo formato: base64 do arquivo real
            const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0))
            blob = new Blob([bytes], { type: data.mimeType })
            filename = data.filename
          } else if (data.html) {
            // Compat. legada: HTML
            blob = new Blob([data.html], { type: 'text/html;charset=utf-8' })
            filename = `${(data.name || report.name || 'relatorio').replace(/[^a-z0-9_\-\s]/gi, '_')}_${readyAt.slice(0, 10)}.html`
          } else return
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = filename
          document.body.appendChild(anchor)
          anchor.click()
          document.body.removeChild(anchor)
          URL.revokeObjectURL(url)
          toast.success(`Relatório "${data.name || report.name}" baixado automaticamente!`)
        } catch (err) {
          console.error('[ScheduledReportManager] Erro ao baixar relatório:', err)
        }
      })()
    }
  }, [scheduledReports])

  useEffect(() => {
    if (scheduledReports) {
      const updatedReports = scheduledReports.map(report => {
        if (!report.nextExecution || !report.isActive) return report
        
        const now = new Date()
        const nextExec = parseISO(report.nextExecution)
        
        if (isBefore(nextExec, now)) {
          const newNextExecution = calculateNextExecution(
            report.startDate,
            report.frequency,
            report.timeOfDay,
            report.dayOfWeek,
            report.dayOfMonth,
            report.lastExecuted
          )
          
          return {
            ...report,
            nextExecution: newNextExecution
          }
        }
        
        return report
      })
      
      const hasChanges = updatedReports.some((report, index) => 
        report.nextExecution !== scheduledReports[index].nextExecution
      )
      
      if (hasChanges) {
        setScheduledReports(updatedReports)
      }
    }
  }, [scheduledReports])

  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.startDate || !formData.timeOfDay || formData.recipients?.length === 0) {
      toast.error('Preencha todos os campos obrigatórios e adicione pelo menos um destinatário')
      return
    }
    
    const nextExecution = calculateNextExecution(
      formData.startDate,
      formData.frequency!,
      formData.timeOfDay,
      formData.dayOfWeek,
      formData.dayOfMonth
    )
    
    try {
      if (editingReport) {
        const updatedPayload: ScheduledReport = {
          ...editingReport,
          ...formData,
          lastModified: new Date().toISOString(),
          nextExecution
        } as ScheduledReport

        const updated = await api.put<ScheduledReport>(`/scheduled-reports/${editingReport.id}`, updatedPayload)
        const normalized = normalizeReport(updated)
        setScheduledReports(current =>
          (current || []).map(report => (report.id === editingReport.id ? normalized : report))
        )
        await logReportExecutionSafe({
          reportId: editingReport.id,
          reportName: updatedPayload.name || 'Relatório agendado',
          reportType: 'scheduled',
          executedBy: currentUser,
          status: 'success',
          trigger: 'manual',
          totalRecords: scheduledReports.length,
          recordsProcessed: 1,
          format: (updatedPayload.format || 'pdf') as ScheduledReportFormat,
          executionDuration: 0,
          metadata: { action: 'update-schedule' }
        })
        toast.success('Relatório agendado atualizado com sucesso!')
      } else {
        const newReport: ScheduledReport = {
          id: crypto.randomUUID(),
          name: formData.name!,
          description: formData.description,
          templateId: formData.templateId,
          createdBy: currentUser,
          createdAt: new Date().toISOString(),
          isActive: formData.isActive ?? true,
          frequency: formData.frequency!,
          startDate: formData.startDate!,
          endDate: formData.endDate,
          timeOfDay: formData.timeOfDay!,
          dayOfWeek: formData.dayOfWeek,
          dayOfMonth: formData.dayOfMonth,
          filters: formData.filters || [],
          columns: formData.columns || [],
          sortBy: formData.sortBy,
          groupBy: formData.groupBy,
          includeCharts: formData.includeCharts,
          chartTypes: formData.chartTypes,
          format: formData.format!,
          deliveryMethod: formData.deliveryMethod!,
          recipients: formData.recipients!,
          emailSubject: formData.emailSubject,
          emailBody: formData.emailBody,
          nextExecution,
          executionCount: 0,
          tags: formData.tags
        }

        const created = await api.post<ScheduledReport>('/scheduled-reports', newReport)
        setScheduledReports(current => [...(current || []), normalizeReport(created)])
        await logReportExecutionSafe({
          reportId: newReport.id,
          reportName: newReport.name,
          reportType: 'scheduled',
          executedBy: currentUser,
          status: 'success',
          trigger: 'manual',
          totalRecords: scheduledReports.length + 1,
          recordsProcessed: 1,
          format: newReport.format,
          executionDuration: 0,
          metadata: { action: 'create-schedule' }
        })
        toast.success('Relatório agendado criado com sucesso!')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('[ScheduledReportManager] Erro ao salvar agendamento:', error)
      await logReportExecutionSafe({
        reportId: editingReport?.id,
        reportName: formData.name || editingReport?.name || 'Relatório agendado',
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'failed',
        trigger: 'manual',
        totalRecords: scheduledReports.length,
        recordsProcessed: 0,
        format: (formData.format || editingReport?.format || 'pdf') as ScheduledReportFormat,
        executionDuration: 0,
        error: error instanceof Error ? error.message : 'Falha ao salvar agendamento',
        metadata: { action: editingReport ? 'update-schedule' : 'create-schedule' }
      })
      toast.error('Não foi possível salvar o agendamento no banco de dados')
    }
  }

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false)
    setEditingReport(null)
    setFormData({
      name: '',
      description: '',
      frequency: 'weekly',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      timeOfDay: '08:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
      format: 'pdf',
      deliveryMethod: 'email',
      recipients: [],
      filters: [],
      columns: [],
      includeCharts: true,
      chartTypes: ['bar', 'pie'],
      isActive: true,
      emailSubject: '',
      emailBody: '',
      attachedReports: [],
      combineIntoSingleFile: false
    })
    setNewRecipient({ name: '', email: '', role: '' })
    setIsAddingAttachedReport(false)
    setNewAttachedReport({
      name: '',
      filters: [],
      columns: [],
      includeCharts: false,
      chartTypes: [],
      format: 'pdf'
    })
  }

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report)
    setFormData(report)
    setIsCreateDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    const report = scheduledReports.find(r => r.id === id)
    try {
      await api.delete(`/scheduled-reports/${id}`)
      setScheduledReports(current => (current || []).filter(r => r.id !== id))
      await logReportExecutionSafe({
        reportId: id,
        reportName: report?.name || 'Relatório agendado',
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'success',
        trigger: 'manual',
        totalRecords: Math.max((scheduledReports?.length || 1) - 1, 0),
        recordsProcessed: 1,
        format: (report?.format || 'pdf') as ScheduledReportFormat,
        executionDuration: 0,
        metadata: { action: 'delete-schedule' }
      })
      toast.success('Relatório agendado excluído')
    } catch (error) {
      console.error('[ScheduledReportManager] Erro ao excluir agendamento:', error)
      await logReportExecutionSafe({
        reportId: id,
        reportName: report?.name || 'Relatório agendado',
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'failed',
        trigger: 'manual',
        totalRecords: scheduledReports.length,
        recordsProcessed: 0,
        format: (report?.format || 'pdf') as ScheduledReportFormat,
        executionDuration: 0,
        error: error instanceof Error ? error.message : 'Falha ao excluir agendamento',
        metadata: { action: 'delete-schedule' }
      })
      toast.error('Não foi possível excluir o agendamento')
    }
  }

  const handleToggleActive = async (id: string) => {
    const target = scheduledReports.find(report => report.id === id)
    if (!target) return

    const newIsActive = !target.isActive
    const nextExecution = newIsActive
      ? calculateNextExecution(
          target.startDate,
          target.frequency,
          target.timeOfDay,
          target.dayOfWeek,
          target.dayOfMonth,
          target.lastExecuted
        )
      : undefined

    try {
      const updated = await api.put<ScheduledReport>(`/scheduled-reports/${id}`, {
        ...target,
        isActive: newIsActive,
        nextExecution
      })
      const normalized = normalizeReport(updated)
      setScheduledReports(current =>
        (current || []).map(report => (report.id === id ? normalized : report))
      )
      await logReportExecutionSafe({
        reportId: id,
        reportName: target.name,
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'success',
        trigger: 'manual',
        totalRecords: scheduledReports.length,
        recordsProcessed: 1,
        format: target.format,
        executionDuration: 0,
        metadata: { action: newIsActive ? 'activate-schedule' : 'pause-schedule' }
      })
    } catch (error) {
      console.error('[ScheduledReportManager] Erro ao alterar status do agendamento:', error)
      await logReportExecutionSafe({
        reportId: id,
        reportName: target.name,
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'failed',
        trigger: 'manual',
        totalRecords: scheduledReports.length,
        recordsProcessed: 0,
        format: target.format,
        executionDuration: 0,
        error: error instanceof Error ? error.message : 'Falha ao alterar status do agendamento',
        metadata: { action: 'toggle-schedule' }
      })
      toast.error('Não foi possível atualizar o status do agendamento')
    }
  }

  const handleDuplicate = async (report: ScheduledReport) => {
    const duplicated: ScheduledReport = {
      ...report,
      id: crypto.randomUUID(),
      name: `${report.name} (Cópia)`,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      lastModified: undefined,
      lastExecuted: undefined,
      executionCount: 0,
      nextExecution: calculateNextExecution(
        report.startDate,
        report.frequency,
        report.timeOfDay,
        report.dayOfWeek,
        report.dayOfMonth
      )
    }

    try {
      const created = await api.post<ScheduledReport>('/scheduled-reports', duplicated)
      setScheduledReports(current => [...(current || []), normalizeReport(created)])
      await logReportExecutionSafe({
        reportId: duplicated.id,
        reportName: duplicated.name,
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'success',
        trigger: 'manual',
        totalRecords: scheduledReports.length + 1,
        recordsProcessed: 1,
        format: duplicated.format,
        executionDuration: 0,
        metadata: { action: 'duplicate-schedule', sourceReportId: report.id }
      })
      toast.success('Relatório duplicado com sucesso!')
    } catch (error) {
      console.error('[ScheduledReportManager] Erro ao duplicar agendamento:', error)
      await logReportExecutionSafe({
        reportId: report.id,
        reportName: report.name,
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'failed',
        trigger: 'manual',
        totalRecords: scheduledReports.length,
        recordsProcessed: 0,
        format: report.format,
        executionDuration: 0,
        error: error instanceof Error ? error.message : 'Falha ao duplicar agendamento',
        metadata: { action: 'duplicate-schedule' }
      })
      toast.error('Não foi possível duplicar o agendamento')
    }
  }

  const handleRunNow = async (id: string) => {
    try {
      const updated = await api.post<ScheduledReport>(`/scheduled-reports/${id}/run-now`)
      setScheduledReports(current =>
        (current || []).map(report => (report.id === id ? normalizeReport(updated) : report))
      )
      toast.success('Execução iniciada com sucesso!')
      await logReportExecutionSafe({
        reportId: id,
        reportName: updated.name || 'Relatório agendado',
        reportType: 'scheduled',
        executedBy: currentUser,
        status: 'success',
        trigger: 'manual',
        totalRecords: 0,
        recordsProcessed: 1,
        format: (updated.format || 'pdf') as ScheduledReportFormat,
        executionDuration: 0,
        metadata: { action: 'run-now' }
      })
      await loadScheduledReports()
    } catch (error) {
      console.error('[ScheduledReportManager] Erro ao executar agora:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao executar agora')
    }
  }

  const handleAddRecipient = () => {
    if (!newRecipient.name || !newRecipient.email) {
      toast.error('Preencha nome e email do destinatário')
      return
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newRecipient.email)) {
      toast.error('Email inválido')
      return
    }
    
    setFormData(prev => ({
      ...prev,
      recipients: [...(prev.recipients || []), { ...newRecipient }]
    }))
    
    setNewRecipient({ name: '', email: '', role: '' })
    toast.success('Destinatário adicionado')
  }

  const handleRemoveRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients?.filter((_, i) => i !== index) || []
    }))
  }

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return
    
    setFormData(prev => ({
      ...prev,
      templateId: template.id,
      name: `Relatório Periódico - ${template.name}`,
      description: template.description,
      filters: template.filters,
      columns: template.columns,
      sortBy: template.sortBy,
      groupBy: template.groupBy,
      includeCharts: template.includeCharts,
      chartTypes: template.chartTypes,
      // Formato do template é fixo — não deve ser alterado no agendamento
      format: (template.exportFormat || 'pdf') as ScheduledReportFormat,
    }))
    
    toast.success('Template carregado!')
  }

  const handleAddAttachedReport = () => {
    if (!newAttachedReport.name) {
      toast.error('Digite um nome para o relatório anexado')
      return
    }

    const attachedReport: AttachedReportConfig = {
      id: crypto.randomUUID(),
      templateId: newAttachedReport.templateId,
      name: newAttachedReport.name!,
      filters: newAttachedReport.filters || [],
      columns: newAttachedReport.columns || [],
      sortBy: newAttachedReport.sortBy,
      groupBy: newAttachedReport.groupBy,
      includeCharts: newAttachedReport.includeCharts || false,
      chartTypes: newAttachedReport.chartTypes || [],
      format: newAttachedReport.format || 'pdf'
    }

    setFormData(prev => ({
      ...prev,
      attachedReports: [...(prev.attachedReports || []), attachedReport]
    }))

    setNewAttachedReport({
      name: '',
      filters: [],
      columns: [],
      includeCharts: false,
      chartTypes: [],
      format: 'pdf'
    })

    setIsAddingAttachedReport(false)
    toast.success('Relatório anexado adicionado!')
  }

  const handleRemoveAttachedReport = (id: string) => {
    setFormData(prev => ({
      ...prev,
      attachedReports: (prev.attachedReports || []).filter(r => r.id !== id)
    }))
    toast.success('Relatório anexado removido')
  }

  const handleLoadTemplateForAttached = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return
    
    setNewAttachedReport(prev => ({
      ...prev,
      templateId: template.id,
      name: template.name,
      filters: template.filters,
      columns: template.columns,
      sortBy: template.sortBy,
      groupBy: template.groupBy,
      includeCharts: template.includeCharts,
      chartTypes: template.chartTypes,
      format: template.exportFormat || 'pdf'
    }))
    
    toast.success('Template carregado para relatório anexado!')
  }

  const activeReports = useMemo(() => 
    (scheduledReports || []).filter(r => r.isActive).length,
    [scheduledReports]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <CalendarCheck size={28} weight="duotone" className="text-primary" />
                Relatórios Agendados Automaticamente
              </CardTitle>
              <CardDescription className="mt-2">
                Configure geração e envio automático de relatórios periódicos por email
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" size="lg">
                  <Plus size={20} weight="bold" />
                  Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CalendarCheck size={24} weight="duotone" />
                    {editingReport ? 'Editar Relatório Agendado' : 'Criar Novo Relatório Agendado'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure a geração automática e periódica de relatórios
                  </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
                  <div className="space-y-6 py-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText size={18} weight="duotone" />
                        Informações Básicas
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="name">Nome do Agendamento *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ex: Relatório Mensal de Atendimentos"
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <Label htmlFor="description">Descrição</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Descreva o objetivo deste relatório agendado..."
                            rows={2}
                          />
                        </div>

                        <div className="col-span-2">
                          <Label htmlFor="template">Carregar de Template Existente</Label>
                          <Select onValueChange={handleLoadTemplate}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map(template => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Clock size={18} weight="duotone" />
                        Frequência e Horário
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="frequency">Frequência *</Label>
                          <Select
                            value={formData.frequency}
                            onValueChange={(value: ScheduledReportFrequency) => 
                              setFormData(prev => ({ ...prev, frequency: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="timeOfDay">Horário de Geração *</Label>
                          <Input
                            id="timeOfDay"
                            type="time"
                            value={formData.timeOfDay}
                            onChange={(e) => setFormData(prev => ({ ...prev, timeOfDay: e.target.value }))}
                          />
                        </div>

                        {formData.frequency === 'weekly' && (
                          <div>
                            <Label htmlFor="dayOfWeek">Dia da Semana</Label>
                            <Select
                              value={formData.dayOfWeek?.toString()}
                              onValueChange={(value) => 
                                setFormData(prev => ({ ...prev, dayOfWeek: parseInt(value) }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAY_OF_WEEK_LABELS.map((label, index) => (
                                  <SelectItem key={index} value={index.toString()}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {(formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'yearly') && (
                          <div>
                            <Label htmlFor="dayOfMonth">Dia do Mês</Label>
                            <Input
                              id="dayOfMonth"
                              type="number"
                              min="1"
                              max="31"
                              value={formData.dayOfMonth}
                              onChange={(e) => setFormData(prev => ({ 
                                ...prev, 
                                dayOfMonth: parseInt(e.target.value) 
                              }))}
                            />
                          </div>
                        )}

                        <div>
                          <Label htmlFor="startDate">Data de Início *</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                          />
                        </div>

                        <div>
                          <Label htmlFor="endDate">Data de Término (Opcional)</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={formData.endDate || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value || undefined }))}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Download size={18} weight="duotone" />
                        Formato e Entrega
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="format">Formato do Arquivo</Label>
                          {formData.templateId ? (
                            // Se um template está selecionado, formato é somente leitura
                            <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
                              {FORMAT_LABELS[formData.format as ScheduledReportFormat] || formData.format || 'PDF'}
                              <span className="ml-auto text-xs opacity-60">(definido pelo template)</span>
                            </div>
                          ) : (
                            <Select
                              value={formData.format}
                              onValueChange={(value: ScheduledReportFormat) =>
                                setFormData(prev => ({ ...prev, format: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="deliveryMethod">Método de Entrega *</Label>
                          <Select
                            value={formData.deliveryMethod}
                            onValueChange={(value: ScheduledReportDeliveryMethod) => 
                              setFormData(prev => ({ ...prev, deliveryMethod: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DELIVERY_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2 flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <ChartBar size={24} weight="duotone" className="text-primary" />
                            <div>
                              <Label className="text-base">Incluir Gráficos</Label>
                              <p className="text-xs text-muted-foreground mt-1">
                                Adicionar visualizações gráficas ao relatório
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={formData.includeCharts}
                            onCheckedChange={(checked) => 
                              setFormData(prev => ({ ...prev, includeCharts: checked }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Users size={18} weight="duotone" />
                        Destinatários *
                      </div>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <Input
                              placeholder="Nome"
                              value={newRecipient.name}
                              onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div className="col-span-5">
                            <Input
                              type="email"
                              placeholder="Email"
                              value={newRecipient.email}
                              onChange={(e) => setNewRecipient(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              placeholder="Cargo"
                              value={newRecipient.role}
                              onChange={(e) => setNewRecipient(prev => ({ ...prev, role: e.target.value }))}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              size="icon"
                              onClick={handleAddRecipient}
                              className="w-full"
                            >
                              <Plus size={18} weight="bold" />
                            </Button>
                          </div>
                        </div>

                        {formData.recipients && formData.recipients.length > 0 && (
                          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                            {formData.recipients.map((recipient, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-card rounded border">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{recipient.name}</div>
                                  <div className="text-xs text-muted-foreground">{recipient.email}</div>
                                  {recipient.role && (
                                    <Badge variant="secondary" className="mt-1 text-xs">
                                      {recipient.role}
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveRecipient(index)}
                                >
                                  <Trash size={16} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {(formData.deliveryMethod === 'email' || formData.deliveryMethod === 'both') && (
                      <>
                        <Separator />
                        
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Envelope size={18} weight="duotone" />
                            Personalização do Email
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="emailSubject">Assunto do Email</Label>
                              <Input
                                id="emailSubject"
                                value={formData.emailSubject}
                                onChange={(e) => setFormData(prev => ({ ...prev, emailSubject: e.target.value }))}
                                placeholder="Ex: Relatório Mensal de Atendimentos - {data}"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Use {'{data}'} para incluir a data de geração
                              </p>
                            </div>

                            <div>
                              <Label htmlFor="emailBody">Corpo do Email</Label>
                              <Textarea
                                id="emailBody"
                                value={formData.emailBody}
                                onChange={(e) => setFormData(prev => ({ ...prev, emailBody: e.target.value }))}
                                placeholder="Olá {nome},&#10;&#10;Segue anexo o relatório periódico..."
                                rows={4}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Use {'{nome}'} para o nome do destinatário e {'{data}'} para a data
                              </p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <Paperclip size={18} weight="duotone" />
                              Relatórios Anexados ao Email
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsAddingAttachedReport(true)}
                              className="gap-2"
                            >
                              <Plus size={16} weight="bold" />
                              Adicionar Relatório
                            </Button>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Anexe múltiplos relatórios ao mesmo email agendado. Cada relatório pode ter configurações e filtros diferentes.
                          </p>

                          {formData.attachedReports && formData.attachedReports.length > 0 && (
                            <>
                              <div className="space-y-2">
                                {formData.attachedReports.map((report) => (
                                  <div
                                    key={report.id}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <File size={24} weight="duotone" className="text-primary" />
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{report.name}</div>
                                        <div className="flex gap-2 mt-1">
                                          <Badge variant="secondary" className="text-xs">
                                            {FORMAT_LABELS[report.format]}
                                          </Badge>
                                          {report.includeCharts && (
                                            <Badge variant="outline" className="text-xs gap-1">
                                              <ChartBar size={12} />
                                              Gráficos
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveAttachedReport(report.id)}
                                    >
                                      <Trash size={16} className="text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Files size={24} weight="duotone" className="text-primary" />
                                  <div>
                                    <Label className="text-base">Combinar em um único arquivo</Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Juntar todos os relatórios em um único PDF anexado
                                    </p>
                                  </div>
                                </div>
                                <Switch
                                  checked={formData.combineIntoSingleFile}
                                  onCheckedChange={(checked) => 
                                    setFormData(prev => ({ ...prev, combineIntoSingleFile: checked }))
                                  }
                                />
                              </div>
                            </>
                          )}

                          {(!formData.attachedReports || formData.attachedReports.length === 0) && (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                              <Paperclip size={40} weight="duotone" className="mx-auto text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">
                                Nenhum relatório anexado adicional
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                O relatório principal será enviado por padrão
                              </p>
                            </div>
                          )}
                        </div>

                        <Dialog open={isAddingAttachedReport} onOpenChange={setIsAddingAttachedReport}>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <File size={24} weight="duotone" />
                                Adicionar Relatório Anexado
                              </DialogTitle>
                              <DialogDescription>
                                Configure um relatório adicional para anexar ao email
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                              <div>
                                <Label htmlFor="attached-template">Carregar de Template</Label>
                                <Select onValueChange={handleLoadTemplateForAttached}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um template..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {templates.map(template => (
                                      <SelectItem key={template.id} value={template.id}>
                                        {template.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="attached-name">Nome do Relatório *</Label>
                                <Input
                                  id="attached-name"
                                  value={newAttachedReport.name}
                                  onChange={(e) => setNewAttachedReport(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="Ex: Estatísticas por Bairro/Comunidade"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="attached-format">Formato</Label>
                                  <Select
                                    value={newAttachedReport.format}
                                    onValueChange={(value: ScheduledReportFormat) => 
                                      setNewAttachedReport(prev => ({ ...prev, format: value }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex items-end">
                                  <div className="flex items-center justify-between p-3 border rounded-lg w-full">
                                    <Label className="text-sm">Incluir Gráficos</Label>
                                    <Switch
                                      checked={newAttachedReport.includeCharts}
                                      onCheckedChange={(checked) => 
                                        setNewAttachedReport(prev => ({ ...prev, includeCharts: checked }))
                                      }
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                  <strong>Dica:</strong> Os filtros e configurações do relatório principal serão aplicados automaticamente. Use templates salvos para carregar configurações específicas.
                                </p>
                              </div>
                            </div>

                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsAddingAttachedReport(false)
                                  setNewAttachedReport({
                                    name: '',
                                    filters: [],
                                    columns: [],
                                    includeCharts: false,
                                    chartTypes: [],
                                    format: 'pdf'
                                  })
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button onClick={handleAddAttachedReport}>
                                Adicionar Relatório
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                      <div>
                        <Label className="text-base">Ativar Agendamento</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Iniciar geração automática de relatórios
                        </p>
                      </div>
                      <Switch
                        checked={formData.isActive}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, isActive: checked }))
                        }
                      />
                    </div>
                  </div>
                </ScrollArea>

                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateOrUpdate}>
                    {editingReport ? 'Atualizar' : 'Criar'} Agendamento
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Agendamentos</p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                      {scheduledReports?.length || 0}
                    </p>
                  </div>
                  <CalendarIcon size={40} weight="duotone" className="text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Agendamentos Ativos</p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
                      {activeReports}
                    </p>
                  </div>
                  <Play size={40} weight="duotone" className="text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Próxima Execução</p>
                    <p className="text-sm font-bold text-purple-900 dark:text-purple-100 mt-1">
                      {scheduledReports && scheduledReports.length > 0
                        ? format(
                            parseISO(
                              scheduledReports
                                .filter(r => r.isActive && r.nextExecution)
                                .sort((a, b) => 
                                  new Date(a.nextExecution!).getTime() - new Date(b.nextExecution!).getTime()
                                )[0]?.nextExecution || new Date().toISOString()
                            ),
                            "dd/MM/yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )
                        : 'Nenhuma'}
                    </p>
                  </div>
                  <Clock size={40} weight="duotone" className="text-purple-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {isLoadingReports && (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <p className="text-sm text-muted-foreground">Carregando agendamentos salvos...</p>
                </div>
              )}

              {!isLoadingReports && (!scheduledReports || scheduledReports.length === 0) && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <CalendarCheck size={64} weight="duotone" className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum relatório agendado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crie seu primeiro agendamento automático de relatórios
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                    <Plus size={18} weight="bold" />
                    Criar Primeiro Agendamento
                  </Button>
                </div>
              )}

              {scheduledReports?.map(report => (
                <Card key={report.id} className={cn(
                  "transition-all hover:shadow-lg",
                  !report.isActive && "opacity-60"
                )}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{report.name}</h3>
                          {report.isActive ? (
                            <Badge className="bg-green-500">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Pausado</Badge>
                          )}
                        </div>
                        {report.description && (
                          <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Clock size={14} />
                            {FREQUENCY_LABELS[report.frequency]}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Download size={14} />
                            {FORMAT_LABELS[report.format]}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Users size={14} />
                            {report.recipients.length} destinatário(s)
                          </Badge>
                          {report.attachedReports && report.attachedReports.length > 0 && (
                            <Badge variant="outline" className="gap-1 bg-purple-50 dark:bg-purple-950 border-purple-300 text-purple-700 dark:text-purple-300">
                              <Paperclip size={14} />
                              {report.attachedReports.length} anexo(s)
                            </Badge>
                          )}
                          {report.combineIntoSingleFile && (
                            <Badge variant="outline" className="gap-1 bg-blue-50 dark:bg-blue-950 border-blue-300 text-blue-700 dark:text-blue-300">
                              <Files size={14} />
                              Combinado
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRunNow(report.id)}
                          title="Executar agora"
                        >
                          <Play size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(report.id)}
                          title={report.isActive ? 'Pausar' : 'Ativar'}
                        >
                          {report.isActive ? (
                            <Pause size={18} weight="fill" />
                          ) : (
                            <Play size={18} weight="fill" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(report)}
                          title="Editar"
                        >
                          <PencilSimple size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(report)}
                          title="Duplicar"
                        >
                          <Copy size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(report.id)}
                          title="Excluir"
                        >
                          <Trash size={18} className="text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Horário</p>
                        <p className="font-medium">{report.timeOfDay}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Próxima Execução</p>
                        <p className="font-medium">
                          {report.nextExecution
                            ? format(parseISO(report.nextExecution), "dd/MM/yy HH:mm", { locale: ptBR })
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Execuções</p>
                        <p className="font-medium">{report.executionCount || 0}x</p>
                      </div>
                    </div>

                    {report.recipients.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Destinatários:</p>
                        <div className="flex flex-wrap gap-1">
                          {report.recipients.map((recipient, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {recipient.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.attachedReports && report.attachedReports.length > 0 && (
                      <div className="mt-4 p-3 border rounded-lg bg-muted/20">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                          <Paperclip size={14} />
                          Relatórios Anexados:
                        </p>
                        <div className="space-y-1">
                          {report.attachedReports.map((attached) => (
                            <div key={attached.id} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1">
                                <File size={12} weight="duotone" />
                                {attached.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {FORMAT_LABELS[attached.format]}
                              </Badge>
                            </div>
                          ))}
                        </div>
                        {report.combineIntoSingleFile && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Files size={12} />
                            Todos os relatórios serão combinados em um único arquivo
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
