import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  ClockClockwise, 
  CheckCircle, 
  XCircle, 
  Warning, 
  MagnifyingGlass,
  FunnelSimple,
  Download,
  Eye,
  CalendarBlank,
  Timer,
  FileText,
  User,
  Envelope,
  ChartBar,
  ArrowsClockwise,
  Info,
} from '@phosphor-icons/react'
import type { ReportExecutionLog } from '@/lib/types'
import { toFirstAndSecondName } from '@/lib/name-utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ReportExecutionHistoryProps {
  executionLogs: ReportExecutionLog[]
  onViewDetails?: (log: ReportExecutionLog) => void
  onDownloadReport?: (log: ReportExecutionLog) => void
  onRefresh?: () => void
  onClearHistory?: () => Promise<void> | void
}

export function ReportExecutionHistory({
  executionLogs,
  onViewDetails,
  onDownloadReport,
  onRefresh,
  onClearHistory
}: ReportExecutionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [triggerFilter, setTriggerFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<ReportExecutionLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const statusAllowed = (status: string) => status === 'success' || status === 'failed'

  const visibleLogs = useMemo(
    () => executionLogs.filter((log) => statusAllowed(log.status)),
    [executionLogs]
  )

  const normalizeType = (reportType: string): 'scheduled' | 'export' => {
    return reportType === 'scheduled' ? 'scheduled' : 'export'
  }

  const normalizeTrigger = (trigger: string): 'manual' | 'scheduled' => {
    return trigger === 'scheduled' ? 'scheduled' : 'manual'
  }

  const filteredLogs = useMemo(() => {
    return visibleLogs.filter(log => {
      const sourceLabel =
        log.source === 'agendamento'
          ? 'agendamento'
          : log.source === 'template'
            ? 'template'
            : log.source === 'analytics'
              ? 'analytics'
              : log.source === 'importacao_exportacao'
                ? 'importar exportar'
                : log.source === 'sistema'
                  ? 'sistema'
                  : ''

      const matchesSearch = 
        log.reportName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        toFirstAndSecondName(log.executedBy).toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.executedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sourceLabel.includes(searchTerm.toLowerCase())

      const matchesDate =
        dateFilter === '' ||
        format(parseISO(log.executedAt), 'yyyy-MM-dd') === dateFilter

      const matchesStatus = statusFilter === 'all' || log.status === statusFilter
      const matchesType = typeFilter === 'all' || normalizeType(log.reportType) === typeFilter
      const matchesTrigger = triggerFilter === 'all' || normalizeTrigger(log.trigger) === triggerFilter

      return matchesSearch && matchesDate && matchesStatus && matchesType && matchesTrigger
    }).sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
  }, [visibleLogs, searchTerm, dateFilter, statusFilter, typeFilter, triggerFilter])

  const stats = useMemo(() => {
    const total = visibleLogs.length
    const success = visibleLogs.filter(log => log.status === 'success').length
    const failed = visibleLogs.filter(log => log.status === 'failed').length
    const avgDuration = visibleLogs.reduce((acc, log) => acc + log.executionDuration, 0) / (total || 1)
    const totalRecords = visibleLogs.reduce((acc, log) => acc + log.totalRecords, 0)

    return { total, success, failed, avgDuration, totalRecords }
  }, [visibleLogs])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} weight="fill" className="text-green-600" />
      case 'failed':
        return <XCircle size={20} weight="fill" className="text-red-600" />
      case 'partial':
        return <Warning size={20} weight="fill" className="text-yellow-600" />
      case 'cancelled':
        return <XCircle size={20} weight="fill" className="text-gray-600" />
      default:
        return <Info size={20} weight="fill" className="text-blue-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      success: { label: 'Sucesso', className: 'bg-green-100 text-green-800 border-green-300' },
      failed: { label: 'Falhou', className: 'bg-red-100 text-red-800 border-red-300' },
      partial: { label: 'Parcial', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800 border-gray-300' }
    }

    const variant = variants[status] || variants.success
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    )
  }

  const getTriggerBadge = (trigger: string) => {
    const normalizedTrigger = normalizeTrigger(trigger)
    const variants: Record<string, { label: string; className: string }> = {
      manual: { label: 'Manual', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      scheduled: { label: 'Agendado', className: 'bg-purple-100 text-purple-800 border-purple-300' }
    }

    const variant = variants[normalizedTrigger] || variants.manual
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const normalizedType = normalizeType(type)
    const variants: Record<string, { label: string; className: string }> = {
      scheduled: { label: 'Agendado', className: 'bg-purple-50 text-purple-700' },
      export: { label: 'Exportação', className: 'bg-green-50 text-green-700' }
    }

    const variant = variants[normalizedType] || { label: normalizedType, className: 'bg-gray-50 text-gray-700' }
    return (
      <Badge variant="secondary" className={variant.className}>
        {variant.label}
      </Badge>
    )
  }

  const getSourceBadge = (source?: string, reportType?: string) => {
    const normalizedSource =
      source ||
      (reportType === 'scheduled'
        ? 'agendamento'
        : reportType === 'template'
          ? 'template'
          : reportType === 'export'
            ? 'importacao_exportacao'
            : 'analytics')

    const variants: Record<string, { label: string; className: string }> = {
      agendamento: { label: 'Agendamento', className: 'bg-purple-100 text-purple-800 border-purple-300' },
      template: { label: 'Template', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
      analytics: { label: 'Analytics', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      importacao_exportacao: { label: 'Importar/Exportar', className: 'bg-green-100 text-green-800 border-green-300' },
      sistema: { label: 'Sistema', className: 'bg-gray-100 text-gray-800 border-gray-300' }
    }

    const variant = variants[normalizedSource] || { label: normalizedSource, className: 'bg-gray-100 text-gray-800 border-gray-300' }
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    )
  }

  const formatDuration = (milliseconds: number) => {
    const formatWithMaxTwoDecimals = (value: number) =>
      new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)

    if (milliseconds < 1000) return `${formatWithMaxTwoDecimals(milliseconds)}ms`
    if (milliseconds < 60000) return `${formatWithMaxTwoDecimals(milliseconds / 1000)}s`

    const minutes = Math.floor(milliseconds / 60000)
    const seconds = (milliseconds % 60000) / 1000

    if (seconds === 0) return `${minutes}m`
    return `${minutes}m ${formatWithMaxTwoDecimals(seconds)}s`
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleViewDetails = (log: ReportExecutionLog) => {
    setSelectedLog(log)
    setDetailsOpen(true)
    if (onViewDetails) onViewDetails(log)
  }

  const handleClearHistory = async () => {
    if (!onClearHistory || isClearingHistory) return

    try {
      setIsClearingHistory(true)
      await onClearHistory()
      onRefresh?.()
    } finally {
      setIsClearingHistory(false)
      setClearDialogOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Execuções</CardTitle>
              <ChartBar size={20} className="text-blue-600" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalRecords.toLocaleString('pt-BR')} registros processados
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bem-sucedidas</CardTitle>
              <CheckCircle size={20} className="text-green-600" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.success}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : 0}% de sucesso
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Falhadas</CardTitle>
              <XCircle size={20} className="text-red-600" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : 0}% de falhas
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Duração Média</CardTitle>
              <Timer size={20} className="text-purple-600" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {formatDuration(stats.avgDuration)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tempo médio de processamento
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClockClockwise size={24} weight="duotone" className="text-primary" />
                Histórico de Execuções
              </CardTitle>
              <CardDescription>
                Visualize todos os logs de execução de relatórios do sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2 xl:col-span-4">
                  <div className="relative">
                    <MagnifyingGlass
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      placeholder="Buscar por nome, usuário ou ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full xl:col-span-2"
                />

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full xl:col-span-2">
                    <FunnelSimple size={16} className="mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                        <span>Todos Status</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} weight="fill" className="text-green-600" />
                        <span>Sucesso</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="failed">
                      <div className="flex items-center gap-2">
                        <XCircle size={14} weight="fill" className="text-red-600" />
                        <span>Falhou</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full xl:col-span-2">
                    <FileText size={16} className="mr-2" />
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Tipos</SelectItem>
                    <SelectItem value="scheduled">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>Agendado</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="export">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>Exportação</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={triggerFilter} onValueChange={setTriggerFilter}>
                  <SelectTrigger className="w-full xl:col-span-2">
                    <ArrowsClockwise size={16} className="mr-2" />
                    <SelectValue placeholder="Gatilho" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Gatilhos</SelectItem>
                    <SelectItem value="manual">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-blue-600" />
                        <span>Manual</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="scheduled">
                      <div className="flex items-center gap-2">
                        <Timer size={14} className="text-purple-600" />
                        <span>Agendado</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="md:col-span-2 xl:col-span-12 flex flex-wrap justify-end gap-2">
                  {(searchTerm || dateFilter || statusFilter !== 'all' || typeFilter !== 'all' || triggerFilter !== 'all') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm('')
                        setDateFilter('')
                        setStatusFilter('all')
                        setTypeFilter('all')
                        setTriggerFilter('all')
                      }}
                      className="gap-2"
                    >
                      <XCircle size={16} />
                      Limpar Filtros
                    </Button>
                  )}

                  {onClearHistory && (
                    <Button
                      variant="destructive"
                      onClick={() => setClearDialogOpen(true)}
                      disabled={isClearingHistory}
                    >
                      {isClearingHistory ? 'Limpando...' : 'Limpar Histórico'}
                    </Button>
                  )}
                </div>
              </div>

              {(searchTerm || dateFilter || statusFilter !== 'all' || typeFilter !== 'all' || triggerFilter !== 'all') && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-muted-foreground font-medium">Filtros ativos:</span>
                  {searchTerm && (
                    <Badge variant="secondary" className="gap-2">
                      <MagnifyingGlass size={12} />
                      "{searchTerm}"
                      <button
                        onClick={() => setSearchTerm('')}
                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                      >
                        <XCircle size={12} weight="fill" />
                      </button>
                    </Badge>
                  )}
                  {dateFilter && (
                    <Badge variant="secondary" className="gap-2">
                      Data: {format(parseISO(`${dateFilter}T00:00:00`), 'dd/MM/yyyy', { locale: ptBR })}
                      <button
                        onClick={() => setDateFilter('')}
                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                      >
                        <XCircle size={12} weight="fill" />
                      </button>
                    </Badge>
                  )}
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-2">
                      Status: {statusFilter === 'success' ? 'Sucesso' : 'Falhou'}
                      <button
                        onClick={() => setStatusFilter('all')}
                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                      >
                        <XCircle size={12} weight="fill" />
                      </button>
                    </Badge>
                  )}
                  {typeFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-2">
                      Tipo: {typeFilter === 'scheduled' ? 'Agendado' : 'Exportação'}
                      <button
                        onClick={() => setTypeFilter('all')}
                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                      >
                        <XCircle size={12} weight="fill" />
                      </button>
                    </Badge>
                  )}
                  {triggerFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-2">
                      Gatilho: {triggerFilter === 'manual' ? 'Manual' : 'Agendado'}
                      <button
                        onClick={() => setTriggerFilter('all')}
                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                      >
                        <XCircle size={12} weight="fill" />
                      </button>
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    • {filteredLogs.length} {filteredLogs.length === 1 ? 'resultado' : 'resultados'}
                  </span>
                </div>
              )}
            </div>

            {filteredLogs.length === 0 ? (
              <Alert>
                <Info size={18} />
                <AlertDescription>
                  <div className="space-y-3">
                    <p>
                      {visibleLogs.length === 0
                        ? 'Nenhuma execução de relatório registrada ainda.'
                        : 'Nenhum resultado encontrado com os filtros aplicados.'}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="border rounded-lg">
                <div className="h-[600px] overflow-auto">
                  <Table className="w-full table-fixed text-xs [&_th]:whitespace-normal [&_td]:whitespace-normal">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[84px]">Status</TableHead>
                        <TableHead className="w-[180px]">Nome do Relatório</TableHead>
                        <TableHead className="w-[84px]">Tipo</TableHead>
                        <TableHead className="w-[108px]">Origem</TableHead>
                        <TableHead className="w-[84px]">Gatilho</TableHead>
                        <TableHead className="w-[150px]">Executado Por</TableHead>
                        <TableHead className="w-[116px]">Data/Hora</TableHead>
                        <TableHead className="w-[72px]">Duração</TableHead>
                        <TableHead className="w-[72px]">Registros</TableHead>
                        <TableHead className="w-[72px]">Formato</TableHead>
                        <TableHead className="text-right whitespace-nowrap w-[72px] pr-2">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(log.status)}
                              {getStatusBadge(log.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium truncate">{log.reportName}</div>
                            <div className="text-[10px] text-muted-foreground truncate">ID: {log.id.slice(0, 8)}...</div>
                          </TableCell>
                          <TableCell>{getTypeBadge(log.reportType)}</TableCell>
                          <TableCell>{getSourceBadge(log.source, log.reportType)}</TableCell>
                          <TableCell>{getTriggerBadge(log.trigger)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User size={14} className="text-muted-foreground" />
                              <span className="text-sm truncate">{toFirstAndSecondName(log.executedBy)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CalendarBlank size={14} className="text-muted-foreground" />
                              <div className="text-sm">
                                <div>{format(parseISO(log.executedAt), 'dd/MM/yyyy', { locale: ptBR })}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(parseISO(log.executedAt), 'HH:mm:ss')}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Timer size={14} className="text-muted-foreground" />
                              <span className="text-sm">{formatDuration(log.executionDuration)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {log.recordsProcessed} / {log.totalRecords}
                            </div>
                            {log.totalRecords > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {((log.recordsProcessed / log.totalRecords) * 100).toFixed(0)}%
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase">
                              {log.format}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right w-[72px] pr-2">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetails(log)}
                              >
                                <Eye size={16} />
                              </Button>
                              {log.status === 'success' && log.filePath && onDownloadReport && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onDownloadReport(log)}
                                >
                                  <Download size={16} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar histórico de execuções?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá todos os registros do histórico e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingHistory}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              disabled={isClearingHistory}
            >
              {isClearingHistory ? 'Limpando...' : 'Confirmar limpeza'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={24} weight="duotone" className="text-primary" />
              Detalhes da Execução
            </DialogTitle>
            <DialogDescription>
              Informações completas sobre a execução do relatório
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedLog.status)}
                      {getStatusBadge(selectedLog.status)}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID da Execução</label>
                  <div className="mt-1 font-mono text-sm">{selectedLog.id}</div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText size={18} weight="duotone" />
                  Informações do Relatório
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nome</label>
                    <div className="mt-1 font-medium">{selectedLog.reportName}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                    <div className="mt-1">{getTypeBadge(selectedLog.reportType)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Origem</label>
                    <div className="mt-1">{getSourceBadge(selectedLog.source, selectedLog.reportType)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Formato</label>
                    <div className="mt-1">
                      <Badge variant="outline" className="uppercase">{selectedLog.format}</Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tamanho do Arquivo</label>
                    <div className="mt-1">{formatFileSize(selectedLog.fileSize)}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <User size={18} weight="duotone" />
                  Informações de Execução
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Executado Por</label>
                    <div className="mt-1 font-medium">{toFirstAndSecondName(selectedLog.executedBy)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gatilho</label>
                    <div className="mt-1">{getTriggerBadge(selectedLog.trigger)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                    <div className="mt-1">
                      {format(parseISO(selectedLog.executedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Duração</label>
                    <div className="mt-1 font-medium text-purple-600">
                      {formatDuration(selectedLog.executionDuration)}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ChartBar size={18} weight="duotone" />
                  Estatísticas de Processamento
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total de Registros</label>
                    <div className="mt-1 text-2xl font-bold text-blue-600">
                      {selectedLog.totalRecords.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Registros Processados</label>
                    <div className="mt-1 text-2xl font-bold text-green-600">
                      {selectedLog.recordsProcessed.toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
                {selectedLog.totalRecords > 0 && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-500"
                        style={{
                          width: `${(selectedLog.recordsProcessed / selectedLog.totalRecords) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {((selectedLog.recordsProcessed / selectedLog.totalRecords) * 100).toFixed(1)}% processado
                    </p>
                  </div>
                )}
              </div>

              {selectedLog.deliveryMethod && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Envelope size={18} weight="duotone" />
                      Informações de Entrega
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Método de Entrega</label>
                        <div className="mt-1 capitalize">{selectedLog.deliveryMethod}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Destinatários</label>
                        <div className="mt-1">{selectedLog.recipients?.length || 0}</div>
                      </div>
                      {selectedLog.emailsSent !== undefined && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Emails Enviados</label>
                            <div className="mt-1 text-green-600 font-medium">{selectedLog.emailsSent}</div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Emails Falhados</label>
                            <div className="mt-1 text-red-600 font-medium">{selectedLog.emailsFailed || 0}</div>
                          </div>
                        </>
                      )}
                    </div>
                    {selectedLog.recipients && selectedLog.recipients.length > 0 && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Destinatários:</p>
                        <div className="space-y-1">
                          {selectedLog.recipients.map((recipient, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <Envelope size={14} className="text-muted-foreground" />
                              <span>{recipient.name}</span>
                              <span className="text-muted-foreground">({recipient.email})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedLog.filters && selectedLog.filters.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FunnelSimple size={18} weight="duotone" />
                      Filtros Aplicados
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedLog.filters.map((filter, idx) => (
                        <Badge key={idx} variant="secondary">
                          {filter.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedLog.error && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-600">
                      <XCircle size={18} weight="duotone" />
                      Erro
                    </h4>
                    <Alert variant="destructive">
                      <AlertDescription>
                        <div className="font-medium mb-2">{selectedLog.error}</div>
                        {selectedLog.errorDetails && (
                          <div className="text-sm font-mono bg-red-950/20 p-3 rounded mt-2 overflow-x-auto">
                            {selectedLog.errorDetails}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>
                </>
              )}

              {selectedLog.warnings && selectedLog.warnings.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-yellow-600">
                      <Warning size={18} weight="duotone" />
                      Avisos
                    </h4>
                    <div className="space-y-2">
                      {selectedLog.warnings.map((warning, idx) => (
                        <Alert key={idx}>
                          <Warning size={16} />
                          <AlertDescription>{warning}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Info size={18} weight="duotone" />
                      Metadados Adicionais
                    </h4>
                    <div className="p-3 bg-muted rounded-lg font-mono text-xs overflow-x-auto">
                      <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
