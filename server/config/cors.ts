import type { CorsOptions } from 'cors'

// Origens permitidas — em produção defina ALLOWED_ORIGINS no .env
// Ex: ALLOWED_ORIGINS=https://iraucuba.gov.br,https://www.iraucuba.gov.br
const rawOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
      .map(o => o.trim())
      .filter(Boolean)
  : null

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Sem origin = requisição server-to-server ou mesmo host (sempre permitida)
    if (!origin) return callback(null, true)

    // Em desenvolvimento, permite qualquer origem
    if (process.env.NODE_ENV !== 'production') return callback(null, true)

    // Em produção, se não houver lista definida, permite todas (deploy inicial)
    if (!rawOrigins) return callback(null, true)

    // Em produção, valida contra a lista de origens permitidas
    if (rawOrigins.includes(origin)) return callback(null, true)

    return callback(new Error(`CORS: origem não autorizada — ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // allowedHeaders não definido → o cors reflete automaticamente os headers solicitados no preflight
}
