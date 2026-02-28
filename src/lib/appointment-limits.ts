import { subDays } from 'date-fns'
import type { Appointment, StatusChangeHistory } from '@/lib/types'

export const BLOCK_WINDOW_DAYS = 7
export const MAX_RESCHEDULES_PER_WINDOW = 3
export const MAX_CANCELLATIONS_PER_WINDOW = 3
export type CancellationCategory = 'user-request' | 'no-show' | 'other'
export type CancellationFilter = CancellationCategory | 'any'

const getWindowStart = (windowDays: number) => subDays(new Date(), windowDays)

const isEntryWithinWindow = (entry: StatusChangeHistory, windowStart: Date) => {
  if (!entry.changedAt) {
    return false
  }
  const changedAt = new Date(entry.changedAt)
  if (Number.isNaN(changedAt.getTime())) {
    return false
  }
  return changedAt >= windowStart
}

const matchesCancellationFilter = (entry: StatusChangeHistory, filter: CancellationFilter) => {
  if (filter === 'any') {
    return true
  }
  const category = entry.metadata?.cancellationCategory
  if (category) {
    return category === filter
  }
  if (filter === 'no-show') {
    return entry.reason?.toLowerCase().includes('faltou') ?? false
  }
  return false
}

const getEntriesForCpf = (appointments: Appointment[], cpf: string) => {
  if (!cpf) {
    return []
  }
  return appointments
    .filter((appointment) => appointment.cpf === cpf)
    .flatMap((appointment) => appointment.statusHistory || [])
}

export function countRecentReschedules(
  appointments: Appointment[] = [],
  cpf: string,
  windowDays = BLOCK_WINDOW_DAYS
) {
  if (!cpf) {
    return 0
  }
  const windowStart = getWindowStart(windowDays)
  return getEntriesForCpf(appointments, cpf).filter((entry) => {
    return Boolean(entry.metadata?.oldDate && entry.metadata?.newDate) && isEntryWithinWindow(entry, windowStart)
  }).length
}

export function isRescheduleBlocked(
  appointments: Appointment[] = [],
  cpf: string,
  limit = MAX_RESCHEDULES_PER_WINDOW,
  windowDays = BLOCK_WINDOW_DAYS
) {
  return countRecentReschedules(appointments, cpf, windowDays) >= limit
}

export function countRecentCancellations(
  appointments: Appointment[] = [],
  cpf: string,
  windowDays = BLOCK_WINDOW_DAYS,
  filter: CancellationFilter = 'any'
) {
  if (!cpf) {
    return 0
  }
  const windowStart = getWindowStart(windowDays)
  return getEntriesForCpf(appointments, cpf).filter((entry) => {
    if (entry.to !== 'cancelled') {
      return false
    }
    if (!isEntryWithinWindow(entry, windowStart)) {
      return false
    }
    return matchesCancellationFilter(entry, filter)
  }).length
}

export function isCancellationBlocked(
  appointments: Appointment[] = [],
  cpf: string,
  limit = MAX_CANCELLATIONS_PER_WINDOW,
  windowDays = BLOCK_WINDOW_DAYS,
  filter: CancellationFilter = 'any'
) {
  return countRecentCancellations(appointments, cpf, windowDays, filter) >= limit
}
