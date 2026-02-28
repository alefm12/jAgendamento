import { Router } from 'express'
import { pool } from '../config/db'
import { z } from 'zod'
import { type AuthRequest } from '../middlewares/auth.middleware'
import { logAppointmentUpdate, logAppointmentDelete, logAppointmentStatusChange } from '../services/audit.service'
import { verificarBloqueioCP } from '../services/bloqueio.service'

const router = Router()

const createAppointmentSchema = z.object({
  protocol: z.string(),
  fullName: z.string(),
  cpf: z.string(),
  rg: z.string().optional(),
  phone: z.string(),
  email: z.string().optional(),
  birthDate: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  regionType: z.string().optional(),
  sedeId: z.string().optional(),
  districtId: z.string().optional(),
  neighborhoodId: z.string().optional(),
  locationId: z.string(),
  date: z.string(),
  time: z.string(),
  status: z.string().default('pending'),
  priority: z.string().default('normal'),
  cinType: z.string().optional(),
  cinNumber: z.string().optional(),
  lgpdConsent: z.any().optional(),
  notes: z.any().optional(),
  statusHistory: z.any().optional()
})

router.get('/', async (_req, res) => {
  try {
    const query = `
      SELECT 
        id, protocol, full_name, cpf, rg, phone, email, birth_date,
        street, number, neighborhood, city, state, zip_code,
        region_type, sede_id, district_id, neighborhood_id,
        location_id, date, time, status, priority,
        cin_type, cin_number, cancelled_by, cancellation_reason, cancellation_category,
        completed_at, completed_by, lgpd_consent, rg_delivery, notes, status_history,
        reminder_sent, reminder_sent_at, created_at, updated_at, last_modified
      FROM appointments
      ORDER BY date DESC, time DESC
    `
    const result = await pool.query(query)
    
    const appointments = result.rows.map(row => ({
      id: row.id,
      protocol: row.protocol,
      fullName: row.full_name,
      cpf: row.cpf,
      rg: row.rg,
      phone: row.phone,
      email: row.email,
      birthDate: row.birth_date,
      street: row.street,
      number: row.number,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      regionType: row.region_type,
      sedeId: row.sede_id,
      districtId: row.district_id,
      neighborhoodId: row.neighborhood_id,
      locationId: row.location_id != null ? String(row.location_id) : null,
      date: row.date,
      time: row.time,
      status: row.status,
      priority: row.priority,
      cinType: row.cin_type,
      cinNumber: row.cin_number,
      cancelledBy: row.cancelled_by,
      cancellationReason: row.cancellation_reason,
      cancellationCategory: row.cancellation_category,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
      lgpdConsent: row.lgpd_consent,
      rgDelivery: row.rg_delivery,
      notes: row.notes,
      statusHistory: row.status_history,
      reminderSent: row.reminder_sent,
      reminderSentAt: row.reminder_sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastModified: row.last_modified
    }))
    
    res.json(appointments)
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error)
    res.status(500).json({ message: 'Erro ao buscar agendamentos' })
  }
})

router.post('/', async (req, res) => {
  try {
    const data = createAppointmentSchema.parse(req.body)
    
    // Verifica se o CPF está bloqueado
    const bloqueio = await verificarBloqueioCP(data.cpf);
    
    if (bloqueio.bloqueado) {
      const dataFormatada = bloqueio.dataDesbloqueio 
        ? new Date(bloqueio.dataDesbloqueio).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'indeterminada';
      
      return res.status(403).json({ 
        message: `CPF bloqueado temporariamente. Você cancelou ${bloqueio.cancelamentosCount} agendamentos nos últimos 7 dias. O bloqueio será removido em ${dataFormatada}.`,
        bloqueado: true,
        dataDesbloqueio: bloqueio.dataDesbloqueio,
        motivo: bloqueio.motivo
      });
    }
    
    const query = `
      INSERT INTO appointments (
        protocol, full_name, cpf, rg, phone, email, birth_date,
        street, number, neighborhood, city, state, zip_code,
        region_type, sede_id, district_id, neighborhood_id,
        location_id, date, time, status, priority,
        cin_type, cin_number, lgpd_consent, notes, status_history
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27
      )
      RETURNING *
    `
    
    const values = [
      data.protocol,
      data.fullName,
      data.cpf,
      data.rg || null,
      data.phone,
      data.email || null,
      data.birthDate || null,
      data.street || null,
      data.number || null,
      data.neighborhood || null,
      data.city || null,
      data.state || null,
      data.zipCode || null,
      data.regionType || null,
      data.sedeId || null,
      data.districtId || null,
      data.neighborhoodId || null,
      data.locationId,
      data.date,
      data.time,
      data.status,
      data.priority,
      data.cinType || null,
      data.cinNumber || null,
      JSON.stringify(data.lgpdConsent || {}),
      JSON.stringify(data.notes || []),
      JSON.stringify(data.statusHistory || [])
    ]
    
    const result = await pool.query(query, values)
    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map(e => e.message).join(', ') })
      return
    }
    console.error('Erro ao criar agendamento:', error)
    res.status(500).json({ message: 'Erro ao criar agendamento' })
  }
})

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const data = req.body
    
    // Buscar dados antigos antes de atualizar (para log de auditoria)
    const oldDataResult = await pool.query('SELECT * FROM appointments WHERE id = $1', [id])
    const oldData = oldDataResult.rows[0]
    
    if (!oldData) {
      res.status(404).json({ message: 'Agendamento não encontrado' })
      return
    }
    
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    let statusChanged = false
    const oldStatus = oldData.status
    const newStatus = data.status
    
    if (data.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`)
      values.push(data.fullName)
    }
    if (data.cpf !== undefined) {
      updates.push(`cpf = $${paramIndex++}`)
      values.push(data.cpf)
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`)
      values.push(data.phone)
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      values.push(data.email)
    }
    if (data.date !== undefined) {
      updates.push(`date = $${paramIndex++}`)
      values.push(data.date)
    }
    if (data.time !== undefined) {
      updates.push(`time = $${paramIndex++}`)
      values.push(data.time)
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(data.status)
      statusChanged = oldStatus !== newStatus
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`)
      values.push(data.priority)
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      values.push(JSON.stringify(data.notes))
    }
    if (data.statusHistory !== undefined) {
      updates.push(`status_history = $${paramIndex++}`)
      values.push(JSON.stringify(data.statusHistory))
    }
    if (data.cancelledBy !== undefined) {
      updates.push(`cancelled_by = $${paramIndex++}`)
      values.push(data.cancelledBy)
    }
    if (data.cancellationReason !== undefined) {
      updates.push(`cancellation_reason = $${paramIndex++}`)
      values.push(data.cancellationReason)
    }
    if (data.completedAt !== undefined) {
      updates.push(`completed_at = $${paramIndex++}`)
      values.push(data.completedAt)
    }
    if (data.completedBy !== undefined) {
      updates.push(`completed_by = $${paramIndex++}`)
      values.push(data.completedBy)
    }
    if (data.rgDelivery !== undefined) {
      updates.push(`rg_delivery = $${paramIndex++}`)
      values.push(JSON.stringify(data.rgDelivery))
    }
    
    updates.push(`updated_at = NOW()`)
    updates.push(`last_modified = NOW()`)
    
    values.push(id)
    
    const query = `
      UPDATE appointments
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    const result = await pool.query(query, values)
    
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Agendamento não encontrado' })
      return
    }
    
    // Log de auditoria (apenas se for usuário autenticado do sistema)
    if (req.user) {
      const newData = result.rows[0]
      
      // Se houve mudança de status, registrar log específico de mudança de status
      if (statusChanged) {
        await logAppointmentStatusChange(
          req.user,
          id,
          oldData.protocol,
          oldData.full_name,
          oldStatus,
          newStatus,
          req
        )
      } else {
        // Caso contrário, log genérico de atualização
        await logAppointmentUpdate(req.user, id, oldData, newData, req)
      }
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error)
    res.status(500).json({ message: 'Erro ao atualizar agendamento' })
  }
})

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    
    // Buscar dados antes de excluir (para log de auditoria)
    const oldDataResult = await pool.query('SELECT * FROM appointments WHERE id = $1', [id])
    const oldData = oldDataResult.rows[0]
    
    if (!oldData) {
      res.status(404).json({ message: 'Agendamento não encontrado' })
      return
    }
    
    const result = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING id', [id])
    
    // Log de auditoria (apenas se for usuário autenticado do sistema)
    if (req.user) {
      await logAppointmentDelete(req.user, id, oldData, req)
    }
    
    res.status(204).send()
  } catch (error) {
    console.error('Erro ao deletar agendamento:', error)
    res.status(500).json({ message: 'Erro ao deletar agendamento' })
  }
})

export default router
