import path from 'path'
import fs from 'fs'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import express, { type NextFunction, type Request, type Response } from 'express'
import { execFile } from 'child_process'
import multer from 'multer'
import { promisify } from 'util'
import { z } from 'zod'
import { pool } from './config/db'
import { env } from './config/env'
import { corsOptions } from './config/cors'
import agendamentoRoutes from './routes/agendamentos'
import usersRoutes from './routes/users'
import locationsRoutes from './routes/locations'
import publicRoutes from './routes/public'
import tenantsRoutes from './routes/tenants'
import locationSettingsRoutes from './routes/locations.routes'
import appointmentRoutes from './routes/appointments.routes'
import appointmentsNewRoutes from './routes/appointments-new'
import locationsNewRoutes from './routes/locations-new'
import secretaryUsersRoutes from './routes/secretaryUsers'
import systemConfigRoutes from './routes/systemConfig'
import configRoutes from './routes/config.routes'
import configAdvancedRoutes from './routes/config-advanced.routes'
import scheduledReportsRoutes from './routes/scheduledReports'
import { startScheduledReportRunner } from './services/scheduledReportRunner'
import { startScheduledBackupRunner } from './services/scheduledBackupRunner'
import reportExecutionLogsRoutes from './routes/reportExecutionLogs'
import auditLogsRoutes from './routes/auditLogs'
import notificationsRoutes from './routes/notifications'
import systemRoutes from './routes/system'
import { hashPassword } from './utils/password'
import authRoutes from './routes/auth.routes'
import { authMiddleware, type AuthRequest } from './middlewares/auth.middleware'
import { logSystemConfigChange } from './services/audit.service'
import { verificarBloqueioCP, registrarCancelamento } from './services/bloqueio.service'
import { WhatsappService } from './services/whatsapp.service'
import { healthCheck } from './controllers/health.controller'

const execFileAsync = promisify(execFile)

// 🔑 CHAVE MESTRA FIXA
process.env.JWT_SECRET = env.JWT_SECRET

const PORT = env.PORT
const app = express()
app.use(cors(corsOptions))

// 🔒 Helmet — cabeçalhos de segurança HTTP
app.use(helmet({
  contentSecurityPolicy: false, // desativado pois o frontend usa Vite/CDN com inline scripts
}))

// 🚦 Rate limiters
// Geral: 200 req / 15 min por IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas requisições. Tente novamente em alguns minutos.' },
})

// Login: 10 tentativas / 15 min por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
})

// Novo agendamento: 5 por IP / 15 min
const agendamentosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Limite de criação de agendamentos atingido. Tente novamente em 15 minutos.' },
})

app.use(generalLimiter)

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: false }))

const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }) }
app.use('/uploads', express.static(uploadsDir))

// Middleware de autenticação global (extrai user do token JWT quando disponível)
app.use(authMiddleware)

const hasSystemAdminAccess = (req: AuthRequest) => {
  const role = String(req.user?.role || '').toUpperCase()
  if (role === 'SUPER_ADMIN') return true
  if (req.user?.adminType === 'system') return true
  if (req.user?.adminType === 'local') return false

  // Compatibilidade com tokens legados (antes de adminType/permissões detalhadas)
  if (role === 'ADMIN' || role === 'MASTER_ADMIN') return true
  if (req.user?.isAdmin === true) return true

  return false
}

const hasPermission = (req: AuthRequest, permission: string) => {
  // Compatibilidade legada: fluxo antigo sem JWT não deve ser bloqueado
  if (!req.user) return true
  if (hasSystemAdminAccess(req)) return true
  return req.user?.permissions?.[permission] === true
}

const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Compatibilidade legada: sem token JWT, mantém comportamento anterior
    if (!req.user) return next()
    if (!hasPermission(req, permission)) {
      return res.status(403).json({ message: 'Sem permissão para esta operação' })
    }
    return next()
  }
}

// --- CORREÇÃO DE TIPOS (name/password) ---
interface PrefeituraRow { id: number; nome: string; slug: string; ativo: boolean; criado_em: string }
interface SuperAdminRow { id: number; name: string; email: string; password: string; created_at: string }

const slugRegex = /^[a-z0-9-]+$/
const createPrefeituraSchema = z.object({
  nome: z.string().min(3),
  slug: z.string().min(3).max(80).regex(slugRegex),
  ativo: z.boolean().optional().default(true)
})
const updatePrefeituraSchema = z.object({
  nome: z.string().min(3).optional(),
  ativo: z.boolean().optional()
}).refine((data) => Object.keys(data).length > 0, 'Nenhum campo')

app.get('/api/health', healthCheck)

const ensureSystemConfigTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_config (
      id SERIAL PRIMARY KEY,
      system_name VARCHAR(255) DEFAULT 'Agendamento CIN',
      primary_color VARCHAR(50) DEFAULT 'oklch(0.45 0.15 145)',
      secondary_color VARCHAR(50) DEFAULT 'oklch(0.65 0.1 180)',
      accent_color VARCHAR(50) DEFAULT 'oklch(0.55 0.18 145)',
      logo TEXT,
      reminder_message TEXT,
      booking_window_days INTEGER DEFAULT 60,
      default_theme VARCHAR(20) DEFAULT 'light',
      working_hours JSONB,
      max_appointments_per_slot INTEGER DEFAULT 2,
      secretary_config JSONB,
      reminder_settings JSONB,
      notification_templates JSONB,
      lgpd_settings JSONB,
      rg_delivery_settings JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS reminder_settings JSONB`)
  await pool.query(`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS notification_templates JSONB`)
}

const loadCustomFieldsForPrefeitura = async (prefeituraId: number) => {
  try {
    const result = await pool.query(
      `SELECT id, nome_campo, label_campo, tipo_campo, placeholder, texto_ajuda, obrigatorio, ativo, opcoes, ordem
         FROM campos_personalizados
        WHERE prefeitura_id = $1
        ORDER BY ordem, id`,
      [prefeituraId]
    )

    return (result.rows || []).map((field: any) => ({
      id: String(field.nome_campo || field.id),
      name: String(field.nome_campo || field.id),
      label: field.label_campo || field.nome_campo || 'Campo',
      type: field.tipo_campo === 'tel' ? 'phone' : (field.tipo_campo || 'text'),
      required: Boolean(field.obrigatorio),
      placeholder: field.placeholder || '',
      options: Array.isArray(field.opcoes) ? field.opcoes : [],
      order: Number(field.ordem || 0),
      helpText: field.texto_ajuda || '',
      enabled: field.ativo !== false
    }))
  } catch (error) {
    console.error('[SYSTEM-CONFIG] Erro ao carregar campos personalizados:', error)
    return []
  }
}

app.get('/api/system-config', async (_req, res) => {
  try {
    await ensureSystemConfigTable()
    const customFields = await loadCustomFieldsForPrefeitura(1)
    const result = await pool.query(
      `SELECT *
         FROM system_config
        ORDER BY id ASC
        LIMIT 1`
    )

    if (result.rowCount === 0) {
      const insert = await pool.query(
        `INSERT INTO system_config (
          system_name, primary_color, secondary_color, accent_color,
          reminder_message, booking_window_days, secretary_config,
          reminder_settings, notification_templates
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          'Sistema de Agendamento',
          '#3b82f6',
          '#1e40af',
          '#6366f1',
          'Olá {nome}, lembramos que você tem agendamento para {data} às {hora}.',
          60,
          JSON.stringify({}),
          JSON.stringify({ enabled: true, hoursBeforeAppointment: 24, reminderDays: [1] }),
          JSON.stringify({})
        ]
      )
      const row = insert.rows[0]
      return res.json({
        systemName: row.system_name,
        primaryColor: row.primary_color,
        secondaryColor: row.secondary_color,
        accentColor: row.accent_color,
        logo: row.logo || '',
        reminderMessage: row.reminder_message,
        bookingWindowDays: row.booking_window_days,
        defaultTheme: row.default_theme || 'light',
        workingHours: row.working_hours || undefined,
        maxAppointmentsPerSlot: row.max_appointments_per_slot || 2,
        secretaryConfig: row.secretary_config || {},
        contactInfo: row.secretary_config?.contactInfo || {},
        reminderSettings: row.reminder_settings || undefined,
        notificationTemplates: row.notification_templates || undefined,
        lgpdSettings: row.lgpd_settings || undefined,
        rgDeliverySettings: row.rg_delivery_settings || undefined,
        customFields
      })
    }

    const row = result.rows[0]
    return res.json({
      systemName: row.system_name,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      logo: row.logo || '',
      reminderMessage: row.reminder_message,
      bookingWindowDays: row.booking_window_days,
      defaultTheme: row.default_theme || 'light',
      workingHours: row.working_hours || undefined,
      maxAppointmentsPerSlot: row.max_appointments_per_slot || 2,
      secretaryConfig: row.secretary_config || {},
      contactInfo: row.secretary_config?.contactInfo || {},
      reminderSettings: row.reminder_settings || undefined,
      notificationTemplates: row.notification_templates || undefined,
      lgpdSettings: row.lgpd_settings || undefined,
      rgDeliverySettings: row.rg_delivery_settings || undefined,
      customFields
    })
  } catch (error) {
    console.error('[SYSTEM-CONFIG] Erro ao carregar:', error)
    return res.status(500).json({ message: 'Erro ao carregar configuração do sistema' })
  }
})

app.put('/api/system-config', async (req: AuthRequest, res) => {
  if (!hasPermission(req, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para alterar configurações do sistema' })
  }

  try {
    await ensureSystemConfigTable()

    const payload = req.body || {}
    const previous = await pool.query('SELECT * FROM system_config WHERE id = 1')
    const oldConfig = previous.rows[0] || null
    const mergedSecretaryConfig = {
      ...(payload.secretaryConfig || {}),
      contactInfo: payload.contactInfo || payload.secretaryConfig?.contactInfo || {}
    }

    const result = await pool.query(
      `INSERT INTO system_config (
         id, system_name, primary_color, secondary_color, accent_color,
         logo, reminder_message, booking_window_days, default_theme,
         working_hours, max_appointments_per_slot, secretary_config,
         reminder_settings, notification_templates, lgpd_settings, rg_delivery_settings, updated_at
       ) VALUES (
         1, $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14, $15, NOW()
       )
       ON CONFLICT (id) DO UPDATE SET
         system_name = EXCLUDED.system_name,
         primary_color = EXCLUDED.primary_color,
         secondary_color = EXCLUDED.secondary_color,
         accent_color = EXCLUDED.accent_color,
         logo = EXCLUDED.logo,
         reminder_message = EXCLUDED.reminder_message,
         booking_window_days = EXCLUDED.booking_window_days,
         default_theme = EXCLUDED.default_theme,
         working_hours = EXCLUDED.working_hours,
         max_appointments_per_slot = EXCLUDED.max_appointments_per_slot,
         secretary_config = EXCLUDED.secretary_config,
         reminder_settings = EXCLUDED.reminder_settings,
         notification_templates = EXCLUDED.notification_templates,
         lgpd_settings = EXCLUDED.lgpd_settings,
         rg_delivery_settings = EXCLUDED.rg_delivery_settings,
         updated_at = NOW()
       RETURNING *`,
      [
        payload.systemName || 'Sistema de Agendamento',
        payload.primaryColor || '#3b82f6',
        payload.secondaryColor || '#1e40af',
        payload.accentColor || '#6366f1',
        payload.logo || null,
        payload.reminderMessage || null,
        payload.bookingWindowDays || 60,
        payload.defaultTheme || 'light',
        payload.workingHours ? JSON.stringify(payload.workingHours) : null,
        payload.maxAppointmentsPerSlot || 2,
        JSON.stringify(mergedSecretaryConfig),
        payload.reminderSettings ? JSON.stringify(payload.reminderSettings) : null,
        payload.notificationTemplates ? JSON.stringify(payload.notificationTemplates) : null,
        payload.lgpdSettings ? JSON.stringify(payload.lgpdSettings) : null,
        payload.rgDeliverySettings ? JSON.stringify(payload.rgDeliverySettings) : null
      ]
    )

    const row = result.rows[0]

    if (req.user) {
      await logSystemConfigChange(
        req.user,
        'institucional',
        oldConfig,
        row,
        req
      )
    }

    return res.json({
      systemName: row.system_name,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      logo: row.logo || '',
      reminderMessage: row.reminder_message,
      bookingWindowDays: row.booking_window_days,
      defaultTheme: row.default_theme || 'light',
      workingHours: row.working_hours || undefined,
      maxAppointmentsPerSlot: row.max_appointments_per_slot || 2,
      secretaryConfig: row.secretary_config || {},
      contactInfo: row.secretary_config?.contactInfo || {},
      reminderSettings: row.reminder_settings || undefined,
      notificationTemplates: row.notification_templates || undefined,
      lgpdSettings: row.lgpd_settings || undefined,
      rgDeliverySettings: row.rg_delivery_settings || undefined
    })
  } catch (error) {
    console.error('[SYSTEM-CONFIG] Erro ao salvar:', error)
    return res.status(500).json({ message: 'Erro ao salvar configuração do sistema' })
  }
})

// ==============================
// BACKUP COMPLETO DO SISTEMA (manual via UI)
// ==============================
const dbBackupsDir = path.join(process.cwd(), 'backups', 'database')
if (!fs.existsSync(dbBackupsDir)) {
  fs.mkdirSync(dbBackupsDir, { recursive: true })
}

const systemBackupsDir = path.join(process.cwd(), 'backups', 'system')
if (!fs.existsSync(systemBackupsDir)) {
  fs.mkdirSync(systemBackupsDir, { recursive: true })
}

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }
})

app.post('/api/system/backup', async (_req: AuthRequest, res) => {
  if (!hasPermission(_req, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para executar backup' })
  }

  try {
    const scriptPath = path.join(process.cwd(), 'system_backup_full.cjs')
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ message: 'Script de backup completo não encontrado' })
    }

    await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: process.env
    })

    const latestPathFile = path.join(systemBackupsDir, 'latest_full.txt')
    if (!fs.existsSync(latestPathFile)) {
      return res.status(500).json({ message: 'Arquivo latest_full.txt não encontrado após backup' })
    }

    const latestBackupPath = fs.readFileSync(latestPathFile, 'utf8').trim()
    if (!latestBackupPath || !fs.existsSync(latestBackupPath)) {
      return res.status(500).json({ message: 'Backup não foi gerado corretamente' })
    }

    const fileName = path.basename(latestBackupPath)
    return res.json({
      success: true,
      fileName,
      downloadUrl: `/api/system/backup/download/${encodeURIComponent(fileName)}`
    })
  } catch (error: any) {
    console.error('❌ [BACKUP] Erro ao gerar backup completo:', error)
    return res.status(500).json({
      message: 'Erro ao gerar backup completo do sistema',
      detail: error?.message || 'Erro desconhecido'
    })
  }
})

app.post('/api/system/backup/import', backupUpload.single('backupFile'), async (req: AuthRequest, res) => {
  if (!hasPermission(req, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para importar backup' })
  }

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' })
    }

    const originalName = req.file.originalname || 'backup.zip'
    const extension = path.extname(originalName).toLowerCase()
    if (extension !== '.zip') {
      return res.status(400).json({ message: 'Arquivo inválido. Envie um backup .zip' })
    }

    const safeName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9-_]/g, '_')
    const fileName = `imported_${Date.now()}_${safeName}.zip`
    const targetPath = path.join(systemBackupsDir, fileName)

    fs.writeFileSync(targetPath, req.file.buffer)
    fs.writeFileSync(path.join(systemBackupsDir, 'latest_full.txt'), targetPath, 'utf8')

    return res.json({
      success: true,
      fileName,
      message: 'Backup importado com sucesso. Agora você pode restaurar o último backup.'
    })
  } catch (error: any) {
    console.error('❌ [BACKUP] Erro ao importar backup:', error)
    return res.status(500).json({
      message: 'Erro ao importar backup',
      detail: error?.message || 'Erro desconhecido'
    })
  }
})

app.get('/api/system/backup/list', async (_req: AuthRequest, res) => {
  if (!hasPermission(_req, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para listar backups' })
  }

  try {
    const entries = fs
      .readdirSync(systemBackupsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'))
      .map((entry) => {
        const absolutePath = path.join(systemBackupsDir, entry.name)
        const stats = fs.statSync(absolutePath)
        return {
          fileName: entry.name,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
          downloadUrl: `/api/system/backup/download/${encodeURIComponent(entry.name)}`
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const latestPathFile = path.join(systemBackupsDir, 'latest_full.txt')
    const latestBackupPath = fs.existsSync(latestPathFile) ? fs.readFileSync(latestPathFile, 'utf8').trim() : ''
    const latestFileName = latestBackupPath ? path.basename(latestBackupPath) : ''

    return res.json({
      success: true,
      latestFileName,
      backups: entries.map((item) => ({
        ...item,
        isLatest: latestFileName === item.fileName
      }))
    })
  } catch (error: any) {
    console.error('❌ [BACKUP] Erro ao listar backups:', error)
    return res.status(500).json({
      message: 'Erro ao listar backups',
      detail: error?.message || 'Erro desconhecido'
    })
  }
})

app.post('/api/system/backup/pick-output-dir', async (_req: AuthRequest, res) => {
  if (!hasPermission(_req, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para selecionar pasta de backup' })
  }

  try {
    if (process.platform !== 'win32') {
      return res.status(400).json({ message: 'Seletor nativo disponível apenas no Windows.' })
    }

    const pickerScript = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "[System.Windows.Forms.Application]::EnableVisualStyles()",
      "$owner = New-Object System.Windows.Forms.Form",
      "$owner.TopMost = $true",
      "$owner.StartPosition = 'CenterScreen'",
      "$owner.ShowInTaskbar = $false",
      "$owner.Opacity = 0",
      "$owner.WindowState = 'Minimized'",
      "$owner.Show()",
      "$owner.Activate()",
      "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
      "$dialog.Title = 'Selecione a pasta de destino para backups automáticos'",
      "$dialog.Filter = 'Pastas|*.none'",
      "$dialog.CheckFileExists = $false",
      "$dialog.CheckPathExists = $true",
      "$dialog.ValidateNames = $false",
      "$dialog.FileName = 'Selecione esta pasta'",
      "$result = $dialog.ShowDialog($owner)",
      "$owner.Close()",
      "if ($result -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  $selectedPath = [System.IO.Path]::GetDirectoryName($dialog.FileName)",
      "  if ($selectedPath) { [Console]::Out.Write($selectedPath) }",
      "}"
    ].join('; ')

    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-STA', '-Command', pickerScript], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: false
    })

    const selectedPath = String(stdout || '').trim()
    return res.json({
      success: true,
      selectedPath,
      cancelled: !selectedPath
    })
  } catch (error: any) {
    console.error('❌ [BACKUP] Erro ao abrir seletor de pasta:', error)
    return res.status(500).json({
      message: 'Erro ao abrir seletor de pasta',
      detail: error?.message || 'Erro desconhecido'
    })
  }
})

app.post('/api/system/backup/restore', async (req: AuthRequest, res) => {
  if (!hasPermission(req, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para restaurar backup' })
  }

  try {
    const requestedFileName = String(req.body?.fileName || '').trim()
    if (!requestedFileName) {
      return res.status(400).json({ message: 'Informe o nome do arquivo de backup para restaurar' })
    }

    const safeFileName = path.basename(requestedFileName)
    if (!safeFileName.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({ message: 'Arquivo inválido. Selecione um backup .zip' })
    }

    const backupPath = path.join(systemBackupsDir, safeFileName)
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ message: 'Backup selecionado não encontrado' })
    }

    const scriptPath = path.join(process.cwd(), 'system_restore_full.cjs')
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ message: 'Script de restauração completa não encontrado' })
    }

    await execFileAsync(process.execPath, [scriptPath, backupPath, '--force'], {
      cwd: process.cwd(),
      env: process.env
    })

    fs.writeFileSync(path.join(systemBackupsDir, 'latest_full.txt'), backupPath, 'utf8')

    return res.json({
      success: true,
      fileName: safeFileName,
      message: `Restauração do backup ${safeFileName} concluída com sucesso.`
    })
  } catch (error: any) {
    console.error('❌ [BACKUP] Erro ao restaurar backup selecionado:', error)
    return res.status(500).json({
      message: 'Erro ao restaurar backup selecionado',
      detail: error?.message || 'Erro desconhecido'
    })
  }
})

app.post('/api/system/backup/restore-latest', async (_req: AuthRequest, res) => {
  if (!hasPermission(_req, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para restaurar backup' })
  }

  try {
    const latestPathFile = path.join(systemBackupsDir, 'latest_full.txt')
    if (!fs.existsSync(latestPathFile)) {
      return res.status(404).json({ message: 'Nenhum backup completo encontrado para restauração' })
    }

    const latestBackupPath = fs.readFileSync(latestPathFile, 'utf8').trim()
    if (!latestBackupPath || !fs.existsSync(latestBackupPath)) {
      return res.status(404).json({ message: 'Último backup informado não existe mais' })
    }

    const scriptPath = path.join(process.cwd(), 'system_restore_full.cjs')
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ message: 'Script de restauração completa não encontrado' })
    }

    await execFileAsync(process.execPath, [scriptPath, latestBackupPath, '--force'], {
      cwd: process.cwd(),
      env: process.env
    })

    return res.json({
      success: true,
      fileName: path.basename(latestBackupPath),
      message: 'Restauração do último backup concluída com sucesso.'
    })
  } catch (error: any) {
    console.error('❌ [BACKUP] Erro ao restaurar último backup:', error)
    return res.status(500).json({
      message: 'Erro ao restaurar último backup',
      detail: error?.message || 'Erro desconhecido'
    })
  }
})

app.get('/api/system/backup/download/:fileName', (req, res) => {
  const authReq = req as AuthRequest
  if (!hasPermission(authReq, 'canChangeSystemSettings')) {
    return res.status(403).json({ message: 'Sem permissão para baixar backup' })
  }

  try {
    const safeFileName = path.basename(req.params.fileName)
    const targetCandidates = [
      path.join(systemBackupsDir, safeFileName),
      path.join(dbBackupsDir, safeFileName)
    ]
    const target = targetCandidates.find((candidate) => fs.existsSync(candidate))

    if (!target) {
      return res.status(404).json({ message: 'Arquivo de backup não encontrado' })
    }

    return res.download(target, safeFileName)
  } catch (error: any) {
    console.error('❌ [BACKUP] Erro ao baixar backup:', error)
    return res.status(500).json({ message: 'Erro ao baixar backup' })
  }
})

// --- ROTA SETUP-ADMIN ---
app.post('/api/setup-admin', async (_req, res, next) => {
  try {
    const defaultEmail = 'admin@admin.com'
    const defaultPassword = '123456'
    const existing = await pool.query('SELECT id FROM super_admins WHERE email = $1', [defaultEmail])
    if ((existing.rowCount ?? 0) > 0) {
      // Atualiza a senha para o padrão caso já exista com senha diferente
      await pool.query(
        'UPDATE super_admins SET password = $1 WHERE email = $2',
        [defaultPassword, defaultEmail]
      )
      return res.json({ message: 'Admin updated' })
    }
    await pool.query(
      'INSERT INTO super_admins (name, email, password) VALUES ($1, $2, $3)',
      ['Administrador Geral', defaultEmail, defaultPassword]
    )
    res.status(201).json({ message: 'Admin created' })
  } catch (error) { next(error) }
})

app.get('/api/prefeituras', async (_req, res, next) => {
  try {
    const result = await pool.query<PrefeituraRow>('SELECT * FROM prefeituras ORDER BY criado_em DESC')
    res.json(result.rows)
  } catch (error) { next(error) }
})

app.post('/api/prefeituras', async (req: AuthRequest, res, next) => {
  try {
    const payload = createPrefeituraSchema.parse(req.body)
    const result = await pool.query<PrefeituraRow>(
      `INSERT INTO prefeituras (nome, slug, ativo) VALUES ($1, $2, $3) RETURNING *`,
      [payload.nome.trim(), payload.slug.trim(), payload.ativo ?? true]
    )
    
    // Log de auditoria
    if (req.user) {
      await logSystemConfigChange(
        req.user,
        'prefeitura_create',
        null,
        result.rows[0],
        req
      );
    }
    
    res.status(201).json(result.rows[0])
  } catch (error) { next(error) }
})

app.patch('/api/prefeituras/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' })
    const payload = updatePrefeituraSchema.parse(req.body)
    
    // Buscar dados antigos para auditoria
    const oldData = await pool.query('SELECT * FROM prefeituras WHERE id = $1', [id])
    
    const fields = [], values = []
    let idx = 1
    if (payload.nome !== undefined) { fields.push(`nome = $${idx++}`); values.push(payload.nome) }
    if (payload.ativo !== undefined) { fields.push(`ativo = $${idx++}`); values.push(payload.ativo) }
    values.push(id)
    
    const result = await pool.query(`UPDATE prefeituras SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values)
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' })
    
    // Log de auditoria
    if (req.user && oldData.rows[0]) {
      await logSystemConfigChange(
        req.user,
        'prefeitura_update',
        oldData.rows[0],
        result.rows[0],
        req
      );
    }
    
    res.json(result.rows[0])
  } catch (error) { next(error) }
})

app.delete('/api/prefeituras/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' })
    
    // Buscar dados para auditoria antes de excluir
    const oldData = await pool.query('SELECT * FROM prefeituras WHERE id = $1', [id])
    
    await pool.query('DELETE FROM prefeituras WHERE id = $1', [id])
    
    // Log de auditoria
    if (req.user && oldData.rows[0]) {
      await logSystemConfigChange(
        req.user,
        'prefeitura_delete',
        oldData.rows[0],
        null,
        req
      );
    }
    
    res.status(204).send()
  } catch (error) { next(error) }
})

// ========== ROTAS DE CONSULTA E CANCELAMENTO DE AGENDAMENTO ==========
// Rota pública para verificar se CPF está bloqueado
app.get('/api/bloqueio/verificar/:cpf', async (req, res) => {
  try {
    const { cpf } = req.params;
    const cleanCpf = cpf.replace(/\D/g, '');
    
    if (cleanCpf.length !== 11) {
      return res.status(400).json({ message: 'CPF inválido' });
    }
    
    const bloqueio = await verificarBloqueioCP(cpf);
    
    res.json(bloqueio);
    
  } catch (error: any) {
    console.error('❌ [ERRO VERIFICAR BLOQUEIO]', error);
    res.status(500).json({ message: 'Erro ao verificar bloqueio', detail: error.message });
  }
});

// Rota para consultar agendamentos por CPF
app.get('/api/agendamentos/consultar/:cpf', async (req, res) => {
  try {
    const { cpf } = req.params;
    const cleanCpf = cpf.replace(/\D/g, '');
    
    if (cleanCpf.length !== 11) {
      return res.status(400).json({ message: 'CPF inválido' });
    }
    
    console.log('[CONSULTA] Buscando agendamentos para CPF:', cleanCpf);
    
    const result = await pool.query(
      `SELECT 
        a.id,
        a.cidadao_nome,
        a.cidadao_cpf,
        a.telefone,
        a.email,
        a.data_agendamento,
        a.hora_agendamento,
        a.status,
        a.tipo_cin,
        COALESCE(a.protocolo, '') as protocolo
      FROM agendamentos a
      WHERE REPLACE(REPLACE(REPLACE(a.cidadao_cpf, '.', ''), '-', ''), ' ', '') = $1
      ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC
      LIMIT 5`,
      [cleanCpf]
    );
    
    console.log('[CONSULTA] Encontrados:', result.rows.length, 'agendamentos');
    
    if (result.rows.length === 0) {
      return res.json({ found: false, appointments: [] });
    }
    
    const appointments = result.rows.map((row: any) => {
      let dateStr = row.data_agendamento;
      if (row.data_agendamento instanceof Date) {
        dateStr = row.data_agendamento.toISOString().split('T')[0];
      }
      
      let timeStr = row.hora_agendamento ? String(row.hora_agendamento).substring(0, 5) : '00:00';
      
      return {
        id: row.id,
        name: row.cidadao_nome,
        cpf: row.cidadao_cpf,
        phone: row.telefone,
        email: row.email,
        date: dateStr,
        time: timeStr,
        status: row.status,
        cinType: row.tipo_cin,
        protocol: row.protocolo || '',
        location: {
          name: null,
          address: null
        }
      };
    });
    
    console.log('[CONSULTA] Retornando:', appointments.length, 'agendamentos formatados');
    res.json({ found: true, appointments });
    
  } catch (error: any) {
    console.error('❌ [ERRO GET CONSULTAR]', error);
    res.status(500).json({ message: 'Erro ao consultar agendamento', detail: error.message });
  }
});

// Rota para solicitar cancelamento (envia código via WhatsApp)
app.post('/api/agendamentos/:id/solicitar-cancelamento', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID de agendamento inválido' });
    }
    
    const result = await pool.query(
      `SELECT id, cidadao_nome, telefone, data_agendamento, hora_agendamento, status, protocolo, prefeitura_id
       FROM agendamentos WHERE id = $1`,
      [appointmentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Agendamento não encontrado' });
    }
    
    const appointment = result.rows[0];
    const maskedPhone = (() => {
      const digits = String(appointment.telefone || '').replace(/\D/g, '')
      if (!digits) return 'não informado'
      if (digits.length <= 4) return '*'.repeat(digits.length)
      return `${digits.slice(0, 2)}${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`
    })()

    const supportContactResult = await pool.query(
      `SELECT NULLIF(TRIM(b.telefone_contato), '') AS telefone_contato
       FROM prefeituras p
       LEFT JOIN tenant_branding b ON b.prefeitura_id = p.id
       WHERE p.id = $1
       LIMIT 1`,
      [appointment.prefeitura_id]
    )

    const supportPhone = supportContactResult.rows[0]?.telefone_contato
      ? String(supportContactResult.rows[0].telefone_contato)
      : null

    const supportGuidance = supportPhone
      ? `Caso você não consiga realizar o cancelamento, entre em contato pelo número ${supportPhone}.`
      : 'Caso você não consiga realizar o cancelamento, entre em contato com a secretaria responsável.'
    
    if (appointment.status !== 'pendente' && appointment.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Este agendamento não pode ser cancelado. Apenas agendamentos pendentes podem ser cancelados.' 
      });
    }
    
    if (!appointment.telefone || String(appointment.telefone).trim().length < 8) {
      return res.status(400).json({
        message: `Não foi possível enviar o código de cancelamento. ${supportGuidance}`
      });
    }

    const appointmentDate = appointment.data_agendamento instanceof Date
      ? appointment.data_agendamento.toLocaleDateString('pt-BR')
      : new Date(appointment.data_agendamento).toLocaleDateString('pt-BR')

    const appointmentTime = String(appointment.hora_agendamento || '').slice(0, 5)

    // Gera e armazena o código
    const code = WhatsappService.storeCancellationCode(appointmentId)

    const whatsappSent = await WhatsappService.sendCancellationCode(
      Number(appointment.prefeitura_id),
      String(appointment.telefone),
      code,
      {
        name: String(appointment.cidadao_nome || 'Cidadão'),
        date: appointmentDate,
        time: appointmentTime,
        protocol: appointment.protocolo || undefined
      }
    )

    console.log('[CANCELAMENTO] Tentativa de envio de código para:', maskedPhone, '| prefeitura:', appointment.prefeitura_id, '| sucesso:', whatsappSent)

    if (!whatsappSent) {
      return res.status(503).json({
        message: `Não foi possível enviar o código de cancelamento no WhatsApp. ${supportGuidance}`
      })
    }

    console.log('[CANCELAMENTO] Código gerado e enviado via WhatsApp para agendamento ID:', appointmentId)
    
    // Em desenvolvimento, retorna o código para facilitar testes
    res.json({ 
      success: true, 
      message: 'Código de cancelamento enviado para seu WhatsApp',
      developmentCode: process.env.NODE_ENV !== 'production' ? code : undefined
    });
    
  } catch (error: any) {
    console.error('❌ [ERRO SOLICITAR CANCELAMENTO]', error);
    res.status(500).json({ message: 'Erro ao solicitar cancelamento', detail: error.message });
  }
});

// Rota para confirmar cancelamento com código
app.post('/api/agendamentos/:id/confirmar-cancelamento', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const rawCode = req.body?.code;
    const code = typeof rawCode === 'string' ? rawCode.trim() : rawCode;
    
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID de agendamento inválido' });
    }
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Código de verificação é obrigatório' });
    }
    
    // Valida o código armazenado
    const isValid = WhatsappService.validateCancellationCode(appointmentId, code, false);
    
    if (!isValid) {
      return res.status(400).json({ message: 'Código inválido ou expirado. Solicite um novo código.' });
    }
    
    // Código válido - procede com o cancelamento
    
    // Busca os dados do agendamento antes de cancelar
    const agendamentoResult = await pool.query(
      `SELECT id, cidadao_nome, cidadao_cpf, protocolo, prefeitura_id
       FROM agendamentos 
       WHERE id = $1`,
      [appointmentId]
    );
    
    if (agendamentoResult.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Agendamento não encontrado' 
      });
    }
    
    const agendamento = agendamentoResult.rows[0];
    
    // Cancela o agendamento
    const updateResult = await pool.query(
      `UPDATE agendamentos 
       SET status = 'cancelled'
       WHERE id = $1 AND (status = 'pendente' OR status = 'pending')
       RETURNING id, cidadao_nome, protocolo`,
      [appointmentId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Agendamento não encontrado ou não pode ser cancelado' 
      });
    }
    
    // Atualiza historico_status com entrada de cancelamento pelo cidadão
    try {
      const histFetch = await pool.query(
        'SELECT historico_status FROM agendamentos WHERE id = $1',
        [appointmentId]
      );
      const currentHistory: any[] = Array.isArray(histFetch.rows[0]?.historico_status)
        ? histFetch.rows[0].historico_status
        : [];

      const previousStatus = currentHistory.length > 0
        ? currentHistory[currentHistory.length - 1].to
        : 'pending';

      const historyEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from: previousStatus,
        to: 'cancelled',
        changedBy: 'Cidadão',
        changedAt: new Date().toISOString(),
        reason: 'Cancelado pelo cidadão via portal/AYLA com código de confirmação'
      };

      await pool.query(
        `UPDATE agendamentos
           SET historico_status = $1,
               cancelado_por = 'cidadao',
               atualizado_em  = NOW()
         WHERE id = $2`,
        [JSON.stringify([...currentHistory, historyEntry]), appointmentId]
      );
    } catch (histError) {
      console.error('[CANCELAMENTO] Falha ao atualizar historico_status:', histError);
    }

    // Consome o código apenas após cancelamento efetivo
    WhatsappService.consumeCancellationCode(appointmentId);

    // Registra o cancelamento e verifica se deve bloquear o CPF (não bloqueia resposta se falhar)
    try {
      await registrarCancelamento(agendamento.cidadao_cpf, appointmentId, agendamento.prefeitura_id);
    } catch (registrationError) {
      console.error('[CANCELAMENTO] Falha ao registrar cancelamento auxiliar:', registrationError);
    }
    
    console.log('✅ [SUCESSO] Agendamento cancelado! ID:', appointmentId);
    
    res.json({ 
      success: true, 
      message: 'Agendamento cancelado com sucesso',
      appointment: updateResult.rows[0]
    });
    
  } catch (error: any) {
    console.error('❌ [ERRO CONFIRMAR CANCELAMENTO]', error);
    res.status(500).json({ message: 'Erro ao confirmar cancelamento', detail: error.message });
  }
});

// ========== FIM DAS ROTAS DE CONSULTA E CANCELAMENTO ==========

// 🔐 Limiters para rotas sensíveis (login e criação de agendamentos)
app.post('/api/super-admin/login', loginLimiter)
app.post('/api/users/login', loginLimiter)
app.post('/api/secretary-users/login', loginLimiter)
app.post('/api/agendamentos', agendamentosLimiter)

app.use(authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/agendamentos', agendamentoRoutes)
app.use('/api/tenants', tenantsRoutes)
app.use('/api', publicRoutes)
app.use('/api', locationsRoutes)
app.use('/api/secretary-users', secretaryUsersRoutes)
app.use('/api/system-config', requirePermission('canChangeSystemSettings'), systemConfigRoutes)
app.use('/api/config', requirePermission('canChangeSystemSettings'), configRoutes)
app.use('/api/config', requirePermission('canChangeSystemSettings'), configAdvancedRoutes)
app.use('/api', scheduledReportsRoutes)
app.use('/api', requirePermission('canViewReports'), reportExecutionLogsRoutes)
app.use('/api', requirePermission('canViewReports'), auditLogsRoutes)
app.use('/api', requirePermission('canChangeSystemSettings'), notificationsRoutes)
app.use('/api', systemRoutes)
app.use(locationSettingsRoutes)
app.use(appointmentRoutes)
app.use('/api/appointments', appointmentsNewRoutes)
app.use('/api/locations', locationsNewRoutes)

// Serve frontend (React) em produção
if (env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist')
  app.use(express.static(distPath))
  app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  res.status(500).json({ message: error.message || 'Internal Error' })
})

const server = app.listen(PORT, async () => {
  console.log(`[server] API running on ${PORT}`)
  startScheduledReportRunner()
  startScheduledBackupRunner()
  // Garante que o admin padrão existe com a senha correta ao iniciar
  try {
    const defaultEmail = 'admin@admin.com'
    const defaultPassword = '123456'
    const existing = await pool.query('SELECT id FROM super_admins WHERE email = $1', [defaultEmail])
    if (existing.rowCount === 0) {
      await pool.query(
        'INSERT INTO super_admins (name, email, password) VALUES ($1, $2, $3)',
        ['Administrador Geral', defaultEmail, defaultPassword]
      )
      console.log(`[server] Admin padrão criado: ${defaultEmail} / ${defaultPassword}`)
    } else {
      await pool.query(
        'UPDATE super_admins SET password = $1 WHERE email = $2',
        [defaultPassword, defaultEmail]
      )
      console.log(`[server] Admin padrão atualizado: ${defaultEmail} / ${defaultPassword}`)
    }
  } catch (err) {
    console.warn('[server] Não foi possível verificar admin padrão:', err)
  }
})