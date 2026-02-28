-- =====================================================
-- MIGRATION 006: SISTEMA DE AGENDAMENTO COMPLETO
-- Criação de todas as tabelas necessárias para o sistema
-- =====================================================

-- 1. TABELA DE CONFIGURAÇÕES DO SISTEMA
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    system_name VARCHAR(255) DEFAULT 'Agendamento CIN',
    primary_color VARCHAR(50) DEFAULT 'oklch(0.45 0.15 145)',
    secondary_color VARCHAR(50) DEFAULT 'oklch(0.65 0.1 180)',
    accent_color VARCHAR(50) DEFAULT 'oklch(0.55 0.18 145)',
    logo TEXT,
    logo_size INTEGER DEFAULT 40,
    title_font VARCHAR(100),
    body_font VARCHAR(100),
    border_radius_preview INTEGER,
    reminder_message TEXT,
    booking_window_days INTEGER DEFAULT 60,
    default_theme VARCHAR(20) DEFAULT 'light',
    working_hours JSONB,
    max_appointments_per_slot INTEGER DEFAULT 2,
    secretary_config JSONB,
    lgpd_settings JSONB,
    rg_delivery_settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE USUÁRIOS DA SECRETARIA
CREATE TABLE IF NOT EXISTS secretary_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    permissions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE LOCALIDADES/LOCAIS DE ATENDIMENTO
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    type VARCHAR(50),
    google_maps_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    working_hours JSONB,
    max_appointments_per_slot INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE AGENDAMENTOS
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
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
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

-- 5. TABELA DE DATAS BLOQUEADAS
CREATE TABLE IF NOT EXISTS blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    reason TEXT NOT NULL,
    block_type VARCHAR(50) DEFAULT 'full-day',
    blocked_times JSONB,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE TEMPLATES DE RELATÓRIOS
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(100) NOT NULL,
    filters JSONB,
    columns JSONB,
    sort_config JSONB,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE RELATÓRIOS AGENDADOS
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    recipients JSONB,
    format VARCHAR(20) DEFAULT 'pdf',
    is_active BOOLEAN DEFAULT TRUE,
    last_execution TIMESTAMPTZ,
    next_execution TIMESTAMPTZ,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA DE LOG DE EXECUÇÃO DE RELATÓRIOS
CREATE TABLE IF NOT EXISTS report_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
    template_name VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    records_count INTEGER,
    error_message TEXT,
    file_path TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by VARCHAR(255)
);

-- 9. TABELA DE LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    performed_by_role VARCHAR(50),
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    target_name VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    changes JSONB,
    metadata JSONB,
    tags TEXT[],
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABELA DE HISTÓRICO DE LEMBRETES
CREATE TABLE IF NOT EXISTS reminder_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    appointment_protocol VARCHAR(50),
    citizen_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    reminder_type VARCHAR(50) NOT NULL,
    channels JSONB,
    status VARCHAR(50) NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT
);

-- =====================================================
-- ÍNDICES PARA MELHOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_appointments_cpf ON appointments(cpf);
CREATE INDEX IF NOT EXISTS idx_appointments_protocol ON appointments(protocol);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_location ON appointments(location_id);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(date);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_location ON blocked_dates(location_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);

CREATE INDEX IF NOT EXISTS idx_reminder_history_appointment ON reminder_history(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reminder_history_sent_at ON reminder_history(sent_at);

CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

-- =====================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secretary_users_updated_at BEFORE UPDATE ON secretary_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir configuração padrão do sistema (se não existir)
INSERT INTO system_config (
    system_name,
    primary_color,
    secondary_color,
    accent_color,
    booking_window_days,
    reminder_message
) 
SELECT 
    'Agendamento CIN',
    'oklch(0.45 0.15 145)',
    'oklch(0.65 0.1 180)',
    'oklch(0.55 0.18 145)',
    60,
    'Olá {nome}, lembramos que você tem agendamento para {data} às {hora} para emissão de CIN. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!'
WHERE NOT EXISTS (SELECT 1 FROM system_config LIMIT 1);

-- Comentário final
COMMENT ON TABLE appointments IS 'Tabela principal de agendamentos do sistema';
COMMENT ON TABLE locations IS 'Locais de atendimento cadastrados';
COMMENT ON TABLE blocked_dates IS 'Datas bloqueadas para agendamento';
COMMENT ON TABLE audit_logs IS 'Registro completo de auditoria do sistema';
