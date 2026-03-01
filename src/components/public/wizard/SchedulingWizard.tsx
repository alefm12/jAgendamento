import { useState, useEffect } from "react"
import { useRoute } from "wouter"
import {
  MapPin,
  Calendar,
  LayoutDashboard,
  CheckCircle2,
  ArrowRight,
  Moon,
  Sun,
  FileText
} from "lucide-react"

interface SchedulingWizardProps {
  tenantSlug?: string
}

const PUBLIC_PORTAL_BASE_URL = "http://localhost:5000"

export default function SchedulingWizard({ tenantSlug }: SchedulingWizardProps) {
  const [, params] = useRoute<{ slug: string }>("/:slug/agendar")
  const slug = tenantSlug ?? params?.slug ?? "iraucuba"
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    // Remove .dark ao desmontar (ao navegar para outra página)
    return () => {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  const buildPortalUrl = (suffix: string) => {
    return `${PUBLIC_PORTAL_BASE_URL.replace(/\/$/, "")}/${slug}${suffix}`
  }

  const handleOpenScheduling = () => {
    window.location.href = buildPortalUrl("/agendar")
  }

  const handleOpenSecretariat = () => {
    window.open(buildPortalUrl("/admin"), "_blank", "noopener")
  }

  const handleContinue = () => {
    handleOpenScheduling()
  }

  const normalizedCity = slug.charAt(0).toUpperCase() + slug.slice(1)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-600 p-2 text-white">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 transition-colors dark:text-white">Agendamento CIN</h1>
            <p className="text-xs text-gray-500 transition-colors dark:text-gray-400">Sistema de Agendamento da Carteira de Identidade Nacional</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1 transition dark:border-gray-600 dark:bg-gray-700">
            <button
              type="button"
              onClick={handleOpenScheduling}
              className="flex items-center gap-2 rounded-md bg-white px-4 py-1.5 text-xs font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-600 dark:text-white"
            >
              <Calendar size={14} /> Agendar
            </button>
            <button
              type="button"
              onClick={handleOpenSecretariat}
              className="flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-600/50 dark:hover:text-white"
              title="Acessar Área Restrita (Nova Aba)"
            >
              <LayoutDashboard size={14} /> Secretaria
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-8 max-w-6xl px-4">
        <div className="flex gap-4 overflow-x-auto pb-4">
          <StepIndicator num={1} label="Escolher Local" active />
          <StepIndicator num={2} label="Escolher Data" />
          <StepIndicator num={3} label="Escolher Horário" />
          <StepIndicator num={4} label="Dados Pessoais" />
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-6xl px-4 pb-20">
        <div className="mb-6">
          <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600">Passo 1</span>
          <h2 className="mt-2 text-2xl font-bold text-gray-800 transition-colors dark:text-white">Escolha o Local de Atendimento</h2>
          <p className="text-sm text-gray-500 transition-colors dark:text-gray-400">As próximas etapas serão liberadas após selecionar um local disponível.</p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-gray-800">
          <div className="flex items-start gap-5">
            <div className="rounded-full border border-emerald-100 bg-emerald-50 p-4 text-emerald-600 dark:bg-emerald-900/30">
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 transition-colors dark:text-white">SIPS - Secretaria de Identificação</h3>
              <p className="mt-1 text-sm text-gray-500 transition-colors dark:text-gray-400">
                R. Jorge Domingues Araújo, 962 - Centro, {normalizedCity} - CE
              </p>
              <span className="mt-3 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-green-700">Disponível</span>
            </div>
          </div>
          <div className="rounded-full bg-emerald-50 p-1 text-emerald-600">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
        </div>

        <div className="mt-10 flex justify-end">
          <button
            type="button"
            onClick={handleContinue}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-10 py-3.5 font-bold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-1 hover:bg-emerald-800 dark:shadow-none"
          >
            Continuar <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

interface StepIndicatorProps {
  num: number
  label: string
  active?: boolean
}

function StepIndicator({ num, label, active }: StepIndicatorProps) {
  return (
    <div
      className={`flex min-w-[150px] flex-1 items-center justify-center gap-2 rounded-full border py-3.5 text-sm font-bold transition-colors ${
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400"
          : "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
          active ? "bg-emerald-200 text-emerald-800" : "bg-gray-100 text-gray-500"
        }`}
      >
        {num}
      </span>
      {label}
    </div>
  )
}
