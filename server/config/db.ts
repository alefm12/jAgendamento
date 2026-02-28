import { Pool, type QueryResult } from 'pg'
import { env } from './env'

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false
})

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no Banco de Dados:', err)
})

export const query = <T = any>(text: string, params?: any[]): Promise<QueryResult<T>> =>
  pool.query<T>(text, params)
