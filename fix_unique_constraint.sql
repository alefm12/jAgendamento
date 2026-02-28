-- Remove a constraint que impede múltiplos agendamentos no mesmo horário
-- Isso permite que o sistema controle o número máximo de agendamentos por slot (maxAppointmentsPerSlot)

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS unique_agendamento;

-- Adiciona índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_agendamentos_slot ON agendamentos(local_id, data_agendamento, hora_agendamento);
