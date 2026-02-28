import { useMemo, useState } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IdentificationCard, TrendUp, Calendar, Download } from '@phosphor-icons/react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { Appointment } from '@/lib/types'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface RGTypeReportProps {
  appointments: Appointment[]
  systemName?: string
}

const COLORS = {
  '1ª via': '#3b82f6',
  '2ª via': '#8b5cf6'
}

export function RGTypeReport({ appointments, systemName = 'Sistema de Agendamento' }: RGTypeReportProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [selectedMonth, setSelectedMonth] = useState('')
  const [viewMode, setViewMode] = useState<'year' | 'month'>('year')

  const years = useMemo(() => {
    const yearsSet = new Set<number>()
    appointments.forEach(apt => {
      const year = parseISO(apt.date).getFullYear()
      yearsSet.add(year)
    })
    const yearsList = Array.from(yearsSet).sort((a, b) => b - a)
    return yearsList.length > 0 ? yearsList : [currentYear]
  }, [appointments, currentYear])

  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ]

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.date)
      const aptYear = aptDate.getFullYear().toString()
      
      if (viewMode === 'year') {
        return aptYear === selectedYear
      } else {
        const aptMonth = format(aptDate, 'MM')
        return aptYear === selectedYear && aptMonth === selectedMonth
      }
    })
  }, [appointments, selectedYear, selectedMonth, viewMode])

  const summary = useMemo(() => {
    const primeiraVia = filteredAppointments.filter(apt => apt.rgType === '1ª via').length
    const segundaVia = filteredAppointments.filter(apt => apt.rgType === '2ª via').length
    const total = primeiraVia + segundaVia
    
    return {
      primeiraVia,
      segundaVia,
      total,
      percentPrimeiraVia: total > 0 ? ((primeiraVia / total) * 100).toFixed(1) : '0',
      percentSegundaVia: total > 0 ? ((segundaVia / total) * 100).toFixed(1) : '0'
    }
  }, [filteredAppointments])

  const monthlyData = useMemo(() => {
    if (viewMode !== 'year') return []
    
    const year = parseInt(selectedYear)
    const startDate = startOfYear(new Date(year, 0, 1))
    const endDate = endOfYear(new Date(year, 11, 31))
    const monthsInYear = eachMonthOfInterval({ start: startDate, end: endDate })
    
    return monthsInYear.map(month => {
      const monthStr = format(month, 'MM')
      const monthName = format(month, 'MMM', { locale: ptBR })
      
      const appointmentsInMonth = appointments.filter(apt => {
        const aptDate = parseISO(apt.date)
        return format(aptDate, 'yyyy-MM') === `${selectedYear}-${monthStr}`
      })
      
      const primeiraVia = appointmentsInMonth.filter(apt => apt.rgType === '1ª via').length
      const segundaVia = appointmentsInMonth.filter(apt => apt.rgType === '2ª via').length
      
      return {
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        '1ª via': primeiraVia,
        '2ª via': segundaVia,
        total: primeiraVia + segundaVia
      }
    })
  }, [appointments, selectedYear, viewMode])

  const dailyData = useMemo(() => {
    if (viewMode !== 'month' || !selectedMonth) return []
    
    const year = parseInt(selectedYear)
    const month = parseInt(selectedMonth) - 1
    const startDate = startOfMonth(new Date(year, month, 1))
    const endDate = endOfMonth(new Date(year, month, 1))
    
    const daysInMonth: { [key: string]: { primeiraVia: number; segundaVia: number } } = {}
    
    filteredAppointments.forEach(apt => {
      const day = format(parseISO(apt.date), 'dd')
      if (!daysInMonth[day]) {
        daysInMonth[day] = { primeiraVia: 0, segundaVia: 0 }
      }
      if (apt.rgType === '1ª via') {
        daysInMonth[day].primeiraVia++
      } else if (apt.rgType === '2ª via') {
        daysInMonth[day].segundaVia++
      }
    })
    
    return Object.entries(daysInMonth)
      .map(([day, data]) => ({
        day: `Dia ${day}`,
        '1ª via': data.primeiraVia,
        '2ª via': data.segundaVia,
        total: data.primeiraVia + data.segundaVia
      }))
      .sort((a, b) => parseInt(a.day.split(' ')[1]) - parseInt(b.day.split(' ')[1]))
  }, [filteredAppointments, selectedYear, selectedMonth, viewMode])

  const pieData = useMemo(() => {
    return [
      { name: '1ª via', value: summary.primeiraVia, color: COLORS['1ª via'] },
      { name: '2ª via', value: summary.segundaVia, color: COLORS['2ª via'] }
    ].filter(item => item.value > 0)
  }, [summary])

  const exportToPDF = () => {
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text(`${systemName}`, 14, 20)
    doc.setFontSize(14)
    doc.text('Relatório Comparativo - 1ª via vs 2ª via', 14, 30)
    
    doc.setFontSize(10)
    const period = viewMode === 'year' 
      ? `Ano: ${selectedYear}`
      : `${months.find(m => m.value === selectedMonth)?.label} de ${selectedYear}`
    doc.text(period, 14, 40)
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 46)
    
    const summaryData = [
      ['Tipo de RG', 'Quantidade', 'Percentual'],
      ['1ª via', summary.primeiraVia.toString(), `${summary.percentPrimeiraVia}%`],
      ['2ª via', summary.segundaVia.toString(), `${summary.percentSegundaVia}%`],
      ['Total', summary.total.toString(), '100%']
    ]
    
    ;(doc as any).autoTable({
      head: [summaryData[0]],
      body: summaryData.slice(1),
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    })
    
    if (viewMode === 'year' && monthlyData.length > 0) {
      const monthlyTableData = monthlyData.map(row => [
        row.month,
        row['1ª via'].toString(),
        row['2ª via'].toString(),
        row.total.toString()
      ])
      
      ;(doc as any).autoTable({
        head: [['Mês', '1ª via', '2ª via', 'Total']],
        body: monthlyTableData,
        startY: (doc as any).lastAutoTable.finalY + 10,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
      })
    }
    
    if (viewMode === 'month' && dailyData.length > 0) {
      const dailyTableData = dailyData.map(row => [
        row.day,
        row['1ª via'].toString(),
        row['2ª via'].toString(),
        row.total.toString()
      ])
      
      ;(doc as any).autoTable({
        head: [['Dia', '1ª via', '2ª via', 'Total']],
        body: dailyTableData,
        startY: (doc as any).lastAutoTable.finalY + 10,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
      })
    }
    
    const fileName = viewMode === 'year'
      ? `relatorio-CIN-tipo-${selectedYear}.pdf`
      : `relatorio-CIN-tipo-${selectedYear}-${selectedMonth}.pdf`
    
    doc.save(fileName)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <IdentificationCard size={28} weight="duotone" className="text-primary" />
                Relatório Comparativo - 1ª via vs 2ª via
              </CardTitle>
              <CardDescription className="mt-2">
                Análise detalhada da quantidade de 1ª e 2ª vias emitidas por período
              </CardDescription>
            </div>
            <Button onClick={exportToPDF} className="gap-2" size="lg">
              <Download size={20} />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Visualização</label>
              <Select value={viewMode} onValueChange={(v: 'year' | 'month') => setViewMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Por Ano</SelectItem>
                  <SelectItem value="month">Por Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {viewMode === 'month' && (
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Mês</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-1">1ª via</p>
                    <p className="text-3xl font-bold text-blue-900">{summary.primeiraVia}</p>
                    <p className="text-xs text-blue-600 mt-1">{summary.percentPrimeiraVia}% do total</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <IdentificationCard size={24} weight="duotone" className="text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700 mb-1">2ª via</p>
                    <p className="text-3xl font-bold text-purple-900">{summary.segundaVia}</p>
                    <p className="text-xs text-purple-600 mt-1">{summary.percentSegundaVia}% do total</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <IdentificationCard size={24} weight="duotone" className="text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground/70 mb-1">Total</p>
                    <p className="text-3xl font-bold text-foreground">{summary.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">Emissões no período</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendUp size={24} weight="duotone" className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {summary.total === 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="py-8">
                <div className="text-center">
                  <Calendar size={48} weight="duotone" className="text-yellow-600 mx-auto mb-3" />
                  <p className="text-lg font-medium text-yellow-900 mb-1">
                    Nenhum agendamento encontrado
                  </p>
                  <p className="text-sm text-yellow-700">
                    Não há dados para o período selecionado
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {summary.total > 0 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Distribuição por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Comparação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS['1ª via'] }} />
                            1ª via
                          </span>
                          <span className="text-sm font-bold">{summary.primeiraVia}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{ 
                              width: `${summary.percentPrimeiraVia}%`,
                              backgroundColor: COLORS['1ª via']
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{summary.percentPrimeiraVia}% do total</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS['2ª via'] }} />
                            2ª via
                          </span>
                          <span className="text-sm font-bold">{summary.segundaVia}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{ 
                              width: `${summary.percentSegundaVia}%`,
                              backgroundColor: COLORS['2ª via']
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{summary.percentSegundaVia}% do total</p>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Total</span>
                          <Badge variant="secondary" className="text-base px-3 py-1">
                            {summary.total} emissões
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {viewMode === 'year' && monthlyData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Evolução Mensal - {selectedYear}</CardTitle>
                    <CardDescription>Comparação mês a mês de 1ª e 2ª vias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="1ª via" fill={COLORS['1ª via']} />
                        <Bar dataKey="2ª via" fill={COLORS['2ª via']} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {viewMode === 'month' && dailyData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Detalhamento Diário - {months.find(m => m.value === selectedMonth)?.label} de {selectedYear}
                    </CardTitle>
                    <CardDescription>Comparação dia a dia de 1ª e 2ª vias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="1ª via" stroke={COLORS['1ª via']} strokeWidth={2} />
                        <Line type="monotone" dataKey="2ª via" stroke={COLORS['2ª via']} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
