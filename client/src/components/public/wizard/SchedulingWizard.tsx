import { useEffect, useState } from 'react'
import { useRoute, useLocation } from 'wouter'
import {
  MapPin,
  Calendar,
  LayoutDashboard,
  CheckCircle2,
  ArrowRight,
  Moon,
  Sun,
  FileText,
  Loader2,
  Phone,
  Printer
} from 'lucide-react'
import { ServiceStep } from './steps/ServiceStep'
import { DateStep } from './steps/DateStep'
import { PersonalDataStep } from './steps/PersonalDataStep'
import { useToast } from '@/hooks/use-toast'

interface TenantColors {
  principal?: string
  agendar?: string
}

interface TenantConfig {
  nome: string
  cores?: TenantColors
  bloquearFimDeSemana?: boolean
  telefone?: string | null
  horariosDisponiveis?: string[]
}

interface SuccessData {
  protocol: string
  person: any
  date: Date | null
  time: string
}

interface WizardFormData {
  localId: string
  serviceId: string
  date: Date | null
  time: string
}

export default function SchedulingWizard() {
  const [, params] = useRoute<{ slug: string }>('/:slug/agendar')
  const slug = params?.slug || 'iraucuba'
  const [, setLocation] = useLocation()
  const { toast } = useToast()

  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  const [formData, setFormData] = useState<WizardFormData>({
    localId: '1',
    serviceId: '',
    date: null,
    time: ''
  })

  useEffect(() => {
    setLoading(true)
    fetch(`/api/public/config/${slug}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Falha ao carregar configuração do tenant')
        }
        return res.json()
      })
      .then((data: TenantConfig) => {
        setConfig(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Erro ao carregar configuração do tenant:', err)
        setConfig({
          nome: slug.toUpperCase(),
          cores: { principal: '#059669', agendar: '#059669' },
          bloquearFimDeSemana: true
        })
        setLoading(false)
      })
  }, [slug])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    // Remove .dark ao desmontar (ao navegar para outra página)
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const themeColor = config?.cores?.agendar || '#059669'

  const handleServiceSelect = (serviceId: string) => {
    setFormData((prev) => ({ ...prev, serviceId }))
    setStep(3)
  }

  const handleDateSelect = (date: Date, time: string) => {
    setFormData((prev) => ({ ...prev, date, time }))
    setStep(4)
  }

  const handleFinish = async (personalData: any) => {
    setSubmitting(true)

    const payload = {
      tenantSlug: slug,
      localId: formData.localId,
      serviceId: formData.serviceId,
      date: formData.date,
      time: formData.time,
      person: personalData
    }

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error('Erro ao salvar agendamento')
      }

      const savedData = await res.json()

      setSuccessData({
        protocol: savedData.protocol,
        person: personalData,
        date: formData.date,
        time: formData.time
      })

      setStep(5)
      toast({ title: 'Agendamento Realizado!', description: `Protocolo: ${savedData.protocol}` })
    } catch (error) {
      console.error('Erro ao finalizar agendamento:', error)
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar',
        description: 'Verifique os dados e tente novamente.'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg p-2 text-white"
            style={{ backgroundColor: config?.cores?.principal || '#059669' }}
          >
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 transition-colors dark:text-white">Agendamento RG</h1>
            <p className="text-xs text-gray-500 transition-colors dark:text-gray-400">Sistema Oficial - {config.nome}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1 transition dark:border-gray-600 dark:bg-gray-700">
            <button
              type="button"
              className="flex items-center gap-2 rounded-md bg-white px-4 py-1.5 text-xs font-bold text-gray-800 shadow-sm transition-colors dark:bg-gray-600 dark:text-white"
            >
              <Calendar size={14} /> Agendar
            </button>
            <button
              type="button"
              onClick={() => window.open(`/${slug}/admin`, '_blank', 'noopener')}
              className="flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-600/50 dark:hover:text-white"
              title="Acessar Área Restrita (Nova Aba)"
            >
              <LayoutDashboard size={14} /> Secretaria
            </button>
          </div>
        </div>
      </header>

      {step < 5 && (
        <div className="mx-auto mt-8 mb-8 max-w-5xl px-4">
          <div className="flex justify-between gap-2 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map((id) => (
              <StepIndicator
                key={id}
                num={id}
                label={['Local', 'Serviço', 'Data', 'Dados'][id - 1]}
                active={step >= id}
                current={step === id}
                color={themeColor}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 pb-16">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 transition-colors dark:text-white">Escolha o Local</h2>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setStep(2)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setStep(2)
              }}
              className="flex cursor-pointer items-center justify-between rounded-2xl border-2 bg-white p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-gray-800"
              style={{ borderColor: themeColor }}
            >
              <div className="flex items-start gap-5">
                <div className="rounded-full p-4 text-white" style={{ backgroundColor: themeColor }}>
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 transition-colors dark:text-white">
                    SIPS - Secretaria de Identificação
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 transition-colors dark:text-gray-400">Centro, {slug}</p>
                </div>
              </div>
              <CheckCircle2 size={28} style={{ color: themeColor }} />
            </div>
          </div>
        )}

        {step === 2 && <ServiceStep onNext={handleServiceSelect} color={themeColor} />}

        {step === 3 && <DateStep onNext={handleDateSelect} color={themeColor} config={config} />}

        {step === 4 && <PersonalDataStep onFinish={handleFinish} loading={submitting} color={themeColor} />}

        {step === 5 && successData && (
          <div
            className="animate-in zoom-in-95 duration-500 rounded-3xl border-t-8 bg-white p-10 text-center shadow-xl dark:bg-gray-800"
            style={{ borderColor: themeColor }}
          >
            <div className="mx-auto mb-6 inline-flex rounded-full bg-green-100 p-5 text-green-600">
              <CheckCircle2 size={64} />
            </div>
            <h2 className="mb-2 text-3xl font-black text-gray-800 dark:text-white">Agendamento Confirmado!</h2>
            <p className="mb-8 text-gray-500">
              Seu protocolo é:
              <span className="ml-2 rounded bg-gray-100 px-2 py-1 font-mono text-lg font-bold text-black dark:bg-gray-700 dark:text-white">
                {successData.protocol}
              </span>
            </p>

            <div className="mx-auto mb-8 max-w-md rounded-2xl border border-gray-100 bg-gray-50 p-6 text-left dark:border-gray-700 dark:bg-gray-700/50">
              <div className="mb-2 flex justify-between text-sm text-gray-500">
                <span>Nome:</span>
                <span className="font-bold text-gray-800 dark:text-white">{successData.person?.nome}</span>
              </div>
              <div className="mb-2 flex justify-between text-sm text-gray-500">
                <span>Data:</span>
                <span className="font-bold text-gray-800 dark:text-white">
                  {successData.date ? new Date(successData.date).toLocaleDateString('pt-BR') : '--'}
                </span>
              </div>
              <div className="mb-2 flex justify-between text-sm text-gray-500">
                <span>Horário:</span>
                <span className="font-bold text-gray-800 dark:text-white">{successData.time}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Local:</span>
                <span className="font-bold text-gray-800 dark:text-white">SIPS - Centro</span>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl border border-gray-300 px-6 py-3 font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Printer size={18} /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => setLocation(`/${slug}`)}
                className="flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-white shadow-lg"
                style={{ backgroundColor: themeColor }}
              >
                <ArrowRight size={18} /> Voltar ao Início
              </button>
            </div>

            {config.telefone && (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                <Phone size={16} />
                Suporte: {config.telefone}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface StepIndicatorProps {
  num: number
  label: string
  active: boolean
  current: boolean
  color: string
}

function StepIndicator({ num, label, active, current, color }: StepIndicatorProps) {
  return (
    <div
      className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-bold transition-colors ${
        active ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-white' : 'border-gray-200 text-gray-400 dark:border-gray-700'
      }`}
      style={{ borderColor: active ? color : undefined, color: active ? color : undefined, opacity: current || active ? 1 : 0.6 }}
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
        style={{ backgroundColor: active ? color : '#e5e7eb', color: active ? '#fff' : '#6b7280' }}
      >
        {num}
      </span>
      {label}
    </div>
  )
}
