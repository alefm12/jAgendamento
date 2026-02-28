import { format, addDays, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { CalendarBlank, Sparkle, CalendarCheck } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: "spring" }}
    >
      <Card className="card-lift p-10 shadow-2xl bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-gray-900 border-2 border-blue-100/50 dark:border-gray-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-full blur-3xl -z-0" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-100/40 to-transparent rounded-full blur-3xl -z-0" />
        
        <div className="relative z-10">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-4 mb-8"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
              <CalendarBlank className="text-white" size={32} weight="duotone" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                Escolha a Data
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Sparkle size={24} weight="fill" className="text-purple-600" />
                </motion.div>
              </h2>
              <p className="text-base text-gray-600 mt-1">Selecione o melhor dia para seu atendimento</p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex justify-center"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl border-2 border-blue-100/50 dark:border-blue-900/50">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onDateSelect}
                locale={ptBR}
                defaultMonth={new Date()}
                disabled={(date) => 
                  isBefore(date, today) || 
                  date > maxDate || 
                  isDateBlocked(date) ||
                  !hasAvailableSlots(date)
                }
                className="rounded-xl"
              />
            </div>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 p-5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border-2 border-blue-200/50 dark:border-blue-800/50 shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <CalendarCheck size={24} weight="fill" className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-base text-gray-700 dark:text-gray-200 leading-relaxed font-medium">
                  <span className="font-bold text-blue-700 dark:text-blue-400">Agendamentos disponíveis</span> {windowDescription}
                  {blockedDates.length > 0 && (
                    <span className="block mt-2 text-sm text-gray-600 dark:text-gray-400">
                      ⚠️ Datas bloqueadas (feriados/facultativos) e datas sem horários disponíveis não estão disponíveis para seleção
                    </span>
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </Card>
    </motion.div>
  )
}
