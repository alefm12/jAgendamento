import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Appointment, AppointmentStatus, SystemConfig, Location } from './types'
import { api } from './api'

export interface NotificationResult {
  success: boolean
  emailSent: boolean
  smsSent: boolean  // mantido por compatibilidade, sempre false
  whatsappSent: boolean
  message: string
}

export interface NotificationData {
  appointment: Appointment
  previousStatus?: AppointmentStatus
  newStatus: AppointmentStatus
  config?: SystemConfig
  locationName?: string      // Nome da secretaria/local (ex: "Secretaria 10")
  locationAddress?: string   // Endereço (ex: "Rua Principal, 100")
  locationMapsUrl?: string   // Link Google Maps
}

function formatAppointmentDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function getEmailSubject(status: AppointmentStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Agendamento Confirmado - CIN'
    case 'cancelled':
      return 'Agendamento Cancelado - CIN'
    case 'completed':
      return 'Atendimento Concluído - CIN'
    case 'awaiting-issuance':
      return 'Seu CIN está em emissão'
    case 'cin-ready':
      return '✅ Seu CIN está Pronto para Retirada!'
    case 'cin-delivered':
      return 'CIN Entregue com Sucesso'
    default:
      return 'Agendamento CIN - Atualização'
  }
}

function getEmailBody(data: NotificationData): string {
  const { appointment, newStatus, locationAddress, locationMapsUrl } = data
  const dateFormatted = formatAppointmentDate(appointment.date)
  const rgType = appointment.rgType || '1ª via'

  let message = `Olá ${appointment.fullName},\n\n`

  switch (newStatus) {
    case 'confirmed':
      message += `Seu agendamento foi confirmado!\n\n`
      message += `📅 Data: ${dateFormatted}\n`
      message += `🕐 Horário: ${appointment.time}\n`
      message += `📋 Protocolo: ${appointment.protocol}\n`
      message += `📄 Tipo: ${rgType}\n`
      
      if (locationAddress) {
        message += `📍 Local: ${locationAddress}\n`
      }
      
      if (locationMapsUrl) {
        message += `🗺️ Ver no Google Maps: ${locationMapsUrl}\n`
      }
      
      message += `\n📋 DOCUMENTOS NECESSÁRIOS PARA ${rgType.toUpperCase()}:\n`
      
      if (rgType === '1ª via') {
        message += `✓ Certidão de Nascimento ou Casamento (original e cópia)\n`
        message += `✓ CPF (original e cópia)\n`
        message += `✓ Comprovante de residência recente (original e cópia)\n`
        message += `✓ Título de eleitor (se tiver)\n`
        message += `\n⚠️ ATENÇÃO: Para 1ª via do CIN, é obrigatório comparecer pessoalmente.\n`
        message += `Menores de 18 anos devem estar acompanhados de um responsável legal.\n`
      } else if (rgType === '2ª via') {
        message += `✓ CIN anterior (original e cópia, mesmo que danificado)\n`
        message += `✓ CPF (original e cópia)\n`
        message += `✓ Comprovante de residência recente (original e cópia)\n`
        message += `✓ Certidão de Nascimento ou Casamento (original e cópia)\n`
        message += `\n⚠️ ATENÇÃO: Para 2ª via, trazer o CIN anterior é OBRIGATÓRIO.\n`
        message += `Caso tenha perdido ou sido roubado, apresente Boletim de Ocorrência.\n`
      }
      
      message += `\n⏰ Por favor, chegue com 10 minutos de antecedência.\n`
      message += `Em caso de dúvidas, entre em contato conosco.\n\n`
      break
    
    case 'cancelled':
      message += `Informamos que seu agendamento foi cancelado.\n\n`
      message += `📅 Data: ${dateFormatted}\n`
      message += `🕐 Horário: ${appointment.time}\n`
      message += `📋 Protocolo: ${appointment.protocol}\n`
      message += `📄 Tipo: ${rgType}\n\n`
      message += `Se desejar reagendar, acesse nosso sistema de agendamento online.\n\n`
      break
    
    case 'completed':
      message += `Seu atendimento foi concluído com sucesso!\n\n`
      message += `📅 Data: ${dateFormatted}\n`
      message += `🕐 Horário: ${appointment.time}\n`
      message += `📋 Protocolo: ${appointment.protocol}\n`
      message += `📄 Tipo: ${rgType}\n\n`
      message += `Agradecemos por utilizar nossos serviços.\n\n`
      break
    
    case 'awaiting-issuance':
      message += `Seu atendimento foi concluído e o RG está em fase de emissão.\n\n`
      message += `📋 Protocolo: ${appointment.protocol}\n`
      message += `📄 Tipo: ${rgType}\n`
      message += `⏳ Assim que a CIN estiver pronta, enviaremos um novo aviso para retirada.\n\n`
      break
    
    case 'cin-ready':
      message += `✅ BOA NOTÍCIA! Sua CIN (${rgType}) está pronta para retirada!\n\n`
      message += `📋 Protocolo: ${appointment.protocol}\n`
      message += `📅 Data do atendimento: ${dateFormatted}\n`
      message += `📄 Tipo: ${rgType}\n\n`
      
      if (locationAddress) {
        message += `📍 Local de retirada: ${locationAddress}\n`
      }
      
      if (locationMapsUrl) {
        message += `🗺️ Ver no Google Maps: ${locationMapsUrl}\n`
      }
      
      message += `\n⚠️ DOCUMENTOS NECESSÁRIOS PARA RETIRADA:\n`
      message += `• Protocolo de atendimento: ${appointment.protocol}\n`
      
      if (rgType === '1ª via') {
        message += `• Para 1ª via: Trazer a certidão de nascimento original apresentada no atendimento\n`
        message += `• Documento com foto para conferência (pode ser CNH, passaporte, etc.)\n`
      } else if (rgType === '2ª via') {
        message += `• Para 2ª via: Trazer o CIN anterior (se ainda possuir)\n`
        message += `• Documento com foto adicional para conferência (CNH, passaporte, etc.)\n`
      }
      
      message += `\n👥 RETIRADA POR TERCEIROS:\n`
      message += `Caso outra pessoa vá retirar seu CIN, será necessário:\n`
      message += `• Cópia do documento do titular (seu documento)\n`
      message += `• Documento original com foto de quem for retirar\n`
      message += `• Protocolo de atendimento\n\n`
      message += `⏰ Horário de funcionamento: Segunda a Sexta, das 8h às 17h\n\n`
      message += `Compareça o mais breve possível para retirar seu documento!\n\n`
      break
    
    case 'cin-delivered':
      message += `✅ Sua CIN (${rgType}) foi entregue com sucesso!\n\n`
      message += `📋 Protocolo: ${appointment.protocol}\n`
      message += `📅 Data do atendimento: ${dateFormatted}\n`
      message += `📄 Tipo: ${rgType}\n\n`
      message += `Agradecemos por utilizar nossos serviços e desejamos um ótimo dia!\n\n`
      break
  }

  message += `Atenciosamente,\nEquipe de Agendamento CIN`

  return message
}

function getWhatsAppMessage(data: NotificationData): string {
  const { appointment, newStatus, locationAddress, locationMapsUrl } = data
  const dateFormatted = format(parseISO(appointment.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const systemName = data.config?.systemName || 'Sistema de Agendamento'
  const rgType = appointment.rgType || '1ª via'

  let message = `*${systemName}*\n\n`
  message += `Olá *${appointment.fullName}*! 👋\n\n`

  switch (newStatus) {
    case 'confirmed':
      message += `✅ Seu agendamento foi *CONFIRMADO*!\n\n`
      message += `📅 *Data:* ${dateFormatted}\n`
      message += `🕐 *Horário:* ${appointment.time}\n`
      message += `📋 *Protocolo:* ${appointment.protocol}\n`
      message += `📄 *Tipo:* ${rgType}\n`
      
      if (locationAddress) {
        message += `📍 *Local:* ${locationAddress}\n`
      }
      
      if (locationMapsUrl) {
        message += `🗺️ *Ver no mapa:* ${locationMapsUrl}\n`
      }
      
      message += `\n*Documentos necessários para ${rgType}:* 📄\n`
      
      if (rgType === '1ª via') {
        message += `✓ Certidão de Nascimento ou Casamento (original e cópia)\n`
        message += `✓ CPF (original e cópia)\n`
        message += `✓ Comprovante de residência recente\n`
        message += `✓ Título de eleitor (se tiver)\n\n`
        message += `⚠️ Para 1ª via, comparecer pessoalmente é obrigatório.\n`
      } else if (rgType === '2ª via') {
        message += `✓ CIN anterior (original e cópia)\n`
        message += `✓ CPF (original e cópia)\n`
        message += `✓ Comprovante de residência recente\n`
        message += `✓ Certidão de Nascimento ou Casamento\n\n`
        message += `⚠️ Para 2ª via, trazer a CIN anterior é obrigatório.\n`
      }
      
      message += `\n⏰ Chegue com *10 minutos de antecedência*.\n\n`
      message += `Em caso de dúvidas, entre em contato conosco! 📞`
      break
    
    case 'cancelled':
      message += `❌ Seu agendamento foi *CANCELADO*.\n\n`
      message += `📅 *Data:* ${dateFormatted}\n`
      message += `🕐 *Horário:* ${appointment.time}\n`
      message += `📋 *Protocolo:* ${appointment.protocol}\n`
      message += `📄 *Tipo:* ${rgType}\n\n`
      message += `Se desejar reagendar, acesse nosso sistema de agendamento online. 🔄`
      break
    
    case 'completed':
      message += `✅ Seu atendimento foi *CONCLUÍDO* com sucesso!\n\n`
      message += `📅 *Data:* ${dateFormatted}\n`
      message += `🕐 *Horário:* ${appointment.time}\n`
      message += `📋 *Protocolo:* ${appointment.protocol}\n`
      message += `📄 *Tipo:* ${rgType}\n\n`
      message += `Agradecemos por utilizar nossos serviços! 🙏`
      break
    
    case 'awaiting-issuance':
      message += `⏳ Sua CIN está *EM EMISSÃO*. Assim que ficar pronta avisaremos por aqui!\n\n`
      message += `📋 *Protocolo:* ${appointment.protocol}\n`
      message += `📄 *Tipo:* ${rgType}\n`
      break
    
    case 'cin-ready':
      message += `✅ *BOA NOTÍCIA!* Sua CIN (${rgType}) está *PRONTA PARA RETIRADA*! 🎉\n\n`
      message += `📋 *Protocolo:* ${appointment.protocol}\n`
      message += `📅 *Data do atendimento:* ${dateFormatted}\n`
      message += `📄 *Tipo:* ${rgType}\n\n`
      
      if (locationAddress) {
        message += `📍 *Local de retirada:* ${locationAddress}\n`
      }
      
      if (locationMapsUrl) {
        message += `🗺️ *Ver no mapa:* ${locationMapsUrl}\n`
      }
      
      message += `\n⚠️ *DOCUMENTOS PARA RETIRADA:*\n`
      message += `• *Protocolo:* ${appointment.protocol}\n`
      
      if (rgType === '1ª via') {
        message += `• Certidão de nascimento original (apresentada no atendimento)\n`
        message += `• Documento com foto para conferência\n`
      } else if (rgType === '2ª via') {
        message += `• CIN anterior (se ainda possuir)\n`
        message += `• Documento com foto adicional para conferência\n`
      }
      
      message += `\n👥 *RETIRADA POR TERCEIROS:*\n`
      message += `• Cópia do documento do titular\n`
      message += `• Documento original de quem for retirar\n\n`
      message += `🕐 *Horário:* Segunda a Sexta, 8h às 17h\n\n`
      message += `Compareça o mais breve possível! 📄✨`
      break
    
    case 'cin-delivered':
      message += `✅ Sua CIN (${rgType}) foi *ENTREGUE* com sucesso! 🎉\n\n`
      message += `📋 *Protocolo:* ${appointment.protocol}\n`
      message += `📅 *Data do atendimento:* ${dateFormatted}\n`
      message += `📄 *Tipo:* ${rgType}\n\n`
      message += `Agradecemos por utilizar nossos serviços! 🙏✨`
      break
    
    default:
      message += `📢 *Atualização* sobre seu agendamento.\n\n`
      message += `📅 *Data:* ${dateFormatted}\n`
      message += `🕐 *Horário:* ${appointment.time}\n`
      message += `📋 *Protocolo:* ${appointment.protocol}\n\n`
      message += `Entre em contato para mais informações. 📞`
  }

  return message
}

function isNotificationAccepted(appointment: Appointment): boolean {
  if (appointment.lgpdConsent?.notificationAccepted === false) return false
  const legacyAccepted = (appointment as any).notificationsAccepted
  if (legacyAccepted === false) return false
  const legacySnakeAccepted = (appointment as any).aceite_notificacoes
  if (legacySnakeAccepted === false) return false
  return true
}

function getTemplateTypeByStatus(status: AppointmentStatus): keyof NonNullable<SystemConfig['notificationTemplates']> | null {
  switch (status) {
    case 'confirmed':
      return 'agendamento'
    case 'cancelled':
      return 'cancelamento'
    case 'completed':
      return 'concluido'
    case 'cin-ready':
      return 'cin_pronta'
    case 'cin-delivered':
      return 'cin_entregue'
    default:
      return null
  }
}

function replaceTemplateVariables(
  template: string,
  appointment: Appointment,
  dateFormatted: string,
  locationName?: string,
  locationAddress?: string,
  locationMapsUrl?: string
): string {
  return template
    .replace(/\{nome\}/g, appointment.fullName)
    .replace(/\{data\}/g, dateFormatted)
    .replace(/\{hora\}/g, appointment.time)
    .replace(/\{protocolo\}/g, appointment.protocol || '')
    .replace(/\{local\}/g, locationName || locationAddress || '')
    .replace(/\{endereco\}/g, locationAddress || '')
    .replace(/\{link_local\}/g, locationMapsUrl || '')
    .replace(/\{tipo_rg\}/g, appointment.rgType || '1ª via')
    .replace(/\{cpf\}/g, appointment.cpf || '')
}

function getPrefeituraIdFromClient(): number | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const tenantId = localStorage.getItem('tenantId')
    if (tenantId && /^\d+$/.test(tenantId)) return Number(tenantId)
  } catch {}
  return undefined
}

async function sendEmailNotification(
  appointment: Appointment,
  subject: string,
  message: string
): Promise<boolean> {
  if (!appointment.email) return false
  try {
    await api.post('/notifications/test-email', {
      prefeituraId: getPrefeituraIdFromClient(),
      to: appointment.email,
      subject,
      message
    })
    return true
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error)
    return false
  }
}

async function sendWhatsAppNotification(
  appointment: Appointment,
  message: string
): Promise<boolean> {
  if (!appointment.phone) return false
  try {
    await api.post('/notifications/test-whatsapp', {
      prefeituraId: getPrefeituraIdFromClient(),
      phone: appointment.phone,
      message
    })
    return true
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error)
    return false
  }
}

export async function sendNotification(data: NotificationData): Promise<NotificationResult> {
  const { appointment, newStatus, config } = data

  try {
    if (!isNotificationAccepted(appointment)) {
      return {
        success: false,
        emailSent: false,
        smsSent: false,
        whatsappSent: false,
        message: 'Notificações não enviadas: cidadão não aceitou receber mensagens.'
      }
    }

    const emailEnabled = config?.emailSettings?.enabled !== false
    const whatsappEnabled = config?.whatsappSettings?.enabled !== false

    const dateFormatted = formatAppointmentDate(appointment.date)
    const templateType = getTemplateTypeByStatus(newStatus)
    const templateConfig = templateType ? config?.notificationTemplates?.[templateType] : undefined
    const emailSubject = templateConfig?.emailAssunto
      ? replaceTemplateVariables(
          templateConfig.emailAssunto,
          appointment,
          dateFormatted,
          data.locationName,
          data.locationAddress,
          data.locationMapsUrl
        )
      : getEmailSubject(newStatus)
    const emailBody = templateConfig?.emailCorpo
      ? replaceTemplateVariables(
          templateConfig.emailCorpo,
          appointment,
          dateFormatted,
          data.locationName,
          data.locationAddress,
          data.locationMapsUrl
        )
      : getEmailBody(data)
    const whatsappMessage = templateConfig?.emailCorpo
      ? replaceTemplateVariables(
          templateConfig.emailCorpo,
          appointment,
          dateFormatted,
          data.locationName,
          data.locationAddress,
          data.locationMapsUrl
        )
      : getWhatsAppMessage(data)

    let emailSent = false
    let whatsappSent = false

    if (emailEnabled && (templateConfig?.emailAtivo ?? true)) {
      emailSent = await sendEmailNotification(appointment, emailSubject, emailBody)
    }

    if (whatsappEnabled && (templateConfig?.whatsappAtivo ?? true)) {
      whatsappSent = await sendWhatsAppNotification(appointment, whatsappMessage)
    }

    const channels: string[] = []
    if (emailSent) channels.push('Email')
    if (whatsappSent) channels.push('WhatsApp')

    const notificationLog = {
      id: crypto.randomUUID(),
      appointmentId: appointment.id,
      type: 'all' as const,
      status: 'sent' as const,
      timestamp: new Date().toISOString(),
      recipientEmail: appointment.email,
      recipientPhone: appointment.phone,
      channels: channels.join(', '),
      message: emailSubject
    }

    window.dispatchEvent(new CustomEvent('notification-sent', { detail: notificationLog }))

    return {
      success: emailSent || whatsappSent,
      emailSent,
      smsSent: false,
      whatsappSent,
      message: `Notificações enviadas via ${channels.join(', ')} para ${appointment.fullName}`
    }
  } catch (error) {
    console.error('Erro ao enviar notificações:', error)
    
    const notificationLog = {
      id: crypto.randomUUID(),
      appointmentId: appointment.id,
      type: 'all' as const,
      status: 'failed' as const,
      timestamp: new Date().toISOString(),
      recipientEmail: appointment.email,
      recipientPhone: appointment.phone,
      message: 'Erro ao enviar notificação'
    }

    window.dispatchEvent(new CustomEvent('notification-sent', { detail: notificationLog }))

    return {
      success: false,
      emailSent: false,
      smsSent: false,
      whatsappSent: false,
      message: 'Erro ao enviar notificações'
    }
  }
}

export async function sendConfirmationNotification(
  appointment: Appointment,
  config?: SystemConfig,
  locationAddress?: string,
  locationMapsUrl?: string,
  locationName?: string
): Promise<NotificationResult> {
  return sendNotification({
    appointment,
    newStatus: 'confirmed',
    previousStatus: 'pending',
    config,
    locationName,
    locationAddress,
    locationMapsUrl
  })
}

export async function sendCancellationNotification(
  appointment: Appointment,
  config?: SystemConfig
): Promise<NotificationResult> {
  return sendNotification({
    appointment,
    newStatus: 'cancelled',
    previousStatus: appointment.status,
    config
  })
}

export async function sendRescheduleNotification(
  appointment: Appointment,
  config?: SystemConfig,
  locationAddress?: string,
  locationMapsUrl?: string,
  locationName?: string
): Promise<NotificationResult> {
  try {
    if (!isNotificationAccepted(appointment)) {
      return {
        success: false,
        emailSent: false,
        smsSent: false,
        whatsappSent: false,
        message: 'Notificações não enviadas: cidadão não aceitou receber mensagens.'
      }
    }

    const emailEnabled = config?.emailSettings?.enabled !== false
    const whatsappEnabled = config?.whatsappSettings?.enabled !== false

    const dateFormatted = formatAppointmentDate(appointment.date)
    const templateConfig = config?.notificationTemplates?.reagendamento

    const defaultSubject = `Reagendamento Confirmado – Protocolo ${appointment.protocol || ''}`
    const defaultBody =
      `Olá {nome}! 😊\n\nSeu atendimento foi reagendado com sucesso.\n\n` +
      `📅 Data: {data}\n🕐 Horário: {hora}\n📍 Local de Atendimento: {local}\n🏠 Endereço: {endereco}\n🗺️ Mapa: {link_local}`

    const subject = replaceTemplateVariables(
      templateConfig?.emailAssunto || defaultSubject,
      appointment, dateFormatted, locationName, locationAddress, locationMapsUrl
    )
    const body = replaceTemplateVariables(
      templateConfig?.emailCorpo || defaultBody,
      appointment, dateFormatted, locationName, locationAddress, locationMapsUrl
    )

    let emailSent = false
    let whatsappSent = false

    if (emailEnabled && (templateConfig?.emailAtivo ?? true)) {
      emailSent = await sendEmailNotification(appointment, subject, body)
    }
    if (whatsappEnabled && (templateConfig?.whatsappAtivo ?? true)) {
      whatsappSent = await sendWhatsAppNotification(appointment, body)
    }

    const channels: string[] = []
    if (emailSent) channels.push('Email')
    if (whatsappSent) channels.push('WhatsApp')

    window.dispatchEvent(new CustomEvent('notification-sent', {
      detail: {
        id: crypto.randomUUID(),
        appointmentId: appointment.id,
        type: 'all' as const,
        status: 'sent' as const,
        timestamp: new Date().toISOString(),
        recipientEmail: appointment.email,
        recipientPhone: appointment.phone,
        channels: channels.join(', '),
        message: subject
      }
    }))

    return {
      success: emailSent || whatsappSent,
      emailSent,
      smsSent: false,
      whatsappSent,
      message: `Notificação de reagendamento enviada via ${channels.join(', ')} para ${appointment.fullName}`
    }
  } catch (error) {
    console.error('[sendRescheduleNotification] Erro:', error)
    return { success: false, emailSent: false, smsSent: false, whatsappSent: false, message: 'Erro ao enviar notificação de reagendamento' }
  }
}

export async function sendStatusUpdateNotification(
  appointment: Appointment,
  previousStatus: AppointmentStatus,
  newStatus: AppointmentStatus,
  config?: SystemConfig,
  locationAddress?: string,
  locationMapsUrl?: string,
  locationName?: string
): Promise<NotificationResult> {
  return sendNotification({
    appointment,
    previousStatus,
    newStatus,
    config,
    locationName,
    locationAddress,
    locationMapsUrl
  })
}

export async function sendReminderNotification(
  appointment: Appointment, 
  config?: SystemConfig,
  locationAddress?: string,
  locationMapsUrl?: string,
  options?: {
    offsetDays?: number
    subjectTemplate?: string
    bodyTemplate?: string
  },
  locationName?: string
): Promise<NotificationResult> {
  const dateFormatted = formatAppointmentDate(appointment.date)
  const locName = locationName || ''
  const address = locationAddress || ''
  const googleMapsLink = locationMapsUrl || ''
  const systemName = config?.systemName || 'Sistema de Agendamento CIN'
  const offsetDays = Math.max(1, Number(options?.offsetDays || 1))
  const antecedenciaTexto = offsetDays === 1 ? `amanhã às ${appointment.time}` : `em ${offsetDays} dias`
  
  if (!isNotificationAccepted(appointment)) {
    return {
      success: false,
      emailSent: false,
      smsSent: false,
      whatsappSent: false,
      message: 'Notificações não enviadas: cidadão não aceitou receber mensagens.'
    }
  }

  const emailEnabled = config?.emailSettings?.enabled !== false
  const whatsappEnabled = config?.whatsappSettings?.enabled !== false
  
  const replaceVars = (template: string) =>
    template
      .replace(/\{nome\}/g, appointment.fullName)
      .replace(/\{data\}/g, dateFormatted)
      .replace(/\{hora\}/g, appointment.time)
      .replace(/\{protocolo\}/g, appointment.protocol || '')
      .replace(/\{local\}/g, locName)
      .replace(/\{endereco\}/g, address)
      .replace(/\{link_local\}/g, googleMapsLink)
      .replace(/\{antecedencia_texto\}/g, antecedenciaTexto)
      .replace(/\{tipo_rg\}/g, appointment.rgType || '1ª via')
      .replace(/\{cpf\}/g, appointment.cpf || '')

  const defaultSubject = `Lembrete de Atendimento — Protocolo ${appointment.protocol}`
  const defaultBody =
    `Olá {nome}! 👋\n\n` +
    `Lembrando que seu atendimento será {antecedencia_texto} ({data}). 📅\n\n` +
    `📌 Protocolo: {protocolo}\n` +
    `🕐 Horário: {hora}\n` +
    `🏛 Local: {local}\n` +
    `📍 Endereço: {endereco}\n` +
    `🗺 Mapa: {link_local}\n\n` +
    `⏳ Chegue com 15 minutos de antecedência.\n`

  const emailSubject = replaceVars(options?.subjectTemplate || defaultSubject)
  const emailBody = replaceVars(options?.bodyTemplate || defaultBody)
  const whatsappMessage = `*${systemName}*\n\n${replaceVars(options?.bodyTemplate || defaultBody)}`

  try {
    let emailSent = false
    let whatsappSent = false

    const templateConfig = config?.notificationTemplates?.lembrete

    if (emailEnabled && (templateConfig?.emailAtivo ?? true)) {
      emailSent = await sendEmailNotification(appointment, emailSubject, emailBody)
    }

    if (whatsappEnabled && (templateConfig?.whatsappAtivo ?? true)) {
      whatsappSent = await sendWhatsAppNotification(appointment, whatsappMessage)
    }

    const channels: string[] = []
    if (emailSent) channels.push('Email')
    if (whatsappSent) channels.push('WhatsApp')

    const notificationLog = {
      id: crypto.randomUUID(),
      appointmentId: appointment.id,
      type: 'reminder' as const,
      status: 'sent' as const,
      timestamp: new Date().toISOString(),
      recipientEmail: appointment.email,
      recipientPhone: appointment.phone,
      channels: channels.join(', '),
      message: emailSubject
    }

    window.dispatchEvent(new CustomEvent('notification-sent', { detail: notificationLog }))

    return {
      success: emailSent || whatsappSent,
      emailSent,
      smsSent: false,
      whatsappSent,
      message: `Lembrete enviado via ${channels.join(', ')} para ${appointment.fullName}`
    }
  } catch (error) {
    console.error('Erro ao enviar lembrete:', error)
    return {
      success: false,
      emailSent: false,
      smsSent: false,
      whatsappSent: false,
      message: 'Erro ao enviar lembrete'
    }
  }
}

export function checkAndSendReminders(
  appointments: Appointment[],
  config?: SystemConfig,
  locations?: Location[]
): void {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd')

  appointments.forEach(async (appointment) => {
    if (
      appointment.date === tomorrowStr &&
      (appointment.status === 'confirmed' || appointment.status === 'pending') &&
      !appointment.reminderSent
    ) {
      const location = locations?.find(loc => loc.id === appointment.locationId)
      await sendReminderNotification(
        appointment, 
        config,
        location?.address,
        location?.googleMapsUrl
      )
    }
  })
}

export async function sendReadyForDeliveryNotification(
  appointment: Appointment,
  config?: SystemConfig,
  locationAddress?: string,
  locationMapsUrl?: string,
  locationName?: string
): Promise<NotificationResult> {
  return sendNotification({
    appointment,
    newStatus: 'cin-ready',
    previousStatus: 'awaiting-issuance',
    config,
    locationName,
    locationAddress,
    locationMapsUrl
  })
}
