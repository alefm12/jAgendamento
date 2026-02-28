import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, AlertCircle } from 'lucide-react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWeekend,
  isBefore,
  startOfDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface WizardConfig {
  bloquearFimDeSemana?: boolean
  horariosDisponiveis?: string[]
}

interface DateStepProps {
  onNext: (date: Date, time: string) => void
  color: string
  config?: WizardConfig
}

export function DateStep({ onNext, color, config }: DateStepProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  const blockWeekends = config?.bloquearFimDeSemana !== false
  const timeSlots: string[] =
    Array.isArray(config?.horariosDisponiveis) && config?.horariosDisponiveis.length
      ? config.horariosDisponiveis
      : ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00']

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const isBlocked = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return true
    if (blockWeekends && isWeekend(date)) return true
    return false
  }

  const canContinue = Boolean(selectedDate && selectedTime)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
            disabled={false}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Selecione a data</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white">{format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}</p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {days.map((day) => {
            const blocked = isBlocked(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={!isCurrentMonth || blocked}
                onClick={() => {
                  setSelectedDate(day)
                  setSelectedTime(null)
                }}
                className={`h-12 rounded-xl border text-sm font-semibold transition ${
                  isSelected
                    ? 'text-white shadow-lg'
                    : blocked
                      ? 'border-dashed border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600'
                      : 'border border-gray-200 text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:text-gray-200'
                } ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}`}
                style={{ backgroundColor: isSelected ? color : undefined }}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>

        {blockWeekends && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-600 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertCircle size={16} />
            Finais de semana estão desativados para este serviço.
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            <Clock size={16} /> Horários disponíveis
          </div>
          <div className="flex flex-wrap gap-3">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  selectedTime === slot
                    ? 'text-white shadow-lg'
                    : 'border-gray-200 text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:text-gray-200'
                }`}
                style={{ backgroundColor: selectedTime === slot ? color : undefined }}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => selectedDate && selectedTime && onNext(selectedDate, selectedTime)}
        disabled={!canContinue}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: color }}
      >
        Confirmar Horário <CalendarIcon size={20} />
      </button>
    </div>
  )
}
