import { useEffect } from 'react'
import { toast } from 'sonner'
import { parseISO, isBefore, isAfter } from 'date-fns'
import type { ScheduledReport } from '@/lib/types'

export function useScheduledReportExecutor(
  scheduledReports: ScheduledReport[] | undefined,
  updateReport: (id: string, updates: Partial<ScheduledReport>) => void
) {
  useEffect(() => {
    if (!scheduledReports || scheduledReports.length === 0) return

    const checkInterval = setInterval(() => {
      const now = new Date()

      scheduledReports.forEach(report => {
        if (!report.isActive || !report.nextExecution) return

        const nextExecution = parseISO(report.nextExecution)

        if (isBefore(nextExecution, now) || Math.abs(now.getTime() - nextExecution.getTime()) < 60000) {
          if (report.endDate && isAfter(now, parseISO(report.endDate))) {
            updateReport(report.id, {
              isActive: false,
              lastExecuted: now.toISOString()
            })
            toast.info(`Relatório "${report.name}" foi desativado (data de término atingida)`)
            return
          }

          const executionCount = (report.executionCount || 0) + 1
          
          toast.success(`Relatório "${report.name}" foi gerado automaticamente!`, {
            description: `Enviado para ${report.recipients.length} destinatário(s) em formato ${report.format.toUpperCase()}`,
            duration: 5000
          })

          const nextExecution = calculateNextExecution(report)
          
          updateReport(report.id, {
            lastExecuted: now.toISOString(),
            executionCount,
            nextExecution
          })
        }
      })
    }, 30000)

    return () => clearInterval(checkInterval)
  }, [scheduledReports, updateReport])
}

function calculateNextExecution(report: ScheduledReport): string {
  const now = new Date()
  const [hours, minutes] = report.timeOfDay.split(':').map(Number)
  
  let nextDate = new Date(now)
  
  switch (report.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1)
      break
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      if (report.dayOfWeek !== undefined) {
        while (nextDate.getDay() !== report.dayOfWeek) {
          nextDate.setDate(nextDate.getDate() + 1)
        }
      }
      break
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14)
      break
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      if (report.dayOfMonth !== undefined) {
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
        nextDate.setDate(Math.min(report.dayOfMonth, lastDayOfMonth))
      }
      break
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
  }
  
  nextDate.setHours(hours, minutes, 0, 0)
  
  if (isBefore(nextDate, now)) {
    return calculateNextExecution({
      ...report,
      lastExecuted: nextDate.toISOString()
    })
  }
  
  return nextDate.toISOString()
}
