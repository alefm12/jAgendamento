import { useEffect, useState } from "react"
import { useRoute, useLocation } from "wouter"
import { Calendar, Search, Phone, Loader2, Building2, Moon, Sun } from "lucide-react"
import AccessibilityDropdown from "./AccessibilityDropdown"
import { AylaButton } from "@/components/ayla/AylaButton"

interface PublicConfig {
  nome: string
  subtitulo: string
  cores: {
    principal: string
    agendar: string
    consultar: string
  }
  logo: string | null
  fundo: string | null
  telefone: string | null
}

interface PublicHomeProps {
  tenantSlug?: string
  onStartSchedule?: () => void
  onConsult?: () => void
}

export default function TenantHome({ tenantSlug, onStartSchedule, onConsult }: PublicHomeProps) {
  const [, params] = useRoute<{ slug: string }>("/:slug")
  const slug = tenantSlug ?? params?.slug ?? ""
  const [, setLocation] = useLocation()

  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
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

  useEffect(() => {
    if (!slug) return
    fetch(`/api/public/config/${slug}`)
      .then((res) => res.json())
      .then((data: PublicConfig) => {
        setConfig(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setError(true)
        setLoading(false)
      })
  }, [slug])

  const handleOpenSecretariat = () => {
    if (slug) {
      window.open(`/${slug}/admin`, "_blank", "noopener")
    }
  }

  const handleAgendarClick = () => {
    if (onStartSchedule) {
      onStartSchedule()
      return
    }
    if (slug) {
      setLocation(`/${slug}/agendar`)
    }
  }

  const handleConsultClick = () => {
    if (onConsult) {
      onConsult()
      return
    }
    if (slug) {
      setLocation(`/${slug}/consultar`)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (error || !config) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500 dark:text-gray-300">Prefeitura não encontrada.</div>
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-gray-100 text-gray-900 transition-colors dark:bg-gray-900 dark:text-gray-100">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-end gap-4 p-6 pointer-events-auto">
        <AccessibilityDropdown />
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          className="rounded-full border border-gray-200/50 bg-white/80 p-3 text-gray-700 shadow-sm backdrop-blur-md transition hover:shadow-md dark:border-gray-700/50 dark:bg-gray-800/80 dark:text-gray-200"
          title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          type="button"
          onClick={handleOpenSecretariat}
          className="group flex items-center gap-3 rounded-full border border-gray-200/50 bg-white/90 pl-3 pr-5 py-2 text-sm font-bold text-gray-700 shadow-sm backdrop-blur-md transition hover:bg-white dark:border-gray-700/50 dark:bg-gray-800/90 dark:text-gray-200"
        >
          <span className="rounded-full bg-blue-100 p-1.5 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/70 dark:text-blue-300">
            <Building2 size={18} />
          </span>
          Área da Secretaria
        </button>
      </div>

      {config.fundo ? (
        <div className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url('${config.fundo}')` }} />
      ) : (
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900" />
      )}
      <div className="fixed inset-0 z-0 bg-white/30 backdrop-blur-[2px] transition-colors duration-300 dark:bg-black/50" />

      <div className="relative z-10 flex w-full max-w-7xl flex-1 flex-col items-center gap-10 px-6 py-24 md:flex-row md:items-center md:gap-4">
        <div className="order-1 flex w-full flex-col items-center text-center md:order-1 md:w-1/2 md:items-start md:text-left">
          <div className="mb-6 flex w-full justify-center md:justify-start">
            {config.logo ? (
              <img src={config.logo} alt="Brasão" className="h-32 w-auto drop-shadow-2xl transition hover:scale-105 md:h-48 lg:h-56" loading="lazy" />
            ) : null}
          </div>
          <h1
            className="mb-4 w-full break-words text-3xl font-black uppercase leading-tight drop-shadow md:text-5xl lg:text-6xl"
            style={{ color: config.cores.principal, textShadow: isDark ? "2px 2px 0px #000" : "2px 2px 0px #fff" }}
          >
            {config.nome}
          </h1>
          <p className="mb-10 max-w-xl rounded-lg bg-white/60 px-4 py-2 text-sm font-bold uppercase tracking-widest text-gray-700 shadow-sm backdrop-blur-md transition-colors dark:bg-gray-800/60 dark:text-gray-200 md:text-lg">
            {config.subtitulo}
          </p>
          <div className="w-full max-w-md space-y-4">
            <button
              type="button"
              onClick={handleAgendarClick}
              className="flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-5 text-lg font-bold uppercase text-white shadow-xl ring-4 ring-white/40 transition hover:-translate-y-1 hover:shadow-2xl dark:ring-black/20"
              style={{ backgroundColor: config.cores.agendar }}
            >
              <Calendar size={24} /> REALIZAR AGENDAMENTO
            </button>
            <button
              type="button"
              onClick={handleConsultClick}
              className="flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-5 text-lg font-bold uppercase text-white shadow-xl ring-4 ring-white/40 transition hover:-translate-y-1 hover:shadow-2xl dark:ring-black/20"
              style={{ backgroundColor: config.cores.consultar }}
            >
              <Search size={24} /> CONSULTAR AGENDAMENTO
            </button>
          </div>
          <div className="mt-12 flex flex-col items-center gap-2 md:items-start">
            <span className="rounded-md bg-white/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-600 shadow-sm backdrop-blur-md transition-colors dark:bg-gray-800/80 dark:text-gray-300">
              PRECISA DE AJUDA?
            </span>
            {config.telefone ? (
              <a
                href={`tel:${config.telefone.replace(/\D/g, '')}`}
                className="flex items-center gap-3 rounded-full bg-white/90 px-8 py-3 text-xl font-black text-gray-900 shadow-lg backdrop-blur-md transition-colors hover:opacity-90 dark:bg-gray-800/90 dark:text-gray-100"
                style={{ color: config.cores.principal }}
              >
                <Phone size={24} />
                {config.telefone}
              </a>
            ) : (
              <p className="flex items-center gap-3 rounded-full bg-white/90 px-8 py-3 text-xl font-black text-gray-900 shadow-lg backdrop-blur-md transition-colors dark:bg-gray-800/90 dark:text-gray-100" style={{ color: config.cores.principal }}>
                <Phone size={24} />
                Contato não informado
              </p>
            )}
           
          </div>
        </div>

        <div className="order-2 flex w-full items-center justify-center md:order-2 md:w-1/2 md:justify-end">
          <img src="/bonecos_rg.png" alt="Cidadãos" className="h-auto w-full max-w-[500px] object-contain drop-shadow-2xl" loading="lazy" />
        </div>
      </div>

      <div className="relative z-20 pb-6 text-center">
        <p className="inline-block rounded-full bg-white/50 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500/80 shadow-sm backdrop-blur-sm transition-colors dark:bg-gray-800/50 dark:text-gray-400/80">
          Desenvolvido por <span className="font-black text-gray-900 dark:text-white">JEOS</span> Tecnologia
        </p>
      </div>

      {/* Assistente Virtual Ayla */}
      <AylaButton tenantSlug={slug} />
    </div>
  )
}
