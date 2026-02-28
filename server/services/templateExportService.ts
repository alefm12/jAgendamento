/**
 * templateExportService
 *
 * ÚNICA fonte da verdade para geração de arquivos de relatório.
 * Utilizado tanto pelo botão "Exportar" da aba Templates (via rota HTTP)
 * quanto pelo Agendador de e-mails (scheduledReportRunner).
 *
 * Formatos suportados: pdf | xlsx | csv | json
 *
 * API pública:
 *   buildTemplateExportFromPayload(payload, fallbackName?)
 *     → { buffer, filename, mimeType, htmlContent, reportName, reportFormat, stats }
 */

import * as XLSX from 'xlsx'
import puppeteer from 'puppeteer'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { pool } from '../config/db'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExportRow = string[]

export type TemplateFilter  = { type?: string; value?: any; label?: string }
export type TemplateColumn  = { id?: string; label?: string; field?: string; enabled?: boolean }

export type TemplateAppointment = {
  id: string
  protocol: string
  fullName: string
  name: string
  cpf: string
  rg: string
  rgType: string
  phone: string
  email: string
  gender: string
  date: string
  time: string
  status: string
  locationId: string
  locationName: string
  locationAddress: string | null
  street: string
  number: string
  neighborhood: string
  regionType: string
  regionName: string
  createdAt: string
  priority: string
}

export type ExportResult = {
  buffer: Buffer
  filename: string
  mimeType: string
  htmlContent: string
  reportName: string
  reportFormat: string
  stats: { total: number; today: number; thisMonth: number; byStatus: Record<string, number> }
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:             'Pendente',
  confirmed:           'Confirmado',
  completed:           'Concluído',
  cancelled:           'Cancelado',
  'awaiting-issuance': 'Aguardando Emissão',
  'cin-ready':         'CIN Pronto',
  'cin-delivered':     'CIN Entregue',
}

const statusLabel = (s: string) => STATUS_LABELS[s] || s

const PRIORITY_LABELS: Record<string, string> = {
  normal:  'Normal',
  high:    'Alta',
  urgent:  'Urgente',
}

// ─── Normalização de linhas do banco ─────────────────────────────────────────

const asIsoDate = (value: any): string => {
  if (value instanceof Date) return value.toISOString().split('T')[0]
  return String(value || '').split('T')[0]
}

export const toTemplateAppointment = (r: any): TemplateAppointment => ({
  id:              String(r.id || ''),
  protocol:        r.protocolo || '',
  fullName:        r.cidadao_nome || '',
  name:            r.cidadao_nome || '',
  cpf:             r.cidadao_cpf || '',
  rg:              '',
  rgType:          r.tipo_cin || '',
  phone:           r.telefone || '',
  email:           r.email || '',
  gender:          r.genero || '',
  date:            asIsoDate(r.data_agendamento),
  time:            r.hora_agendamento ? String(r.hora_agendamento).substring(0, 5) : '',
  status:          r.status || '',
  locationId:      r.local_id != null ? String(r.local_id) : '',
  locationName:    r.local_nome || '',
  locationAddress: null,
  street:          r.endereco_rua || '',
  number:          r.endereco_numero || '',
  neighborhood:    r.bairro_nome || '',
  regionType:      r.regiao_tipo || '',
  regionName:      r.regiao_nome || '',
  createdAt:       r.criado_em instanceof Date ? r.criado_em.toISOString() : new Date().toISOString(),
  priority:        r.prioridade || 'normal',
})

// ─── Filtros e ordenação (espelha o filteredAppointments do ReportTemplateViewer) ─

export const applyTemplateFiltersAndSort = (
  rows: TemplateAppointment[],
  payload: any,
): TemplateAppointment[] => {
  let filtered = [...rows]
  const filters: TemplateFilter[] = Array.isArray(payload?.filters) ? payload.filters : []

  // Agrupa filtros por tipo → OR dentro do mesmo tipo, AND entre tipos diferentes
  const filtersByType: Record<string, any[]> = {}
  for (const f of filters) {
    const type = String(f?.type || '')
    if (!type) continue
    if (!filtersByType[type]) filtersByType[type] = []
    filtersByType[type].push(f?.value)
  }

  for (const [type, values] of Object.entries(filtersByType)) {
    switch (type) {
      case 'status':
        filtered = filtered.filter((a) => values.includes(a.status))
        break
      case 'location':
        filtered = filtered.filter((a) => values.includes(a.locationId))
        break
      case 'rgType':
        filtered = filtered.filter((a) => a.rgType && values.includes(a.rgType))
        break
      case 'priority':
        filtered = filtered.filter((a) => a.priority && values.includes(a.priority))
        break
      case 'neighborhood':
        filtered = filtered.filter((a) =>
          a.neighborhood &&
          values.some((v) => a.neighborhood.toLowerCase().includes(String(v || '').toLowerCase())),
        )
        break
    }
  }

  if (payload?.sortBy?.field) {
    const field = String(payload.sortBy.field)
    const asc   = payload.sortBy.order !== 'desc'
    filtered.sort((a: any, b: any) => {
      const av = a[field], bv = b[field]
      if (av === undefined || bv === undefined) return 0
      return asc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }

  return filtered
}

// ─── Construtores de linhas para CSV / Excel ──────────────────────────────────

const buildCsvRows = (rows: TemplateAppointment[]) => {
  const headers = [
    'Protocolo', 'Nome Completo', 'CPF', 'CIN', 'Tipo de CIN',
    'Telefone', 'Email', 'Data', 'Horário', 'Status',
    'Local', 'Endereço', 'Bairro', 'Prioridade', 'Criado em',
  ]
  const data: ExportRow[] = rows.map((a) => [
    a.protocol,
    a.fullName,
    a.cpf,
    a.rg || '',
    a.rgType || 'Não informado',
    a.phone,
    a.email,
    a.date ? format(new Date(a.date + 'T12:00:00'), 'dd/MM/yyyy') : '',
    a.time,
    statusLabel(a.status),
    a.locationName || '',
    `${a.street || ''} ${a.number || ''}`.trim(),
    a.neighborhood || '',
    PRIORITY_LABELS[a.priority || 'normal'] || 'Normal',
    a.createdAt ? format(new Date(a.createdAt), 'dd/MM/yyyy HH:mm') : '',
  ])
  return { headers, data }
}

const buildExcelRows = (rows: TemplateAppointment[]) => {
  const headers = [
    'Data', 'Hora', 'Nome Completo', 'CPF', 'Status', 'Local de Atendimento',
    'Tipo de CIN', 'Gênero', 'Telefone', 'Email', 'Protocolo',
    'Região / Distrito', 'Logradouro', 'Número', 'Bairro / Comunidade',
  ]
  const data: ExportRow[] = rows.map((a) => [
    a.date ? format(new Date(a.date + 'T12:00:00'), 'dd/MM/yyyy') : '',
    a.time,
    a.fullName,
    a.cpf,
    statusLabel(a.status),
    a.locationName || '',
    a.rgType || '',
    a.gender || '',
    a.phone,
    a.email,
    a.protocol,
    [a.regionName, a.regionType].filter(Boolean).join(' - '),
    a.street || '',
    a.number || '',
    a.neighborhood || '',
  ])
  return { headers, data }
}

// ─── Resolução de célula (espelha getCellValue do ReportTemplateViewer) ───────

const getCellValue = (a: TemplateAppointment, field: string): string => {
  switch (field) {
    case 'locationName':  return a.locationName || '-'
    case 'statusLabel':   return statusLabel(a.status)
    case 'priorityLabel': return PRIORITY_LABELS[a.priority || 'normal'] || 'Normal'
    case 'rgTypeLabel':   return a.rgType || '-'
    case 'date':          return a.date ? format(new Date(a.date + 'T12:00:00'), 'dd/MM/yyyy') : '-'
    default:              return String((a as any)[field] ?? '-')
  }
}

const htmlEscape = (v: any) =>
  String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')

// ─── Construtor HTML para PDF (Puppeteer) ─────────────────────────────────────

const buildTemplatePdfHtml = (
  payload: any,
  rows: TemplateAppointment[],
  enabledColumns: TemplateColumn[],
): string => {
  const filters: TemplateFilter[] = Array.isArray(payload?.filters) ? payload.filters : []

  const filterBadges = filters
    .map((f) => `<span class="badge">${htmlEscape(f.label || `${f.type}: ${f.value}`)}</span>`)
    .join('')

  // ─ Métricas por dimensão ─
  const byStatus   = rows.reduce((acc: Record<string,number>, r) => { const l = statusLabel(r.status); acc[l] = (acc[l]||0)+1; return acc }, {})
  const byCin      = rows.reduce((acc: Record<string,number>, r) => { const l = r.rgType || 'Não informado'; acc[l] = (acc[l]||0)+1; return acc }, {})
  const byLocation = rows.reduce((acc: Record<string,number>, r) => { const l = r.locationName || 'Sem Local'; acc[l] = (acc[l]||0)+1; return acc }, {})

  const total       = rows.length
  const maxStatus   = Math.max(1, ...Object.values(byStatus))
  const maxLocation = Math.max(1, ...Object.values(byLocation))

  const bar = (name: string, value: number, max: number, cls: string) => {
    const w = Math.max(3, Math.round((value / max) * 100))
    return `<div class="bar-row"><span>${htmlEscape(name)}</span><div class="bar"><div class="fill ${cls}" style="width:${w}%"></div></div><strong>${value}</strong></div>`
  }
  const pctBar = (name: string, value: number, cls: string) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0
    return `<div class="bar-row"><span>${htmlEscape(name)}</span><div class="bar"><div class="fill ${cls}" style="width:${Math.max(3,pct)}%"></div></div><strong>${pct}%</strong></div>`
  }

  const statusBars   = Object.entries(byStatus).map(([n,v])   => bar(n,v,maxStatus,'blue')).join('')   || '<div class="empty">Sem dados</div>'
  const cinRows      = Object.entries(byCin).map(([n,v])      => pctBar(n,v,'purple')).join('')        || '<div class="empty">Sem dados</div>'
  const locationBars = Object.entries(byLocation).map(([n,v]) => bar(n,v,maxLocation,'green')).join('')|| '<div class="empty">Sem dados</div>'

  // ─ Colunas ─
  const columns = enabledColumns.length > 0 ? enabledColumns : [
    { label:'Protocolo',    field:'protocol'     },
    { label:'Nome Completo',field:'fullName'      },
    { label:'CPF',          field:'cpf'           },
    { label:'Data',         field:'date'          },
    { label:'Horário',      field:'time'          },
    { label:'Status',       field:'statusLabel'   },
    { label:'Local',        field:'locationName'  },
  ]
  const thead   = columns.map((c)  => `<th>${htmlEscape(c.label||c.field||'')}</th>`).join('')
  const rowsHtml = rows.slice(0,40).map((r) =>
    `<tr>${columns.map((c) => `<td>${htmlEscape(getCellValue(r,String(c.field||'')))}</td>`).join('')}</tr>`
  ).join('') || `<tr><td colspan="${columns.length}">Nenhum registro encontrado</td></tr>`

  // ─ Contagem de grupos ─
  const groupBy = String(payload?.groupBy || 'none')
  const groupsCount = (() => {
    if (groupBy === 'none') return 1
    const s = new Set<string>()
    for (const r of rows) {
      if      (groupBy === 'location')     s.add(r.locationName || 'Sem Local')
      else if (groupBy === 'neighborhood') s.add(r.neighborhood || 'Sem Bairro')
      else if (groupBy === 'status')       s.add(statusLabel(r.status))
      else if (groupBy === 'rgType')       s.add(r.rgType || 'Não Especificado')
      else if (groupBy === 'date')         s.add(r.date ? format(new Date(r.date+'T12:00:00'),'dd/MM/yyyy') : 'Sem Data')
      else                                 s.add('Outros')
    }
    return Math.max(1, s.size)
  })()

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#fff;margin:0;padding:20px;color:#111827}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .label{color:#6b7280;font-size:13px}
    .value{font-size:36px;font-weight:900;line-height:1;margin-top:4px}
    .badges{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
    .badge{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700}
    .charts{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .chart-title{font-size:16px;font-weight:700;margin-bottom:8px}
    .bar-row{display:grid;grid-template-columns:220px 1fr 60px;gap:10px;align-items:center;margin:8px 0;font-size:13px}
    .bar{height:14px;background:#e5e7eb;border-radius:999px;overflow:hidden}
    .fill{height:100%;border-radius:999px}
    .fill.blue{background:#3b82f6}.fill.purple{background:#8b5cf6}.fill.green{background:#10b981}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left}
    th{background:#f3f4f6;font-weight:700}
    .empty{color:#9ca3af;font-size:13px;margin-top:6px}
    .meta{margin-top:8px;color:#6b7280;font-size:12px}
  </style>
</head>
<body>
  <div class="card">
    <h3 style="margin:0 0 12px;font-size:20px">Resumo do Relatório</h3>
    <div class="summary">
      <div><div class="label">Total de Registros</div><div class="value">${rows.length}</div></div>
      <div><div class="label">Grupos</div><div class="value">${groupsCount}</div></div>
      <div><div class="label">Filtros Aplicados</div><div class="value">${filters.length}</div></div>
      <div><div class="label">Colunas</div><div class="value">${columns.length}</div></div>
    </div>
    ${filters.length > 0 ? `<div class="badges">${filterBadges}</div>` : ''}
  </div>

  <div class="card">
    <h3 style="margin:0 0 12px;font-size:20px">Visualizações</h3>
    <div class="charts">
      <div><div class="chart-title">Distribuição por Status</div>${statusBars}</div>
      <div><div class="chart-title">Distribuição por Tipo de CIN</div>${cinRows}</div>
    </div>
    <div style="margin-top:14px">
      <div class="chart-title">Distribuição por Local de Atendimento</div>${locationBars}
    </div>
  </div>

  <div class="card">
    <h3 style="margin:0 0 10px;font-size:20px">Dados dos Agendamentos</h3>
    <table>
      <thead><tr>${thead}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${rows.length > 40 ? `<div class="meta">+ ${rows.length - 40} registros adicionais</div>` : ''}
  </div>
</body>
</html>`
}

// ─── Corpo do e-mail (preview + estatísticas) ─────────────────────────────────

const buildEmailHtml = (
  reportName: string,
  stats: { total: number; today: number; thisMonth: number; byStatus: Record<string,number> },
  periodLabel: string,
  generatedAt: string,
  headers: string[],
  data: ExportRow[],
): string => {
  const statusRows = Object.entries(stats.byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;color:#374151">${statusLabel(s)}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700">${n}</td>
    </tr>`).join('')

  const previewRows = data.slice(0, 20).map((row) =>
    `<tr>${row.map((c) => `<td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;white-space:nowrap">${c}</td>`).join('')}</tr>`
  ).join('')

  const moreRows = data.length > 20
    ? `<tr><td colspan="${headers.length}" style="padding:8px 10px;font-size:11px;color:#9ca3af;text-align:center">+ ${data.length - 20} registro(s) adicionais no arquivo anexo</td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>${reportName}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;margin:0;padding:24px">
  <div style="max-width:900px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#009639,#00b844);padding:28px 32px">
      <h1 style="color:#fff;margin:0 0 6px;font-size:22px;font-weight:800">${reportName}</h1>
      <p style="color:#d1fae5;margin:0;font-size:13px">Período de referência: ${periodLabel}</p>
    </div>
    <div style="padding:32px">
      <div style="display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap">
        <div style="flex:1;min-width:110px;background:#f0fdf4;border-left:4px solid #009639;border-radius:6px;padding:14px 16px">
          <div style="font-size:30px;font-weight:900;color:#009639">${stats.total}</div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase">Total Geral</div>
        </div>
        <div style="flex:1;min-width:110px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 16px">
          <div style="font-size:30px;font-weight:900;color:#3b82f6">${stats.today}</div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase">Hoje</div>
        </div>
        <div style="flex:1;min-width:110px;background:#fefce8;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px">
          <div style="font-size:30px;font-weight:900;color:#f59e0b">${stats.thisMonth}</div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase">Este Mês</div>
        </div>
      </div>
      <h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 10px;text-transform:uppercase">Distribuição por Status</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
        <thead><tr style="background:#f9fafb">
          <th style="padding:8px 14px;text-align:left;font-size:12px;text-transform:uppercase">Status</th>
          <th style="padding:8px 14px;text-align:right;font-size:12px;text-transform:uppercase">Qtde</th>
        </tr></thead>
        <tbody>${statusRows || '<tr><td colspan="2" style="padding:12px 14px;color:#9ca3af">Nenhum registro</td></tr>'}</tbody>
      </table>
      <h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 10px;text-transform:uppercase">Prévia dos Dados</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
          <thead><tr style="background:#f9fafb">${headers.map((h) => `<th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;white-space:nowrap">${h}</th>`).join('')}</tr></thead>
          <tbody>${previewRows}${moreRows}</tbody>
        </table>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#166534">📎 O arquivo completo está anexado a este e-mail no formato solicitado.</p>
      </div>
      <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 16px">
      <p style="font-size:11px;color:#9ca3af;margin:0">Gerado automaticamente pelo <strong>jAgendamento</strong> em ${generatedAt}</p>
    </div>
  </div>
</body>
</html>`
}

// ─── Gerador de arquivo por formato ──────────────────────────────────────────

const generateExportFile = async (
  rawRows: any[],
  payload: any,
  fmt: string,
  reportName: string,
  generatedAt: string,
  periodLabel: string,
  stats: { total: number; today: number; thisMonth: number; byStatus: Record<string,number> },
): Promise<Omit<ExportResult, 'reportName' | 'reportFormat' | 'stats'>> => {
  const normalized   = rawRows.map(toTemplateAppointment)
  const rows         = applyTemplateFiltersAndSort(normalized, payload)
  const { headers: csvHeaders, data: csvData }     = buildCsvRows(rows)
  const { headers: excelHeaders, data: excelData } = buildExcelRows(rows)
  const safeName     = (reportName || 'relatorio').replace(/[^a-z0-9_\-\s]/gi, '_')
  const dateStamp    = format(new Date(), 'yyyy-MM-dd_HHmm')

  // ── CSV ──
  if (fmt === 'csv') {
    const BOM = '\uFEFF'
    const csv = [csvHeaders, ...csvData]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g,'""')}"`).join(','))
      .join('\r\n')
    return {
      buffer:      Buffer.from(BOM + csv, 'utf8'),
      filename:    `${safeName}_${dateStamp}.csv`,
      mimeType:    'text/csv; charset=utf-8',
      htmlContent: buildEmailHtml(reportName, stats, periodLabel, generatedAt, csvHeaders, csvData),
    }
  }

  // ── JSON ──
  if (fmt === 'json') {
    const jsonData = rows.map((a) => ({ ...a, statusLabel: statusLabel(a.status) }))
    return {
      buffer:      Buffer.from(JSON.stringify(jsonData, null, 2), 'utf8'),
      filename:    `${safeName}_${dateStamp}.json`,
      mimeType:    'application/json',
      htmlContent: buildEmailHtml(reportName, stats, periodLabel, generatedAt, csvHeaders, csvData),
    }
  }

  // ── PDF ──
  if (fmt === 'pdf') {
    const scheduledReportId = payload?._scheduledReportId
    const cronToken  = process.env.CRON_PRINT_TOKEN || ''
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/$/, '')
    const emailHtml  = buildEmailHtml(reportName, stats, periodLabel, generatedAt, csvHeaders, csvData)

    if (scheduledReportId && cronToken) {
      // ── Modo CRON: Puppeteer navega para a página React real ────────────────
      // O PDF resultante é pixel-perfect com o que o utilizador vê na aba Templates.
      const printUrl = `${frontendUrl}/print/report?id=${scheduledReportId}&cron_token=${encodeURIComponent(cronToken)}`
      console.log(`[templateExportService] PDF via PrintReportPage: ${printUrl}`)

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 })
        await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30_000 })
        // Aguarda sinal da PrintReportPage: window.reportReady = true
        await page.waitForFunction(() => (window as any).reportReady === true, { timeout: 30_000 })
        const pdfRaw = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '10mm', right: '8mm', bottom: '10mm', left: '8mm' },
        })
        return {
          buffer:      Buffer.from(pdfRaw),
          filename:    `${safeName}_${dateStamp}.pdf`,
          mimeType:    'application/pdf',
          htmlContent: emailHtml,
        }
      } finally {
        await browser.close()
      }
    }

    // ── Fallback: HTML customizado (exportação manual via rota HTTP) ──────────
    const enabledColumns: TemplateColumn[] = Array.isArray(payload?.columns)
      ? payload.columns.filter((c: TemplateColumn) => c?.enabled)
      : []
    const html    = buildTemplatePdfHtml(payload, rows, enabledColumns)
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    try {
      const page = await browser.newPage()
      await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdfRaw = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
      })
      return {
        buffer:      Buffer.from(pdfRaw),
        filename:    `${safeName}_${dateStamp}.pdf`,
        mimeType:    'application/pdf',
        htmlContent: emailHtml,
      }
    } finally {
      await browser.close()
    }
  }

  // ── XLSX (padrão) ──
  const ws = XLSX.utils.aoa_to_sheet([excelHeaders, ...excelData])
  ws['!cols'] = [
    {wch:12},{wch:8},{wch:32},{wch:14},{wch:20},{wch:28},
    {wch:12},{wch:12},{wch:16},{wch:28},{wch:16},{wch:20},{wch:24},{wch:8},{wch:24},
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos')
  const xlsBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
  return {
    buffer:      xlsBuf,
    filename:    `${safeName}_${dateStamp}.xlsx`,
    mimeType:    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    htmlContent: buildEmailHtml(reportName, stats, periodLabel, generatedAt, excelHeaders, excelData),
  }
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Ponto de entrada único para geração de relatórios.
 * Usado pela rota HTTP da aba Templates E pelo Agendador.
 * Ambos chamam esta função → arquivo anexado no e-mail é idêntico ao baixado pelo usuário.
 */
export const buildTemplateExportFromPayload = async (
  payload: any,
  fallbackName?: string,
): Promise<ExportResult> => {
  const now          = new Date()
  const today        = now.toISOString().split('T')[0]
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01`

  const periodLabel  = `${format(new Date(firstOfMonth + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })} a ${format(now, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
  const generatedAt  = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  const { rows: rawRows } = await pool.query<any>(`
    SELECT
      a.id, a.cidadao_nome, a.cidadao_cpf, a.data_agendamento, a.hora_agendamento,
      a.status, a.telefone, a.email, a.genero, a.local_id, a.tipo_cin,
      a.endereco_rua, a.endereco_numero, a.bairro_nome, a.regiao_tipo, a.regiao_nome,
      a.protocolo, a.criado_em, a.prioridade, a.concluido_por,
      l.nome_local AS local_nome
    FROM agendamentos a
    LEFT JOIN locais_atendimento l ON l.id = a.local_id
    WHERE a.prefeitura_id = 1
    ORDER BY a.data_agendamento ASC
  `)

  const normalized = rawRows.map(toTemplateAppointment)
  const filtered   = applyTemplateFiltersAndSort(normalized, payload)

  const stats = {
    total:      filtered.length,
    today:      filtered.filter((r) => r.date === today).length,
    thisMonth:  filtered.filter((r) => r.date >= firstOfMonth).length,
    byStatus:   filtered.reduce((acc: Record<string,number>, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {}),
  }

  const reportName   = String(payload?.name   || fallbackName || 'Relatório Agendado')
  const reportFormat = String(payload?.exportFormat || payload?.format || 'pdf')

  const file = await generateExportFile(rawRows, payload, reportFormat, reportName, generatedAt, periodLabel, stats)

  return { ...file, reportName, reportFormat, stats }
}
