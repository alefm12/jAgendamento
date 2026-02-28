import { Router } from 'express'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { pool } from '../config/db'
import { type AuthRequest } from '../middlewares/auth.middleware'
import { createAuditLog as createServerAuditLog } from '../services/audit.service'

const router = Router()

const testEmailSchema = z.object({
  prefeituraId: z.union([z.string(), z.number()]).optional(),
  to: z.string().email('E-mail de destino inválido'),
  subject: z.string().optional(),
  message: z.string().optional()
})

const resolveTenantId = async (req: AuthRequest, payloadTenant?: string | number) => {
  if (payloadTenant) return Number(payloadTenant)
  const headerTenant = req.headers['x-tenant-id']
  if (typeof headerTenant === 'string' && headerTenant.trim()) return Number(headerTenant)
  const headerSlug = req.headers['x-prefeitura-slug']
  if (typeof headerSlug === 'string' && headerSlug.trim()) {
    const tenantResult = await pool.query(
      'SELECT id FROM prefeituras WHERE slug = $1 LIMIT 1',
      [headerSlug.trim()]
    )
    const tenantId = tenantResult.rows[0]?.id
    if (tenantId) return Number(tenantId)
  }
  return 1
}

const normalizeSmtpHost = (rawHost?: string) => {
  const host = (rawHost || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  const aliases: Record<string, string> = {
    'smtp.titan.hostgator.com': 'smtp.titan.email',
    'mail.titan.hostgator.com': 'smtp.titan.email'
  }
  return aliases[host.toLowerCase()] || host
}

type SendAttempt = {
  port: number
  secure: boolean
  requireTLS?: boolean
}

const buildSmtpAttempts = (basePort: number, baseSecure: boolean): SendAttempt[] => {
  const attempts: SendAttempt[] = [
    { port: basePort, secure: baseSecure, requireTLS: !baseSecure }
  ]

  const addAttempt = (next: SendAttempt) => {
    const key = `${next.port}-${next.secure}-${Boolean(next.requireTLS)}`
    const exists = attempts.some((a) => `${a.port}-${a.secure}-${Boolean(a.requireTLS)}` === key)
    if (!exists) attempts.push(next)
  }

  // Fallbacks comuns para provedores SMTP (incluindo Titan)
  addAttempt({ port: 465, secure: true, requireTLS: false })
  addAttempt({ port: 587, secure: false, requireTLS: true })
  addAttempt({ port: 587, secure: false, requireTLS: false })

  return attempts
}

const classifySmtpError = (errors: string[]) => {
  const joined = errors.join(' | ')
  if (/EAUTH|535|authentication failed|Invalid login/i.test(joined)) {
    return 'Falha de autenticação SMTP. Revise usuário/senha da conta Titan e se a caixa permite SMTP externo.'
  }
  if (/wrong version number|ESOCKET|SSL routines|tls/i.test(joined)) {
    return 'Incompatibilidade TLS/porta SMTP. Tente porta 465 com SSL ou 587 com TLS.'
  }
  if (/ENOTFOUND|getaddrinfo|host/i.test(joined)) {
    return 'Servidor SMTP não encontrado. Revise o host SMTP (Titan geralmente usa smtp.titan.email).'
  }
  return errors[0] || 'Erro ao enviar e-mail de teste'
}

const uniqueStrings = (items: Array<string | undefined | null>) => {
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of items) {
    const value = String(item || '').trim()
    if (!value) continue
    if (seen.has(value)) continue
    seen.add(value)
    output.push(value)
  }
  return output
}

router.post('/notifications/test-email', async (req: AuthRequest, res) => {
  const payloadParse = testEmailSchema.safeParse(req.body || {})
  if (!payloadParse.success) {
    return res.status(400).json({ message: payloadParse.error.issues[0]?.message || 'Dados inválidos' })
  }

  const payload = payloadParse.data
  const tenantId = await resolveTenantId(req, payload.prefeituraId)

  try {
    const configResult = await pool.query(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure, ativo
         FROM smtp_config
        WHERE prefeitura_id = $1
        LIMIT 1`,
      [tenantId]
    )
    const smtp = configResult.rows[0]

    if (!smtp || !smtp.ativo) {
      return res.status(400).json({ message: 'SMTP não configurado ou desativado para esta prefeitura.' })
    }

    const normalizedHost = normalizeSmtpHost(smtp.smtp_host)
    const port = Number(smtp.smtp_port || 587)
    const secure = port === 465 ? true : Boolean(smtp.smtp_secure)

    const subject = payload.subject || 'Teste de E-mail - Sistema de Agendamento'
    const textMessage = payload.message || 'Este é um e-mail de teste enviado pelo sistema de Agendamento.'
    const smtpUserCandidates = uniqueStrings([
      smtp.smtp_user,
      smtp.smtp_from_email,
      String(smtp.smtp_user || '').toLowerCase(),
      String(smtp.smtp_from_email || '').toLowerCase()
    ])
    const smtpPasswordCandidates = uniqueStrings([
      smtp.smtp_password,
      typeof smtp.smtp_password === 'string' ? smtp.smtp_password.trim() : ''
    ])
    const smtpAuthMethods: Array<'PLAIN' | 'LOGIN'> = ['PLAIN', 'LOGIN']

    const fromAddress = smtp.smtp_from_name
      ? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email || smtpUserCandidates[0] || smtp.smtp_user}>`
      : (smtp.smtp_from_email || smtpUserCandidates[0] || smtp.smtp_user)

    const attempts = buildSmtpAttempts(port, secure)
    const attemptErrors: string[] = []
    let sent = false

    for (const attempt of attempts) {
      for (const authMethod of smtpAuthMethods) {
        for (const userCandidate of smtpUserCandidates) {
          for (const passCandidate of smtpPasswordCandidates) {
            try {
              const transporter = nodemailer.createTransport({
                host: normalizedHost,
                port: attempt.port,
                secure: attempt.secure,
                requireTLS: attempt.requireTLS,
                authMethod,
                tls: { servername: normalizedHost },
                auth: userCandidate && passCandidate
                  ? { user: userCandidate, pass: passCandidate }
                  : undefined
              })

              await transporter.sendMail({
                from: fromAddress,
                to: payload.to,
                subject,
                text: textMessage
              })
              sent = true
              break
            } catch (attemptError) {
              const errorText = attemptError instanceof Error ? attemptError.message : String(attemptError)
              attemptErrors.push(
                `host=${normalizedHost} port=${attempt.port} secure=${attempt.secure} method=${authMethod} user=${userCandidate}: ${errorText}`
              )
            }
          }
          if (sent) break
        }
        if (sent) break
      }
      if (sent) break
    }

    if (!sent) {
      throw new Error(classifySmtpError(attemptErrors))
    }

    await createServerAuditLog({
      userId: req.user?.id,
      userEmail: req.user?.email || null,
      userName: req.user?.name || req.user?.email || 'Sistema',
      userRole: req.user?.role || 'SECRETARY',
      action: 'TEST_EMAIL_NOTIFICATION',
      actionCategory: 'NOTIFICATION',
      description: `O usuário ${req.user?.name || req.user?.email || 'Sistema'} testou envio de e-mail para ${payload.to}, pela aba Testar Notificações.`,
      severity: 'LOW',
      entityType: 'notification',
      entityId: String(tenantId),
      newValues: { to: payload.to, subject },
      status: 'success'
    }, req)

    return res.json({ success: true, message: 'E-mail de teste enviado com sucesso.' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar e-mail de teste'
    const friendlyMessage = errorMessage

    await createServerAuditLog({
      userId: req.user?.id,
      userEmail: req.user?.email || null,
      userName: req.user?.name || req.user?.email || 'Sistema',
      userRole: req.user?.role || 'SECRETARY',
      action: 'TEST_EMAIL_NOTIFICATION',
      actionCategory: 'NOTIFICATION',
      description: `O usuário ${req.user?.name || req.user?.email || 'Sistema'} tentou testar envio de e-mail para ${payload.to}, pela aba Testar Notificações.`,
      severity: 'HIGH',
      entityType: 'notification',
      entityId: String(tenantId),
      newValues: { to: payload.to },
      status: 'failed',
      errorMessage: friendlyMessage
    }, req)

    console.error('[notifications] Erro ao enviar e-mail de teste:', error)
    return res.status(500).json({
      message: friendlyMessage
    })
  }
})

// ─── Diagnóstico SMTP por etapas ─────────────────────────────────────────────
const smtpDiagSchema = z.object({
  prefeituraId: z.union([z.string(), z.number()]).optional()
})

router.post('/notifications/smtp-diagnose', async (req: AuthRequest, res) => {
  const parsed = smtpDiagSchema.safeParse(req.body || {})
  const tenantId = await resolveTenantId(req, parsed.data?.prefeituraId)

  const steps: Array<{ step: string; ok: boolean; detail: string }> = []

  try {
    // Etapa 1: ler configuração do banco
    const configResult = await pool.query(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure, ativo
         FROM smtp_config WHERE prefeitura_id = $1 LIMIT 1`,
      [tenantId]
    )
    const smtp = configResult.rows[0]

    if (!smtp) {
      return res.json({
        success: false,
        steps: [{ step: 'Configuração', ok: false, detail: 'Nenhuma configuração SMTP encontrada no banco.' }]
      })
    }

    steps.push({
      step: 'Configuração',
      ok: true,
      detail: `Host: ${smtp.smtp_host}, Porta: ${smtp.smtp_port}, Usuário: ${smtp.smtp_user}, Ativo: ${smtp.ativo}`
    })

    if (!smtp.ativo) {
      steps.push({ step: 'SMTP Ativo', ok: false, detail: 'SMTP está desativado. Ative em Administração > Notificações.' })
      return res.json({ success: false, steps })
    }

    const normalizedHost = normalizeSmtpHost(smtp.smtp_host)
    const port = Number(smtp.smtp_port || 587)
    const secure = port === 465 ? true : Boolean(smtp.smtp_secure)

    steps.push({ step: 'SMTP Ativo', ok: true, detail: 'SMTP está habilitado.' })

    // Etapa 2: verificar TCP + EHLO
    let transporter: ReturnType<typeof nodemailer.createTransport> | null = null
    try {
      transporter = nodemailer.createTransport({
        host: normalizedHost,
        port,
        secure,
        tls: { servername: normalizedHost },
        auth: smtp.smtp_user && smtp.smtp_password
          ? { user: smtp.smtp_user, pass: smtp.smtp_password }
          : undefined
      })
      await transporter.verify()
      steps.push({ step: 'Conexão TCP/TLS', ok: true, detail: `Conectado com sucesso a ${normalizedHost}:${port}` })
      steps.push({ step: 'Autenticação', ok: true, detail: `Login aceito pelo servidor SMTP para ${smtp.smtp_user}` })
      return res.json({ success: true, steps })
    } catch (verifyError) {
      const msg = verifyError instanceof Error ? verifyError.message : String(verifyError)

      if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|getaddrinfo|ETIMEOUT/i.test(msg)) {
        steps.push({ step: 'Conexão TCP/TLS', ok: false, detail: `Servidor não alcançado em ${normalizedHost}:${port}. ${msg}` })
        // tenta fallback ports
        for (const fallbackPort of [465, 587]) {
          if (fallbackPort === port) continue
          try {
            const fb = nodemailer.createTransport({
              host: normalizedHost,
              port: fallbackPort,
              secure: fallbackPort === 465,
              tls: { servername: normalizedHost },
              auth: smtp.smtp_user && smtp.smtp_password
                ? { user: smtp.smtp_user, pass: smtp.smtp_password }
                : undefined
            })
            await fb.verify()
            steps.push({
              step: `Fallback Porta ${fallbackPort}`,
              ok: true,
              detail: `Funcionou na porta ${fallbackPort}! Altere a porta SMTP para ${fallbackPort} nas configurações.`
            })
            return res.json({ success: false, steps })
          } catch {
            steps.push({ step: `Fallback Porta ${fallbackPort}`, ok: false, detail: `Não funcionou na porta ${fallbackPort} também.` })
          }
        }
        return res.json({ success: false, steps })
      }

      if (/EAUTH|535|authentication failed|Invalid login/i.test(msg)) {
        steps.push({ step: 'Conexão TCP/TLS', ok: true, detail: `Servidor alcançado em ${normalizedHost}:${port}` })
        steps.push({ step: 'Autenticação', ok: false, detail: `Credenciais recusadas pelo servidor: ${msg}. Verifique usuário/senha da caixa no painel Titan.` })
        return res.json({ success: false, steps })
      }

      if (/wrong version number|SSL|TLS/i.test(msg)) {
        steps.push({ step: 'Conexão TCP/TLS', ok: false, detail: `Problema de SSL/TLS na porta ${port}: ${msg}. Tente trocar a porta.` })
        return res.json({ success: false, steps })
      }

      steps.push({ step: 'Conexão TCP/TLS', ok: false, detail: msg })
      return res.json({ success: false, steps })
    }
  } catch (error) {
    steps.push({
      step: 'Erro interno',
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    })
    return res.json({ success: false, steps })
  }
})

// ─── Diagnóstico UltraMsg por etapas ─────────────────────────────────────────
const zapiDiagSchema = z.object({
  prefeituraId: z.union([z.string(), z.number()]).optional(),
  api_url: z.string().optional(),
  api_token: z.string().optional(),
  client_token: z.string().optional(),
  instance_id: z.string().optional(),
  ativo: z.boolean().optional()
})

router.post(['/notifications/provider-diagnose', '/notifications/ultramsg-diagnose', '/notifications/zapi-diagnose'], async (req: AuthRequest, res) => {
  const parsed = zapiDiagSchema.safeParse(req.body || {})
  const tenantId = await resolveTenantId(req, parsed.data?.prefeituraId)
  const steps: Array<{ step: string; ok: boolean; detail: string }> = []

  try {
    const configResult = await pool.query(
      `SELECT api_url, api_token, client_token, instance_id, numero_origem, ativo
         FROM whatsapp_config WHERE prefeitura_id = $1 LIMIT 1`,
      [tenantId]
    )
    const dbCfg = configResult.rows[0]
    const bodyCfg = parsed.data || {}
    const cfg = {
      ...dbCfg,
      api_url: bodyCfg.api_url ?? dbCfg?.api_url,
      api_token: bodyCfg.api_token ?? dbCfg?.api_token,
      client_token: bodyCfg.client_token ?? dbCfg?.client_token,
      instance_id: bodyCfg.instance_id ?? dbCfg?.instance_id,
      ativo: bodyCfg.ativo ?? dbCfg?.ativo ?? true
    }

    if (!dbCfg && !bodyCfg.instance_id && !bodyCfg.api_token) {
      return res.json({ success: false, steps: [{ step: 'Configuração', ok: false, detail: 'Nenhuma configuração de plataforma de mensagens encontrada no banco.' }] })
    }

    steps.push({
      step: 'Configuração',
      ok: true,
      detail: `ID: ${cfg.instance_id || '(vazio)'}, Token: ${cfg.api_token ? cfg.api_token.substring(0, 6) + '…' : '(vazio)'}, Client-Token: ${cfg.client_token ? 'informado' : 'não informado (usará token da instância)'}, URL: ${cfg.api_url || '(padrão)'}, Ativo: ${cfg.ativo}`
    })

    if (!cfg.ativo) {
      steps.push({ step: 'WhatsApp Ativo', ok: false, detail: 'WhatsApp está desativado. Ative em Administração > Notificações.' })
      return res.json({ success: false, steps })
    }

    if (!cfg.instance_id || !cfg.api_token) {
      steps.push({ step: 'Credenciais', ok: false, detail: 'ID ou Token não preenchidos.' })
      return res.json({ success: false, steps })
    }

    steps.push({ step: 'WhatsApp Ativo', ok: true, detail: 'WhatsApp está habilitado.' })
    steps.push({ step: 'Credenciais', ok: true, detail: 'Instance ID e Token preenchidos.' })

    const { WhatsappService } = await import('../services/whatsapp.service.js')
    const status = await WhatsappService.checkInstanceStatus(cfg.instance_id, cfg.api_token, cfg.api_url, cfg.client_token)

    if (status.status === 'auth_error') {
      steps.push({ step: 'Autenticação', ok: false, detail: status.error || 'Token ou ID inválidos.' })
      return res.json({ success: false, steps })
    }

    if (!status.connected) {
      steps.push({
        step: 'Instância',
        ok: false,
        detail: `Instância não conectada ao WhatsApp. Status: "${status.status}". ${status.error || 'Verifique a conexão no painel da sua plataforma.'}`
      })
      return res.json({ success: false, steps })
    }

    steps.push({
      step: 'Instância',
      ok: true,
      detail: `Conectada ao WhatsApp!${status.phone ? ` Número: ${status.phone}` : ''}`
    })

    return res.json({ success: true, steps })
  } catch (error) {
    steps.push({ step: 'Erro interno', ok: false, detail: error instanceof Error ? error.message : String(error) })
    return res.json({ success: false, steps })
  }
})

// ─── Teste de envio WhatsApp ─────────────────────────────────────────────────
const zapiTestSchema = z.object({
  prefeituraId: z.union([z.string(), z.number()]).optional(),
  phone: z.string().min(8, 'Telefone inválido'),
  message: z.string().optional(),
  api_url: z.string().optional(),
  api_token: z.string().optional(),
  client_token: z.string().optional(),
  instance_id: z.string().optional(),
  ativo: z.boolean().optional()
})

router.post('/notifications/test-whatsapp', async (req: AuthRequest, res) => {
  const parsed = zapiTestSchema.safeParse(req.body || {})
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Dados inválidos' })
  }

  const tenantId = await resolveTenantId(req, parsed.data.prefeituraId)

  try {
    const configResult = await pool.query(
      `SELECT api_url, api_token, client_token, instance_id, ativo FROM whatsapp_config WHERE prefeitura_id = $1 LIMIT 1`,
      [tenantId]
    )
    const dbCfg = configResult.rows[0]
    const bodyCfg = parsed.data || {}
    const cfg = {
      ...dbCfg,
      api_url: bodyCfg.api_url ?? dbCfg?.api_url,
      api_token: bodyCfg.api_token ?? dbCfg?.api_token,
      client_token: bodyCfg.client_token ?? dbCfg?.client_token,
      instance_id: bodyCfg.instance_id ?? dbCfg?.instance_id,
      ativo: bodyCfg.ativo ?? dbCfg?.ativo ?? true
    }

    if (!cfg || !cfg.ativo) {
      return res.status(400).json({ message: 'WhatsApp não configurado ou desativado.' })
    }

    if (!cfg.instance_id || !cfg.api_token) {
      return res.status(400).json({ message: 'ID da instância e token são obrigatórios.' })
    }

    const { WhatsappService } = await import('../services/whatsapp.service.js')
    const result = await WhatsappService.sendTestMessage(
      cfg.instance_id,
      cfg.api_token,
      parsed.data.phone,
      parsed.data.message,
      cfg.api_url,
      cfg.client_token
    )

    await createServerAuditLog({
      userId: req.user?.id,
      userEmail: req.user?.email || null,
      userName: req.user?.name || req.user?.email || 'Sistema',
      userRole: req.user?.role || 'SECRETARY',
      action: 'TEST_WHATSAPP_NOTIFICATION',
      actionCategory: 'NOTIFICATION',
      description: `Teste de WhatsApp para ${parsed.data.phone} pela aba Testar Notificações.`,
      severity: 'LOW',
      entityType: 'notification',
      entityId: String(tenantId),
      newValues: { phone: parsed.data.phone },
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error
    }, req)

    if (result.success) {
      return res.json({ success: true, message: 'Mensagem de teste enviada com sucesso!' })
    }
    return res.status(500).json({ message: result.error || 'Erro ao enviar mensagem de teste.' })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro interno' })
  }
})

export default router

