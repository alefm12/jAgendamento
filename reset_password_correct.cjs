const { Pool } = require('pg')
const { randomBytes, scryptSync } = require('crypto')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

function hashPassword(password) {
  const KEY_LENGTH = 64
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${derivedKey}`
}

async function resetPassword() {
  try {
    const newPassword = 'admin123'
    const hash = hashPassword(newPassword)
    
    console.log('🔑 Redefinindo senha...')
    console.log('Nova senha:', newPassword)
    console.log('Hash gerado:', hash.substring(0, 30) + '...')
    
    const result = await pool.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE email = $2 RETURNING id, nome, email',
      [hash, 'alefifce@gmail.com']
    )
    
    if (result.rows.length > 0) {
      console.log('\n✅ Senha atualizada com sucesso!')
      console.log('📧 Email:', result.rows[0].email)
      console.log('🔑 Nova senha: admin123')
      console.log('👤 Nome:', result.rows[0].nome)
    } else {
      console.log('❌ Usuário não encontrado')
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

resetPassword()
