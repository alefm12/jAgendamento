import { useEffect, useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import { DateSelector } from '@/components/DateSelector'
import { Button } from '@/components/ui/button'
import type { BlockedDate, Appointment } from '@/lib/types'

interface DateStepProps {
  locationId?: string
  selectedDate: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  fetchBlockedDates: (locationId: string) => Promise<BlockedDate[]>
  onBlockedDatesChange?: (dates: BlockedDate[]) => void
  onBack?: () => void
  maxAdvanceDays?: number
  appointments?: Appointment[]
  workingHours?: string[]
  maxAppointmentsPerSlot?: number
}

export function DateStep({
  locationId,
  selectedDate,
  onDateSelect,
  fetchBlockedDates,
  onBlockedDatesChange,
  onBack,
  maxAdvanceDays,
  appointments = [],
  workingHours = [],
  maxAppointmentsPerSlot = 2
}: DateStepProps) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    if (!locationId) {
      setBlockedDates([])
      onBlockedDatesChange?.([])
      return () => {
        isMounted = false
      }
    }

    const loadAvailability = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const dates = await fetchBlockedDates(locationId)
        if (!isMounted) return
        setBlockedDates(dates)
        onBlockedDatesChange?.(dates)
      } catch (err) {
        console.error('[DateStep] Falha ao carregar disponibilidade', err)
        if (!isMounted) return
        setError('Não foi possível carregar as datas disponíveis para este local.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAvailability()

    return () => {
      isMounted = false
    }
  }, [locationId, fetchBlockedDates, onBlockedDatesChange])

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
        <CalendarBlank size={24} className="mx-auto mb-3 text-muted-foreground" />
        <p>Selecione uma localidade para exibir o calendário.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center text-sm text-primary">
        Carregando disponibilidade para este local...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <DateSelector 
        selectedDate={selectedDate} 
        onDateSelect={onDateSelect} 
        blockedDates={blockedDates}
        maxAdvanceDays={maxAdvanceDays}
        appointments={appointments}
        locationId={locationId}
        workingHours={workingHours}
        maxAppointmentsPerSlot={maxAppointmentsPerSlot}
      />
      {onBack && (
        <div className="flex gap-3">
          <Button
            variant="default"
            onClick={onBack}
            className="mt-5 w-full rounded-xl py-4 text-base font-semibold"
          >
            Voltar
          </Button>
        </div>
      )}
    </div>
  )
}
