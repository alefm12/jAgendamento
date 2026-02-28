const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function createTestUser() {
  try {
    // Verificar usuários existentes
    const checkQuery = 'SELECT id, nome, email, perfil FROM usuarios WHERE prefeitura_id = 1'
    const checkResult = await pool.query(checkQuery)
    
    console.log('📋 Usuários existentes:', checkResult.rows.length)
    checkResult.rows.forEach(user => {
      console.log(`  - ID ${user.id}: ${user.nome} (${user.email}) - ${user.perfil}`)
    })

    if (checkResult.rows.length === 0) {
      console.log('\n➕ Criando usuário admin de teste...')
      
      // Senha: "admin123" com hash bcrypt
      const bcrypt = require('bcryptjs')
      const senhaHash = bcrypt.hashSync('admin123', 10)
      
      const insertQuery = `
        INSERT INTO usuarios (prefeitura_id, nome, email, cpf, telefone, senha_hash, perfil, ativo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, nome, email, perfil
      `
      
      const result = await pool.query(insertQuery, [
        1, // prefeitura_id
        'Administrador Sistema',
        'admin@iraucuba.ce.gov.br',
        '00000000000',
        '88999999999',
        senhaHash,
        'admin',
        true
      ])
      
      console.log('✅ Usuário criado com sucesso!')
      console.log('📧 Email:', result.rows[0].email)
      console.log('🔑 Senha: admin123')
      console.log('👤 Nome:', result.rows[0].nome)
    } else {
      console.log('\n✅ Usuários já cadastrados!')
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

createTestUser()
