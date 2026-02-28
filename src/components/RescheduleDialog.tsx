import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { ArrowsClockwise, CalendarBlank, Clock, CheckCircle } from '@phosphor-icons/react'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Appointment, BlockedDate, TimeSlot } from '@/lib/types'

interface RescheduleDialogProps {
  appointment: Appointment
  allAppointments: Appointment[]
  workingHours: string[]
  maxAppointmentsPerSlot: number
  blockedDates?: BlockedDate[]
  maxAdvanceDays?: number
  onReschedule: (appointmentId: string, newDate: string, newTime: string) => void
  disabled?: boolean
  disabledReason?: string
}

export function RescheduleDialog({
  appointment,
  allAppointments,
  workingHours,
  maxAppointmentsPerSlot,
  blockedDates = [],
  maxAdvanceDays = 60,
  onReschedule,
  disabled = false,
  disabledReason
}: RescheduleDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedTime, setSelectedTime] = useState<string | undefined>()

  // limpa horário ao trocar data
  useEffect(() => {
    setSelectedTime(undefined)
  }, [selectedDate])

  // limpa seleção ao fechar
  useEffect(() => {
    if (!isOpen) {
      setSelectedDate(undefined)
      setSelectedTime(undefined)
    }
  }, [isOpen])

  const isCompleted = appointment.status === 'completed'
  const isTriggerDisabled = isCompleted || disabled

  const today = startOfDay(new Date())
  const safeWindow = Math.max(1, Math.min(365, maxAdvanceDays))
  const maxDate = addDays(today, safeWindow)

  const filteredBlockedDates = useMemo(() => {
    return blockedDates.filter((entry) => {
      if (!entry.locationId) return true
      return String(entry.locationId) === String(appointment.locationId)
    })
  }, [blockedDates, appointment.locationId])

  const hasAvailableSlotsOnDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')

    const hasFullDayBlock = filteredBlockedDates.some(
      (block) => block.date === dateStr && block.blockType === 'full-day'
    )
    if (hasFullDayBlock) {
      return false
    }

    const blockedTimes = new Set<string>()
    filteredBlockedDates
      .filter((block) => block.date === dateStr && block.blockType === 'specific-times')
      .forEach((block) => (block.blockedTimes || []).forEach((time) => blockedTimes.add(time)))

    const appointmentsOnDate = allAppointments.filter(
      (apt) =>
        apt.date === dateStr &&
        String(apt.locationId) === String(appointment.locationId) &&
        apt.id !== appointment.id &&
        apt.status !== 'cancelled'
    )

    const now = new Date()
    const isToday = dateStr === format(now, 'yyyy-MM-dd')
    const currentTime = isToday ? format(now, 'HH:mm') : null

    for (const time of workingHours) {
      if (isToday && currentTime && time <= currentTime) {
        continue
      }

      if (blockedTimes.has(time)) {
        continue
      }

      const count = appointmentsOnDate.filter((apt) => apt.time === time).length
      if (count < maxAppointmentsPerSlot) {
        return true
      }
    }

    return false
  }

  const availableTimeSlots = useMemo((): TimeSlot[] => {
    if (!selectedDate) return []

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const isToday = dateStr === format(today, 'yyyy-MM-dd')
    const currentTime = format(new Date(), 'HH:mm')

    const appointmentsOnDate = allAppointments.filter(
      apt =>
        apt.date === dateStr &&
        String(apt.locationId) === String(appointment.locationId) &&
        apt.id !== appointment.id &&
        apt.status !== 'cancelled'
    )

    const hasFullDayBlock = filteredBlockedDates.some(
      (block) => block.date === dateStr && block.blockType === 'full-day'
    )

    const blockedTimes = new Set<string>()
    filteredBlockedDates
      .filter((block) => block.date === dateStr && block.blockType === 'specific-times')
      .forEach((block) => (block.blockedTimes || []).forEach((time) => blockedTimes.add(time)))

    return workingHours.map(time => {
      if (isToday && time <= currentTime) {
        return { time, available: false, count: 0 }
      }

      if (hasFullDayBlock || blockedTimes.has(time)) {
        return { time, available: false, count: 0 }
      }

      const count = appointmentsOnDate.filter(apt => apt.time === time).length
      return { time, available: count < maxAppointmentsPerSlot, count }
    })
  }, [selectedDate, allAppointments, appointment.id, appointment.locationId, workingHours, maxAppointmentsPerSlot, today, filteredBlockedDates])

  const handleReschedule = () => {
    if (!selectedDate || !selectedTime) return
    onReschedule(appointment.id, format(selectedDate, 'yyyy-MM-dd'), selectedTime)
    setIsOpen(false)
  }

  const currentDate = parseISO(appointment.date)
  const availableCount = availableTimeSlots.filter(s => s.available).length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isTriggerDisabled}
          title={isTriggerDisabled && disabledReason ? disabledReason : undefined}
        >
          <ArrowsClockwise size={16} />
          Reagendar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowsClockwise size={20} className="text-primary" />
            Reagendar Atendimento
          </DialogTitle>
          <div className="text-sm text-muted-foreground space-y-0.5 pt-1">
            <p className="font-semibold text-foreground">{appointment.fullName}</p>
            <p>
              Agendamento atual:{' '}
              <span className="font-medium">
                {format(currentDate, "dd/MM/yyyy")} às {appointment.time}
              </span>
            </p>
          </div>
        </DialogHeader>

        {/* ── Corpo em coluna única para evitar corte do calendário ── */}
        <div className="space-y-5 pt-2">

          {/* Calendário */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CalendarBlank size={15} className="text-primary" />
              Selecione a Nova Data
            </h3>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                defaultMonth={new Date()}
                disabled={(date) => {
                  const normalizedDate = startOfDay(date)
                  return normalizedDate < today || normalizedDate > maxDate || !hasAvailableSlotsOnDate(normalizedDate)
                }}
                className="rounded-lg border w-fit"
                classNames={{
                  months: 'flex flex-col',
                  month: 'space-y-3',
                  caption: 'flex justify-center pt-1 relative items-center',
                  caption_label: 'text-sm font-semibold',
                  nav: 'space-x-1 flex items-center',
                  nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors',
                  nav_button_previous: 'absolute left-1',
                  nav_button_next: 'absolute right-1',
                  table: 'w-full border-collapse',
                  head_row: 'flex',
                  head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-xs text-center',
                  row: 'flex w-full mt-1',
                  cell: 'h-9 w-9 text-center text-sm p-0 relative',
                  day: 'h-9 w-9 p-0 font-normal rounded-md hover:bg-accent/50 transition-colors aria-selected:opacity-100',
                  day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  day_today: 'bg-accent/30 font-bold text-accent-foreground',
                  day_outside: 'opacity-30',
                  day_disabled: 'opacity-25 cursor-not-allowed',
                  day_range_middle: 'rounded-none',
                  day_hidden: 'invisible',
                }}
              />
            </div>
          </div>

          {/* Horários */}
          {selectedDate && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock size={15} className="text-primary" />
                Selecione o Novo Horário
                <span className="ml-1 text-xs text-muted-foreground font-normal">
                  — {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  {availableCount > 0 ? ` · ${availableCount} disponível(is)` : ' · Sem horários'}
                </span>
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {availableTimeSlots.map(slot => (
                  <Button
                    key={slot.time}
                    variant={selectedTime === slot.time ? 'default' : 'outline'}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={cn(
                      'h-10 text-sm font-medium relative',
                      !slot.available && 'opacity-40 cursor-not-allowed line-through',
                      selectedTime === slot.time && 'ring-2 ring-primary ring-offset-1'
                    )}
                  >
                    {slot.time}
                    {selectedTime === slot.time && (
                      <CheckCircle
                        size={12}
                        weight="fill"
                        className="absolute top-1 right-1 text-primary-foreground"
                      />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!selectedDate && (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
              <CalendarBlank size={36} weight="thin" />
              <p className="text-sm">Selecione uma data para ver os horários disponíveis</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedTime}
            className="gap-2"
          >
            <ArrowsClockwise size={16} weight="bold" />
            Confirmar Reagendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
