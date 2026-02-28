import { Router } from 'express'
import { pool } from '../config/db'
import { z } from 'zod'

const router = Router()

const createLocationSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  type: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  workingHours: z.any().optional(),
  maxAppointmentsPerSlot: z.number().optional()
})

router.get('/', async (_req, res) => {
  try {
    const query = `
      SELECT 
        id, name, address, city, state, zip_code, phone, email,
        type, google_maps_url, is_active, working_hours, max_appointments_per_slot,
        created_at, updated_at
      FROM locations
      WHERE is_active = true
      ORDER BY name ASC
    `
    const result = await pool.query(query)
    
    const locations = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      phone: row.phone,
      email: row.email,
      type: row.type,
      googleMapsUrl: row.google_maps_url,
      isActive: row.is_active,
      workingHours: row.working_hours,
      maxAppointmentsPerSlot: row.max_appointments_per_slot,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    res.json(locations)
  } catch (error) {
    console.error('Erro ao buscar localidades:', error)
    res.status(500).json({ message: 'Erro ao buscar localidades' })
  }
})

router.post('/', async (req, res) => {
  try {
    const data = createLocationSchema.parse(req.body)
    
    const query = `
      INSERT INTO locations (
        name, address, city, state, zip_code, phone, email,
        type, google_maps_url, working_hours, max_appointments_per_slot
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING *
    `
    
    const values = [
      data.name,
      data.address || null,
      data.city || null,
      data.state || null,
      data.zipCode || null,
      data.phone || null,
      data.email || null,
      data.type || null,
      data.googleMapsUrl || null,
      JSON.stringify(data.workingHours || []),
      data.maxAppointmentsPerSlot || 2
    ]
    
    const result = await pool.query(query, values)
    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map(e => e.message).join(', ') })
      return
    }
    console.error('Erro ao criar localidade:', error)
    res.status(500).json({ message: 'Erro ao criar localidade' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body
    
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(data.name)
    }
    if (data.address !== undefined) {
      updates.push(`address = $${paramIndex++}`)
      values.push(data.address)
    }
    if (data.city !== undefined) {
      updates.push(`city = $${paramIndex++}`)
      values.push(data.city)
    }
    if (data.googleMapsUrl !== undefined) {
      updates.push(`google_maps_url = $${paramIndex++}`)
      values.push(data.googleMapsUrl)
    }
    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(data.isActive)
    }
    
    updates.push(`updated_at = NOW()`)
    values.push(id)
    
    const query = `
      UPDATE locations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    const result = await pool.query(query, values)
    
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Localidade não encontrada' })
      return
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao atualizar localidade:', error)
    res.status(500).json({ message: 'Erro ao atualizar localidade' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await pool.query('DELETE FROM locations WHERE id = $1 RETURNING id', [id])
    
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Localidade não encontrada' })
      return
    }
    
    res.status(204).send()
  } catch (error) {
    console.error('Erro ao deletar localidade:', error)
    res.status(500).json({ message: 'Erro ao deletar localidade' })
  }
})

export default router
