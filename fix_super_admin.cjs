const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    // Verificar o usuário atual
    const current = await pool.query("SELECT id, name, email, password FROM super_admins WHERE email = 'admin@admin.com'");
    console.log('Usuário atual:', current.rows);

    // Atualizar a senha para "admin"
    const update = await pool.query(
      "UPDATE super_admins SET password = 'admin' WHERE email = 'admin@admin.com' RETURNING id, email, password"
    );
    console.log('Senha atualizada:', update.rows);
  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await pool.end();
  }
}

fix();
