import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog'
import {
  ClockCounterClockwise,
  MagnifyingGlass,
  Download,
  User,
  SignIn,
  SignOut,
  X
} from '@phosphor-icons/react'
import type { Appointment, AuditLog } from '@/lib/types'
import { getAuditLogs } from '@/lib/audit-logger'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

interface AuditReportProps {
  appointments: Appointment[]
}

type AccessEvent = 'login' | 'logout'

interface AccessLogEntry {
  id: string
  userName: string
  event: AccessEvent
  performedAt: string
  ipAddress?: string
}

interface ActiveUserSession {
  userName: string
  lastLoginAt: string
  ipAddress?: string
}

const normalizeAccessEvent = (action?: string): AccessEvent | null => {
  const key = String(action || '').trim().toLowerCase()
  if (key === 'user_login') return 'login'
  if (key === 'user_logout') return 'logout'
  return null
}

export function AuditReport({ appointments: _appointments }: AuditReportProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'login' | 'logout'>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [logs, setLogs] = useState<AccessLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadAccessLogs = async () => {
      setLoading(true)
      try {
        const auditLogs = await getAuditLogs()
        const accessLogs = (auditLogs || []).reduce<AccessLogEntry[]>((acc, log: AuditLog) => {
            const event = normalizeAccessEvent(log.action)
            if (!event) return acc

            const userName = String(log.performedBy || '').trim()
            if (!userName) return acc

            acc.push({
              id: log.id,
              userName,
              event,
              performedAt: log.performedAt,
              ipAddress: log.ipAddress
            })

            return acc
          }, [])
          .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())

        setLogs(accessLogs)
      } catch {
        setLogs([])
      } finally {
        setLoading(false)
      }
    }

    loadAccessLogs()
  }, [])

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>()
    logs.forEach((entry) => users.add(entry.userName))
    return Array.from(users).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [logs])

  const activeUserSessions = useMemo(() => {
    const lastEventByUser = new Map<string, AccessEvent>()
    const lastLoginByUser = new Map<string, AccessLogEntry>()

    const orderedLogs = [...logs].sort(
      (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
    )

    orderedLogs.forEach((entry) => {
      lastEventByUser.set(entry.userName, entry.event)
      if (entry.event === 'login') {
        lastLoginByUser.set(entry.userName, entry)
      }
    })

    const sessions: ActiveUserSession[] = []
    lastEventByUser.forEach((event, userName) => {
      if (event === 'login') {
        const lastLogin = lastLoginByUser.get(userName)
        sessions.push({
          userName,
          lastLoginAt: lastLogin?.performedAt || new Date().toISOString(),
          ipAddress: lastLogin?.ipAddress
        })
      }
    })

    return sessions.sort((a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime())
  }, [logs])

  const activeUsersSet = useMemo(() => {
    return new Set(activeUserSessions.map((session) => session.userName))
  }, [activeUserSessions])

  const activeUsersCount = activeUsersSet.size

  const filteredLogs = useMemo(() => {
    let filtered = logs

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((entry) => entry.userName.toLowerCase().includes(term))
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.userName === userFilter)
    }

    if (statusFilter === 'login') {
      filtered = filtered.filter((entry) => entry.event === 'login')
    }

    if (statusFilter === 'logout') {
      filtered = filtered.filter((entry) => entry.event === 'logout')
    }

    if (statusFilter === 'active') {
      filtered = activeUserSessions.map((session) => ({
        id: `active-${session.userName}`,
        userName: session.userName,
        event: 'login' as AccessEvent,
        performedAt: session.lastLoginAt,
        ipAddress: session.ipAddress
      }))
    }

    if (dateFrom) {
      const fromDate = startOfDay(parseISO(dateFrom))
      filtered = filtered.filter((entry) => {
        const entryDate = parseISO(entry.performedAt)
        return isAfter(entryDate, fromDate) || entryDate.getTime() === fromDate.getTime()
      })
    }

    if (dateTo) {
      const toDate = endOfDay(parseISO(dateTo))
      filtered = filtered.filter((entry) => {
        const entryDate = parseISO(entry.performedAt)
        return isBefore(entryDate, toDate) || entryDate.getTime() === toDate.getTime()
      })
    }

    return filtered
  }, [logs, searchTerm, userFilter, statusFilter, dateFrom, dateTo, activeUsersSet])

  const hasActiveFilters = Boolean(searchTerm.trim() || statusFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo)

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setUserFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const exportAccessLogPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4')
    const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

    doc.setFontSize(16)
    doc.text('Relatório de Acessos', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em: ${generatedAt}`, 14, 21)
    doc.text(`Usuários ativos no momento: ${activeUsersCount}`, 14, 27)

    autoTable(doc, {
      startY: 32,
      head: [['Data/Hora', 'Usuário', 'Evento', 'IP']],
      body: filteredLogs.map((entry) => [
        format(parseISO(entry.performedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        entry.userName,
        entry.event === 'login' ? 'Login' : 'Logout',
        entry.ipAddress || '-'
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] }
    })

    doc.save(`acessos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)
  }

  const exportAccessLogXLSX = () => {
    const rows = filteredLogs.map((entry) => ({
      'Data/Hora': format(parseISO(entry.performedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      'Usuário': entry.userName,
      'Evento': entry.event === 'login' ? 'Login' : 'Logout',
      'IP': entry.ipAddress || ''
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Acessos')
    XLSX.writeFile(wb, `acessos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ClockCounterClockwise size={18} weight="duotone" />
          Relatório de Auditoria
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95vw] max-w-5xl max-h-[94vh] overflow-x-hidden p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ClockCounterClockwise size={24} weight="duotone" />
            Relatório de Acessos
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Controle de entrada e saída no sistema por usuário, com dia e hora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <Card className="w-full">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Usuários Ativos no Momento</p>
                <p className="text-base sm:text-lg font-bold leading-none pr-1">{activeUsersCount}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 min-w-0">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome do usuário..."
                  className="pl-9 h-9 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 sm:shrink-0">
                <Button onClick={exportAccessLogPDF} size="sm" variant="outline" className="gap-2 text-xs min-w-[116px]" disabled={filteredLogs.length === 0}>
                  <Download size={16} />
                  Exportar PDF
                </Button>

                <Button onClick={exportAccessLogXLSX} size="sm" variant="outline" className="gap-2 text-xs min-w-[116px]" disabled={filteredLogs.length === 0}>
                  <Download size={16} />
                  Exportar XLSX
                </Button>
              </div>
            </div>

            <Card className="p-3 sm:p-4 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Usuário</Label>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos os usuários" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      {uniqueUsers.map((user) => (
                        <SelectItem key={user} value={user}>{user}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'login' | 'logout')}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="logout">Logout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Data Inicial</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 text-sm pr-0 [::-webkit-calendar-picker-indicator]:mr-0 [::-webkit-calendar-picker-indicator]:ml-0 [::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Data Final</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 text-sm pr-0 [::-webkit-calendar-picker-indicator]:mr-0 [::-webkit-calendar-picker-indicator]:ml-0 [::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {filteredLogs.length} acesso(s) encontrado(s)
                  </p>
                  <Button onClick={clearFilters} variant="ghost" size="sm" className="gap-2 text-xs">
                    <X size={16} />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <ScrollArea className="h-[56vh] pr-1 sm:pr-2">
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-12 text-sm text-muted-foreground">Carregando acessos...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12">
                  <ClockCounterClockwise className="mx-auto text-muted-foreground mb-4" size={64} weight="duotone" />
                  <p className="text-base text-muted-foreground">Nenhum acesso registrado</p>
                </div>
              ) : (
                filteredLogs.map((entry) => (
                  <Card key={entry.id} className="p-3 sm:p-4">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {entry.event === 'login' ? (
                          <SignIn size={16} className="text-emerald-600" weight="bold" />
                        ) : (
                          <SignOut size={16} className="text-rose-600" weight="bold" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{entry.userName}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <User size={12} />
                            <span>{entry.event === 'login' ? 'Entrou no sistema' : 'Saiu do sistema'}</span>
                            {entry.ipAddress && <span>• IP {entry.ipAddress}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Badge variant="outline" className={entry.event === 'login' ? 'text-emerald-700 border-emerald-300 text-[11px]' : 'text-rose-700 border-rose-300 text-[11px]'}>
                          {entry.event === 'login' ? 'Login' : 'Logout'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {format(parseISO(entry.performedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
