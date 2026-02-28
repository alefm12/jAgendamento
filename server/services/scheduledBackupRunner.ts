import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { pool } from '../config/db'

const execFileAsync = promisify(execFile)
const INTERVAL_MS = 60 * 1000

type BackupPeriod = 'diario' | 'semanal' | 'mensal'

interface BackupConfigRow {
  prefeituraId: number
  backupPeriodicidade: BackupPeriod
  backupHorario: string
  backupRetencaoDias: number
  backupOutputDir: string | null
  backupUltimoEm: string | null
}

const runningPrefeituras = new Set<number>()

const ensureBackupColumns = async () => {
  await pool.query(`ALTER TABLE geral_config ADD COLUMN IF NOT EXISTS backup_output_dir TEXT`)
  await pool.query(`ALTER TABLE geral_config ADD COLUMN IF NOT EXISTS backup_ultimo_em TIMESTAMPTZ`)
}

const normalizeHourMinute = (value: string | null | undefined) => {
  if (!value) return { hour: 2, minute: 0 }
  const [hRaw, mRaw] = value.split(':')
  const hour = Number(hRaw)
  const minute = Number(mRaw)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return { hour: 2, minute: 0 }
  return {
    hour: Math.max(0, Math.min(23, hour)),
    minute: Math.max(0, Math.min(59, minute))
  }
}

const buildScheduleDate = (now: Date, periodicidade: BackupPeriod, hour: number, minute: number) => {
  const scheduled = new Date(now)

  if (periodicidade === 'semanal') {
    const day = now.getDay() // 0 domingo, 1 segunda
    const diffToMonday = (day + 6) % 7
    scheduled.setDate(now.getDate() - diffToMonday)
  } else if (periodicidade === 'mensal') {
    scheduled.setDate(1)
  }

  scheduled.setHours(hour, minute, 0, 0)
  return scheduled
}

const isDueNow = (config: BackupConfigRow, now: Date) => {
  const { hour, minute } = normalizeHourMinute(config.backupHorario)
  const scheduledDate = buildScheduleDate(now, config.backupPeriodicidade, hour, minute)

  if (now.getTime() < scheduledDate.getTime()) return false

  const lastRun = config.backupUltimoEm ? new Date(config.backupUltimoEm) : null
  if (lastRun && lastRun.getTime() >= scheduledDate.getTime()) {
    return false
  }

  return true
}

const cleanupOldFiles = async (directory: string, retentionDays: number) => {
  if (!directory || !fs.existsSync(directory)) return

  const retentionMs = Math.max(1, retentionDays) * 24 * 60 * 60 * 1000
  const now = Date.now()
  const entries = await fsp.readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.zip')) continue
    if (!entry.name.startsWith('full_backup_auto_')) continue

    const fullPath = path.join(directory, entry.name)
    const stats = await fsp.stat(fullPath)
    const ageMs = now - stats.mtime.getTime()

    if (ageMs > retentionMs) {
      await fsp.rm(fullPath, { force: true })
    }
  }
}

const runBackupForConfig = async (config: BackupConfigRow) => {
  const destinationDir = (config.backupOutputDir || '').trim()
  if (!destinationDir) {
    throw new Error('Pasta de destino do backup automático não configurada')
  }

  const scriptPath = path.join(process.cwd(), 'system_backup_full.cjs')
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Script de backup completo não encontrado')
  }

  await execFileAsync(process.execPath, [scriptPath, 'auto'], {
    cwd: process.cwd(),
    env: process.env
  })

  const systemBackupsDir = path.join(process.cwd(), 'backups', 'system')
  const latestPathFile = path.join(systemBackupsDir, 'latest_full.txt')
  if (!fs.existsSync(latestPathFile)) {
    throw new Error('latest_full.txt não encontrado após backup automático')
  }

  const latestBackupPath = (await fsp.readFile(latestPathFile, 'utf8')).trim()
  if (!latestBackupPath || !fs.existsSync(latestBackupPath)) {
    throw new Error('Arquivo de backup automático não encontrado')
  }

  await fsp.mkdir(destinationDir, { recursive: true })
  const destinationPath = path.join(destinationDir, path.basename(latestBackupPath))
  if (path.resolve(destinationPath) !== path.resolve(latestBackupPath)) {
    await fsp.copyFile(latestBackupPath, destinationPath)
  }
  await cleanupOldFiles(destinationDir, config.backupRetencaoDias)

  await cleanupOldFiles(systemBackupsDir, config.backupRetencaoDias)

  await pool.query(
    `UPDATE geral_config
        SET backup_ultimo_em = NOW(),
            atualizado_em = CURRENT_TIMESTAMP
      WHERE prefeitura_id = $1`,
    [config.prefeituraId]
  )
}

const runScheduledBackupsNow = async () => {
  try {
    await ensureBackupColumns()

    const result = await pool.query(
      `SELECT prefeitura_id as "prefeituraId",
              backup_periodicidade as "backupPeriodicidade",
              backup_horario as "backupHorario",
              backup_retencao_dias as "backupRetencaoDias",
              backup_output_dir as "backupOutputDir",
              backup_ultimo_em as "backupUltimoEm"
         FROM geral_config
        WHERE backup_ativo = TRUE`
    )

    const now = new Date()

    for (const row of result.rows as BackupConfigRow[]) {
      if (!String(row.backupOutputDir || '').trim()) {
        console.warn(`[BackupRunner] Backup automático ignorado prefeitura=${row.prefeituraId}: pasta de destino não configurada`)
        continue
      }
      if (!isDueNow(row, now)) continue
      if (runningPrefeituras.has(row.prefeituraId)) continue

      runningPrefeituras.add(row.prefeituraId)
      try {
        console.log(`[BackupRunner] Iniciando backup automático prefeitura=${row.prefeituraId}`)
        await runBackupForConfig(row)
        console.log(`[BackupRunner] Backup automático concluído prefeitura=${row.prefeituraId}`)
      } catch (error) {
        console.error(`[BackupRunner] Erro no backup automático prefeitura=${row.prefeituraId}:`, error)
      } finally {
        runningPrefeituras.delete(row.prefeituraId)
      }
    }
  } catch (error) {
    console.error('[BackupRunner] Erro ao processar backups automáticos:', error)
  }
}

export const startScheduledBackupRunner = () => {
  console.log('[BackupRunner] Agendador automático de backup iniciado (intervalo 1 min)')
  void runScheduledBackupsNow()
  setInterval(() => {
    void runScheduledBackupsNow()
  }, INTERVAL_MS)
}
