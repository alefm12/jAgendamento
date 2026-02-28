-- ==================================================
-- EXECUTE ESTE SQL NO PGADMIN PARA CRIAR A TABELA
-- ==================================================

-- Conecte ao banco jagendamento primeiro!

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(50) UNIQUE NOT NULL,
    
    -- Dados Pessoais
    full_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(20) NOT NULL,
    rg VARCHAR(50),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    birth_date DATE,
    
    -- Endereço
    street VARCHAR(255),
    number VARCHAR(50),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(20),
    region_type VARCHAR(50),
    sede_id VARCHAR(50),
    district_id VARCHAR(50),
    neighborhood_id VARCHAR(50),
    
    -- Dados do Agendamento
    location_id VARCHAR(100),
    date DATE NOT NULL,
    time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    
    -- Informações da CIN
    cin_type VARCHAR(50),
    cin_number VARCHAR(50),
    
    -- Controle de Cancelamento
    cancelled_by VARCHAR(50),
    cancellation_reason TEXT,
    cancellation_category VARCHAR(100),
    
    -- Controle de Atendimento
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(255),
    
    -- LGPD
    lgpd_consent JSONB,
    
    -- Entrega do CIN
    rg_delivery JSONB,
    
    -- Notas
    notes JSONB,
    
    -- Histórico de Status
    status_history JSONB,
    
    -- Lembretes
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ,
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_appointments_cpf ON appointments(cpf);
CREATE INDEX IF NOT EXISTS idx_appointments_protocol ON appointments(protocol);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_modified = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_appointments_updated_at 
BEFORE UPDATE ON appointments
FOR EACH ROW 
EXECUTE FUNCTION update_appointments_updated_at();

-- Verificar se foi criado
SELECT 'Tabela appointments criada com sucesso!' as status;
SELECT COUNT(*) as total_appointments FROM appointments;
