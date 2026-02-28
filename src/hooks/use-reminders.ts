import { useEffect, useRef } from 'react'
import { differenceInHours, differenceInDays, parseISO } from 'date-fns'
import type { Appointment, SystemConfig, Location } from '@/lib/types'
import { sendReminderNotification, sendReadyForDeliveryNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit-logger'
import { toast } from 'sonner'

export function useReminders(
  appointments: Appointment[],
  setAppointments: (updater: (current: Appointment[]) => Appointment[]) => void,
  config?: SystemConfig,
  locations?: Location[]
) {
  const checkedAppointmentsRef = useRef<Set<string>>(new Set())
  const checkedRGRemindersRef = useRef<Set<string>>(new Set())
  const isCheckingRef = useRef(false)
  const lastCheckRef = useRef<string>('')

  useEffect(() => {
    const checkReminders = async () => {
      if (isCheckingRef.current) return
      
      const appointmentIds = appointments.map(a => a.id).sort().join(',')
      const now = new Date()
      const hourBucket = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`
      const checkKey = `${appointmentIds}|${hourBucket}`
      if (lastCheckRef.current === checkKey) return
      
      lastCheckRef.current = checkKey
      isCheckingRef.current = true
      let hasChanges = false

      const reminderEnabled = config?.reminderSettings?.enabled !== false
      const reminderDays = Array.isArray(config?.reminderSettings?.reminderDays)
        ? [...new Set((config?.reminderSettings?.reminderDays || []).map((d) => Math.max(1, Number(d || 1))))]
        : [Math.max(1, Math.round((config?.reminderSettings?.hoursBeforeAppointment || 24) / 24))]
      const reminderTemplate = config?.notificationTemplates?.lembrete

      if (reminderEnabled && reminderDays.length > 0) {
        for (const appointment of appointments) {
          if (
            (appointment.status === 'confirmed' || appointment.status === 'pending')
          ) {
            const appointmentDateTime = parseISO(`${appointment.date}T${appointment.time}`)
            const hoursUntilAppointment = differenceInHours(appointmentDateTime, now)

            for (const offsetDays of reminderDays) {
              const offsetHours = offsetDays * 24
              const reminderKey = `${appointment.id}-${offsetDays}`
              const alreadySentOffsets = appointment.reminderSentOffsets || []
              if (alreadySentOffsets.includes(offsetDays) || checkedAppointmentsRef.current.has(reminderKey)) {
                continue
              }

              // Janela de envio de 1 hora para não repetir no loop
              if (hoursUntilAppointment <= offsetHours && hoursUntilAppointment > offsetHours - 1) {
                checkedAppointmentsRef.current.add(reminderKey)

                const location = locations?.find(loc => loc.id === appointment.locationId)
                const result = await sendReminderNotification(
                  appointment,
                  config,
                  location?.address,
                  location?.googleMapsUrl,
                  {
                    offsetDays,
                    subjectTemplate: reminderTemplate?.emailAssunto,
                    bodyTemplate: reminderTemplate?.emailCorpo
                  },
                  location?.name
                )

                if (result.success) {
                  hasChanges = true
                  const channels: string[] = []
                  if (result.emailSent) channels.push('📧 Email')
                  if (result.whatsappSent) channels.push('💬 WhatsApp')

                  const antecedenciaTexto = offsetDays === 1 ? '1 dia antes' : `${offsetDays} dias antes`
                  toast.success(`Lembrete (${antecedenciaTexto}) enviado via ${channels.join(', ')} para ${appointment.fullName}`, {
                    duration: 5000
                  })

                  await createAuditLog({
                    action: 'reminder_sent',
                    description: `Lembrete automático (${antecedenciaTexto}) enviado para ${appointment.fullName}`,
                    performedBy: 'Sistema Automático',
                    performedByRole: 'system',
                    targetType: 'appointment',
                    targetId: appointment.id,
                    targetName: `${appointment.fullName} - ${appointment.protocol}`,
                    metadata: {
                      module: 'Lembretes',
                      protocol: appointment.protocol,
                      citizenName: appointment.fullName,
                      date: appointment.date,
                      time: appointment.time,
                      channels: channels.join(', '),
                      reminderOffsetDays: offsetDays
                    },
                    tags: ['reminder', 'automatic', 'notification']
                  })

                  setAppointments((current) =>
                    current.map((apt) =>
                      apt.id === appointment.id
                        ? {
                            ...apt,
                            reminderSent: true,
                            reminderSentOffsets: Array.from(new Set([...(apt.reminderSentOffsets || []), offsetDays]))
                          }
                        : apt
                    )
                  )
                }
              }
            }
          }
        }
      }

      const rgReminderDays = config?.rgDeliverySettings?.reminderAfterDays || 7
      const autoReminderEnabled = config?.rgDeliverySettings?.autoReminderEnabled !== false

      if (autoReminderEnabled) {
        for (const appointment of appointments) {
          if (appointment.status === 'cin-ready' && appointment.completedAt) {
            const readyDate = parseISO(appointment.completedAt)
            const daysSinceReady = differenceInDays(now, readyDate)
            
            const remindersSent = appointment.rgReadyRemindersSent || 0
            const shouldSendReminder = daysSinceReady >= rgReminderDays && remindersSent === 0

            if (shouldSendReminder && 
                !checkedRGRemindersRef.current.has(`${appointment.id}-${remindersSent}`)) {
              
              checkedRGRemindersRef.current.add(`${appointment.id}-${remindersSent}`)
              
              const location = locations?.find(loc => loc.id === appointment.locationId)
              const result = await sendReadyForDeliveryNotification(
                appointment,
                config,
                location?.address,
                location?.googleMapsUrl,
                location?.name
              )
              
              if (result.success) {
                hasChanges = true
                const channels: string[] = []
                if (result.emailSent) channels.push('📧 Email')
                if (result.whatsappSent) channels.push('💬 WhatsApp')
                
                const reminderType = remindersSent === 0 ? 'primeiro lembrete' : `${remindersSent + 1}º lembrete`
                toast.success(
                  `CIN pronto há ${daysSinceReady} dias - ${reminderType} enviado via ${channels.join(', ')} para ${appointment.fullName}`, 
                  { duration: 6000 }
                )
                
                setAppointments((current) =>
                  current.map((apt) =>
                    apt.id === appointment.id
                      ? { 
                          ...apt, 
                          rgReadyRemindersSent: (apt.rgReadyRemindersSent || 0) + 1,
                          lastRgReminderSentAt: now.toISOString()
                        }
                      : apt
                  )
                )
              }
            }
          }
        }
      }
      
      if (hasChanges) {
        // estado já atualizado por offset durante o envio
      }
      
      isCheckingRef.current = false
    }

    const timeoutId = setTimeout(() => {
      checkReminders()
    }, 100)

    const intervalId = setInterval(checkReminders, 60 * 60 * 1000)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [appointments, setAppointments, config, locations])
}
