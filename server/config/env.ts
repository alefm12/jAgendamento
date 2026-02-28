import dotenv from 'dotenv'

dotenv.config()

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.SERVER_PORT || process.env.PORT || 4000),
  JWT_SECRET: process.env.JWT_SECRET || 'segredo-dev-super-seguro-123',
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL: process.env.DATABASE_SSL === 'true'
}
