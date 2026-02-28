import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Package, Clock, CheckCircle, Warning, TrendUp, Calendar, FilePdf, Printer, Download, ShareNetwork, Funnel, X, MagnifyingGlass, MapPin } from '@phosphor-icons/react'
import { differenceInDays, differenceInHours, parseISO, format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Appointment, Location } from '@/lib/types'

interface RGDeliveryReportProps {
  appointments: Appointment[]
  locations?: Location[]
  systemName?: string
}

export function RGDeliveryReport({ appointments, locations = [], systemName = 'Sistema de Agendamento' }: RGDeliveryReportProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'awaiting-issuance' | 'cin-ready' | 'cin-delivered'>('all')
  const [overdueFilter, setOverdueFilter] = useState<'all' | 'overdue' | 'normal'>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const filteredAppointments = useMemo(() => {
    let filtered = appointments.filter(apt => 
      apt.status === 'awaiting-issuance' ||
      apt.status === 'cin-ready' ||
      apt.status === 'cin-delivered'
    )

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(apt =>
        apt.fullName.toLowerCase().includes(term) ||
        apt.cpf.includes(term) ||
        apt.protocol.toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter)
    }

    if (overdueFilter !== 'all') {
      filtered = filtered.filter(apt => {
        if (!apt.completedAt) return false
        if (apt.status !== 'awaiting-issuance' && apt.status !== 'cin-ready') return false
        const readyDate = parseISO(apt.completedAt)
        const now = new Date()
        const days = differenceInDays(now, readyDate)
        const isOverdue = days > 7
        return overdueFilter === 'overdue' ? isOverdue : !isOverdue
      })
    }

    if (dateFrom) {
      const fromDate = startOfDay(parseISO(dateFrom))
      filtered = filtered.filter(apt => {
        const aptDate = apt.rgDelivery?.deliveredAt 
          ? parseISO(apt.rgDelivery.deliveredAt)
          : apt.completedAt ? parseISO(apt.completedAt) : null
        if (!aptDate) return false
        return isAfter(aptDate, fromDate) || aptDate.getTime() === fromDate.getTime()
      })
    }

    if (dateTo) {
      const toDate = endOfDay(parseISO(dateTo))
      filtered = filtered.filter(apt => {
        const aptDate = apt.rgDelivery?.deliveredAt 
          ? parseISO(apt.rgDelivery.deliveredAt)
          : apt.completedAt ? parseISO(apt.completedAt) : null
        if (!aptDate) return false
        return isBefore(aptDate, toDate) || aptDate.getTime() === toDate.getTime()
      })
    }

    return filtered
  }, [appointments, searchTerm, statusFilter, overdueFilter, dateFrom, dateTo])

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setOverdueFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || overdueFilter !== 'all' || dateFrom || dateTo

  const stats = useMemo(() => {
    const awaitingIssuance = filteredAppointments.filter(apt => apt.status === 'awaiting-issuance')
    const cinReady = filteredAppointments.filter(apt => apt.status === 'cin-ready')
    const delivered = filteredAppointments.filter(apt => apt.status === 'cin-delivered')
    
    let totalWaitTime = 0
    const waitTimes: number[] = []
    let overdueCount = 0
    
    delivered.forEach(apt => {
      if (apt.completedAt && apt.rgDelivery?.deliveredAt) {
        const readyDate = parseISO(apt.completedAt)
        const deliveredDate = parseISO(apt.rgDelivery.deliveredAt)
        const days = differenceInDays(deliveredDate, readyDate)
        waitTimes.push(days)
        totalWaitTime += days
      }
    })

    const pendingAppointments = [...awaitingIssuance, ...cinReady]
    pendingAppointments.forEach(apt => {
      if (apt.completedAt) {
        const readyDate = parseISO(apt.completedAt)
        const now = new Date()
        const days = differenceInDays(now, readyDate)
        if (days > 7) {
          overdueCount++
        }
      }
    })
    
    const avgWaitTime = waitTimes.length > 0 
      ? (totalWaitTime / waitTimes.length).toFixed(1)
      : '0'
      
    const minWaitTime = waitTimes.length > 0 ? Math.min(...waitTimes) : 0
    const maxWaitTime = waitTimes.length > 0 ? Math.max(...waitTimes) : 0
    
    const medianWaitTime = waitTimes.length > 0 
      ? waitTimes.sort((a, b) => a - b)[Math.floor(waitTimes.length / 2)]
      : 0
    
    const last30Days = delivered.filter(apt => {
      if (!apt.rgDelivery?.deliveredAt) return false
      const deliveredDate = parseISO(apt.rgDelivery.deliveredAt)
      const daysAgo = differenceInDays(new Date(), deliveredDate)
      return daysAgo <= 30
    })
    
    const currentPending = awaitingIssuance.length + cinReady.length
    
    return {
      totalDelivered: delivered.length,
      currentPending,
      avgWaitTime,
      minWaitTime,
      maxWaitTime,
      medianWaitTime,
      overdueCount,
      last30DaysCount: last30Days.length,
      deliveryRate: delivered.length + currentPending > 0 
        ? ((delivered.length / (delivered.length + currentPending)) * 100).toFixed(1)
        : '0'
    }
  }, [filteredAppointments])

  const locationStats = useMemo(() => {
    if (locations.length === 0) return []
    
    return locations.map(location => {
      const locationAppointments = filteredAppointments.filter(apt => apt.locationId === location.id)
      const delivered = locationAppointments.filter(apt => apt.status === 'cin-delivered')
      const awaitingIssuance = locationAppointments.filter(apt => apt.status === 'awaiting-issuance')
      const cinReady = locationAppointments.filter(apt => apt.status === 'cin-ready')
      
      let totalWaitTime = 0
      let waitCount = 0
      
      delivered.forEach(apt => {
        if (apt.completedAt && apt.rgDelivery?.deliveredAt) {
          const readyDate = parseISO(apt.completedAt)
          const deliveredDate = parseISO(apt.rgDelivery.deliveredAt)
          const days = differenceInDays(deliveredDate, readyDate)
          totalWaitTime += days
          waitCount++
        }
      })
      
      const avgWaitTime = waitCount > 0 ? (totalWaitTime / waitCount).toFixed(1) : '0'
      
      return {
        location,
        total: locationAppointments.length,
        delivered: delivered.length,
        awaitingIssuance: awaitingIssuance.length,
        cinReady: cinReady.length,
        avgWaitTime,
        deliveryRate: locationAppointments.length > 0
          ? ((delivered.length / locationAppointments.length) * 100).toFixed(1)
          : '0'
      }
    }).filter(stat => stat.total > 0).sort((a, b) => b.total - a.total)
  }, [filteredAppointments, locations])
  
  const pendingDetails = useMemo(() => {
    return filteredAppointments
      .filter(apt => apt.status === 'awaiting-issuance' || apt.status === 'cin-ready')
      .map(apt => {
        const readyDate = apt.completedAt ? parseISO(apt.completedAt) : new Date()
        const now = new Date()
        const daysWaiting = differenceInDays(now, readyDate)
        const hoursWaiting = differenceInHours(now, readyDate)
        
        return {
          ...apt,
          daysWaiting,
          hoursWaiting,
          isOverdue: daysWaiting > 7,
          phase: apt.status
        }
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting)
  }, [filteredAppointments])

  const deliveredDetails = useMemo(() => {
    return filteredAppointments
      .filter(apt => apt.status === 'cin-delivered')
      .map(apt => {
        const readyDate = apt.completedAt ? parseISO(apt.completedAt) : new Date()
        const deliveredDate = apt.rgDelivery?.deliveredAt ? parseISO(apt.rgDelivery.deliveredAt) : new Date()
        const waitDays = differenceInDays(deliveredDate, readyDate)
        
        return {
          ...apt,
          waitDays
        }
      })
      .sort((a, b) => {
        const dateA = a.rgDelivery?.deliveredAt ? parseISO(a.rgDelivery.deliveredAt) : new Date(0)
        const dateB = b.rgDelivery?.deliveredAt ? parseISO(b.rgDelivery.deliveredAt) : new Date(0)
        return dateB.getTime() - dateA.getTime()
      })
  }, [filteredAppointments])

  const generatePDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 20

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(systemName, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 10
    doc.setFontSize(14)
    doc.text('Relatório de Tempo de Entrega de CIN', pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 15
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumo Estatístico', 14, yPosition)
    
    yPosition += 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    const statsData = [
      ['Métrica', 'Valor'],
      ['Tempo Médio de Espera', `${stats.avgWaitTime} dias`],
      ['Tempo Mediano de Espera', `${stats.medianWaitTime} dias`],
      ['Tempo Mínimo', `${stats.minWaitTime} dias`],
      ['Tempo Máximo', `${stats.maxWaitTime} dias`],
      ['CINs Aguardando Retirada', `${stats.currentPending}`],
      ['CINs Entregues', `${stats.totalDelivered}`],
      ['Taxa de Entrega', `${stats.deliveryRate}%`],
      ['Entregas nos Últimos 30 Dias', `${stats.last30DaysCount}`],
      ['CINs com Mais de 7 Dias', `${stats.overdueCount}`]
    ]

    autoTable(doc, {
      startY: yPosition,
      head: [statsData[0]],
      body: statsData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [69, 134, 85], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    })

    yPosition = (doc as any).lastAutoTable.finalY + 15

    if (yPosition > pageHeight - 40) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('CINs Aguardando Retirada', 14, yPosition)
    
    yPosition += 8

    if (pendingDetails.length > 0) {
      const pendingData = [
        ['Nome', 'Protocolo', 'Dias Aguardando', 'Status']
      ]
      
      pendingDetails.forEach(apt => {
        pendingData.push([
          apt.fullName,
          apt.protocol,
          `${apt.daysWaiting}d`,
          apt.isOverdue ? '⚠ Atrasado' : 'Normal'
        ])
      })

      autoTable(doc, {
        startY: yPosition,
        head: [pendingData[0]],
        body: pendingData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [69, 134, 85], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9 },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 3) {
            const cellValue = data.cell.raw as string
            if (cellValue.includes('Atrasado')) {
              data.cell.styles.textColor = [255, 100, 0]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 15
    } else {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Nenhuma CIN aguardando retirada no momento.', 14, yPosition)
      yPosition += 15
    }

    if (yPosition > pageHeight - 60 && deliveredDetails.length > 0) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Últimas Entregas Realizadas', 14, yPosition)
    
    yPosition += 8

    if (deliveredDetails.length > 0) {
      const deliveredData = [
        ['Nome', 'Protocolo', 'Data Entrega', 'Tempo Espera', 'Recebido Por']
      ]
      
      deliveredDetails.slice(0, 20).forEach(apt => {
        const deliveredDate = apt.rgDelivery?.deliveredAt 
          ? format(parseISO(apt.rgDelivery.deliveredAt), 'dd/MM/yyyy', { locale: ptBR })
          : 'N/A'
        const receivedBy = apt.rgDelivery?.receivedByName || 'N/A'
        
        deliveredData.push([
          apt.fullName,
          apt.protocol,
          deliveredDate,
          `${apt.waitDays}d`,
          receivedBy
        ])
      })

      autoTable(doc, {
        startY: yPosition,
        head: [deliveredData[0]],
        body: deliveredData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [69, 134, 85], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 }
      })
    } else {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Nenhuma CIN foi entregue ainda.', 14, yPosition)
    }

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 10
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Relatório gerado automaticamente pelo ${systemName}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )

    return doc
  }

  const handleDownloadPDF = () => {
    try {
      const doc = generatePDF()
      const fileName = `relatorio-CIN-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`
      doc.save(fileName)
      toast.success('PDF baixado com sucesso!', {
        description: `Arquivo: ${fileName}`
      })
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      toast.error('Erro ao gerar PDF')
    }
  }

  const handlePrintPDF = () => {
    try {
      const doc = generatePDF()
      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      
      const printWindow = window.open(pdfUrl, '_blank')
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print()
        })
        toast.success('Abrindo janela de impressão...')
      } else {
        toast.error('Bloqueador de pop-up detectado. Por favor, permita pop-ups para esta página.')
      }
    } catch (error) {
      console.error('Erro ao imprimir PDF:', error)
      toast.error('Erro ao preparar impressão')
    }
  }

  const handleViewPDF = () => {
    try {
      const doc = generatePDF()
      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      
      window.open(pdfUrl, '_blank')
      toast.success('PDF aberto em nova aba')
    } catch (error) {
      console.error('Erro ao visualizar PDF:', error)
      toast.error('Erro ao visualizar PDF')
    }
  }

  const handleSharePDF = async () => {
    try {
      const doc = generatePDF()
      const pdfBlob = doc.output('blob')
      const fileName = `relatorio-CIN-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`
      
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Relatório de Entrega de CIN',
          text: 'Relatório de tempo de entrega de documentos CIN',
          files: [file]
        })
        toast.success('Compartilhado com sucesso!')
      } else {
        const pdfUrl = URL.createObjectURL(pdfBlob)
        await navigator.clipboard.writeText(pdfUrl)
        toast.info('Link copiado para área de transferência', {
          description: 'Cole em um navegador para visualizar'
        })
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error)
      toast.error('Erro ao compartilhar PDF')
    }
  }

  return (
    <div className="space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            <Package size={28} weight="duotone" className="text-primary" />
            Relatório de Tempo de Entrega de CIN
          </h2>
          <p className="text-muted-foreground">
            Análise do tempo médio de espera para retirada de documentos
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleDownloadPDF}
            className="gap-2"
            size="sm"
          >
            <Download size={18} weight="bold" />
            Baixar PDF
          </Button>
          
          <Button 
            onClick={handleViewPDF}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <FilePdf size={18} weight="duotone" />
            Visualizar
          </Button>
          
          <Button 
            onClick={handlePrintPDF}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <Printer size={18} weight="duotone" />
            Imprimir
          </Button>
          
          <Button 
            onClick={handleSharePDF}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <ShareNetwork size={18} weight="duotone" />
            Compartilhar
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, CPF ou protocolo..."
                className="pl-10"
              />
            </div>
            <Button 
              onClick={() => setShowFilters(!showFilters)} 
              variant={showFilters ? "default" : "outline"} 
              className="gap-2"
            >
              <Funnel size={18} />
              Filtros
            </Button>
          </div>

          {showFilters && (
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="awaiting-issuance">Aguardando Emissão</SelectItem>
                        <SelectItem value="cin-ready">CIN Prontas</SelectItem>
                        <SelectItem value="cin-delivered">CIN Entregues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Situação</Label>
                  <Select value={overdueFilter} onValueChange={(v: any) => setOverdueFilter(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="overdue">Atrasados (+7 dias)</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {filteredAppointments.length} registro(s) encontrado(s)
                  </p>
                  <Button 
                    onClick={clearFilters} 
                    variant="ghost" 
                    size="sm"
                    className="gap-2"
                  >
                    <X size={16} />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Médio de Espera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">
                {stats.avgWaitTime}
              </span>
              <span className="text-muted-foreground">dias</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock size={14} />
              Média geral
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Mediano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">
                {stats.medianWaitTime}
              </span>
              <span className="text-muted-foreground">dias</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Min: {stats.minWaitTime}d | Max: {stats.maxWaitTime}d
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aguardando Retirada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-600">
                {stats.currentPending}
              </span>
              <span className="text-muted-foreground">CINs</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Package size={14} />
              Prontos para entrega
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entregas Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">
                {stats.totalDelivered}
              </span>
              <span className="text-muted-foreground">CINs</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle size={14} />
              Taxa: {stats.deliveryRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {stats.overdueCount > 0 && (
        <Card className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
              <Warning size={24} weight="fill" />
              Atenção: CINs com mais de 7 dias aguardando retirada
            </CardTitle>
            <CardDescription className="text-orange-600 dark:text-orange-400">
              {stats.overdueCount} documento(s) aguardando há mais de 1 semana
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar size={24} weight="duotone" />
            Últimos 30 Dias
          </CardTitle>
          <CardDescription>
            {stats.last30DaysCount} CIN(s) entregue(s) no último mês
          </CardDescription>
        </CardHeader>
      </Card>

      {pendingDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>CINs Aguardando Retirada - Detalhamento</CardTitle>
            <CardDescription>
              Lista ordenada por tempo de espera (maior para menor)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingDetails.slice(0, 10).map((apt) => (
                <div 
                  key={apt.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    apt.isOverdue 
                      ? 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20' 
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{apt.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      Protocolo: {apt.protocol}
                    </p>
                    {apt.completedAt && (
                      <p className="text-xs text-muted-foreground">
                        Pronto desde: {format(parseISO(apt.completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${apt.isOverdue ? 'text-orange-600' : 'text-muted-foreground'}`}>
                      {apt.daysWaiting}d
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {apt.hoursWaiting}h total
                    </p>
                    {apt.isOverdue && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
                        <Warning size={12} weight="fill" />
                        Atrasado
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {pendingDetails.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  + {pendingDetails.length - 10} CIN(s) aguardando retirada
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {locationStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin size={24} weight="duotone" className="text-primary" />
              Estatísticas por Localidade
            </CardTitle>
            <CardDescription>
              Análise de entrega de CIN por sede/distrito
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {locationStats.map((stat) => (
                <div key={stat.location.id} className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin size={18} weight="fill" className="text-primary" />
                        <h4 className="font-bold text-lg">{stat.location.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{stat.location.address}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">{stat.total}</div>
                      <p className="text-xs text-muted-foreground">total</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">CINs Pendentes</p>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-purple-600" weight="duotone" />
                        <p className="text-xl font-bold text-purple-600">{stat.awaitingIssuance + stat.cinReady}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Em emissão: {stat.awaitingIssuance} • Prontas: {stat.cinReady}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Entregues</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-600" weight="fill" />
                        <p className="text-xl font-bold text-green-600">{stat.delivered}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Tempo Médio</p>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-blue-600" weight="duotone" />
                        <p className="text-xl font-bold text-blue-600">{stat.avgWaitTime}<span className="text-sm text-muted-foreground ml-1">d</span></p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
                      <div className="flex items-center gap-2">
                        <TrendUp size={16} className="text-orange-600" weight="duotone" />
                        <p className="text-xl font-bold text-orange-600">{stat.deliveryRate}<span className="text-sm text-muted-foreground">%</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
