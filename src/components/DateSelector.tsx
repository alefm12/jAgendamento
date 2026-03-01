import { format, addDays, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { CalendarBlank, CalendarCheck } from '@phosphor-icons/react'
import type { BlockedDate, Appointment } from '@/lib/types'

interface DateSelectorProps {
  selectedDate: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  blockedDates?: BlockedDate[]
  maxAdvanceDays?: number
  appointments?: Appointment[]
  locationId?: string
  workingHours?: string[]
  maxAppointmentsPerSlot?: number
}

export function DateSelector({ 
  selectedDate, 
  onDateSelect, 
  blockedDates = [], 
  maxAdvanceDays = 60,
  appointments = [],
  locationId,
  workingHours = [],
  maxAppointmentsPerSlot = 2
}: DateSelectorProps) {
  console.log('[DateSelector] Props recebidas:', {
    locationId,
    workingHoursLength: workingHours.length,
    workingHours,
    appointmentsLength: appointments.length,
    maxAppointmentsPerSlot,
    blockedDatesLength: blockedDates.length
  })

  const today = startOfDay(new Date())
  const safeWindow = Math.max(1, Math.min(365, maxAdvanceDays))
  const maxDate = addDays(today, safeWindow)
  const formattedWindow = safeWindow.toLocaleString('pt-BR')
  const windowDescription = safeWindow === 1
    ? 'para o próximo dia liberado'
    : `para os próximos ${formattedWindow} dias`

  const isDateBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return blockedDates.some(bd => bd.date === dateStr)
  }

  const hasAvailableSlots = (date: Date) => {
    // Se não tem locationId configurado, permitir seleção (modo simplificado)
    if (!locationId) {
      console.log('[DateSelector] locationId não definido, permitindo seleção')
      return true
    }

    // Se não tem workingHours configurados, permitir seleção
    if (!workingHours || workingHours.length === 0) {
      console.log('[DateSelector] workingHours não configurados, permitindo seleção')
      return true
    }

    const dateStr = format(date, 'yyyy-MM-dd')
    
    // Verificar se é bloqueio de dia inteiro
    const hasFullDayBlock = blockedDates.some(
      (block) => block.date === dateStr && block.blockType === 'full-day'
    )
    if (hasFullDayBlock) {
      console.log(`[DateSelector] Data ${dateStr} bloqueada (dia inteiro)`)
      return false
    }

    // Obter horários bloqueados específicos
    const blockedTimes = new Set<string>()
    blockedDates
      .filter((block) => block.date === dateStr && block.blockType === 'specific-times')
      .forEach((block) => (block.blockedTimes || []).forEach((time) => blockedTimes.add(time)))

    // Verificar se a data é hoje e filtrar horários que já passaram
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const isToday = dateStr === today
    const currentTime = isToday ? format(now, 'HH:mm') : null

    // Contar horários disponíveis
    const appointmentsOnDate = appointments.filter(
      (appt) => appt.date === dateStr && appt.locationId === locationId
    )

    let availableCount = 0
    for (const time of workingHours) {
      // Pular horários que já passaram se for hoje
      if (isToday && currentTime && time <= currentTime) {
        continue
      }

      // Pular se horário está bloqueado
      if (blockedTimes.has(time)) {
        continue
      }

      // Contar agendamentos neste horário
      const count = appointmentsOnDate.filter((appt) => appt.time === time).length
      
      // Se ainda há vagas, incrementar contador
      if (count < maxAppointmentsPerSlot) {
        availableCount++
      }
    }

    const hasSlots = availableCount > 0
    if (!hasSlots) {
      console.log(`[DateSelector] Data ${dateStr} sem horários disponíveis (${workingHours.length} horários verificados)`)
    }
    return hasSlots
  }

  return (
    <div>
      <Card className="p-6 bg-card border shadow-sm">
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow flex-shrink-0">
              <CalendarBlank className="text-primary-foreground" size={26} weight="duotone" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Escolha a Data
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Selecione o melhor dia para seu atendimento</p>
            </div>
          </div>
          
          <div className="flex justify-center">
            <div className="bg-card rounded-xl p-2 border">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onDateSelect}
                locale={ptBR}
                defaultMonth={new Date()}
                modifiersStyles={{
                  today: { background: 'none', border: 'none', fontWeight: 'bold' }
                }}
                disabled={(date) => 
                  isBefore(date, today) || 
                  date > maxDate || 
                  isDateBlocked(date) ||
                  !hasAvailableSlots(date)
                }
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="mt-5 p-4 bg-primary/10 rounded-xl border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <CalendarCheck size={20} weight="fill" className="text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  <span className="font-bold text-primary">Agendamentos disponíveis</span> {windowDescription}
                  {blockedDates.length > 0 && (
                    <span className="block mt-2 text-xs text-muted-foreground">
                      ⚠️ Datas bloqueadas (feriados/facultativos) e datas sem horários disponíveis não estão disponíveis para seleção
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
