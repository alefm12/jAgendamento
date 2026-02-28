/**
 * scheduledReportRunner
 *
 * RESPONSABILIDADE ÚNICA: verificar relatórios agendados vencidos,
 * pedir o arquivo pronto ao templateExportService e disparar o e-mail.
 *
 * Este arquivo NÃO sabe montar arquivos. Ele é um mensageiro/carteiro:
 *   1. Lê o agendamento do banco
 *   2. Chama buildTemplateExportFromPayload() → recebe { buffer, filename, mimeType, ... }
 *   3. Entrega esse buffer no anexo do Nodemailer
 *   4. Atualiza last_execution / next_execution no banco
 */

import nodemailer from 'nodemailer'
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns'
import { pool } from '../config/db'
import { buildTemplateExportFromPayload } from './templateExportService'

// ─── Helpers SMTP (mesma lógica de notifications.ts) ─────────────────────────

const normalizeSmtpHost = (rawHost?: string) => {
  const host = (rawHost || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  const aliases: Record<string, string> = {
    'smtp.titan.hostgator.com': 'smtp.titan.email',
    'mail.titan.hostgator.com': 'smtp.titan.email',
  }
  return aliases[host.toLowerCase()] || host
}

// ─── Cálculo de próxima execução ─────────────────────────────────────────────

const calcNextExecution = (
  from: Date,
  frequency: string,
  timeOfDay: string,
): Date => {
  const [hours, minutes] = (timeOfDay || '08:00').split(':').map(Number)
  let next: Date
  switch (frequency) {
    case 'daily':      next = addDays(from, 1);    break
    case 'weekly':     next = addWeeks(from, 1);   break
    case 'biweekly':   next = addWeeks(from, 2);   break
    case 'monthly':    next = addMonths(from, 1);  break
    case 'quarterly':  next = addMonths(from, 3);  break
    case 'yearly':     next = addYears(from, 1);   break
    default:           next = addDays(from, 1)
  }
  next.setHours(hours, minutes, 0, 0)
  return next
}

// (STATUS_LABELS e helpers de exportação foram movidos para templateExportService.ts)

// ─── Envio de e-mail com anexo ──────────────────────────────────────────────

const sendReportEmail = async (
  smtp: any,
  recipients: Array<{ name?: string; email: string }>,
  subject: string,
  html: string,
  attachment: { buffer: Buffer; filename: string; mimeType: string },
) => {
  const normalizedHost = normalizeSmtpHost(smtp.smtp_host)
  const port = Number(smtp.smtp_port || 587)
  const secure = port === 465 ? true : Boolean(smtp.smtp_secure)

  const fromAddress = smtp.smtp_from_name
    ? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email || smtp.smtp_user}>`
    : (smtp.smtp_from_email || smtp.smtp_user)

  const toAddresses = recipients
    .filter((r) => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
    .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email))

  if (toAddresses.length === 0) throw new Error('Nenhum destinatário válido')

  const attempts = [
    { port, secure, requireTLS: !secure },
    { port: 465, secure: true,  requireTLS: false },
    { port: 587, secure: false, requireTLS: true  },
    { port: 587, secure: false, requireTLS: false },
  ]

  let sent = false
  const errors: string[] = []

  outer:
  for (const attempt of attempts) {
    for (const authMethod of ['PLAIN', 'LOGIN'] as const) {
      try {
        const transporter = nodemailer.createTransport({
          host: normalizedHost,
          port: attempt.port,
          secure: attempt.secure,
          requireTLS: attempt.requireTLS,
          authMethod,
          tls: { servername: normalizedHost },
          auth: smtp.smtp_user && smtp.smtp_password
            ? { user: smtp.smtp_user, pass: smtp.smtp_password }
            : undefined,
        })
        await transporter.sendMail({
          from: fromAddress, to: toAddresses, subject, html,
          attachments: [{
            filename: attachment.filename,
            content:  attachment.buffer,
            contentType: attachment.mimeType,
          }],
        })
        sent = true
        break outer
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err))
      }
    }
  }

  if (!sent) throw new Error(errors[0] || 'Falha ao enviar email')
}

// ─── Runner principal ────────────────────────────────────────────────────────

export const runScheduledReportsNow = async () => {
  try {
    const now = new Date()

    // 1. Buscar relatórios ativos com next_execution vencida
    const { rows: dueReports } = await pool.query<any>(
      `SELECT * FROM scheduled_reports
        WHERE is_active = TRUE
          AND next_execution IS NOT NULL
          AND next_execution <= $1`,
      [now.toISOString()],
    )

    if (dueReports.length === 0) return

    console.log(`[ScheduledRunner] ${dueReports.length} relatório(s) prontos para execução`)

    // 2. Buscar configuração SMTP (tenant 1)
    const { rows: smtpRows } = await pool.query<any>(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure, ativo
         FROM smtp_config WHERE prefeitura_id = 1 LIMIT 1`,
    )
    const smtp = smtpRows[0]

    // 3. Executar cada relatório
    for (const row of dueReports) {
      const payload: any   = (row.payload && typeof row.payload === 'object') ? row.payload : {}
      const reportName     = payload.name || row.name || 'Relatório Agendado'
      const reportFormat: string   = payload.format || row.format || 'excel'
      const deliveryMethod: string = payload.deliveryMethod || 'email'
      const frequency: string      = payload.frequency      || row.frequency || 'daily'
      const timeOfDay: string      = payload.timeOfDay      || '08:00'
      const recipients: Array<{ name?: string; email: string }> = Array.isArray(payload.recipients)
        ? payload.recipients
        : []

      const emailSubject = payload.emailSubject
        || `${reportName} — ${format(now, 'dd/MM/yyyy')}`

      const nextExec = calcNextExecution(now, frequency, timeOfDay)

      try {
        const exportResult = await buildTemplateExportFromPayload(
          { ...payload, format: reportFormat, _scheduledReportId: row.id },
          reportName,
        )

        if ((deliveryMethod === 'email' || deliveryMethod === 'both')) {
          if (!smtp || !smtp.ativo) {
            console.warn(`[ScheduledRunner] ⚠️  SMTP não configurado/ativo — email não enviado para "${reportName}"`)
          } else if (recipients.length === 0) {
            console.warn(`[ScheduledRunner] ⚠️  Sem destinatários para "${reportName}"`)
          } else {
            await sendReportEmail(smtp, recipients, emailSubject, exportResult.htmlContent, {
              buffer:   exportResult.buffer,
              filename: exportResult.filename,
              mimeType: exportResult.mimeType,
            })
            console.log(`[ScheduledRunner] ✅ Email enviado para "${reportName}" → ${recipients.map((r) => r.email).join(', ')} (anexo: ${exportResult.filename})`)
          }
        }

        const downloadReady = deliveryMethod === 'download' || deliveryMethod === 'both'

        const updatedPayload = {
          ...payload,
          lastExecuted:       now.toISOString(),
          nextExecution:      nextExec.toISOString(),
          executionCount:     (Number(payload.executionCount || 0) + 1),
          ...(downloadReady ? {
            lastReportData:     exportResult.buffer.toString('base64'),
            lastReportFilename: exportResult.filename,
            lastReportMime:     exportResult.mimeType,
            lastReportReadyAt:  now.toISOString(),
          } : {}),
        }

        await pool.query(
          `UPDATE scheduled_reports
              SET last_execution = $2,
                  next_execution = $3,
                  payload        = $4,
                  updated_at     = NOW()
            WHERE id = $1`,
          [row.id, now.toISOString(), nextExec.toISOString(), JSON.stringify(updatedPayload)],
        )

        console.log(`[ScheduledRunner] ✅ "${reportName}" executado — próxima: ${nextExec.toISOString()}`)
      } catch (execErr) {
        console.error(`[ScheduledRunner] ❌ Erro ao executar "${reportName}":`, execErr)
        await pool.query(
          `UPDATE scheduled_reports SET next_execution = $2, updated_at = NOW() WHERE id = $1`,
          [row.id, nextExec.toISOString()],
        )
      }
    }
  } catch (err) {
    console.error('[ScheduledRunner] Erro geral:', err)
  }
}

export const startScheduledReportRunner = () => {
  const INTERVAL_MS = 60_000 // verifica a cada 1 minuto

  // Executa imediatamente ao iniciar e depois a cada minuto
  void runScheduledReportsNow()
  setInterval(() => { void runScheduledReportsNow() }, INTERVAL_MS)
  console.log('[ScheduledRunner] 🟢 Runner de relatórios agendados iniciado (intervalo: 60 s)')
}
