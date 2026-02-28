import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChartBar, TrendUp, User, ShieldWarning, Pulse, Calendar, Clock, Target } from '@phosphor-icons/react'
import { BarChart, Bar, PieChart, Pie, LineChart, Line, AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AuditLog, AuditSeverity, AuditActionType } from '@/lib/types'
import { motion } from 'framer-motion'
import { toFirstAndSecondName } from '@/lib/name-utils'

interface AuditMetricsDashboardProps {
  logs: AuditLog[]
}

const SEVERITY_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
}

const SEVERITY_LABELS = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alta',
  critical: 'Crítica',
}

const ACTION_CATEGORY_LABELS: Record<string, string> = {
  appointment: 'Agendamentos',
  location: 'Localidades',
  user: 'Usuários',
  blocked_date: 'Bloqueios',
  config: 'Configurações',
  data: 'Dados',
  report: 'Relatórios',
  rg: 'CIN',
  system: 'Sistema',
}

const translateToPtBr = (input?: string) => {
  if (!input) return ''
  const replacements: Array<[RegExp, string]> = [
    [/\bwaiting-issuance\b/gi, 'aguardando confecção'],
    [/\bawaiting-issuance\b/gi, 'aguardando confecção'],
    [/\bcin-ready\b/gi, 'cin pronta'],
    [/\bcin-delivered\b/gi, 'cin entregue'],
    [/\bin-progress\b/gi, 'em atendimento'],
    [/\bcompleted\b/gi, 'concluído'],
    [/\bconfirmed\b/gi, 'confirmado'],
    [/\bcancelled\b/gi, 'cancelado'],
    [/\bcanceled\b/gi, 'cancelado'],
    [/\bno-show\b/gi, 'faltou'],
    [/\bpending\b/gi, 'pendente'],
    [/\bsuccess\b/gi, 'sucesso'],
    [/\bfailed\b/gi, 'falha'],
    [/\berror\b/gi, 'erro']
  ]
  return replacements.reduce((acc, [pattern, value]) => acc.replace(pattern, value), input)
}

export function AuditMetricsDashboard({ logs }: AuditMetricsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week')
  const [selectedUser, setSelectedUser] = useState<string>('all')

  const parseLogDate = (value?: string | null) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const formatLogDate = (value?: string, pattern = "dd/MM/yyyy 'às' HH:mm") => {
    const date = parseLogDate(value)
    return date ? format(date, pattern, { locale: ptBR }) : 'Data não informada'
  }

  const DEFAULT_SEVERITY: AuditSeverity = 'medium'

  const resolveSeverity = (value?: AuditSeverity | string | null): AuditSeverity => {
    const normalized = String(value || '').toLowerCase()
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
      return normalized
    }
    if (normalized === 'baixo' || normalized === 'baixa') return 'low'
    if (normalized === 'medio' || normalized === 'médio' || normalized === 'média') return 'medium'
    if (normalized === 'alta') return 'high'
    if (normalized === 'critica' || normalized === 'crítica') return 'critical'
    return DEFAULT_SEVERITY
  }

  const filteredLogs = useMemo(() => {
    let filtered = [...logs]

    const now = new Date()
    let dateRange: { start: Date; end: Date } | null = null

    switch (timeRange) {
      case 'today':
        dateRange = { start: startOfDay(now), end: endOfDay(now) }
        break
      case 'week':
        dateRange = { start: startOfWeek(now, { locale: ptBR }), end: now }
        break
      case 'month':
        dateRange = { start: startOfMonth(now), end: now }
        break
    }

    if (dateRange) {
      filtered = filtered.filter(log => {
        const date = parseLogDate(log.performedAt)
        return date ? isWithinInterval(date, dateRange!) : false
      })
    }

    if (selectedUser !== 'all') {
      filtered = filtered.filter(log => toFirstAndSecondName(log.performedBy) === selectedUser)
    }

    return filtered.sort((a, b) => {
      const aTime = parseLogDate(a.performedAt)?.getTime() ?? 0
      const bTime = parseLogDate(b.performedAt)?.getTime() ?? 0
      return bTime - aTime
    })
  }, [logs, timeRange, selectedUser])

  const uniqueUsers = useMemo(() => {
    const users = new Set(logs.map(log => toFirstAndSecondName(log.performedBy)))
    return Array.from(users).sort()
  }, [logs])

  const metrics = useMemo(() => {
    const severityCount: Record<AuditSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    const userActionCount: Record<string, number> = {}
    const actionTypeCount: Record<string, number> = {}
    const categoryCount: Record<string, number> = {}
    const roleCount: Record<string, number> = {}
    const hourlyActivity: Record<number, number> = {}

    filteredLogs.forEach(log => {
      const severity = resolveSeverity(log.severity)
      severityCount[severity]++
      
      const userLabel = toFirstAndSecondName(log.performedBy)
      userActionCount[userLabel] = (userActionCount[userLabel] || 0) + 1
      
      const actionLabel = translateToPtBr(log.actionLabel)
      actionTypeCount[actionLabel] = (actionTypeCount[actionLabel] || 0) + 1
      
      const category = (log.action || 'sem_categoria').split('_')[0]
      categoryCount[category] = (categoryCount[category] || 0) + 1
      
      const role = log.performedByRole || 'system'
      roleCount[role] = (roleCount[role] || 0) + 1
      
      const logDate = parseLogDate(log.performedAt)
      const hour = logDate ? logDate.getHours() : 0
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1
    })

    return {
      total: filteredLogs.length,
      severityCount,
      userActionCount,
      actionTypeCount,
      categoryCount,
      roleCount,
      hourlyActivity,
      criticalCount: severityCount.critical,
      highSeverityCount: severityCount.high + severityCount.critical,
    }
  }, [filteredLogs])

  const severityChartData = useMemo(() => 
    Object.entries(metrics.severityCount)
      .map(([severity, count]) => ({
        name: SEVERITY_LABELS[severity as AuditSeverity],
        value: count,
        color: SEVERITY_COLORS[severity as AuditSeverity],
      }))
      .filter(item => item.value > 0)
  , [metrics.severityCount])

  const topUsersData = useMemo(() => 
    Object.entries(metrics.userActionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([user, count]) => ({
        name: user,
        ações: count,
      }))
  , [metrics.userActionCount])

  const topActionsData = useMemo(() => 
    Object.entries(metrics.actionTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([action, count]) => ({
        name: action,
        quantidade: count,
      }))
  , [metrics.actionTypeCount])

  const categoryData = useMemo(() => 
    Object.entries(metrics.categoryCount)
      .map(([category, count]) => ({
        name: ACTION_CATEGORY_LABELS[category] || category,
        value: count,
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
  , [metrics.categoryCount])

  const roleData = useMemo(() => 
    Object.entries(metrics.roleCount)
      .map(([role, count]) => ({
        name: role === 'admin' ? 'Administrador' : 
              role === 'secretary' ? 'Secretaria' : 
              role === 'user' ? 'Usuário' : 
              'Sistema',
        value: count,
      }))
      .filter(item => item.value > 0)
  , [metrics.roleCount])

  const hourlyActivityData = useMemo(() => {
    const data: Array<{ hora: string; atividade: number }> = []
    for (let hour = 0; hour < 24; hour++) {
      data.push({
        hora: `${hour.toString().padStart(2, '0')}h`,
        atividade: metrics.hourlyActivity[hour] || 0,
      })
    }
    return data
  }, [metrics.hourlyActivity])

  const dailyTrendData = useMemo(() => {
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 1
    const data: Array<{ data: string; ações: number; críticas: number }> = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      
      const dayLogs = filteredLogs.filter(log => {
        const logDate = parseLogDate(log.performedAt)
        return logDate ? format(logDate, 'yyyy-MM-dd') === dateStr : false
      })
      
      data.push({
        data: format(date, 'dd/MMM', { locale: ptBR }),
        ações: dayLogs.length,
        críticas: dayLogs.filter(log => {
          const severity = resolveSeverity(log.severity)
          return severity === 'critical' || severity === 'high'
        }).length,
      })
    }
    
    return data
  }, [filteredLogs, timeRange])

  const criticalLogs = useMemo(() => 
    filteredLogs
      .filter(log => {
        const severity = resolveSeverity(log.severity)
        return severity === 'critical' || severity === 'high'
      })
      .slice(0, 5)
  , [filteredLogs])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ChartBar size={32} weight="duotone" className="text-primary" />
            Dashboard de Métricas de Auditoria
          </h2>
          <p className="text-muted-foreground mt-1">
            Análise visual das ações realizadas no sistema
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {uniqueUsers.map(user => (
                <SelectItem key={user} value={user}>{user}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Ações
              </CardTitle>
              <Pulse size={20} className="text-blue-600" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{metrics.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                registradas no período
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ações Críticas
              </CardTitle>
              <ShieldWarning size={20} className="text-red-600" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{metrics.criticalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                requerem atenção especial
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alta Severidade
              </CardTitle>
              <TrendUp size={20} className="text-orange-600" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{metrics.highSeverityCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ações de alta importância
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuários Ativos
              </CardTitle>
              <User size={20} className="text-purple-600" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {Object.keys(metrics.userActionCount).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                realizaram ações
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {metrics.criticalCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <ShieldWarning size={24} weight="duotone" />
                Ações Críticas Recentes
              </CardTitle>
              <CardDescription className="text-red-600">
                Estas ações requerem atenção imediata pela sua importância
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criticalLogs.map(log => {
                  const severity = resolveSeverity(log.severity)
                  return (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-3 p-3 bg-white rounded-lg border border-red-200"
                  >
                    <Badge 
                      className="mt-0.5"
                      style={{ 
                        backgroundColor: SEVERITY_COLORS[severity],
                        color: 'white'
                      }}
                    >
                      {SEVERITY_LABELS[severity]}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{translateToPtBr(log.actionLabel)}</p>
                      <p className="text-sm text-muted-foreground">{translateToPtBr(log.description)}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {toFirstAndSecondName(log.performedBy)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatLogDate(log.performedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="users">Por Usuário</TabsTrigger>
          <TabsTrigger value="actions">Por Ação</TabsTrigger>
          <TabsTrigger value="trends">Tendências</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target size={20} weight="duotone" />
                  Distribuição por Severidade
                </CardTitle>
                <CardDescription>
                  Classificação de gravidade das ações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={severityChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {severityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartBar size={20} weight="duotone" />
                  Ações por Categoria
                </CardTitle>
                <CardDescription>
                  Distribuição de ações por tipo de entidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User size={20} weight="duotone" />
                  Ações por Perfil
                </CardTitle>
                <CardDescription>
                  Distribuição de ações entre diferentes perfis de usuário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={roleData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {roleData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][index % 4]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={24} weight="duotone" />
                Top 10 Usuários Mais Ativos
              </CardTitle>
              <CardDescription>
                Ranking de usuários por quantidade de ações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={topUsersData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="ações" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pulse size={24} weight="duotone" />
                Tipos de Ações Mais Frequentes
              </CardTitle>
              <CardDescription>
                Ranking das ações mais realizadas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={topActionsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={150}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="quantidade" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendUp size={24} weight="duotone" />
                Tendência de Ações ao Longo do Tempo
              </CardTitle>
              <CardDescription>
                Evolução das ações no período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={dailyTrendData}>
                  <defs>
                    <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="ações" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill="url(#colorActions)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="críticas" 
                    stroke="#ef4444" 
                    fillOpacity={1} 
                    fill="url(#colorCritical)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={24} weight="duotone" />
                Atividade por Hora do Dia
              </CardTitle>
              <CardDescription>
                Distribuição de ações ao longo das 24 horas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={hourlyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="hora" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="atividade" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
