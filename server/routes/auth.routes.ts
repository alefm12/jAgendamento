import { Router } from 'express';
import { query } from '../config/db';
import jwt from 'jsonwebtoken';
import { logLogin, logLoginFailed } from '../services/audit.service';

const router = Router();

router.post('/api/super-admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(`[AUTH] Login para: ${email}`);

    const result = await query("SELECT * FROM super_admins WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      await logLoginFailed(email, 'Usuário não encontrado', req);
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const dbPassword = user.password || user.senha_hash;
    
    if (dbPassword === password) {
      console.log("[AUTH] Sucesso! Enviando PACOTE MEGA UNIVERSAL...");

      const token = jwt.sign(
        { id: user.id, role: 'SUPER_ADMIN', tenantId: 1, email: user.email },
        process.env.JWT_SECRET || 'segredo-dev-super-seguro-123',
        { expiresIn: '7d' }
      );

      // Log de login bem-sucedido
      await logLogin({
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'SUPER_ADMIN',
        tenantId: 1,
        tenantName: 'Prefeitura Admin'
      }, req);

      // --- CRIAÇÃO DOS OBJETOS ANINHADOS (O Segredo!) ---
      // O frontend provavelmente quer 'tenant' como um objeto, não só o ID.
      const tenantObj = {
        id: 1,
        _id: 1,
        name: 'Prefeitura Admin',
        slug: 'admin',
        status: 'active',
        ativo: true
      };

      const universalUser = {
          // IDs em número e string (para evitar erro de .toString())
          id: user.id,
          _id: user.id,
          idStr: String(user.id),
          
          name: user.name,
          email: user.email,
          role: 'SUPER_ADMIN',
          
          // IDs soltos
          tenantId: 1,
          tenant_id: 1,
          prefeituraId: 1,

          // --- AQUI ESTÁ A CORREÇÃO PRINCIPAL ---
          // Envia a prefeitura como objeto completo dentro do usuário
          tenant: tenantObj,
          prefeitura: tenantObj,
          organization: tenantObj,
          
          permissions: ['all']
      };

      res.json({
        success: true,
        token: token,
        
        // Envia também na raiz da resposta
        tenantId: 1,
        user: universalUser,
        
        // Envia objetos na raiz também
        tenant: tenantObj,
        prefeitura: tenantObj
      });
      
    } else {
      await logLoginFailed(email, 'Senha incorreta', req);
      res.status(401).json({ error: 'Senha incorreta.' });
    }

  } catch (error) {
    console.error('Erro no Login:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

export default router;