/**
 * PrintReportPage
 *
 * Página renderizada exclusivamente pelo Puppeteer (CRON / Agendador).
 * Acesso: /print/report?id={scheduledReportId}&cron_token={CRON_PRINT_TOKEN}
 *
 * Replica EXATAMENTE o mesmo layout e lógica de filtros/agrupamento
 * do <ReportTemplateViewer> — o contentRef que html-to-image captura.
 * Quando os dados estão prontos, sinaliza window.reportReady = true
 * para o Puppeteer iniciar o page.pdf().
 */

import { useEffect, useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── Constantes (espelha ReportTemplateViewer) ────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  'awaiting-issuance': 'Aguardando Emissão',
  'cin-ready': 'CIN Pronta',
  'cin-delivered': 'CIN Entregue',
}

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899',
  '#f59e0b', '#10b981', '#06b6d4',
  '#6366f1', '#f43f5e',
]

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface PrintAppointment {
  id: string
  protocol: string
  fullName: string
  cpf: string
  rg?: string
  rgType?: string
  phone: string
  email: string
  gender?: string
  locationId: string
  locationName?: string | null
  street?: string
  number?: string
  neighborhood?: string
  regionType?: string
  regionName?: string
  date: string
  time: string
  status: string
  createdAt: string
  priority?: string
}

interface PrintLocation {
  id: string
  name: string
}

interface TemplatePayload {
  name?: string
  description?: string
  filters?: Array<{ type: string; value: any; label?: string }>
  columns?: Array<{ id: string; label: string; field: string; enabled: boolean }>
  sortBy?: { field: string; order: 'asc' | 'desc' }
  groupBy?: string
  includeCharts?: boolean
  exportFormat?: string
}

// ─── getCellValue (espelha ReportTemplateViewer) ──────────────────────────────

const getCellValue = (
  apt: PrintAppointment,
  field: string,
  locations: PrintLocation[],
): string => {
  switch (field) {
    case 'locationName': {
      const loc = locations.find((l) => l.id === apt.locationId)
      return loc?.name || apt.locationName || '-'
    }
    case 'statusLabel':
      return STATUS_LABELS[apt.status] || apt.status
    case 'priorityLabel':
      return PRIORITY_LABELS[apt.priority || 'normal'] || 'Normal'
    case 'rgTypeLabel':
      return apt.rgType || '-'
    case 'date':
      try { return format(parseISO(apt.date), 'dd/MM/yyyy') } catch { return apt.date || '-' }
    default: {
      const val = (apt as Record<string, any>)[field]
      return val !== undefined && val !== null ? String(val) : '-'
    }
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PrintReportPage() {
  const params    = new URLSearchParams(window.location.search)
  const reportId  = params.get('id')
  const cronToken = params.get('cron_token')

  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg]   = useState('')
  const [template, setTemplate]   = useState<TemplatePayload>({})
  const [appointments, setAppointments] = useState<PrintAppointment[]>([])
  const [locations, setLocations]       = useState<PrintLocation[]>([])

  // ── Busca dados do backend ──────────────────────────────────────────────────
  useEffect(() => {
    if (!reportId || !cronToken) {
      setErrorMsg('Parâmetros ausentes: id e cron_token são obrigatórios')
      setLoadState('error')
      return
    }

    fetch(`/api/scheduled-reports/${reportId}/print-data?cron_token=${encodeURIComponent(cronToken)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Servidor retornou HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setTemplate(data.payload || {})
        setAppointments(data.appointments || [])
        setLocations(data.locations || [])
        setLoadState('ready')
      })
      .catch((e: Error) => {
        setErrorMsg(e.message)
        setLoadState('error')
      })
  }, [])

  // ── Sinaliza Puppeteer após render dos gráficos ─────────────────────────────
  useEffect(() => {
    if (loadState !== 'ready') return
    // 1200 ms para Recharts terminar de animar
    const t = setTimeout(() => { (window as any).reportReady = true }, 1200)
    return () => clearTimeout(t)
  }, [loadState])

  // ── Lógica de filtros (espelha filteredAppointments de ReportTemplateViewer) ─
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments]
    const filters = Array.isArray(template.filters) ? template.filters : []

    const filtersByType: Record<string, any[]> = {}
    filters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = []
      filtersByType[f.type].push(f.value)
    })

    Object.entries(filtersByType).forEach(([type, values]) => {
      switch (type) {
        case 'status':
          filtered = filtered.filter((a) => values.includes(a.status))
          break
        case 'location':
          filtered = filtered.filter((a) => values.includes(a.locationId))
          break
        case 'rgType':
          filtered = filtered.filter((a) => a.rgType != null && values.includes(a.rgType))
          break
        case 'priority':
          filtered = filtered.filter((a) => a.priority != null && values.includes(a.priority))
          break
        case 'neighborhood':
          filtered = filtered.filter((a) =>
            a.neighborhood != null &&
            values.some((v: string) => a.neighborhood!.toLowerCase().includes(v.toLowerCase())),
          )
          break
      }
    })

    if (template.sortBy?.field) {
      const { field, order } = template.sortBy
      filtered.sort((a, b) => {
        const av = (a as Record<string, any>)[field]
        const bv = (b as Record<string, any>)[field]
        if (av === undefined || bv === undefined) return 0
        return order === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    }

    return filtered
  }, [appointments, template])

  // ── Agrupamento (espelha groupedData de ReportTemplateViewer) ───────────────
  const groupedData = useMemo(() => {
    if (!template.groupBy || template.groupBy === 'none') {
      return { Todos: filteredAppointments }
    }

    const groups: Record<string, PrintAppointment[]> = {}
    filteredAppointments.forEach((apt) => {
      let key = ''
      switch (template.groupBy) {
        case 'location': {
          const loc = locations.find((l) => l.id === apt.locationId)
          key = loc?.name || apt.locationName || 'Sem Local'
          break
        }
        case 'neighborhood':
          key = apt.neighborhood || 'Sem Bairro'
          break
        case 'status':
          key = STATUS_LABELS[apt.status] || apt.status
          break
        case 'rgType':
          key = apt.rgType || 'Não Especificado'
          break
        case 'date':
          try { key = format(parseISO(apt.date), 'dd/MM/yyyy') } catch { key = apt.date || 'Sem Data' }
          break
        default:
          key = 'Outros'
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(apt)
    })
    return groups
  }, [filteredAppointments, template.groupBy, locations])

  // ── Dados de gráficos ───────────────────────────────────────────────────────
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAppointments.forEach((a) => {
      const label = STATUS_LABELS[a.status] || a.status
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [filteredAppointments])

  const cinTypeChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAppointments.forEach((a) => {
      const label = a.rgType || 'Não informado'
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [filteredAppointments])

  const locationChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAppointments.forEach((a) => {
      const loc = locations.find((l) => l.id === a.locationId)
      const label = loc?.name || a.locationName || 'Sem local'
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [filteredAppointments, locations])

  const groupChartData = useMemo(() => {
    if (!template.groupBy || template.groupBy === 'none') return []
    return Object.entries(groupedData)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, apts]) => ({ name: key, value: apts.length }))
  }, [groupedData, template.groupBy])

  // ── Colunas habilitadas ─────────────────────────────────────────────────────
  const enabledColumns = useMemo(
    () => (Array.isArray(template.columns) ? template.columns.filter((c) => c.enabled) : []),
    [template.columns],
  )

  // ── Estados de carregamento ─────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#6b7280' }}>
        <p>Carregando relatório…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#ef4444' }}>
        <p>Erro: {errorMsg}</p>
      </div>
    )
  }

  const filters = Array.isArray(template.filters) ? template.filters : []
  const groupByLabel: Record<string, string> = {
    status: 'Status', location: 'Local', rgType: 'Tipo de CIN',
    neighborhood: 'Bairro', date: 'Data',
  }

  // ── Render: idêntico ao contentRef do ReportTemplateViewer ─────────────────
  return (
    <div
      className="space-y-6 bg-background p-6"
      style={{ minWidth: '900px', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Resumo */}
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
              <p className="text-3xl font-bold">{filters.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Colunas</p>
              <p className="text-3xl font-bold">{enabledColumns.length}</p>
            </div>
          </div>
          {filters.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Filtros Ativos:</p>
              <div className="flex flex-wrap gap-2">
                {filters.map((filter, i) => {
                  let displayLabel = filter.label
                  if (filter.type === 'status') {
                    const pt = STATUS_LABELS[filter.value]
                    if (pt) displayLabel = `Status: ${pt}`
                  } else if (filter.type === 'priority') {
                    const pt = PRIORITY_LABELS[filter.value]
                    if (pt) displayLabel = `Prioridade: ${pt}`
                  }
                  return <Badge key={i} variant="secondary">{displayLabel}</Badge>
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos */}
      {template.includeCharts && filteredAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visualizações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              {/* Status — barras horizontais */}
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
                      {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tipo de CIN — pizza */}
              <div>
                <h4 className="text-sm font-semibold mb-1">Distribuição por Tipo de CIN</h4>
                <p className="text-xs text-muted-foreground mb-3">Proporção entre 1ª via e 2ª via</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={cinTypeChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="45%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine
                    >
                      {cinTypeChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Separator />

            {/* Local de Atendimento */}
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

            {/* Agrupamento personalizado */}
            {groupChartData.length > 1 && template.groupBy && template.groupBy !== 'none' && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-1">
                    Distribuição por {groupByLabel[template.groupBy] || template.groupBy}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">Agrupamento configurado no template</p>
                  <ResponsiveContainer width="100%" height={Math.max(160, groupChartData.length * 44)}>
                    <BarChart data={groupChartData} layout="vertical" barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [v, 'Qtd']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {groupChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabelas por grupo */}
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
                    {enabledColumns.map((col) => (
                      <TableHead key={col.id} className="whitespace-normal break-words align-top text-sm">
                        {col.label}
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
                    groupAppointments.map((apt) => (
                      <TableRow key={apt.id}>
                        {enabledColumns.map((col) => (
                          <TableCell key={col.id} className="whitespace-normal break-words align-top text-[13px] leading-5">
                            {getCellValue(apt, col.field, locations)}
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
  )
}
