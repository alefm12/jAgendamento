import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameDay } from 'date-fns'
import type { Appointment, AppointmentStats } from './types'

export function calculateStats(appointments: Appointment[]): AppointmentStats {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 })
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  return {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a =>
      a.status === 'completed' ||
      a.status === 'awaiting-issuance' ||
      a.status === 'cin-ready' ||
      a.status === 'cin-delivered'
    ).length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    today: appointments.filter(a => isSameDay(parseISO(a.date), now)).length,
    thisWeek: appointments.filter(a => {
      const date = parseISO(a.date)
      return isWithinInterval(date, { start: weekStart, end: weekEnd })
    }).length,
    thisMonth: appointments.filter(a => {
      const date = parseISO(a.date)
      return isWithinInterval(date, { start: monthStart, end: monthEnd })
    }).length
  }
}

export function getAppointmentsByDay(appointments: Appointment[]): Record<string, number> {
  return appointments.reduce((acc, apt) => {
    const date = format(parseISO(apt.date), 'yyyy-MM-dd')
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function getAppointmentsByStatus(appointments: Appointment[]) {
  const awaitingIssuance = appointments.filter(a => a.status === 'awaiting-issuance').length
  const cinReady = appointments.filter(a => a.status === 'cin-ready').length
  const cinDelivered = appointments.filter(a => a.status === 'cin-delivered').length
  return {
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed' || a.status === 'awaiting-issuance' || a.status === 'cin-ready' || a.status === 'cin-delivered').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    awaitingIssuance,
    cinReady,
    cinDelivered
  }
}

export function getUpcomingAppointments(appointments: Appointment[], limit = 5): Appointment[] {
  const now = new Date()
  return appointments
    .filter(a => {
      const aptDate = parseISO(a.date)
      return aptDate >= now && (a.status === 'pending' || a.status === 'confirmed')
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })
    .slice(0, limit)
}
