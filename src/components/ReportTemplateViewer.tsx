import { useState, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { 
  Download, 
  FileText, 
  ChartBar,
  X,
  FilePdf,
  FileXls,
  FileCsv,
  FileCode
} from '@phosphor-icons/react'
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import type { ReportTemplate, Appointment, Location } from '@/lib/types'
import { api } from '@/lib/api'
import { logReportExecutionSafe } from '@/lib/report-logger'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

interface ReportTemplateViewerProps {
  template: ReportTemplate
  appointments: Appointment[]
  locations: Location[]
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  'pending': 'Pendente',
  'confirmed': 'Confirmado',
  'completed': 'Concluído',
  'cancelled': 'Cancelado',
  'awaiting-issuance': 'Aguardando Emissão',
  'cin-ready': 'CIN Pronta',
  'cin-delivered': 'CIN Entregue'
}

const PRIORITY_LABELS: Record<string, string> = {
  'normal': 'Normal',
  'high': 'Alta',
  'urgent': 'Urgente'
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f43f5e']

export function ReportTemplateViewer({ template, appointments, locations, onClose }: ReportTemplateViewerProps) {
  const [isExporting, setIsExporting] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments]

    // Agrupa filtros pelo tipo para aplicar OR dentro do mesmo tipo
    // e AND entre tipos diferentes
    const filtersByType: Record<string, string[]> = {}
    template.filters.forEach(filter => {
      if (!filtersByType[filter.type]) filtersByType[filter.type] = []
      filtersByType[filter.type].push(filter.value)
    })

    Object.entries(filtersByType).forEach(([type, values]) => {
      switch (type) {
        case 'status':
          filtered = filtered.filter(apt => values.includes(apt.status))
          break
        case 'location':
          filtered = filtered.filter(apt => values.includes(apt.locationId))
          break
        case 'rgType':
          filtered = filtered.filter(apt => apt.rgType != null && values.includes(apt.rgType))
          break
        case 'priority':
          filtered = filtered.filter(apt => apt.priority != null && values.includes(apt.priority))
          break
        case 'neighborhood':
          filtered = filtered.filter(apt =>
            apt.neighborhood != null &&
            values.some(v => apt.neighborhood!.toLowerCase().includes(v.toLowerCase()))
          )
          break
      }
    })

    if (template.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[template.sortBy!.field as keyof Appointment]
        const bVal = b[template.sortBy!.field as keyof Appointment]
        
        if (aVal === undefined || bVal === undefined) return 0
        
        if (template.sortBy!.order === 'asc') {
          return aVal > bVal ? 1 : -1
        } else {
          return aVal < bVal ? 1 : -1
        }
      })
    }

    return filtered
  }, [appointments, template])

  const groupedData = useMemo(() => {
    if (template.groupBy === 'none') {
      return { 'Todos': filteredAppointments }
    }

    const groups: Record<string, Appointment[]> = {}

    filteredAppointments.forEach(apt => {
      let groupKey = ''
      
      switch (template.groupBy) {
        case 'location':
          const location = locations.find(l => l.id === apt.locationId)
          groupKey = location?.name || 'Sem Local'
          break
        case 'neighborhood':
          groupKey = apt.neighborhood || 'Sem Bairro'
          break
        case 'status':
          groupKey = STATUS_LABELS[apt.status] || apt.status
          break
        case 'rgType':
          groupKey = apt.rgType || 'Não Especificado'
          break
        case 'date':
          groupKey = format(parseISO(apt.date), 'dd/MM/yyyy')
          break
        default:
          groupKey = 'Outros'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(apt)
    })

    return groups
  }, [filteredAppointments, template.groupBy, locations])

  // Dados específicos por dimensão para gráficos significativos
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAppointments.forEach(a => {
      const label = STATUS_LABELS[a.status] || a.status
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [filteredAppointments])

  const cinTypeChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAppointments.forEach(a => {
      const label = a.rgType || 'Não informado'
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [filteredAppointments])

  const locationChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAppointments.forEach(a => {
      const loc = locations.find(l => l.id === a.locationId)
      const label = loc?.name || 'Sem local'
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [filteredAppointments, locations])

  const groupChartData = useMemo(() => {
    if (template.groupBy === 'none') return []
    return Object.entries(groupedData)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, apts]) => ({ name: key, value: apts.length }))
  }, [groupedData, template.groupBy])

  const chartData = statusChartData // mantido para compatibilidade

  const getCellValue = (appointment: Appointment, field: string) => {
    switch (field) {
      case 'locationName':
        const location = locations.find(l => l.id === appointment.locationId)
        return location?.name || '-'
      case 'statusLabel':
        return STATUS_LABELS[appointment.status] || appointment.status
      case 'priorityLabel':
        return PRIORITY_LABELS[appointment.priority || 'normal']
      case 'rgTypeLabel':
        return appointment.rgType || '-'
      case 'date':
        return format(parseISO(appointment.date), 'dd/MM/yyyy')
      default:
        const value = appointment[field as keyof Appointment]
        return value !== undefined && value !== null ? String(value) : '-'
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    const exportFormat = template.exportFormat || 'pdf'
    const startedAt = performance.now()

    try {
      if (exportFormat === 'pdf') {
        if (!contentRef.current) {
          throw new Error('Conteúdo do relatório não encontrado para exportação')
        }

        const dataUrl = await toPng(contentRef.current, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
        })

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const imgProps = pdf.getImageProperties(dataUrl)
        const imgWidth = pageWidth
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width

        let heightLeft = imgHeight
        let position = 0

        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight

        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }

        pdf.save(`relatorio_${template.name.replace(/[^a-z0-9_\-\s]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)

        toast.success('Relatório exportado em PDF!')
        await logReportExecutionSafe({
          reportId: template.id,
          reportName: template.name,
          reportType: 'template',
          executedBy: template.createdBy || 'Usuário',
          status: 'success',
          trigger: 'template',
          filters: template.filters,
          totalRecords: filteredAppointments.length,
          recordsProcessed: filteredAppointments.length,
          format: exportFormat,
          executionDuration: Math.round(performance.now() - startedAt),
          metadata: { action: 'export-template-local-pdf' }
        })
        return
      }

      const result = await api.post<{
        data: string
        filename: string
        mimeType: string
      }>('/scheduled-reports/export-template', {
        ...template,
        format: exportFormat,
        exportFormat,
      })

      const bytes = Uint8Array.from(atob(result.data), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast.success(`Relatório exportado em ${exportFormat.toUpperCase()}!`)
      await logReportExecutionSafe({
        reportId: template.id,
        reportName: template.name,
        reportType: 'template',
        executedBy: template.createdBy || 'Usuário',
        status: 'success',
        trigger: 'template',
        filters: template.filters,
        totalRecords: filteredAppointments.length,
        recordsProcessed: filteredAppointments.length,
        format: exportFormat,
        executionDuration: Math.round(performance.now() - startedAt),
        metadata: { action: 'export-template' }
      })
    } catch (error) {
      toast.error('Erro ao exportar relatório')
      console.error(error)
      await logReportExecutionSafe({
        reportId: template.id,
        reportName: template.name,
        reportType: 'template',
        executedBy: template.createdBy || 'Usuário',
        status: 'failed',
        trigger: 'template',
        filters: template.filters,
        totalRecords: filteredAppointments.length,
        recordsProcessed: 0,
        format: exportFormat,
        executionDuration: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : 'Erro ao exportar relatório',
        metadata: { action: 'export-template' }
      })
    } finally {
      setIsExporting(false)
    }
  }

  const enabledColumns = template.columns.filter(col => col.enabled)

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 z-50 bg-background border rounded-lg shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText size={28} weight="duotone" />
              {template.name}
            </h2>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleExport} disabled={isExporting} className="gap-2">
              {(template.exportFormat || 'pdf') === 'pdf' && <FilePdf size={18} />}
              {(template.exportFormat || 'pdf') === 'excel' && <FileXls size={18} />}
              {(template.exportFormat || 'pdf') === 'csv' && <FileCsv size={18} />}
              {(template.exportFormat || 'pdf') === 'json' && <FileCode size={18} />}
              {isExporting
                ? ((template.exportFormat || 'pdf') === 'pdf' ? 'Gerando PDF...' : 'Exportando...')
                : `Exportar ${(template.exportFormat || 'pdf').toUpperCase()}`}
            </Button>
            <Button onClick={onClose} variant="ghost" size="icon">
              <X size={24} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-6">
            <div ref={contentRef} className="space-y-6 bg-background">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo do Relatório</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Registros</p>
                      <p className="text-3xl font-bold">{filteredAppointments.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Grupos</p>
                      <p className="text-3xl font-bold">{Object.keys(groupedData).length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Filtros Aplicados</p>
                      <p className="text-3xl font-bold">{template.filters.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Colunas</p>
                      <p className="text-3xl font-bold">{enabledColumns.length}</p>
                    </div>
                  </div>

                  {template.filters.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Filtros Ativos:</p>
                      <div className="flex flex-wrap gap-2">
                        {template.filters.map((filter, index) => {
                          // Normaliza o label para português (compatibilidade com templates antigos salvos em inglês)
                          let displayLabel = filter.label
                          if (filter.type === 'status') {
                            const ptLabel = STATUS_LABELS[filter.value]
                            if (ptLabel) displayLabel = `Status: ${ptLabel}`
                          } else if (filter.type === 'priority') {
                            const ptLabel = PRIORITY_LABELS[filter.value]
                            if (ptLabel) displayLabel = `Prioridade: ${ptLabel}`
                          }
                          return (
                            <Badge key={index} variant="secondary">
                              {displayLabel}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {template.includeCharts && filteredAppointments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ChartBar size={24} weight="duotone" />
                      Visualizações
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-8">

                    {/* Linha 1: Distribuição por Status + Tipo de CIN */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Status — Barras horizontais */}
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Distribuição por Status</h4>
                        <p className="text-xs text-muted-foreground mb-3">Quantidade de agendamentos por situação</p>
                        <ResponsiveContainer width="100%" height={Math.max(180, statusChartData.length * 42)}>
                          <BarChart data={statusChartData} layout="vertical" barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => [v, 'Qtd']} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                              {statusChartData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Tipo de CIN — Pizza */}
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Distribuição por Tipo de CIN</h4>
                        <p className="text-xs text-muted-foreground mb-3">Proporção entre 1ª via e 2ª via</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={cinTypeChartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="45%"
                              outerRadius={80}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              labelLine={true}
                            >
                              {cinTypeChartData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v, n]} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <Separator />

                    {/* Linha 2: Local de Atendimento */}
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Distribuição por Local de Atendimento</h4>
                      <p className="text-xs text-muted-foreground mb-3">Total de agendamentos por local</p>
                      <ResponsiveContainer width="100%" height={Math.max(160, locationChartData.length * 48)}>
                        <BarChart data={locationChartData} layout="vertical" barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [v, 'Qtd']} />
                          <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={28}>
                            {locationChartData.map((_, i) => (
                              <Cell key={i} fill={['#10b981','#059669','#047857','#065f46','#064e3b'][i % 5]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Linha 3: Agrupamento personalizado (só se groupBy !== 'none') */}
                    {groupChartData.length > 1 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-semibold mb-1">
                            Distribuição por {template.groupBy === 'status' ? 'Status' : template.groupBy === 'location' ? 'Local' : template.groupBy === 'rgType' ? 'Tipo de CIN' : template.groupBy === 'neighborhood' ? 'Bairro' : 'Data'}
                          </h4>
                          <p className="text-xs text-muted-foreground mb-3">Agrupamento configurado no template</p>
                          <ResponsiveContainer width="100%" height={Math.max(160, groupChartData.length * 44)}>
                            <BarChart data={groupChartData} layout="vertical" barCategoryGap="20%">
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v) => [v, 'Qtd']} />
                              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                                {groupChartData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}

                  </CardContent>
                </Card>
              )}

              {Object.entries(groupedData).map(([groupName, groupAppointments]) => (
                <Card key={groupName}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{groupName}</span>
                      <Badge variant="outline">{groupAppointments.length} registro(s)</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            {enabledColumns.map(column => (
                              <TableHead key={column.id} className="whitespace-normal break-words align-top text-sm">
                                {column.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupAppointments.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={enabledColumns.length} className="text-center text-muted-foreground">
                                Nenhum registro encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            groupAppointments.map(appointment => (
                              <TableRow key={appointment.id}>
                                {enabledColumns.map(column => (
                                  <TableCell key={column.id} className="whitespace-normal break-words align-top text-[13px] leading-5">
                                    {String(getCellValue(appointment, column.field as string) ?? '')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
