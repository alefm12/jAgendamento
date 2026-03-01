import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Clock, CheckCircle, CalendarCheck } from '@phosphor-icons/react'
import type { TimeSlot } from '@/lib/types'

interface TimeSelectorProps {
  date: Date
  slots: TimeSlot[]
  selectedTime: string | undefined
  onTimeSelect: (time: string) => void
}

export function TimeSelector({ date, slots, selectedTime, onTimeSelect }: TimeSelectorProps) {
  const availableSlots = slots.filter(slot => slot.available)

  // Bloqueia interação por 700ms após montar/trocar data
  // usando useRef com timestamp — imune a clicks sintéticos do iOS
  // (o iOS gera um click sintético a partir do toque na data que cai sobre a grade de horários)
  const mountedAtRef = useRef<number>(Date.now())
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(false)
    mountedAtRef.current = Date.now()
    const t = setTimeout(() => setReady(true), 700)
    return () => clearTimeout(t)
  }, [date])

  const handleTimeSelect = (time: string) => {
    if (Date.now() - mountedAtRef.current < 700) return
    onTimeSelect(time)
  }
  
  return (
    <div>
      <Card className="p-6 bg-white border shadow-sm">
        <div>
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow flex-shrink-0">
              <Clock className="text-white" size={22} weight="duotone" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">
                Escolha o Horário
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Para <span className="font-semibold text-gray-700">{format(date, "dd 'de' MMMM", { locale: ptBR })}</span>
              </p>
            </div>
          </div>

          {availableSlots.length === 0 ? (
            <div className="p-5 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-center gap-3 justify-center text-center">
                <Clock size={22} weight="fill" className="text-red-600" />
                <div>
                  <h3 className="font-bold text-red-800">Sem horários disponíveis</h3>
                  <p className="text-sm text-red-700 mt-1">Por favor, escolha outra data</p>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className={`grid grid-cols-3 sm:grid-cols-4 gap-2.5 transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-60 pointer-events-none'}`}
            >
              {slots.map((slot) => (
                <Button
                  key={slot.time}
                  variant={selectedTime === slot.time ? "default" : "outline"}
                  onTouchStart={(e) => { if (Date.now() - mountedAtRef.current < 700) e.preventDefault() }}
                  onClick={() => slot.available && handleTimeSelect(slot.time)}
                  disabled={!slot.available}
                  className={`
                    w-full h-12 text-sm font-semibold rounded-xl transition-all
                    ${selectedTime === slot.time
                      ? 'bg-primary text-white shadow ring-2 ring-primary/40'
                      : slot.available
                      ? 'bg-white border border-gray-300 text-gray-700 hover:border-primary hover:bg-primary/5'
                      : 'bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1">
                    {selectedTime === slot.time && (
                      <CheckCircle size={15} weight="fill" />
                    )}
                    <span>{slot.time}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}

          <div className="mt-5 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center gap-3">
              <CalendarCheck size={20} weight="fill" className="text-primary flex-shrink-0" />
              <p className="text-sm text-gray-700">
                <span className="font-bold text-primary">{availableSlots.length} horário(s)</span> disponível(is). Selecione o melhor para você.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
