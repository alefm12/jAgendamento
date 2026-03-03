import { useEffect, useState } from 'react'
import { Search, ArrowLeft, CheckCircle, Clock, Calendar, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { validateCPF, formatCPF } from '@/lib/validators'
import { PublicCancelDialog } from './PublicCancelDialog'
import { AylaButton } from '@/components/ayla/AylaButton'

interface ConsultationStatusProps {
  onBack: () => void
  tenantSlug?: string
}

interface AppointmentData {
  id: number
  name: string
  cpf: string
  phone: string
  email: string
  date: string
  time: string
  status: string
  cinType: string
  protocol?: string
  location: {
    name: string | null
    address: string | null
  }
}

interface ConsultationResponse {
  found: boolean
  appointments: AppointmentData[]
}

const getContactGuidance = (supportPhone?: string | null) =>
  supportPhone && supportPhone.trim().length > 0
    ? `Caso você não consiga realizar o agendamento ou cancelamento, entre em contato pelo número ${supportPhone}.`
    : 'Caso você não consiga realizar o agendamento ou cancelamento, entre em contato com a secretaria responsável.'

const statusDisplay: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'pending': { 
    label: 'Pendente', 
    color: 'amber',
    icon: <Clock className="text-amber-500" size={24} />
  },
  'pendente': { 
    label: 'Pendente', 
    color: 'amber',
    icon: <Clock className="text-amber-500" size={24} />
  },
  'confirmed': { 
    label: 'Confirmado', 
    color: 'blue',
    icon: <CheckCircle className="text-blue-500" size={24} />
  },
  'confirmado': { 
    label: 'Confirmado', 
    color: 'blue',
    icon: <CheckCircle className="text-blue-500" size={24} />
  },
  'completed': { 
    label: 'Concluído', 
    color: 'green',
    icon: <CheckCircle className="text-green-500" size={24} />
  },
  'concluido': { 
    label: 'Concluído', 
    color: 'green',
    icon: <CheckCircle className="text-green-500" size={24} />
  },
  'cancelled': { 
    label: 'Cancelado', 
    color: 'red',
    icon: <XCircle className="text-red-500" size={24} />
  },
  'cancelado': { 
    label: 'Cancelado', 
    color: 'red',
    icon: <XCircle className="text-red-500" size={24} />
  },
  'awaiting-issuance': { 
    label: 'Aguardando Emissão', 
    color: 'purple',
    icon: <Clock className="text-purple-500" size={24} />
  },
  'cin-ready': { 
    label: 'CIN Pronta', 
    color: 'green',
    icon: <CheckCircle className="text-green-500" size={24} />
  },
  'cin-delivered': { 
    label: 'CIN Entregue', 
    color: 'emerald',
    icon: <CheckCircle className="text-emerald-500" size={24} />
  }
}

export function ConsultationStatus({ onBack, tenantSlug }: ConsultationStatusProps) {
  const [cpf, setCpf] = useState('')
  const [result, setResult] = useState<ConsultationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null)
  const [supportPhone, setSupportPhone] = useState<string | null>(null)

  useEffect(() => {
    const detectedSlug = tenantSlug || (typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean)[0]
      : '')

    if (!detectedSlug) return

    fetch(`/api/public/config/${detectedSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSupportPhone(data?.telefone || null))
      .catch(() => setSupportPhone(null))
  }, [tenantSlug])

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    const cleanCpf = cpf.replace(/\D/g, '')
    const contactGuidance = getContactGuidance(supportPhone)
    
    if (!validateCPF(cleanCpf)) {
      alert(`CPF inválido. Por favor, verifique e tente novamente.\n\n${contactGuidance}`)
      return
    }
    
    setLoading(true)
    setResult(null)

    try {
      console.log('[CONSULTA] Fazendo requisição para CPF:', cleanCpf)
      const response = await fetch(`/api/agendamentos/consultar/${cleanCpf}`)
      
      console.log('[CONSULTA] Status da resposta:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }))
        console.error('[CONSULTA] Erro na resposta:', errorData)
        throw new Error(errorData.message || `Erro ${response.status}`)
      }
      
      const data: ConsultationResponse = await response.json()
      console.log('[CONSULTA] Dados recebidos:', data)
      
      setResult(data)
    } catch (error) {
      console.error('Erro ao consultar agendamento:', error)
      alert(`Erro ao consultar agendamento: ${error instanceof Error ? error.message : 'Tente novamente'}\n\n${contactGuidance}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value)
    setCpf(formatted)
  }

  const handleOpenCancelDialog = (appointment: AppointmentData) => {
    setSelectedAppointment(appointment)
    setCancelDialogOpen(true)
  }

  const handleCancelSuccess = () => {
    // Recarrega a consulta após cancelamento
    const cleanCpf = cpf.replace(/\D/g, '')
    fetch(`/api/agendamentos/consultar/${cleanCpf}`)
      .then(res => res.json())
      .then(data => setResult(data))
      .catch(error => console.error('Erro ao atualizar dados:', error))
  }

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('T')[0].split('-')
      return `${day}/${month}/${year}`
    } catch {
      return dateStr
    }
  }

  const handleStartSchedule = () => {
    if (tenantSlug) {
      window.location.href = `/${tenantSlug}/agendar`
    } else {
      window.location.href = '/agendar'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-white px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800"
        >
          <ArrowLeft size={18} />
          Voltar
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-2">Consultar Agendamento</h2>
        <p className="text-gray-500 mb-6 text-sm">Digite seu CPF para verificar seus agendamentos.</p>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-3 border"
              maxLength={14}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search size={20} />
                Consultar
              </>
            )}
          </button>
        </form>

        {result && (
          <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
            {result.found && result.appointments.length > 0 ? (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Agendamentos Encontrados ({result.appointments.length})
                </h3>
                {result.appointments.map((appointment, index) => {
                  const statusInfo = statusDisplay[appointment.status] || statusDisplay['pending']
                  const canCancel = appointment.status === 'pending' || appointment.status === 'pendente'
                  
                  return (
                    <div key={appointment.id} className={`rounded-xl border-2 p-5 space-y-3 ${
                      statusInfo.color === 'green' ? 'border-green-200 bg-green-50' :
                      statusInfo.color === 'amber' ? 'border-amber-200 bg-amber-50' :
                      statusInfo.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                      statusInfo.color === 'red' ? 'border-red-200 bg-red-50' :
                      'border-gray-200 bg-gray-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg">{appointment.name}</h4>
                          {appointment.protocol && (
                            <p className="text-xs text-gray-600 mt-1">
                              Protocolo: <span className="font-mono font-semibold">{appointment.protocol}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {statusInfo.icon}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600 font-semibold">Status:</span>
                          <p className={`font-bold ${
                            statusInfo.color === 'green' ? 'text-green-700' :
                            statusInfo.color === 'amber' ? 'text-amber-700' :
                            statusInfo.color === 'blue' ? 'text-blue-700' :
                            statusInfo.color === 'red' ? 'text-red-700' :
                            'text-gray-700'
                          }`}>{statusInfo.label}</p>
                        </div>
                        <div>
                          <span className="text-gray-600 font-semibold">Tipo:</span>
                          <p className="text-gray-900">{appointment.cinType || 'CIN'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm bg-white p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-gray-600" />
                          <span className="font-semibold text-gray-900">
                            {formatDate(appointment.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gray-600" />
                          <span className="font-semibold text-gray-900">
                            {appointment.time}
                          </span>
                        </div>
                      </div>

                      {appointment.location.name && (
                        <div className="text-xs text-gray-600 bg-white p-3 rounded-lg">
                          <strong>Local:</strong> {appointment.location.name}
                          {appointment.location.address && (
                            <span className="block mt-1">{appointment.location.address}</span>
                          )}
                        </div>
                      )}

                      {canCancel && (
                        <div className="pt-3 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => handleOpenCancelDialog(appointment)}
                            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 transition"
                          >
                            <XCircle size={18} />
                            Cancelar Agendamento
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="text-center py-8 space-y-4">
                <AlertCircle className="mx-auto text-gray-400" size={64} />
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    Nenhum agendamento encontrado
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Não encontramos nenhum agendamento vinculado a este CPF.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartSchedule}
                    className="inline-flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg"
                  >
                    <Calendar size={20} />
                    Realizar Agendamento
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedAppointment && (
        <PublicCancelDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          appointmentId={selectedAppointment.id}
          appointmentName={selectedAppointment.name}
          appointmentDate={formatDate(selectedAppointment.date)}
          appointmentTime={selectedAppointment.time}
          supportPhone={supportPhone}
          onCancelSuccess={handleCancelSuccess}
        />
      )}

      {/* Assistente Virtual Ayla */}
      <AylaButton tenantSlug={tenantSlug} />
    </div>
  )
}

