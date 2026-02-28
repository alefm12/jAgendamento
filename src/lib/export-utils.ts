import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Appointment, Location } from './types'
import { logReportExecutionSafe } from './report-logger'

const getCurrentUserName = () => {
  if (typeof window === 'undefined') return 'Sistema'
  const raw = localStorage.getItem('currentUser')
  if (!raw) return 'Usuário'
  try {
    const parsed = JSON.parse(raw)
    return parsed?.fullName || parsed?.name || parsed?.email || 'Usuário'
  } catch {
    return 'Usuário'
  }
}

export function exportToCSV(appointments: Appointment[], locations: Location[]) {
  const startedAt = performance.now()
  const headers = [
    'Protocolo',
    'Nome Completo',
    'CPF',
    'CIN',
    'Tipo de CIN',
    'Telefone',
    'Email',
    'Data',
    'Horário',
    'Status',
    'Local',
    'Endereço',
    'Bairro',
    'Prioridade',
    'Criado em'
  ]

  const rows = appointments.map(apt => {
    const location = locations.find(loc => loc.id === apt.locationId)
    return [
      apt.protocol,
      apt.fullName,
      apt.cpf,
      apt.rg || '',
      apt.rgType || 'Não informado',
      apt.phone,
      apt.email,
      format(parseISO(apt.date), 'dd/MM/yyyy'),
      apt.time,
      getStatusLabel(apt.status),
      location?.name || '',
      `${apt.street || ''} ${apt.number || ''}`.trim(),
      apt.neighborhood || '',
      apt.priority === 'urgent' ? 'Urgente' : apt.priority === 'high' ? 'Alta' : 'Normal',
      format(parseISO(apt.createdAt), 'dd/MM/yyyy HH:mm')
    ]
  })

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `agendamentos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`
  link.click()
  void logReportExecutionSafe({
    reportName: 'Exportação de Agendamentos (CSV)',
    reportType: 'export',
    executedBy: getCurrentUserName(),
    status: 'success',
    trigger: 'manual',
    totalRecords: appointments.length,
    recordsProcessed: appointments.length,
    format: 'csv',
    executionDuration: Math.round(performance.now() - startedAt),
    metadata: { module: 'analytics-import-export' }
  })
}

export function exportToJSON(appointments: Appointment[], locations: Location[]) {
  const startedAt = performance.now()
  const data = appointments.map(apt => {
    const location = locations.find(loc => loc.id === apt.locationId)
    return {
      ...apt,
      locationName: location?.name,
      locationAddress: location?.address,
      statusLabel: getStatusLabel(apt.status)
    }
  })

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `agendamentos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`
  link.click()
  void logReportExecutionSafe({
    reportName: 'Exportação de Agendamentos (JSON)',
    reportType: 'export',
    executedBy: getCurrentUserName(),
    status: 'success',
    trigger: 'manual',
    totalRecords: appointments.length,
    recordsProcessed: appointments.length,
    format: 'json',
    executionDuration: Math.round(performance.now() - startedAt),
    metadata: { module: 'analytics-import-export' }
  })
}

export function exportToPDF(appointments: Appointment[], locations: Location[], title: string = 'Relatório de Agendamentos') {
  const startedAt = performance.now()
  const doc = new jsPDF('landscape', 'mm', 'a4')
  const pageWidth  = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height

  const GREEN:  [number, number, number] = [0, 150, 57]
  const DARK:   [number, number, number] = [51, 51, 51]
  const GRAY:   [number, number, number] = [102, 102, 102]
  const WHITE:  [number, number, number] = [255, 255, 255]
  const LIGHT:  [number, number, number] = [245, 245, 245]

  const emittedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  // ─── CABEÇALHO DA PRIMEIRA PÁGINA ───────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageWidth, 16, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('DADOS DETALHADOS', pageWidth / 2, 10, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em: ${emittedAt}  |  Total: ${appointments.length} registro(s)`, pageWidth / 2, 14, { align: 'center' })

  // ─── TABELA DE DADOS ────────────────────────────────────────────────────────
  const tableData = appointments.map(apt => {
    const location = locations.find(loc => loc.id === apt.locationId)
    const regionDistrict = [apt.regionName, apt.regionType].filter(Boolean).join(' - ') || ''
    return [
      format(parseISO(apt.date), 'dd/MM/yyyy'),
      apt.time,
      apt.fullName,
      apt.cpf,
      getStatusLabel(apt.status),
      location?.name || '',
      apt.rgType || '',
      apt.gender || '',
      apt.phone,
      apt.email,
      apt.protocol,
      regionDistrict,
      apt.street || '',
      apt.number || '',
      apt.neighborhood || '',
    ]
  })

  autoTable(doc, {
    head: [['Data','Hora','Nome Completo','CPF','Status','Local de Atendimento','Tipo','Gênero','Telefone','Email','Protocolo','Região','Logradouro','Nº','Bairro']],
    body: tableData,
    startY: 20,
    styles: { fontSize: 6.5, cellPadding: 1.5, textColor: DARK, lineColor: [220,220,220], lineWidth: 0.1, overflow: 'linebreak', minCellHeight: 8 },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 6.5, halign: 'center', cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0:  { cellWidth: 15, halign: 'center' },
      1:  { cellWidth: 9,  halign: 'center' },
      2:  { cellWidth: 28 },
      3:  { cellWidth: 21, halign: 'center' },
      4:  { cellWidth: 20 },
      5:  { cellWidth: 26 },
      6:  { cellWidth: 11, halign: 'center' },
      7:  { cellWidth: 14 },
      8:  { cellWidth: 17, halign: 'center' },
      9:  { cellWidth: 24 },
      10: { cellWidth: 21, halign: 'center' },
      11: { cellWidth: 14, halign: 'center' },
      12: { cellWidth: 18 },
      13: { cellWidth: 7,  halign: 'center' },
      14: { cellWidth: 20 },
    },
    didDrawPage: (data) => {
      const pg = data.pageNumber
      if (pg > 1) {
        doc.setFillColor(...GREEN)
        doc.rect(0, 0, pageWidth, 12, 'F')
        doc.setTextColor(...WHITE)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('DADOS DETALHADOS — continuação', pageWidth / 2, 8, { align: 'center' })
      }
      doc.setFillColor(...LIGHT)
      doc.rect(0, pageHeight - 10, pageWidth, 10, 'F')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GRAY)
      doc.text(`Página ${pg}  |  ${title}  |  ${emittedAt}`, pageWidth / 2, pageHeight - 4, { align: 'center' })
    },
  })

  // ─── RESUMO ESTATÍSTICO ──────────────────────────────────────────────────────
  doc.addPage()

  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageWidth, 16, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('RESUMO ESTATÍSTICO', pageWidth / 2, 10, { align: 'center' })

  // Acumular contagens
  const statusCounts:       Record<string, number> = {}
  const rgTypeCounts:       Record<string, number> = {}
  const locationCounts:     Record<string, number> = {}
  const genderCounts:       Record<string, number> = {}
  const regionCounts:       Record<string, number> = {}
  const neighborhoodCounts: Record<string, number> = {}

  appointments.forEach(apt => {
    statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1
    if (apt.rgType) rgTypeCounts[apt.rgType] = (rgTypeCounts[apt.rgType] || 0) + 1
    const loc = locations.find(l => l.id === apt.locationId)
    if (loc) locationCounts[loc.name] = (locationCounts[loc.name] || 0) + 1
    if (apt.gender) {
      const g = apt.gender.startsWith('Outro:') ? 'Outro' : apt.gender
      genderCounts[g] = (genderCounts[g] || 0) + 1
    }
    if (apt.regionType) regionCounts[apt.regionType] = (regionCounts[apt.regionType] || 0) + 1
    if (apt.neighborhood) neighborhoodCounts[apt.neighborhood] = (neighborhoodCounts[apt.neighborhood] || 0) + 1
  })

  const statusLabels: Record<string, string> = {
    pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído',
    cancelled: 'Cancelado', 'awaiting-issuance': 'Aguardando Emissão',
    'cin-ready': 'CIN Pronta', 'cin-delivered': 'CIN Entregue',
  }

  const total = appointments.length

  // KPIs de topo
  const kpis = [
    { label: 'Total de Agendamentos', value: total },
    { label: 'Cancelados',            value: statusCounts['cancelled'] || 0 },
    { label: 'CIN Pronta',            value: statusCounts['cin-ready'] || 0 },
    { label: 'CIN Entregue',          value: statusCounts['cin-delivered'] || 0 },
    { label: 'Aguardando Confecção',  value: statusCounts['awaiting-issuance'] || 0 },
  ]

  const kpiY   = 22
  const kpiGap = 5
  const kpiW   = (pageWidth - 14 * 2 - kpiGap * (kpis.length - 1)) / kpis.length
  kpis.forEach((k, i) => {
    const x = 14 + i * (kpiW + kpiGap)
    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, kpiY, kpiW, 22, 2, 2, 'F')
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(0.5)
    doc.roundedRect(x, kpiY, kpiW, 22, 2, 2, 'S')
    doc.setTextColor(...GRAY)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(k.label, x + kpiW / 2, kpiY + 7, { align: 'center' })
    doc.setTextColor(...GREEN)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(k.value.toString(), x + kpiW / 2, kpiY + 18, { align: 'center' })
  })

  const makeStatRows = (counts: Record<string, number>, labelMap?: Record<string, string>) =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [
        labelMap ? (labelMap[k] || k) : k,
        v.toString(),
        `${total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'}%`,
      ])

  // Layout: margem 14mm cada lado → conteúdo = 297-28 = 269mm
  // 3 colunas com gap de 7mm entre elas: colW = (269 - 14) / 3 = 85mm
  const MARGIN   = 14
  const COL_GAP  = 7
  const COL_W    = (pageWidth - MARGIN * 2 - COL_GAP * 2) / 3  // ~85mm
  const COL_X    = [MARGIN, MARGIN + COL_W + COL_GAP, MARGIN + (COL_W + COL_GAP) * 2]
  const ROW_GAP  = 18   // espaço vertical entre linhas de tabelas
  const TITLE_H  = 6    // altura do título antes da tabela

  const tableStyle = {
    styles:            { fontSize: 8, cellPadding: 3.5, textColor: DARK, lineColor: [220, 220, 220] as [number,number,number], lineWidth: 0.1 },
    headStyles:        { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' as const, fontSize: 8, cellPadding: 3.5 },
    alternateRowStyles:{ fillColor: LIGHT },
    columnStyles:      { 1: { halign: 'center' as const, cellWidth: 18 }, 2: { halign: 'center' as const, cellWidth: 18 } },
  }

  const drawStatTable = (sectionTitle: string, rows: string[][], colIdx: number, startY: number) => {
    const x = COL_X[colIdx]
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(sectionTitle, x, startY - 2)
    autoTable(doc, {
      head: [['Descrição', 'Qtd', '%']],
      body: rows.length > 0 ? rows : [['Sem dados', '—', '—']],
      startY,
      tableWidth: COL_W,
      margin: { left: x },
      ...tableStyle,
    })
  }

  // ── LINHA 1: Status | Tipo de CIN | Gênero ───────────────────────────
  const row1Y = kpiY + 32

  drawStatTable('Distribuição por Status',     makeStatRows(statusCounts, statusLabels), 0, row1Y)
  drawStatTable('Distribuição por Tipo de CIN',makeStatRows(rgTypeCounts),               1, row1Y)
  drawStatTable('Distribuição por Gênero',     makeStatRows(genderCounts),               2, row1Y)

  // ── LINHA 2: Local de Atendimento | Região | Bairro/Comunidade ───────
  const row2Y = ((doc as any).lastAutoTable?.finalY || row1Y + 40) + ROW_GAP

  drawStatTable('Distribuição por Local de Atendimento', makeStatRows(locationCounts),     0, row2Y)
  drawStatTable('Distribuição por Região',               makeStatRows(regionCounts),       1, row2Y)
  drawStatTable('Distribuição por Bairro/Comunidade',    makeStatRows(neighborhoodCounts), 2, row2Y)

  // Rodapé da página
  doc.setFillColor(...LIGHT)
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(`${title}  |  ${emittedAt}`, pageWidth / 2, pageHeight - 4, { align: 'center' })

  doc.save(`relatorio_agendamentos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)
  void logReportExecutionSafe({
    reportName: title || 'Relatório de Agendamentos',
    reportType: 'export',
    executedBy: getCurrentUserName(),
    status: 'success',
    trigger: 'manual',
    totalRecords: appointments.length,
    recordsProcessed: appointments.length,
    format: 'pdf',
    executionDuration: Math.round(performance.now() - startedAt),
    metadata: { module: 'analytics-import-export' }
  })
}

export function exportToExcel(appointments: Appointment[], locations: Location[]) {
  const startedAt = performance.now()
  // Cabeçalhos no padrão do modelo oficial de importação
  const headers = [
    'Data',
    'Hora',
    'Nome Completo',
    'CPF',
    'Status',
    'Local de Atendimento',
    'Tipo de CIN',
    'Gênero',
    'Telefone',
    'Email',
    'Protocolo',
    'Região / Distrito',
    'Logradouro',
    'Número',
    'Bairro / Comunidade',
  ]

  const rows = appointments.map(apt => {
    const location = locations.find(loc => loc.id === apt.locationId)
    const regionDistrict = [apt.regionName, apt.regionType]
      .filter(Boolean)
      .join(' - ') || ''

    return [
      format(parseISO(apt.date), 'dd/MM/yyyy'),
      apt.time,
      apt.fullName,
      apt.cpf,
      getStatusLabel(apt.status),
      location?.name || '',
      apt.rgType || '',
      apt.gender || '',
      apt.phone,
      apt.email,
      apt.protocol,
      regionDistrict,
      apt.street || '',
      apt.number || '',
      apt.neighborhood || '',
    ]
  })

  // Cria worksheet com os dados
  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Largura das colunas
  ws['!cols'] = [
    { wch: 12 }, // Data
    { wch: 8  }, // Hora
    { wch: 32 }, // Nome Completo
    { wch: 14 }, // CPF
    { wch: 20 }, // Status
    { wch: 28 }, // Local de Atendimento
    { wch: 12 }, // Tipo de CIN
    { wch: 12 }, // Gênero
    { wch: 16 }, // Telefone
    { wch: 28 }, // Email
    { wch: 16 }, // Protocolo
    { wch: 20 }, // Região / Distrito
    { wch: 24 }, // Logradouro
    { wch: 8  }, // Número
    { wch: 24 }, // Bairro / Comunidade
  ]

  // Congela a primeira linha (cabeçalho)
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `agendamentos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`
  link.click()
  void logReportExecutionSafe({
    reportName: 'Exportação de Agendamentos (Excel)',
    reportType: 'export',
    executedBy: getCurrentUserName(),
    status: 'success',
    trigger: 'manual',
    totalRecords: appointments.length,
    recordsProcessed: appointments.length,
    format: 'excel',
    executionDuration: Math.round(performance.now() - startedAt),
    metadata: { module: 'analytics-import-export' }
  })
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    'awaiting-issuance': 'Aguardando Emissão',
    'cin-ready': 'CIN Pronta',
    'cin-delivered': 'CIN Entregue'
  }
  return labels[status] || status
}
