import { Router } from 'express'

const router = Router()

router.get('/agendamentos', async (req, res) => {
  console.log('[TESTE] GET /agendamentos chamado!')
  res.json([{ test: 'ok', message: 'Rota funcionando!' }])
})

export default router
