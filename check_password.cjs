const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const pool = new Pool({
  connectionString: 'postgres://postgres:123@localhost:5432/jagendamento'
})

async function checkPassword() {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1 AND prefeitura_id = 1',
      ['alefifce@gmail.com']
    )

    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado!')
      return
    }

    const user = result.rows[0]
    console.log('✅ Usuário encontrado:')
    console.log('  ID:', user.id)
    console.log('  Nome:', user.nome)
    console.log('  Email:', user.email)
    console.log('  Senha hash:', user.senha_hash ? user.senha_hash.substring(0, 20) + '...' : 'NULL')

    if (!user.senha_hash) {
      console.log('\n⚠️ Usuário não possui senha! Definindo senha padrão "admin123"...')
      const newHash = bcrypt.hashSync('admin123', 10)
      await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [newHash, user.id])
      console.log('✅ Senha definida com sucesso!')
      console.log('📧 Email: alefifce@gmail.com')
      console.log('🔑 Senha: admin123')
    } else {
      // Testar senhas comuns
      const senhasTeste = ['senha123', 'admin123', '123456', 'alef123']
      let senhaCorreta = null

      for (const senha of senhasTeste) {
        if (bcrypt.compareSync(senha, user.senha_hash)) {
          senhaCorreta = senha
          break
        }
      }

      if (senhaCorreta) {
        console.log('\n✅ Senha encontrada:', senhaCorreta)
      } else {
        console.log('\n⚠️ Nenhuma das senhas comuns funcionou. Redefinindo para "admin123"...')
        const newHash = bcrypt.hashSync('admin123', 10)
        await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [newHash, user.id])
        console.log('✅ Senha redefinida com sucesso!')
        console.log('📧 Email: alefifce@gmail.com')
        console.log('🔑 Nova senha: admin123')
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

checkPassword()
