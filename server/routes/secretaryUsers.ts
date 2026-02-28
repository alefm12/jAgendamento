import { Router } from 'express'
import { pool } from '../config/db'
import jwt from 'jsonwebtoken'
// REMOVIDO TEMPORARIAMENTE PARA TESTE
// import tenantMiddleware, { type TenantRequest } from '../middleware/tenantMiddleware'

const router = Router()
// router.use(tenantMiddleware)

const normalizePermissionsPayload = (permissions: any, isAdmin: boolean, adminType?: string) => {
  const basePermissions = (permissions && typeof permissions === 'object') ? { ...permissions } : {}
  const normalizedAdminType = adminType === 'system' || adminType === 'local' ? adminType : (isAdmin ? 'system' : 'none')
  const allowedLocationIds = Array.isArray(basePermissions.allowedLocationIds)
    ? basePermissions.allowedLocationIds.map((value: any) => String(value)).filter(Boolean)
    : []
  const hiddenTabs = Array.isArray(basePermissions.hiddenTabs)
    ? basePermissions.hiddenTabs.map((value: any) => String(value)).filter(Boolean)
    : []

  return {
    ...basePermissions,
    adminType: normalizedAdminType,
    canViewAllLocations: normalizedAdminType === 'system',
    allowedLocationIds: normalizedAdminType === 'system' ? [] : allowedLocationIds,
    hiddenTabs
  }
}

const mapSecretaryUserRow = (row: any) => {
  const permissions = row.permissions || {}
  const adminType = permissions.adminType || (row.isAdmin ? 'system' : 'none')
  return {
    ...row,
    id: String(row.id),
    adminType,
    permissions: {
      ...permissions,
      adminType,
      canViewAllLocations: permissions.canViewAllLocations === true || adminType === 'system',
      allowedLocationIds: Array.isArray(permissions.allowedLocationIds)
        ? permissions.allowedLocationIds.map((value: any) => String(value)).filter(Boolean)
        : [],
      hiddenTabs: Array.isArray(permissions.hiddenTabs)
        ? permissions.hiddenTabs.map((value: any) => String(value)).filter(Boolean)
        : []
    }
  }
}

router.get('/', async (req, res) => {
  const tenantId = 1 // Hardcoded para teste
  
  try {
    // Tentar tabela usuarios_secretaria primeiro, depois usuarios
    let result
    try {
      result = await pool.query(
        `SELECT id, nome_completo as "fullName", email, cpf, telefone as phone, 
                usuario as username, ativo as "isActive", eh_admin as "isAdmin", 
                criado_em as "createdAt", permissoes as permissions
           FROM usuarios_secretaria
          WHERE prefeitura_id = $1
          ORDER BY nome_completo ASC`,
        [tenantId]
      )
    } catch (e) {
      // Se falhar, usar tabela usuarios
      console.log('[SECRETARY-USERS] Tabela usuarios_secretaria não existe, usando usuarios')
      result = await pool.query(
        `SELECT id, nome as "fullName", email, cpf, telefone as phone, 
                email as username, ativo as "isActive", 
                CASE WHEN perfil = 'admin' THEN true ELSE false END as "isAdmin",
                criado_em as "createdAt", '{}'::jsonb as permissions
           FROM usuarios
          WHERE prefeitura_id = $1
          ORDER BY nome ASC`,
        [tenantId]
      )
    }
    
    res.json(result.rows.map(mapSecretaryUserRow))
  } catch (error) {
    console.error('[SECRETARY-USERS] Erro ao listar usuários:', error)
    res.status(500).json({ message: 'Erro ao listar usuários', detail: (error as Error).message })
  }
})

router.post('/', async (req, res) => {
  const tenantId = 1 // Hardcoded para teste
  const { fullName, email, cpf, phone, username, password, isAdmin, permissions, adminType } = req.body

  const normalizedPermissions = normalizePermissionsPayload(permissions, Boolean(isAdmin), adminType)
  const effectiveIsAdmin = normalizedPermissions.adminType === 'system' || normalizedPermissions.adminType === 'local'
  
  try {
    const result = await pool.query(
      `INSERT INTO usuarios_secretaria 
        (prefeitura_id, nome_completo, email, cpf, telefone, usuario, senha_hash, eh_admin, permissoes, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING id, nome_completo as "fullName", email, cpf, telefone as phone, 
                 usuario as username, ativo as "isActive", eh_admin as "isAdmin", 
                 criado_em as "createdAt", permissoes as permissions`,
      [tenantId, fullName, email, cpf, phone, username, password, effectiveIsAdmin, JSON.stringify(normalizedPermissions)]
    )
    
    res.status(201).json(mapSecretaryUserRow(result.rows[0]))
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    res.status(500).json({ message: 'Erro ao criar usuário' })
  }
})

router.put('/:id', async (req, res) => {
  const tenantId = 1 // Hardcoded para teste
  const userId = req.params.id
  const { fullName, email, cpf, phone, username, isAdmin, permissions, adminType, isActive } = req.body

  const normalizedPermissions = normalizePermissionsPayload(permissions, Boolean(isAdmin), adminType)
  const effectiveIsAdmin = normalizedPermissions.adminType === 'system' || normalizedPermissions.adminType === 'local'
  
  try {
    const result = await pool.query(
      `UPDATE usuarios_secretaria 
       SET nome_completo = $1, email = $2, cpf = $3, telefone = $4, 
           usuario = $5, eh_admin = $6, permissoes = $7, ativo = $8
       WHERE id = $9 AND prefeitura_id = $10
       RETURNING id, nome_completo as "fullName", email, cpf, telefone as phone, 
                 usuario as username, ativo as "isActive", eh_admin as "isAdmin", 
                 criado_em as "createdAt", permissoes as permissions`,
      [fullName, email, cpf, phone, username, effectiveIsAdmin, JSON.stringify(normalizedPermissions), isActive, userId, tenantId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' })
    }
    
    res.json(mapSecretaryUserRow(result.rows[0]))
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    res.status(500).json({ message: 'Erro ao atualizar usuário' })
  }
})

router.delete('/:id', async (req, res) => {
  const tenantId = 1 // Hardcoded para teste
  const userId = req.params.id
  
  try {
    const result = await pool.query(
      'DELETE FROM usuarios_secretaria WHERE id = $1 AND prefeitura_id = $2',
      [userId, tenantId]
    )
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' })
    }
    
    res.status(204).send()
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    res.status(500).json({ message: 'Erro ao deletar usuário' })
  }
})

router.post('/login', async (req, res) => {
  const tenantId = 1
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '').trim()

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios' })
  }

  try {
    const result = await pool.query(
      `SELECT id, nome_completo as "fullName", email, cpf, telefone as phone,
              usuario as username, ativo as "isActive", eh_admin as "isAdmin",
              criado_em as "createdAt", permissoes as permissions
         FROM usuarios_secretaria
        WHERE prefeitura_id = $1 AND LOWER(usuario) = LOWER($2)
        LIMIT 1`,
      [tenantId, username]
    )

    const user = result.rows[0]
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const passwordCheck = await pool.query(
      `SELECT 1 FROM usuarios_secretaria
        WHERE id = $1 AND senha_hash = $2
        LIMIT 1`,
      [user.id, password]
    )

    if (passwordCheck.rowCount === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Usuário inativo' })
    }

    const mappedUser = mapSecretaryUserRow(user)
    const token = jwt.sign(
      {
        id: Number(mappedUser.id),
        email: mappedUser.email,
        name: mappedUser.fullName,
        role: mappedUser.isAdmin ? 'ADMIN' : 'SECRETARY',
        tenantId,
        adminType: mappedUser.adminType,
        permissions: mappedUser.permissions || {}
      },
      process.env.JWT_SECRET || 'segredo-dev-super-seguro-123',
      { expiresIn: '7d' }
    )

    return res.json({
      success: true,
      token,
      user: mappedUser
    })
  } catch (error) {
    console.error('Erro ao autenticar usuário da secretaria:', error)
    return res.status(500).json({ message: 'Erro ao autenticar usuário' })
  }
})

export default router
