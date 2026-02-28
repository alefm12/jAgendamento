import { Router, type Response } from 'express'
import { z } from 'zod'
import { pool } from '../config/db'
import tenantMiddleware, { type TenantRequest } from '../middleware/tenantMiddleware'
import { hashPassword, verifyPassword } from '../utils/password'
import { logLoginFailed } from '../services/audit.service'
import { isValidCPF, stripNonDigits } from '../../utils/validators'

const router = Router()
router.use(tenantMiddleware)

const perfilSchema = z.enum(['admin', 'secretaria'])

const cpfSchema = z
  .string()
  .min(11, 'CPF Inválido')
  .transform((value) => stripNonDigits(value))
  .refine((value) => /^\d{11}$/.test(value), 'CPF Inválido')
  .refine((value) => isValidCPF(value), 'CPF Inválido')

const telefoneSchema = z
  .string()
  .min(10, 'Telefone inválido')
  .transform((value) => stripNonDigits(value))
  .refine((value) => /^\d{10,11}$/.test(value), 'Telefone inválido')

const createUserSchema = z.object({
  nome: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  cpf: cpfSchema,
  telefone: telefoneSchema,
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  perfil: perfilSchema,
  ativo: z.boolean().optional().default(true)
})

const updateUserSchema = z
  .object({
    nome: z.string().min(3).optional(),
    email: z.string().email().optional(),
    cpf: cpfSchema.optional(),
    telefone: telefoneSchema.optional(),
    senha: z.string().min(6).optional(),
    perfil: perfilSchema.optional(),
    ativo: z.boolean().optional()
  })
  .refine((data) => Object.keys(data).length > 0, 'Nenhum campo para atualizar')

const loginSchema = z.object({
  identifier: z.string().min(3, 'Informe o e-mail do usuário'),
  senha: z.string().min(4, 'Senha inválida')
})

interface UserRow {
  id: number
  nome: string
  email: string
  cpf: string | null
  telefone: string | null
  perfil: string
  ativo: boolean
  criado_em: string
  senha_hash?: string
}

const selectFields = 'id, nome, email, cpf, telefone, perfil, ativo, criado_em'

const mapUser = (row: UserRow) => ({
  id: row.id,
  nome: row.nome,
  email: row.email,
  cpf: row.cpf,
  telefone: row.telefone,
  perfil: row.perfil,
  ativo: row.ativo,
  criado_em: row.criado_em
})

const handleUniqueViolation = (error: unknown, res: Response): boolean => {
  const pgError = error as { code?: string; constraint?: string; detail?: string } | undefined
  if (pgError?.code !== '23505') {
    return false
  }

  const constraint = (pgError.constraint || '').toLowerCase()
  const detail = (pgError.detail || '').toLowerCase()
  const cpfConflict = constraint.includes('cpf') || detail.includes('cpf')

  if (cpfConflict) {
    res.status(409).json({ message: 'CPF JÁ CADASTRADO' })
  } else {
    res.status(409).json({ message: 'E-mail já cadastrado para esta prefeitura' })
  }
  return true
}

router.get('/', async (req, res, next) => {
  try {
    const tenantId = (req as TenantRequest).tenantId
    if (!tenantId) {
      res.status(400).json({ message: 'Prefeitura não identificada' })
      return
    }

    const result = await pool.query<UserRow>(
      `SELECT ${selectFields} FROM usuarios WHERE prefeitura_id = $1 ORDER BY nome ASC`,
      [tenantId]
    )
    res.json(result.rows.map(mapUser))
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  const tenantId = (req as TenantRequest).tenantId
  if (!tenantId) {
    res.status(400).json({ message: 'Prefeitura não identificada' })
    return
  }

  try {
    const payload = createUserSchema.parse(req.body)

    const result = await pool.query<UserRow>(
      `INSERT INTO usuarios (prefeitura_id, nome, email, cpf, telefone, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${selectFields}`,
      [
        tenantId,
        payload.nome.trim(),
        payload.email.trim().toLowerCase(),
        payload.cpf,
        payload.telefone,
        hashPassword(payload.senha),
        payload.perfil,
        payload.ativo ?? true
      ]
    )

    res.status(201).json(mapUser(result.rows[0]))
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    if (handleUniqueViolation(error, res)) {
      return
    }
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  const tenantId = (req as TenantRequest).tenantId
  if (!tenantId) {
    res.status(400).json({ message: 'Prefeitura não identificada' })
    return
  }

  try {
    const userId = Number.parseInt(req.params.id, 10)
    if (Number.isNaN(userId)) {
      res.status(400).json({ message: 'ID inválido' })
      return
    }

    const payload = updateUserSchema.parse(req.body)

    const fields: string[] = []
    const values: unknown[] = []
    let index = 1

    if (payload.nome !== undefined) {
      fields.push(`nome = $${index++}`)
      values.push(payload.nome.trim())
    }
    if (payload.email !== undefined) {
      fields.push(`email = $${index++}`)
      values.push(payload.email.trim().toLowerCase())
    }
    if (payload.cpf !== undefined) {
      fields.push(`cpf = $${index++}`)
      values.push(payload.cpf)
    }
    if (payload.telefone !== undefined) {
      fields.push(`telefone = $${index++}`)
      values.push(payload.telefone)
    }
    if (payload.senha !== undefined) {
      fields.push(`senha_hash = $${index++}`)
      values.push(hashPassword(payload.senha))
    }
    if (payload.perfil !== undefined) {
      fields.push(`perfil = $${index++}`)
      values.push(payload.perfil)
    }
    if (payload.ativo !== undefined) {
      fields.push(`ativo = $${index++}`)
      values.push(payload.ativo)
    }

    values.push(tenantId)
    values.push(userId)

    const query = `UPDATE usuarios SET ${fields.join(', ')}
                   WHERE prefeitura_id = $${index} AND id = $${index + 1}
                   RETURNING ${selectFields}`

    const result = await pool.query<UserRow>(query, values)

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Usuário não encontrado' })
      return
    }

    res.json(mapUser(result.rows[0]))
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    if (handleUniqueViolation(error, res)) {
      return
    }
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const tenantId = (req as TenantRequest).tenantId
    if (!tenantId) {
      res.status(400).json({ message: 'Prefeitura não identificada' })
      return
    }

    const userId = Number.parseInt(req.params.id, 10)
    if (Number.isNaN(userId)) {
      res.status(400).json({ message: 'ID inválido' })
      return
    }

    const result = await pool.query('DELETE FROM usuarios WHERE id = $1 AND prefeitura_id = $2', [
      userId,
      tenantId
    ])

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Usuário não encontrado' })
      return
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const tenantId = (req as TenantRequest).tenantId
    if (!tenantId) {
      res.status(400).json({ message: 'Prefeitura não identificada' })
      return
    }

    const payload = loginSchema.parse(req.body)
    const identifier = payload.identifier.trim().toLowerCase()

    const result = await pool.query<UserRow>(
      `SELECT ${selectFields}, senha_hash FROM usuarios
        WHERE prefeitura_id = $1 AND LOWER(email) = $2
        LIMIT 1`,
      [tenantId, identifier]
    )

    if (result.rowCount === 0) {
      await logLoginFailed(identifier, 'Usuário não encontrado', req)
      res.status(401).json({ message: 'Credenciais inválidas' })
      return
    }

    const user = result.rows[0]

    if (!user.ativo) {
      await logLoginFailed(identifier, 'Usuário inativo', req)
      res.status(403).json({ message: 'Usuário inativo' })
      return
    }

    if (!user.senha_hash || !verifyPassword(payload.senha, user.senha_hash)) {
      await logLoginFailed(identifier, 'Senha incorreta', req)
      res.status(401).json({ message: 'Credenciais inválidas' })
      return
    }

    res.json(mapUser(user))
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    next(error)
  }
})

export default router
