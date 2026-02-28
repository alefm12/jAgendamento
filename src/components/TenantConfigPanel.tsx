import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Calendar, Loader2, Palette, Phone, Search, Upload } from "lucide-react"

import { useToast } from "@/hooks/use-toast"

interface TenantConfigResponse {
  nome_exibicao?: string | null
  name?: string | null
  subtitulo?: string | null
  telefone_contato?: string | null
  cor_principal?: string | null
  cor_botao_agendar?: string | null
  cor_botao_consultar?: string | null
  url_logo?: string | null
  url_fundo?: string | null
}

const DEFAULT_SUBTITLE = "SERVIÇO DE AGENDAMENTO DE CIN"

const RAW_BASE_PATH = import.meta.env.BASE_URL ?? "/"
const NORMALIZED_BASE_PATH = RAW_BASE_PATH === "/" ? "" : RAW_BASE_PATH.endsWith("/") ? RAW_BASE_PATH.slice(0, -1) : RAW_BASE_PATH
const PUBLIC_BASE_PREFIX = NORMALIZED_BASE_PATH.length > 0 ? `${NORMALIZED_BASE_PATH}/` : "/"

function buildPublicPath(path: string) {
  const sanitized = path.replace(/^\/+/, "")
  return `${PUBLIC_BASE_PREFIX}${sanitized}`
}

function resolveAssetUrl(path: string | null) {
  if (!path) return null
  if (/^(?:https?:|data:|blob:)/i.test(path) || path.startsWith("//")) return path
  return buildPublicPath(path)
}

const BONECOS_IMAGE = buildPublicPath("bonecos_rg.png")

function extractTenantIdFromPath() {
  if (typeof window === "undefined") return null
  const match = window.location.pathname.match(/tenant\/(\d+)/)
  return match?.[1] ?? null
}

export default function TenantConfigPanel() {
  const [, navigate] = useLocation()
  const { toast } = useToast()

  const [tenantId] = useState<string | null>(() => extractTenantIdFromPath())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const hasLoaded = useRef(false)

  const [nomeExibicao, setNomeExibicao] = useState("")
  const [subtitulo, setSubtitulo] = useState(DEFAULT_SUBTITLE)
  const [telefone, setTelefone] = useState("")
  const [corPrincipal, setCorPrincipal] = useState("#166534")
  const [corBotaoAgendar, setCorBotaoAgendar] = useState("#00A859")
  const [corBotaoConsultar, setCorBotaoConsultar] = useState("#1E40AF")
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [fundoPreview, setFundoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [fundoFile, setFundoFile] = useState<File | null>(null)

  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const fundoInputRef = useRef<HTMLInputElement | null>(null)

  const resolvedLogoPreview = resolveAssetUrl(logoPreview)
  const resolvedFundoPreview = resolveAssetUrl(fundoPreview)

  useEffect(() => {
    if (!tenantId || hasLoaded.current) {
      if (!tenantId) setLoading(false)
      return
    }

    async function fetchConfig() {
      try {
        const response = await fetch(`/api/tenants/${tenantId}/config-details`)
        if (!response.ok) throw new Error("Erro ao buscar configuração")
        const data: TenantConfigResponse = await response.json()
        setNomeExibicao(data.nome_exibicao || data.name || "")
        setSubtitulo(data.subtitulo || DEFAULT_SUBTITLE)
        setTelefone(data.telefone_contato || "")
        setCorPrincipal(data.cor_principal || "#166534")
        setCorBotaoAgendar(data.cor_botao_agendar || "#00A859")
        setCorBotaoConsultar(data.cor_botao_consultar || "#1E40AF")
        setLogoPreview(data.url_logo || null)
        setFundoPreview(data.url_fundo || null)
      } catch (error) {
        console.error(error)
        toast({
          variant: "destructive",
          title: "Erro ao carregar",
          description: "Não foi possível carregar as configurações visuais."
        })
      } finally {
        hasLoaded.current = true
        setLoading(false)
      }
    }

    void fetchConfig()
  }, [tenantId, toast])

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview)
      if (fundoPreview?.startsWith("blob:")) URL.revokeObjectURL(fundoPreview)
    }
  }, [logoPreview, fundoPreview])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: "logo" | "fundo") => {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    if (type === "logo") {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview)
      setLogoFile(file)
      setLogoPreview(previewUrl)
    } else {
      if (fundoPreview?.startsWith("blob:")) URL.revokeObjectURL(fundoPreview)
      setFundoFile(file)
      setFundoPreview(previewUrl)
    }
  }

  const handleSave = async () => {
    if (!tenantId) return
    setSaving(true)

    try {
      const formData = new FormData()
      formData.append("nome_exibicao", nomeExibicao)
      formData.append("subtitulo", subtitulo)
      formData.append("telefone_contato", telefone)
      formData.append("cor_principal", corPrincipal)
      formData.append("cor_botao_agendar", corBotaoAgendar)
      formData.append("cor_botao_consultar", corBotaoConsultar)
      if (logoFile) formData.append("logo", logoFile)
      if (fundoFile) formData.append("fundo", fundoFile)

      const response = await fetch(`/api/tenants/${tenantId}/config`, {
        method: "PUT",
        body: formData
      })

      if (!response.ok) throw new Error("Falha ao salvar")

      toast({
        title: "Sucesso",
        description: "Identidade visual atualizada."
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não conseguimos salvar suas alterações."
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 px-4 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-full border border-slate-200 bg-white p-3 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Identidade Visual</h1>
              <p className="text-sm text-slate-500">Editando Tenant #{tenantId ?? "--"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !tenantId}
            className="hidden items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold uppercase text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Salvando" : "Salvar Tudo"}
          </button>
        </div>

        <div className="grid gap-10 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-4">
            <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Palette className="h-5 w-5 text-emerald-600" /> Personalização
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Nome Principal</label>
                  <input
                    value={nomeExibicao}
                    onChange={(e) => setNomeExibicao(e.target.value)}
                    placeholder="PREFEITURA DE..."
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 font-semibold text-slate-800 outline-none ring-0 transition focus:border-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Subtítulo / Serviço</label>
                  <textarea
                    value={subtitulo}
                    rows={3}
                    onChange={(e) => setSubtitulo(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-4 border-t border-slate-100 pt-5">
                  <ColorInput label="Cor do Título" value={corPrincipal} onChange={setCorPrincipal} />
                  <ColorInput label="Botão Agendar" value={corBotaoAgendar} onChange={setCorBotaoAgendar} />
                  <ColorInput label="Botão Consultar" value={corBotaoConsultar} onChange={setCorBotaoConsultar} />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Upload className="h-5 w-5 text-sky-600" /> Imagens e Contato
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">WhatsApp / Suporte</label>
                  <input
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ThumbUploader
                    label="Brasão"
                    preview={resolvedLogoPreview}
                    onClick={() => logoInputRef.current?.click()}
                  />
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={(e) => handleFileChange(e, "logo")}
                    accept="image/*"
                    className="hidden"
                  />
                  <ThumbUploader
                    label="Fundo"
                    preview={resolvedFundoPreview}
                    tall
                    onClick={() => fundoInputRef.current?.click()}
                  />
                  <input
                    type="file"
                    ref={fundoInputRef}
                    onChange={(e) => handleFileChange(e, "fundo")}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </section>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !tenantId}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-center font-semibold uppercase text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
            >
              {saving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Salvar Tudo"}
            </button>
          </div>

          <div className="xl:col-span-8">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Pré-visualização</div>
            <div className="mt-3 relative w-full overflow-hidden rounded-[32px] border-[8px] border-slate-900/80 bg-slate-200 shadow-2xl">
              {resolvedFundoPreview ? (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${resolvedFundoPreview}')` }} />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-400" />
              )}
              <div className="absolute inset-0 bg-white/15 backdrop-blur-[1px]" />

              <div className="relative z-10 flex min-h-[520px] flex-col gap-10 px-8 py-10 md:flex-row md:items-center md:justify-between">
                <div className="order-2 flex w-full flex-col items-start text-left md:order-1 md:w-1/2">
                  <div className="mb-8 h-40 w-full max-w-xs">
                    {resolvedLogoPreview ? (
                      <img src={resolvedLogoPreview} alt="Logo preview" className="h-full w-auto drop-shadow-2xl" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-40 items-center justify-center rounded-full border-2 border-dashed border-white/80 bg-white/30 text-xs font-semibold text-slate-600">
                        LOGO
                      </div>
                    )}
                  </div>
                  <h3
                    className="mb-4 text-4xl font-black uppercase leading-tight drop-shadow"
                    style={{ color: corPrincipal, textShadow: "2px 2px 0px #fff" }}
                  >
                    {nomeExibicao || "PREFEITURA DE ..."}
                  </h3>
                  <p className="mb-6 rounded-lg bg-white/60 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-600">
                    {subtitulo}
                  </p>
                  <div className="w-full max-w-sm space-y-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-lg font-bold uppercase text-white shadow-xl ring-2 ring-white/40"
                      style={{ backgroundColor: corBotaoAgendar }}
                    >
                      <Calendar size={20} /> Agendar
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-lg font-bold uppercase text-white shadow-xl ring-2 ring-white/40"
                      style={{ backgroundColor: corBotaoConsultar }}
                    >
                      <Search size={20} /> Consultar
                    </button>
                  </div>
                  <div className="mt-8 flex flex-col items-start gap-2">
                    <span className="rounded-md bg-white/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-500 shadow-sm">
                      PRECISA DE AJUDA?
                    </span>
                    <div className="flex items-center gap-3 rounded-full bg-white/90 px-6 py-2 text-base font-black text-gray-900 shadow-xl backdrop-blur-md">
                      <Phone size={20} style={{ color: corPrincipal }} />
                      <span>{telefone || "(00) 00000-0000"}</span>
                    </div>
                  </div>
                </div>
                <div className="order-1 flex w-full items-center justify-center md:order-2 md:w-1/2">
                  <img
                    src={BONECOS_IMAGE}
                    alt="Bonecos RG"
                    className="h-auto w-full max-w-[420px] object-contain drop-shadow-2xl"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden"
                    }}
                  />
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-20 text-center">
                <p className="inline-block rounded-full bg-white/40 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500/80 backdrop-blur-sm shadow-sm">
                  Desenvolvido por <span className="font-black text-gray-900">JEOS</span> - SISTEMAS E GOVERNO
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ColorInput({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const handleHexChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.trim().replace(/[^0-9a-fA-F]/g, "")
    const normalized = rawValue.replace(/^#+/, "").slice(0, 6)
    onChange(`#${normalized.padEnd(6, "0")}`)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
        <input
          value={value}
          onChange={handleHexChange}
          className="mt-1 w-32 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-mono uppercase text-slate-700 outline-none focus:border-emerald-500"
        />
      </div>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-16 w-16 cursor-pointer rounded-2xl border border-slate-200 bg-transparent p-0"
      />
    </div>
  )
}

function ThumbUploader({
  label,
  preview,
  tall = false,
  onClick
}: {
  label: string
  preview: string | null
  tall?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-32 w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400 transition hover:border-emerald-400 ${tall ? "overflow-hidden" : ""}`}
    >
      {preview ? (
        <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <span>{label}</span>
      )}
    </button>
  )
}
