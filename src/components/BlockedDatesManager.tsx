import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { CalendarBlank, Trash, Plus, Clock, CalendarX, TrashSimple } from '@phosphor-icons/react'
import { format, parseISO, addDays, startOfMonth, endOfMonth, addMonths, isSaturday, isSunday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import type { BlockedDate } from '@/lib/types'

interface BlockedDatesManagerProps {
  blockedDates: BlockedDate[]
  onAddBlockedDate: (date: string, reason: string, blockType: 'full-day' | 'specific-times', blockedTimes?: string[], silent?: boolean) => void
  onDeleteBlockedDate: (id: string, silent?: boolean) => void
  currentUser: string
  workingHours?: string[]
}

const DEFAULT_WORKING_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

export function BlockedDatesManager({ 
  blockedDates, 
  onAddBlockedDate, 
  onDeleteBlockedDate,
  currentUser,
  workingHours = DEFAULT_WORKING_HOURS
}: BlockedDatesManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isWeekendDialogOpen, setIsWeekendDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [reason, setReason] = useState('')
  const [blockType, setBlockType] = useState<'full-day' | 'specific-times'>('full-day')
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set())
  const [blockSaturdays, setBlockSaturdays] = useState(true)
  const [blockSundays, setBlockSundays] = useState(true)
  const [weekendMonths, setWeekendMonths] = useState(3)

  const handleAddBlockedDate = () => {
    if (!selectedDate || !reason.trim()) {
      toast.error('Preencha a data e o motivo do bloqueio')
      return
    }

    if (blockType === 'specific-times' && selectedTimes.size === 0) {
      toast.error('Selecione pelo menos um horário para bloquear')
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existingBlock = blockedDates.find(bd => bd.date === dateStr)
    
    if (existingBlock) {
      toast.error('Já existe um bloqueio para esta data')
      return
    }

    onAddBlockedDate(
      dateStr, 
      reason, 
      blockType,
      blockType === 'specific-times' ? Array.from(selectedTimes) : undefined
    )
    
    setSelectedDate(undefined)
    setReason('')
    setBlockType('full-day')
    setSelectedTimes(new Set())
    setIsDialogOpen(false)
  }

  const handleToggleTime = (time: string) => {
    const newTimes = new Set(selectedTimes)
    if (newTimes.has(time)) {
      newTimes.delete(time)
    } else {
      newTimes.add(time)
    }
    setSelectedTimes(newTimes)
  }

  const handleSelectAllTimes = () => {
    if (selectedTimes.size === workingHours.length) {
      setSelectedTimes(new Set())
    } else {
      setSelectedTimes(new Set(workingHours))
    }
  }

  const handleBlockWeekends = () => {
    if (!blockSaturdays && !blockSundays) {
      toast.error('Selecione pelo menos sábados ou domingos para bloquear')
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = addMonths(today, weekendMonths)
    
    let currentDate = today
    const datesToBlock: Array<{ date: string; dayName: string }> = []

    while (currentDate <= endDate) {
      const shouldBlock = 
        (blockSaturdays && isSaturday(currentDate)) ||
        (blockSundays && isSunday(currentDate))

      if (shouldBlock) {
        const dateStr = format(currentDate, 'yyyy-MM-dd')
        const existingBlock = blockedDates.find(bd => bd.date === dateStr)
        
        if (!existingBlock) {
          const dayName = format(currentDate, 'EEEE', { locale: ptBR })
          datesToBlock.push({ date: dateStr, dayName })
        }
      }
      
      currentDate = addDays(currentDate, 1)
    }

    if (datesToBlock.length === 0) {
      toast.info('Todos os finais de semana já estão bloqueados no período selecionado')
      setIsWeekendDialogOpen(false)
      return
    }

    let reasonText = ''
    if (blockSaturdays && blockSundays) {
      reasonText = 'Final de semana - sem atendimento'
    } else if (blockSaturdays) {
      reasonText = 'Sábado - sem atendimento'
    } else if (blockSundays) {
      reasonText = 'Domingo - sem atendimento'
    }

    datesToBlock.forEach(({ date }) => {
      onAddBlockedDate(date, reasonText, 'full-day', undefined, true)
    })

    const dayTypeText = blockSaturdays && blockSundays 
      ? 'finais de semana' 
      : blockSaturdays 
        ? 'sábados' 
        : 'domingos'

    toast.success(`✅ Bloqueio em lote concluído`, {
      description: `${datesToBlock.length} ${dayTypeText} bloqueados pelos próximos ${weekendMonths} ${weekendMonths === 1 ? 'mês' : 'meses'}`,
      duration: 5000
    })

    setIsWeekendDialogOpen(false)
    setBlockSaturdays(true)
    setBlockSundays(true)
    setWeekendMonths(3)
  }

  const handleDeleteMonthBlocks = (monthKey: string, monthLabel: string) => {
    const blocksToDelete = blockedDates.filter(bd => {
      const blockMonth = format(parseISO(bd.date), 'yyyy-MM')
      return blockMonth === monthKey
    })

    if (blocksToDelete.length === 0) {
      toast.error('Nenhum bloqueio encontrado para este mês')
      return
    }

    toast.promise(
      new Promise((resolve) => {
        blocksToDelete.forEach(block => {
          onDeleteBlockedDate(block.id, true)
        })
        setTimeout(() => resolve(true), 100)
      }),
      {
        loading: 'Removendo bloqueios em lote...',
        success: `✅ ${blocksToDelete.length} bloqueio(s) removido(s) de ${monthLabel}`,
        error: 'Erro ao remover bloqueios'
      }
    )
  }

  const handleDeleteAllBlocks = () => {
    if (blockedDates.length === 0) {
      toast.error('Não há bloqueios para remover')
      return
    }

    toast.promise(
      new Promise((resolve) => {
        blockedDates.forEach(block => {
          onDeleteBlockedDate(block.id, true)
        })
        setTimeout(() => resolve(true), 100)
      }),
      {
        loading: 'Removendo todos os bloqueios em lote...',
        success: `✅ Bloqueio em lote removido: ${blockedDates.length} data(s) desbloqueada(s)`,
        error: 'Erro ao remover bloqueios'
      }
    )
  }

  const isDateBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return blockedDates.some(bd => bd.date === dateStr)
  }

  const sortedBlockedDates = [...blockedDates].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const upcomingBlocks = sortedBlockedDates.filter(bd => 
    new Date(bd.date) >= new Date()
  )

  const pastBlocks = sortedBlockedDates.filter(bd => 
    new Date(bd.date) < new Date()
  )

  const groupBlocksByMonth = (blocks: BlockedDate[]) => {
    const grouped = new Map<string, BlockedDate[]>()
    
    blocks.forEach(block => {
      const date = parseISO(block.date)
      const monthKey = format(date, 'yyyy-MM')
      const monthLabel = format(date, 'MMMM yyyy', { locale: ptBR })
        .split(' ')
        .map((word, index) => index === 0 ? word.toUpperCase() : word)
        .join(' de ')
      
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, [])
      }
      grouped.get(monthKey)?.push(block)
    })
    
    return Array.from(grouped.entries()).map(([key, blocks]) => ({
      monthKey: key,
      monthLabel: format(parseISO(blocks[0].date), 'MMMM yyyy', { locale: ptBR })
        .split(' ')
        .map((word, index) => index === 0 ? word.toUpperCase() : word)
        .join(' de '),
      blocks: blocks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }))
  }

  const upcomingGrouped = groupBlocksByMonth(upcomingBlocks)
  const pastGrouped = groupBlocksByMonth(pastBlocks)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarBlank size={24} weight="duotone" />
              Bloqueio de Datas
            </CardTitle>
            <CardDescription>
              Bloqueie datas específicas (feriados, facultativos) para evitar agendamentos do público
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isWeekendDialogOpen} onOpenChange={setIsWeekendDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarX size={18} weight="duotone" />
                  Bloquear Finais de Semana
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Bloquear Sábados e Domingos</DialogTitle>
                  <DialogDescription>
                    Bloqueie rapidamente todos os finais de semana para os próximos meses
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-3">
                    <Label>Dias a bloquear</Label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <Label htmlFor="block-saturdays" className="font-medium cursor-pointer">
                              Sábados
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Bloquear todos os sábados
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="block-saturdays"
                          checked={blockSaturdays}
                          onCheckedChange={setBlockSaturdays}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <Label htmlFor="block-sundays" className="font-medium cursor-pointer">
                              Domingos
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Bloquear todos os domingos
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="block-sundays"
                          checked={blockSundays}
                          onCheckedChange={setBlockSundays}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weekend-months">Período (meses)</Label>
                    <Input
                      id="weekend-months"
                      type="number"
                      min={1}
                      max={12}
                      value={weekendMonths}
                      onChange={(e) => setWeekendMonths(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                    />
                    <p className="text-sm text-muted-foreground">
                      Bloqueará finais de semana pelos próximos {weekendMonths} mês(es)
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      💡 Esta ação bloqueará automaticamente todos os {
                        blockSaturdays && blockSundays ? 'sábados e domingos' :
                        blockSaturdays ? 'sábados' : 'domingos'
                      } pelos próximos {weekendMonths} mês(es). Datas já bloqueadas serão ignoradas.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsWeekendDialogOpen(false)
                      setBlockSaturdays(true)
                      setBlockSundays(true)
                      setWeekendMonths(3)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleBlockWeekends}
                    disabled={!blockSaturdays && !blockSundays}
                  >
                    Bloquear Finais de Semana
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus size={18} weight="bold" />
                  Bloquear Data Específica
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <DialogHeader className="flex-shrink-0 pb-4">
                <DialogTitle>Bloquear Data</DialogTitle>
                <DialogDescription>
                  Selecione uma data e informe o motivo do bloqueio
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-1 -mx-1">
                <div className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <div className="w-full">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        defaultMonth={new Date()}
                        disabled={(date) => {
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          return date < today || isDateBlocked(date)
                        }}
                        className="rounded-md border w-full"
                      />
                    </div>
                    {selectedDate && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Data selecionada: {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo do Bloqueio</Label>
                    <Input
                      id="reason"
                      placeholder="Ex: Feriado Nacional, Dia Facultativo..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Tipo de Bloqueio</Label>
                    <RadioGroup value={blockType} onValueChange={(v) => setBlockType(v as 'full-day' | 'specific-times')}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full-day" id="full-day" />
                        <Label htmlFor="full-day" className="font-normal cursor-pointer">
                          Dia inteiro (nenhum horário disponível)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="specific-times" id="specific-times" />
                        <Label htmlFor="specific-times" className="font-normal cursor-pointer">
                          Horários específicos (selecionar quais horários bloquear)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {blockType === 'specific-times' && (
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Clock size={18} weight="duotone" />
                          Selecionar Horários para Bloquear
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAllTimes}
                        >
                          {selectedTimes.size === workingHours.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                        {workingHours.map((time) => (
                          <div key={time} className="flex items-center space-x-2">
                            <Checkbox
                              id={`time-${time}`}
                              checked={selectedTimes.has(time)}
                              onCheckedChange={() => handleToggleTime(time)}
                            />
                            <Label
                              htmlFor={`time-${time}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {time}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {selectedTimes.size > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {selectedTimes.size} horário(s) selecionado(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setSelectedDate(undefined)
                    setReason('')
                    setBlockType('full-day')
                    setSelectedTimes(new Set())
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddBlockedDate}
                  disabled={!selectedDate || !reason.trim() || (blockType === 'specific-times' && selectedTimes.size === 0)}
                >
                  Bloquear {blockType === 'full-day' ? 'Dia Inteiro' : 'Horários'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {blockedDates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarBlank size={48} className="mx-auto mb-3 opacity-50" />
            <p>Nenhuma data bloqueada</p>
            <p className="text-sm mt-1">Bloqueie datas para evitar agendamentos em feriados</p>
          </div>
        ) : (
          <div className="space-y-8">
            {blockedDates.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrashSimple size={24} className="text-red-600" weight="duotone" />
                  <div>
                    <p className="font-semibold text-red-900">Remover todos os bloqueios</p>
                    <p className="text-sm text-red-700">
                      {blockedDates.length} bloqueio(s) cadastrado(s) no total
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleDeleteAllBlocks}
                  className="gap-2"
                >
                  <Trash size={18} weight="bold" />
                  Remover Todos
                </Button>
              </div>
            )}

            {upcomingGrouped.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                  <CalendarBlank size={18} weight="duotone" />
                  Próximos Bloqueios
                </h4>
                <div className="space-y-6">
                  {upcomingGrouped.map((group) => (
                    <div key={group.monthKey} className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b-2 border-primary/20">
                        <div className="flex items-center gap-3">
                          <h5 className="text-lg font-bold text-primary tracking-wide">
                            {group.monthLabel}
                          </h5>
                          <Badge variant="secondary" className="font-semibold">
                            {group.blocks.length} {group.blocks.length === 1 ? 'bloqueio' : 'bloqueios'}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMonthBlocks(group.monthKey, group.monthLabel)}
                          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        >
                          <Trash size={16} weight="bold" />
                          Remover Mês
                        </Button>
                      </div>
                      <div className="grid gap-2 pl-4">
                        {group.blocks.map((block) => (
                          <div
                            key={block.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-all hover:shadow-md"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge variant="default" className="font-mono text-base px-3 py-1">
                                  {format(parseISO(block.date), "dd")}
                                </Badge>
                                <span className="font-semibold text-foreground text-base">
                                  {format(parseISO(block.date), "EEEE", { locale: ptBR })}
                                </span>
                                {block.blockType === 'specific-times' && block.blockedTimes && (
                                  <Badge variant="outline" className="gap-1">
                                    <Clock size={14} weight="duotone" />
                                    {block.blockedTimes.length} horário(s)
                                  </Badge>
                                )}
                                {block.blockType === 'full-day' && (
                                  <Badge variant="destructive" className="gap-1">
                                    <CalendarX size={14} weight="duotone" />
                                    Dia Inteiro
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1.5 font-medium">{block.reason}</p>
                              {block.blockType === 'specific-times' && block.blockedTimes && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {block.blockedTimes.slice(0, 10).map(time => (
                                    <Badge key={time} variant="secondary" className="text-xs">
                                      {time}
                                    </Badge>
                                  ))}
                                  {block.blockedTimes.length > 10 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{block.blockedTimes.length - 10} mais
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1.5">
                                Bloqueado por {block.createdBy}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteBlockedDate(block.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                            >
                              <Trash size={18} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  )
}
