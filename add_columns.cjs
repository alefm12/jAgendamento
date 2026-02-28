const { Pool } = require('pg')

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'jagendamento',
  password: '123',
  port: 5432
})

async function addColumns() {
  try {
    console.log('📋 Adicionando colunas faltantes...')

    // Adicionar colunas
    await pool.query(`
      ALTER TABLE agendamentos 
      ADD COLUMN IF NOT EXISTS notas JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS historico_status JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS ultima_modificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `)
    console.log('✅ Colunas adicionadas')

    // Gerar protocolos
    await pool.query(`UPDATE agendamentos SET protocolo = 'AGD-' || id WHERE protocolo IS NULL`)
    console.log('✅ Protocolos gerados')

    // Criar índices
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_agendamentos_protocolo ON agendamentos(protocolo);
      CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
      CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendamento)
    `)
    console.log('✅ Índices criados')

    // Verificar estrutura
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'agendamentos'
      ORDER BY ordinal_position
    `)
    console.log('\n📊 Estrutura da tabela agendamentos:')
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`)
    })

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await pool.end()
  }
}

addColumns()
