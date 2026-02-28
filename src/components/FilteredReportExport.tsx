import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  format, parseISO,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  isWithinInterval,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CalendarBlank, Download, FileText, FileCsv, FileXls, FilePdf, MapPin, X } from '@phosphor-icons/react'
import type { Appointment, Location } from '@/lib/types'
import { cn } from '@/lib/utils'
import { exportToCSV, exportToJSON, exportToExcel, exportToPDF } from '@/lib/export-utils'

type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

interface FilteredReportExportProps {
  appointments: Appointment[]
  locations: Location[]
  systemName?: string
}

export function FilteredReportExport({ appointments, locations, systemName }: FilteredReportExportProps) {
  // Período
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()

  // Multi-select
  const [selectedLocationIds, setSelectedLocationIds]     = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses]           = useState<string[]>([])
  const [selectedGenders, setSelectedGenders]             = useState<string[]>([])
  const [selectedDistricts, setSelectedDistricts]         = useState<string[]>([])
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([])

  // Single-select
  const [selectedRgType, setSelectedRgType] = useState<string>('all')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')

  // Opções dinâmicas
  const regions       = Array.from(new Set(appointments.map(a => a.regionType).filter(Boolean)))
  const districts     = Array.from(new Set(appointments.map(a => a.regionName || a.sedeId || a.districtId).filter(Boolean)))
  const neighborhoods = Array.from(new Set(appointments.map(a => a.neighborhood).filter(Boolean)))
  const uniqueGenders = Array.from(new Set(appointments.map(a => {
    if (!a.gender) return null
    return a.gender.startsWith('Outro:') ? 'Outro' : a.gender
  }).filter(Boolean))) as string[]
  const uniqueStatuses = Array.from(new Set(appointments.map(a => a.status)))
  const visibleStatuses = uniqueStatuses.filter(status => status !== 'completed')

  const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído',
    cancelled: 'Cancelado', 'awaiting-issuance': 'Aguardando Emissão',
    'cin-ready': 'CIN Pronta', 'cin-delivered': 'CIN Entregue',
  }

  // Intervalo de datas conforme preset
  const getPeriodInterval = (): { start: Date; end: Date } | null => {
    const now = new Date()
    switch (periodPreset) {
      case 'today':  return { start: startOfDay(now),  end: endOfDay(now) }
      case 'week':   return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) }
      case 'month':  return { start: startOfMonth(now), end: endOfMonth(now) }
      case 'year':   return { start: startOfYear(now),  end: endOfYear(now) }
      case 'custom': return startDate ? { start: startOfDay(startDate), end: endDate ? endOfDay(endDate) : endOfDay(startDate) } : null
      default:       return null
    }
  }

  const getPeriodLabel = () => {
    const labels: Record<PeriodPreset, string> = {
      all: 'Todos os Períodos', today: 'Hoje', week: 'Esta Semana',
      month: 'Este Mês', year: 'Este Ano', custom: 'Período Personalizado',
    }
    if (periodPreset === 'custom' && startDate) {
      return endDate
        ? `${format(startDate, 'dd/MM/yyyy')} – ${format(endDate, 'dd/MM/yyyy')}`
        : `A partir de ${format(startDate, 'dd/MM/yyyy')}`
    }
    return labels[periodPreset]
  }

  const filterAppointments = () => {
    let filtered = [...appointments]

    const interval = getPeriodInterval()
    if (interval) {
      filtered = filtered.filter(apt => {
        try { return isWithinInterval(parseISO(apt.date), interval) } catch { return false }
      })
    }

    if (selectedLocationIds.length > 0)
      filtered = filtered.filter(apt => selectedLocationIds.includes(apt.locationId))

    if (selectedStatuses.length > 0)
      filtered = filtered.filter(apt => selectedStatuses.includes(apt.status))

    if (selectedRgType !== 'all')
      filtered = filtered.filter(apt => apt.rgType === selectedRgType)

    if (selectedRegion !== 'all')
      filtered = filtered.filter(apt => apt.regionType === selectedRegion)

    if (selectedDistricts.length > 0)
      filtered = filtered.filter(apt => selectedDistricts.includes(apt.regionName || apt.sedeId || apt.districtId || ''))

    if (selectedNeighborhoods.length > 0)
      filtered = filtered.filter(apt => selectedNeighborhoods.includes(apt.neighborhood || ''))

    if (selectedGenders.length > 0)
      filtered = filtered.filter(apt => {
        if (!apt.gender) return false
        const g = apt.gender.startsWith('Outro:') ? 'Outro' : apt.gender
        return selectedGenders.includes(g)
      })

    return filtered
  }

  const clearFilters = () => {
    setPeriodPreset('all')
    setStartDate(undefined)
    setEndDate(undefined)
    setSelectedLocationIds([])
    setSelectedStatuses([])
    setSelectedGenders([])
    setSelectedDistricts([])
    setSelectedNeighborhoods([])
    setSelectedRgType('all')
    setSelectedRegion('all')
    toast.info('Filtros limpos')
  }

  const getStatusLabel = (status: string): string => {
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

  const exportFilteredToPDF = () => {
    const filtered = filterAppointments()

    if (filtered.length === 0) {
      toast.error('Nenhum agendamento encontrado com os filtros selecionados')
      return
    }

    const doc = new jsPDF('landscape', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    
    // CORES DO SISTEMA (definidas como tuplas)
    const primaryGreen: [number, number, number] = [0, 150, 57] // #009639
    const darkGray: [number, number, number] = [51, 51, 51] // #333333
    const lightGray: [number, number, number] = [102, 102, 102] // #666666
    const white: [number, number, number] = [255, 255, 255]
    const lightBackground: [number, number, number] = [245, 245, 245]

    // ============================================
    // PÁGINA 1: CAPA
    // ============================================
    
    // Fundo verde no topo
    doc.setFillColor(...primaryGreen)
    doc.rect(0, 0, pageWidth, 60, 'F')
    
    // Logo JEOS (simulado - texto)
    doc.setTextColor(...white)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('JEOS SISTEMAS E GOVERNO', pageWidth / 2, 15, { align: 'center' })
    
    // Título principal na faixa verde
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('RELATÓRIO ANALÍTICO', pageWidth / 2, 35, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('SECRETARIA DE INCLUSÃO E PROMOÇÃO SOCIAL', pageWidth / 2, 45, { align: 'center' })
    
    // Área central
    doc.setTextColor(...darkGray)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Sistema de Agendamento', pageWidth / 2, 90, { align: 'center' })
    doc.text('Carteira de Identidade Nacional (CIN)', pageWidth / 2, 100, { align: 'center' })
    
    // Informações de emissão
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...lightGray)
    const currentDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    doc.text(`Emitido em: ${currentDate}`, pageWidth / 2, 120, { align: 'center' })
    
    // Brasão/Logo (simulado com círculo verde)
    doc.setFillColor(...primaryGreen)
    doc.circle(pageWidth / 2, 160, 25, 'F')
    doc.setTextColor(...white)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('CIN', pageWidth / 2, 165, { align: 'center' })
    
    // Rodapé da capa
    doc.setTextColor(...darkGray)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(systemName || 'Prefeitura Municipal', pageWidth / 2, pageHeight - 30, { align: 'center' })
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...lightGray)
    doc.text('Powered by JEOS Tecnologia', pageWidth / 2, pageHeight - 15, { align: 'center' })
    
    // ============================================
    // PÁGINA 2: RESUMO EXECUTIVO
    // ============================================
    doc.addPage()
    let yPos = 20
    
    // Cabeçalho da página
    doc.setFillColor(...primaryGreen)
    doc.rect(0, 0, pageWidth, 15, 'F')
    doc.setTextColor(...white)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMO EXECUTIVO', pageWidth / 2, 10, { align: 'center' })
    
    yPos = 25
    
    // Filtros aplicados
    doc.setTextColor(...darkGray)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Filtros Aplicados:', 15, yPos)
    yPos += 7
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...lightGray)
    
    const periodLabel = getPeriodLabel()
    if (periodPreset !== 'all') {
      doc.text(`• Período: ${periodLabel}`, 20, yPos)
      yPos += 5
    }

    if (selectedLocationIds.length > 0) {
      const names = selectedLocationIds.map(id => locations.find(l => l.id === id)?.name || id).join(', ')
      doc.text(`• Local: ${names}`, 20, yPos)
      yPos += 5
    }

    if (selectedStatuses.length > 0) {
      doc.text(`• Status: ${selectedStatuses.map(s => STATUS_LABELS[s] || s).join(', ')}`, 20, yPos)
      yPos += 5
    }

    if (selectedRgType !== 'all') {
      doc.text(`• Tipo de CIN: ${selectedRgType}`, 20, yPos)
      yPos += 5
    }

    if (selectedRegion !== 'all') {
      doc.text(`• Região: ${selectedRegion}`, 20, yPos)
      yPos += 5
    }

    if (selectedDistricts.length > 0) {
      doc.text(`• Distrito/Sede: ${selectedDistricts.join(', ')}`, 20, yPos)
      yPos += 5
    }

    if (selectedNeighborhoods.length > 0) {
      doc.text(`• Bairro: ${selectedNeighborhoods.join(', ')}`, 20, yPos)
      yPos += 5
    }

    if (selectedGenders.length > 0) {
      doc.text(`• Gênero: ${selectedGenders.join(', ')}`, 20, yPos)
      yPos += 5
    }
    
    yPos += 10
    
    // KPIs em cards
    const statusCountsKPI = filtered.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const totalCinProntas = statusCountsKPI['cin-ready'] || 0
    const totalEntregues = statusCountsKPI['cin-delivered'] || 0
    const totalAguardando = statusCountsKPI['awaiting-issuance'] || 0
    
    // Grid de KPIs (2x2)
    const cardWidth = 85
    const cardHeight = 30
    const cardGap = 10
    const cardStartX = 15
    
    // Card 1: Total
    doc.setFillColor(...lightBackground)
    doc.roundedRect(cardStartX, yPos, cardWidth, cardHeight, 3, 3, 'F')
    doc.setDrawColor(...primaryGreen)
    doc.setLineWidth(0.5)
    doc.roundedRect(cardStartX, yPos, cardWidth, cardHeight, 3, 3, 'S')
    
    doc.setTextColor(...lightGray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Total de Agendamentos', cardStartX + cardWidth / 2, yPos + 8, { align: 'center' })
    
    doc.setTextColor(...primaryGreen)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text(filtered.length.toString(), cardStartX + cardWidth / 2, yPos + 22, { align: 'center' })
    
    // Card 2: CIN Prontas
    doc.setFillColor(...lightBackground)
    doc.roundedRect(cardStartX + cardWidth + cardGap, yPos, cardWidth, cardHeight, 3, 3, 'F')
    doc.setDrawColor(...primaryGreen)
    doc.roundedRect(cardStartX + cardWidth + cardGap, yPos, cardWidth, cardHeight, 3, 3, 'S')
    
    doc.setTextColor(...lightGray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('CIN Prontas', cardStartX + cardWidth + cardGap + cardWidth / 2, yPos + 8, { align: 'center' })
    
    doc.setTextColor(...primaryGreen)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text(totalCinProntas.toString(), cardStartX + cardWidth + cardGap + cardWidth / 2, yPos + 22, { align: 'center' })
    
    yPos += cardHeight + cardGap
    
    // Card 3: Entregues
    doc.setFillColor(...lightBackground)
    doc.roundedRect(cardStartX, yPos, cardWidth, cardHeight, 3, 3, 'F')
    doc.setDrawColor(...primaryGreen)
    doc.roundedRect(cardStartX, yPos, cardWidth, cardHeight, 3, 3, 'S')
    
    doc.setTextColor(...lightGray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('CIN Entregues', cardStartX + cardWidth / 2, yPos + 8, { align: 'center' })
    
    doc.setTextColor(...primaryGreen)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text(totalEntregues.toString(), cardStartX + cardWidth / 2, yPos + 22, { align: 'center' })
    
    // Card 4: Aguardando
    doc.setFillColor(...lightBackground)
    doc.roundedRect(cardStartX + cardWidth + cardGap, yPos, cardWidth, cardHeight, 3, 3, 'F')
    doc.setDrawColor(...primaryGreen)
    doc.roundedRect(cardStartX + cardWidth + cardGap, yPos, cardWidth, cardHeight, 3, 3, 'S')
    
    doc.setTextColor(...lightGray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Aguardando Confecção', cardStartX + cardWidth + cardGap + cardWidth / 2, yPos + 8, { align: 'center' })
    
    doc.setTextColor(...primaryGreen)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text(totalAguardando.toString(), cardStartX + cardWidth + cardGap + cardWidth / 2, yPos + 22, { align: 'center' })
    
    yPos += cardHeight + 20
    
    // ============================================
    // PÁGINA 3: DADOS DETALHADOS
    // ============================================
    doc.addPage()
    
    // Cabeçalho
    doc.setFillColor(...primaryGreen)
    doc.rect(0, 0, pageWidth, 15, 'F')
    doc.setTextColor(...white)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('DADOS DETALHADOS', pageWidth / 2, 10, { align: 'center' })
    
    yPos = 25

    const tableData = filtered.map(apt => {
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
      head: [['Data', 'Hora', 'Nome Completo', 'CPF', 'Status', 'Local de Atendimento', 'Tipo CIN', 'Gênero', 'Telefone', 'Email', 'Protocolo', 'Região/Distrito', 'Logradouro', 'Nº', 'Bairro/Comunidade']],
      body: tableData,
      startY: yPos,
      styles: { 
        fontSize: 7,
        cellPadding: 2,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        textColor: darkGray,
        overflow: 'ellipsize',
      },
      headStyles: { 
        fillColor: primaryGreen,
        textColor: white,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7,
      },
      alternateRowStyles: { 
        fillColor: lightBackground
      },
      columnStyles: {
        0:  { cellWidth: 16, halign: 'center' }, // Data
        1:  { cellWidth: 10, halign: 'center' }, // Hora
        2:  { cellWidth: 30 },                   // Nome Completo
        3:  { cellWidth: 22, halign: 'center' }, // CPF
        4:  { cellWidth: 22, halign: 'center' }, // Status
        5:  { cellWidth: 28 },                   // Local de Atendimento
        6:  { cellWidth: 13, halign: 'center' }, // Tipo CIN
        7:  { cellWidth: 15, halign: 'center' }, // Gênero
        8:  { cellWidth: 18, halign: 'center' }, // Telefone
        9:  { cellWidth: 22 },                   // Email
        10: { cellWidth: 22, halign: 'center' }, // Protocolo
        11: { cellWidth: 16, halign: 'center' }, // Região/Distrito
        12: { cellWidth: 18 },                   // Logradouro
        13: { cellWidth: 8,  halign: 'center' }, // Número
        14: { cellWidth: 20 },                   // Bairro/Comunidade
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages()
        const currentPage = data.pageNumber
        
        // Cabeçalho em todas as páginas (exceto capa)
        if (currentPage > 2) {
          doc.setFillColor(...primaryGreen)
          doc.rect(0, 0, pageWidth, 15, 'F')
          doc.setTextColor(...white)
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text('DADOS DETALHADOS - CONTINUAÇÃO', pageWidth / 2, 10, { align: 'center' })
        }
        
        // Rodapé em todas as páginas
        doc.setFillColor(...lightBackground)
        doc.rect(0, pageHeight - 20, pageWidth, 20, 'F')
        
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...lightGray)
        doc.text(
          `Página ${currentPage} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
        
        doc.setFontSize(7)
        doc.text(
          `${systemName || 'Sistema de Agendamento'} - Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        )
      }
    })

    const finalY = (doc as any).lastAutoTable.finalY || yPos + 20
    
    // ============================================
    // PÁGINA FINAL: RESUMO E ESTATÍSTICAS
    // ============================================
    doc.addPage()
    
    // Cabeçalho
    doc.setFillColor(...primaryGreen)
    doc.rect(0, 0, pageWidth, 15, 'F')
    doc.setTextColor(...white)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMO ESTATÍSTICO', pageWidth / 2, 10, { align: 'center' })
    
    let summaryY = 30
    
    // Resumo por Status
    const statusCounts: Record<string, number> = {}
    filtered.forEach(apt => {
      statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1
    })

    doc.setTextColor(...darkGray)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Distribuição por Status', 15, summaryY)
    summaryY += 10
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      const percentage = ((count / filtered.length) * 100).toFixed(1)
      doc.setTextColor(...lightGray)
      doc.text('•', 20, summaryY)
      doc.setTextColor(...darkGray)
      doc.text(`${getStatusLabel(status)}: `, 25, summaryY)
      doc.setTextColor(...primaryGreen)
      doc.setFont('helvetica', 'bold')
      doc.text(`${count} (${percentage}%)`, 80, summaryY)
      doc.setFont('helvetica', 'normal')
      summaryY += 6
    })
    
    summaryY += 10
    
    // Resumo por Tipo de CIN
    const rgTypeCounts: Record<string, number> = { '1ª via': 0, '2ª via': 0 }
    filtered.forEach(apt => {
      if (apt.rgType) {
        rgTypeCounts[apt.rgType] = (rgTypeCounts[apt.rgType] || 0) + 1
      }
    })
    
    doc.setTextColor(...darkGray)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Distribuição por Tipo de CIN', 15, summaryY)
    summaryY += 10
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...lightGray)
    doc.text('•', 20, summaryY)
    doc.setTextColor(...darkGray)
    doc.text('1ª via: ', 25, summaryY)
    doc.setTextColor(...primaryGreen)
    doc.setFont('helvetica', 'bold')
    doc.text(`${rgTypeCounts['1ª via']}`, 50, summaryY)
    doc.setFont('helvetica', 'normal')
    summaryY += 6
    
    doc.setTextColor(...lightGray)
    doc.text('•', 20, summaryY)
    doc.setTextColor(...darkGray)
    doc.text('2ª via: ', 25, summaryY)
    doc.setTextColor(...primaryGreen)
    doc.setFont('helvetica', 'bold')
    doc.text(`${rgTypeCounts['2ª via']}`, 50, summaryY)
    summaryY += 15
    
    // Resumo por Localidade
    if (locations.length > 0) {
      const locationCounts: Record<string, number> = {}
      filtered.forEach(apt => {
        const location = locations.find(loc => loc.id === apt.locationId)
        if (location) {
          locationCounts[location.name] = (locationCounts[location.name] || 0) + 1
        }
      })
      
      doc.setTextColor(...darkGray)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Distribuição por Local de Atendimento', 15, summaryY)
      summaryY += 10
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      
      Object.entries(locationCounts).forEach(([location, count]) => {
        const percentage = ((count / filtered.length) * 100).toFixed(1)
        doc.setTextColor(...lightGray)
        doc.text('•', 20, summaryY)
        doc.setTextColor(...darkGray)
        doc.text(`${location}: `, 25, summaryY)
        doc.setTextColor(...primaryGreen)
        doc.setFont('helvetica', 'bold')
        doc.text(`${count} (${percentage}%)`, 80, summaryY)
        doc.setFont('helvetica', 'normal')
        summaryY += 6
      })
    }
    
    // ============================================
    // CONTRA-CAPA
    // ============================================
    doc.addPage()
    
    // Fundo verde
    doc.setFillColor(...primaryGreen)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    
    // Logo/Brasão central
    doc.setFillColor(...white)
    doc.circle(pageWidth / 2, pageHeight / 2 - 30, 35, 'F')
    
    doc.setTextColor(...primaryGreen)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('CIN', pageWidth / 2, pageHeight / 2 - 25, { align: 'center' })
    
    // Nome do sistema
    doc.setTextColor(...white)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(systemName || 'Sistema de Agendamento', pageWidth / 2, pageHeight / 2 + 30, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Carteira de Identidade Nacional', pageWidth / 2, pageHeight / 2 + 42, { align: 'center' })
    
    // Rodapé
    doc.setFontSize(10)
    doc.text('JEOS Tecnologia', pageWidth / 2, pageHeight - 30, { align: 'center' })
    doc.setFontSize(8)
    doc.text('Soluções em Governo Digital', pageWidth / 2, pageHeight - 20, { align: 'center' })

    const fileName = `relatorio_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
    doc.save(fileName)

    toast.success('Relatório PDF gerado com sucesso!', {
      description: `${filtered.length} registro(s) exportado(s)`
    })
  }

  const filteredCount = filterAppointments().length

  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText size={24} weight="duotone" className="text-primary" />
          Exportar Dados
        </CardTitle>
        <CardDescription>
          Aplique filtros e exporte apenas os dados desejados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <CalendarBlank size={16} weight="duotone" />
              Período
            </label>
            <Select value={periodPreset} onValueChange={v => setPeriodPreset(v as PeriodPreset)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Períodos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="year">Este Ano</SelectItem>
                <SelectItem value="custom">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <MapPin size={16} weight="duotone" />
              Local de Atendimento
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedLocationIds.length === 0 ? 'Todos' : `${selectedLocationIds.length} selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Selecione os locais</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLocationIds([])}>Limpar</Button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {locations.map(loc => (
                      <div key={loc.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`exp-loc-${loc.id}`}
                          checked={selectedLocationIds.includes(loc.id)}
                          onCheckedChange={checked => setSelectedLocationIds(
                            checked ? [...selectedLocationIds, loc.id] : selectedLocationIds.filter(id => id !== loc.id)
                          )}
                        />
                        <label htmlFor={`exp-loc-${loc.id}`} className="text-sm cursor-pointer">{loc.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedStatuses.length === 0 ? 'Todos' : `${selectedStatuses.length} selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Selecione os status</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStatuses([])}>Limpar</Button>
                  </div>
                  <div className="space-y-2">
                    {visibleStatuses.map(s => (
                      <div key={s} className="flex items-center space-x-2">
                        <Checkbox
                          id={`exp-st-${s}`}
                          checked={selectedStatuses.includes(s)}
                          onCheckedChange={checked => setSelectedStatuses(
                            checked ? [...selectedStatuses, s] : selectedStatuses.filter(x => x !== s)
                          )}
                        />
                        <label htmlFor={`exp-st-${s}`} className="text-sm cursor-pointer">{STATUS_LABELS[s] || s}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de CIN</label>
            <Select value={selectedRgType} onValueChange={setSelectedRgType}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1ª via">1ª via</SelectItem>
                <SelectItem value="2ª via">2ª via</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Gênero</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedGenders.length === 0 ? 'Todos' : `${selectedGenders.length} selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Selecione os gêneros</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedGenders([])}>Limpar</Button>
                  </div>
                  <div className="space-y-2">
                    {uniqueGenders.map(g => (
                      <div key={g} className="flex items-center space-x-2">
                        <Checkbox
                          id={`exp-g-${g}`}
                          checked={selectedGenders.includes(g)}
                          onCheckedChange={checked => setSelectedGenders(
                            checked ? [...selectedGenders, g] : selectedGenders.filter(x => x !== g)
                          )}
                        />
                        <label htmlFor={`exp-g-${g}`} className="text-sm cursor-pointer">{g}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Região</label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Sede">Sede</SelectItem>
                <SelectItem value="Distrito">Distrito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Distrito/Sede</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedDistricts.length === 0 ? 'Todos' : `${selectedDistricts.length} selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Selecione distritos/sedes</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDistricts([])}>Limpar</Button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {districts.map(d => (
                      <div key={d as string} className="flex items-center space-x-2">
                        <Checkbox
                          id={`exp-dist-${d}`}
                          checked={selectedDistricts.includes(d as string)}
                          onCheckedChange={checked => setSelectedDistricts(
                            checked ? [...selectedDistricts, d as string] : selectedDistricts.filter(x => x !== d)
                          )}
                        />
                        <label htmlFor={`exp-dist-${d}`} className="text-sm font-medium leading-none cursor-pointer">{d}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bairro/Comunidade</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedNeighborhoods.length === 0 ? 'Todos' : `${selectedNeighborhoods.length} selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Selecione bairros/comunidades</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedNeighborhoods([])}>Limpar</Button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {neighborhoods.map(n => (
                      <div key={n as string} className="flex items-center space-x-2">
                        <Checkbox
                          id={`exp-neigh-${n}`}
                          checked={selectedNeighborhoods.includes(n as string)}
                          onCheckedChange={checked => setSelectedNeighborhoods(
                            checked ? [...selectedNeighborhoods, n as string] : selectedNeighborhoods.filter(x => x !== n)
                          )}
                        />
                        <label htmlFor={`exp-neigh-${n}`} className="text-sm font-medium leading-none cursor-pointer">{n}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {periodPreset === 'custom' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                      <CalendarBlank size={16} className="mr-2" />
                      {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR}
                      disabled={date => !!endDate && date > endDate} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                      <CalendarBlank size={16} className="mr-2" />
                      {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR}
                      disabled={date => !!startDate && date < startDate} />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>

        {/* Contador + Limpar Filtros */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredCount}</span> registro(s) encontrado(s)
          </div>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X size={14} className="mr-2" /> Limpar Filtros
          </Button>
        </div>

        <Separator />

        {/* Botões de exportação — usam apenas os dados filtrados */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Exportar dados filtrados</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button
              variant="outline"
              className="gap-2"
              disabled={filteredCount === 0}
              onClick={() => {
                exportToCSV(filterAppointments(), locations)
                toast.success('CSV exportado!')
              }}
            >
              <FileCsv size={18} />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={filteredCount === 0}
              onClick={() => {
                exportToJSON(filterAppointments(), locations)
                toast.success('JSON exportado!')
              }}
            >
              <Download size={18} />
              Exportar JSON
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={filteredCount === 0}
              onClick={() => {
                exportToExcel(filterAppointments(), locations)
                toast.success('Excel exportado!')
              }}
            >
              <FileXls size={18} />
              Exportar Excel
            </Button>
            <Button
              className="gap-2 button-glow"
              disabled={filteredCount === 0}
              onClick={() => {
                exportToPDF(filterAppointments(), locations, systemName || 'Relatório de Agendamentos')
                toast.success('PDF gerado!')
              }}
            >
              <FilePdf size={18} />
              Exportar PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
