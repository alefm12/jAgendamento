import { Button } from '@/components/ui/button'
import { TimeSelector } from '@/components/TimeSelector'
import type { TimeSlot } from '@/lib/types'
import { CalendarBlank } from '@phosphor-icons/react'

interface TimeStepProps {
  selectedDate?: Date
  selectedTime?: string
  slots: TimeSlot[]
  onSelect: (time: string) => void
  onBack: () => void
}

export function TimeStep({ selectedDate, selectedTime, slots, onSelect, onBack }: TimeStepProps) {
  if (!selectedDate) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
        <CalendarBlank size={24} className="mx-auto mb-3 text-muted-foreground" />
        <p>Selecione uma data antes de escolher o horário.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TimeSelector date={selectedDate} slots={slots} selectedTime={selectedTime} onTimeSelect={onSelect} />
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
      </div>
    </div>
  )
}
