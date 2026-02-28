import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowsClockwise } from '@phosphor-icons/react'
import type { AppointmentPriority } from '@/lib/types'
import { api } from '@/lib/api'

interface TenantCallEntry {
  announcementId?: string
  id: string
  nome: string
  cpf?: string
  data: string | null
  hora: string | null
  status?: string | null
  prioridade?: AppointmentPriority
  local?: string | null
  sala?: string | null
  guiche?: string | null
  slug?: string | null
}

interface TenantCallResponse {
  slug: string
  nome: string
  logoUrl?: string | null
  primaryColor?: string | null
  chamadasConfig?: {
    vozTipo?: string | null
    vozIdioma?: string | null
    vozGenero?: string | null
    vozVelocidade?: number | null
    vozVolume?: number | null
    templateChamada?: string | null
    corFundoChamada?: string | null
    corTextoChamada?: string | null
    corDestaqueChamada?: string | null
  }
  atualizadoEm?: string
  proximoAtendimento?: TenantCallEntry | null
  chamadas: TenantCallEntry[]
}

interface PublicTenantConfigResponse {
  nome?: string
  logo?: string | null
  cores?: { principal?: string | null }
}

interface ChamadaPageProps {
  tenantSlug?: string
}

const CALL_HISTORY_STORAGE_KEY = 'callAnnouncementsHistory'

type PersistedCallAnnouncement = {
  payload: TenantCallEntry
  emittedAt: number
}

const readPersistedCallHistory = (slug?: string): TenantCallEntry[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CALL_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedCallAnnouncement[]
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item && item.payload)
      .filter((item) => !slug || !item.payload.slug || item.payload.slug === slug)
      .sort((a, b) => Number(b.emittedAt || 0) - Number(a.emittedAt || 0))
      .map((item) => item.payload)
  } catch {
    return []
  }
}

const persistCallInHistory = (payload: TenantCallEntry) => {
  if (typeof window === 'undefined') return
  try {
    const now = Date.now()
    const raw = localStorage.getItem(CALL_HISTORY_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as PersistedCallAnnouncement[]) : []
    const safe = Array.isArray(parsed) ? parsed : []

    const next: PersistedCallAnnouncement[] = [
      { payload, emittedAt: now },
      ...safe.filter((entry) => {
        const sameAnnouncement =
          payload.announcementId && entry?.payload?.announcementId
            ? entry.payload.announcementId === payload.announcementId
            : false
        const sameComposite =
          entry?.payload?.id === payload.id &&
          String(entry?.payload?.sala || '') === String(payload.sala || '') &&
          String(entry?.payload?.guiche || '') === String(payload.guiche || '')
        return !sameAnnouncement && !sameComposite
      }),
    ].slice(0, 40)

    localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // noop
  }
}

const PRIORITY_LABELS: Record<AppointmentPriority, string> = {
  urgent: 'URGENTE',
  high: 'ALTA',
  normal: 'NORMAL',
}

const resolveAssetUrl = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  return `/${trimmed.replace(/^\/+/, '').replace(/\\/g, '/')}`
}

const hexToRgba = (hex: string, alpha: number) => {
  const value = String(hex || '').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return `rgba(15, 23, 42, ${alpha})`
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const resolveVoiceProfile = (voiceType: string) => {
  const normalized = String(voiceType || 'padrao').toLowerCase()
  if (normalized === 'padrao') {
    return { providerHints: [], rateBoost: 0, pitchBoost: 0 }
  }
  const isAzure = normalized.includes('azure')
  const isAws = normalized.includes('aws')
  const providerHints = isAzure
    ? ['microsoft', 'azure', 'zira', 'david']
    : isAws
    ? ['amazon', 'aws', 'polly']
    : ['google', 'gtts']

  const providerRateBoost = isAzure ? -0.12 : isAws ? -0.03 : 0.06
  const providerPitchBoost = isAzure ? -0.1 : isAws ? -0.03 : 0.1

  if (normalized.includes('jovem')) return { providerHints, rateBoost: providerRateBoost + 0.1, pitchBoost: providerPitchBoost + 0.2 }
  if (normalized.includes('orador')) return { providerHints, rateBoost: providerRateBoost - 0.05, pitchBoost: providerPitchBoost - 0.1 }
  if (normalized.includes('animada')) return { providerHints, rateBoost: providerRateBoost + 0.15, pitchBoost: providerPitchBoost + 0.25 }
  if (normalized.includes('formal')) return { providerHints, rateBoost: providerRateBoost - 0.08, pitchBoost: providerPitchBoost - 0.05 }
  return { providerHints, rateBoost: providerRateBoost, pitchBoost: providerPitchBoost }
}

const selectBestVoice = (
  voices: SpeechSynthesisVoice[],
  voiceType: string,
  voiceGender: string,
  voiceLanguage: string,
) => {
  const { providerHints } = resolveVoiceProfile(voiceType)
  const normalizedGender = String(voiceGender || 'feminino').toLowerCase()
  const langBase = String(voiceLanguage || 'pt-BR').toLowerCase().split('-')[0]

  const femininePatterns = /(female|feminina|woman|mulher|maria|helena|clara|luciana|brenda|sofia|camila)/i
  const masculinePatterns = /(male|masculino|man|homem|joa[oõ]|paulo|ricardo|carlos|mateus|daniel)/i

  const byLanguage = voices.filter((voice) => {
    const lang = String(voice.lang || '').toLowerCase()
    return lang.startsWith(langBase)
  })
  const preferredPool = byLanguage.length ? byLanguage : voices

  const byProvider = preferredPool.filter((voice) =>
    providerHints.some((hint) => String(voice.name || '').toLowerCase().includes(hint)),
  )
  const providerPool = byProvider.length ? byProvider : preferredPool

  const byFemale = preferredPool.filter((voice) => femininePatterns.test(String(voice.name || '')))
  const byMale = preferredPool.filter((voice) => masculinePatterns.test(String(voice.name || '')))

  const scoreVoice = (voice: SpeechSynthesisVoice) => {
    const name = String(voice.name || '')
    let score = 0
    if (providerHints.some((hint) => String(name).toLowerCase().includes(hint))) score += 2
    if (normalizedGender === 'feminino') {
      if (femininePatterns.test(name)) score += 6
      if (masculinePatterns.test(name)) score -= 5
    }
    if (normalizedGender === 'masculino') {
      if (masculinePatterns.test(name)) score += 6
      if (femininePatterns.test(name)) score -= 5
    }
    return score
  }

  const ranked = [...preferredPool].sort((a, b) => scoreVoice(b) - scoreVoice(a))

  if (normalizedGender === 'feminino') {
    return byFemale[0] || ranked[0] || providerPool.find((voice) => !masculinePatterns.test(String(voice.name || ''))) || providerPool[0] || voices[0]
  }
  if (normalizedGender === 'masculino') {
    return byMale[0] || ranked[0] || providerPool.find((voice) => !femininePatterns.test(String(voice.name || ''))) || providerPool[0] || voices[0]
  }

  return providerPool[0] || voices[0]
}

const buildAnnouncementMessage = (template: string | null | undefined, entry: TenantCallEntry) => {
  const fallbackTemplate = '{NOME DO CIDADAO} comparecer a Sala {numero da sala} guiche {numero do guiche}'
  let messageTemplate = String(template || '').trim() || fallbackTemplate

  const citizenName = String(entry.nome || '').trim() || 'CIDADÃO'
  const roomNumber = String(entry.sala || '').trim() || '--'
  const deskNumber = String(entry.guiche || '').trim()

  if (!deskNumber) {
    messageTemplate = messageTemplate
      .replace(/\s*,?\s*guich[eê]\s*\{\s*numero\s+do\s+guiche\s*\}/gi, '')
      .replace(/\s*,?\s*guich[eê]\s*\{\s*guiche\s*\}/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  return messageTemplate
    .replace(/\{\s*NOME\s+DO\s+CIDADAO\s*\}/gi, citizenName)
    .replace(/\{\s*name\s*\}/gi, citizenName)
    .replace(/\{\s*numero\s+da\s+sala\s*\}/gi, roomNumber)
    .replace(/\{\s*sala\s*\}/gi, roomNumber)
    .replace(/\{\s*numero\s+do\s+guiche\s*\}/gi, deskNumber)
    .replace(/\{\s*guiche\s*\}/gi, deskNumber)
    .replace(/\{\s*protocol\s*\}/gi, entry.id)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const playBellTrindon = () => {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) return

  const audioContext = new AudioCtx()
  const now = audioContext.currentTime
  const notes = [784, 988, 1319]

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, now)
    gain.gain.setValueAtTime(0.0001, now)

    const start = now + index * 0.14
    const attack = start + 0.02
    const end = start + 0.18

    gain.gain.exponentialRampToValueAtTime(0.22, attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(start)
    oscillator.stop(end)
  })
}

export default function ChamadaPage({ tenantSlug }: ChamadaPageProps) {
  const [branding, setBranding] = useState<{
    name: string
    logoUrl: string | null
    primaryColor: string
    callsConfig: {
      vozTipo: string
      vozIdioma: string
      vozGenero: string
      vozVelocidade: number
      vozVolume: number
      templateChamada: string
      corFundoChamada: string
      corTextoChamada: string
      corDestaqueChamada: string
    }
  } | null>(null)
  const [currentCall, setCurrentCall] = useState<TenantCallEntry | null>(null)
  const [history, setHistory] = useState<TenantCallEntry[]>([])
  const [isLoadingBrand, setIsLoadingBrand] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const currentCallRef = useRef<TenantCallEntry | null>(null)
  const lastAnnouncementRef = useRef<string | null>(null)
  const lastLiveUpdateAtRef = useRef<number>(0)

  useEffect(() => {
    currentCallRef.current = currentCall
  }, [currentCall])

  useEffect(() => {
    if (!tenantSlug) {
      setError('Prefeitura não encontrada.')
      return
    }

    const fetchBrand = async () => {
      const fetchStartedAt = Date.now()
      setIsLoadingBrand(true)
      setError(null)
      try {
        const [callResp, configResp] = await Promise.all([
          api.get<TenantCallResponse>(`/public/tenant/${tenantSlug}/chamadas`, {
            skipAuthHeaders: true,
          }),
          api
            .get<PublicTenantConfigResponse>(`/public/config/${tenantSlug}`, {
              skipAuthHeaders: true,
            })
            .catch(() => null),
        ])

        const resolvedLogo =
          resolveAssetUrl(callResp.logoUrl) ?? resolveAssetUrl(configResp?.logo) ?? null

        setBranding({
          name: configResp?.nome ?? callResp.nome,
          logoUrl: resolvedLogo,
          primaryColor:
            callResp.primaryColor ?? configResp?.cores?.principal ?? '#059669',
          callsConfig: {
            vozTipo: 'padrao',
            vozIdioma: String(callResp.chamadasConfig?.vozIdioma || 'pt-BR'),
            vozGenero: String(callResp.chamadasConfig?.vozGenero || 'feminino'),
            vozVelocidade: Number(callResp.chamadasConfig?.vozVelocidade ?? 1),
            vozVolume: Number(callResp.chamadasConfig?.vozVolume ?? 1),
            templateChamada: String(callResp.chamadasConfig?.templateChamada || 'Chamando {name}. Sala {sala}.'),
            corFundoChamada: String(callResp.chamadasConfig?.corFundoChamada || '#ffffff'),
            corTextoChamada: String(callResp.chamadasConfig?.corTextoChamada || '#0f172a'),
            corDestaqueChamada: String(
              callResp.chamadasConfig?.corDestaqueChamada ||
                callResp.primaryColor ||
                configResp?.cores?.principal ||
                '#059669'
            ),
          },
        })

        const shouldApplyInitialData = lastLiveUpdateAtRef.current <= fetchStartedAt
        if (shouldApplyInitialData) {
          const persistedCalls = readPersistedCallHistory(tenantSlug)
          const initialCall = persistedCalls[0] ?? null
          setCurrentCall(initialCall)
          const onlyCalledHistory = persistedCalls
            .filter((c) => !initialCall || c.id !== initialCall.id || c.announcementId !== initialCall.announcementId)
            .slice(0, 3)
          setHistory(onlyCalledHistory)
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar os dados.',
        )
      } finally {
        setIsLoadingBrand(false)
      }
    }

    void fetchBrand()
  }, [tenantSlug, refreshIndex])

  const speakAnnouncement = useCallback((entry: TenantCallEntry) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const callsConfig = branding?.callsConfig
    const voiceType = String(callsConfig?.vozTipo || 'padrao').toLowerCase()
    const voiceGender = String(callsConfig?.vozGenero || 'feminino').toLowerCase()
    const voiceLanguage = String(callsConfig?.vozIdioma || 'pt-BR')

    const msg = buildAnnouncementMessage(callsConfig?.templateChamada, entry)

    const speakNow = () => {
      const allVoices = window.speechSynthesis.getVoices()
      const profile = resolveVoiceProfile(voiceType)
      const selectedVoice = selectBestVoice(allVoices, voiceType, voiceGender, voiceLanguage)

      window.speechSynthesis.cancel()
      playBellTrindon()
      const utterance = new SpeechSynthesisUtterance(msg)
      utterance.lang = voiceLanguage
      utterance.rate = Math.max(0.5, Math.min(2, Number(callsConfig?.vozVelocidade ?? 1) + profile.rateBoost))
      const basePitch = voiceGender === 'feminino' ? 1.3 : 0.65
      utterance.pitch = Math.max(0.1, Math.min(2, basePitch + profile.pitchBoost))
      utterance.volume = Number(callsConfig?.vozVolume ?? 1)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }
      window.setTimeout(() => {
        window.speechSynthesis.speak(utterance)
      }, 460)
    }

    if (!window.speechSynthesis.getVoices().length) {
      const originalHandler = window.speechSynthesis.onvoiceschanged
      window.speechSynthesis.onvoiceschanged = () => {
        speakNow()
        window.speechSynthesis.onvoiceschanged = originalHandler
      }
      return
    }

    speakNow()
  }, [branding])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined')
      return
    const channel = new BroadcastChannel('call-announcements')
    channelRef.current = channel

    const applyPayload = (payload: TenantCallEntry) => {
      const dedupeKey = String(payload.announcementId || `${payload.id}-${payload.sala || ''}-${payload.guiche || ''}`)
      if (lastAnnouncementRef.current === dedupeKey) {
        return
      }
      lastAnnouncementRef.current = dedupeKey
      lastLiveUpdateAtRef.current = Date.now()
      persistCallInHistory(payload)

      const prev = currentCallRef.current
      setHistory((h) => {
        if (prev && prev.nome.toLowerCase() === payload.nome.toLowerCase())
          return h
        const withoutNew = h.filter((e) => e.id !== payload.id)
        const updated = prev ? [prev, ...withoutNew] : withoutNew
        return updated.slice(0, 3)
      })

      setError(null)
      setIsLoadingBrand(false)
      setBranding((b) =>
        b ?? {
          name: tenantSlug?.toUpperCase() ?? 'PREFEITURA',
          logoUrl: null,
          primaryColor: '#059669',
          callsConfig: {
            vozTipo: 'padrao',
            vozIdioma: 'pt-BR',
            vozGenero: 'feminino',
            vozVelocidade: 1,
            vozVolume: 1,
            templateChamada: '{NOME DO CIDADAO} comparecer a Sala {numero da sala} guiche {numero do guiche}',
            corFundoChamada: '#ffffff',
            corTextoChamada: '#0f172a',
            corDestaqueChamada: '#059669',
          },
        },
      )
      setCurrentCall(payload)
      speakAnnouncement(payload)
    }

    channel.onmessage = (event) => {
      if (event.data?.type !== 'CALL_TRIGGERED') return
      const payload = event.data.payload as TenantCallEntry
      if (tenantSlug && payload.slug && payload.slug !== tenantSlug) return
      applyPayload(payload)
    }

    try {
      const raw = localStorage.getItem('latestCallAnnouncement')
      if (raw) {
        const parsed = JSON.parse(raw) as { type?: string; payload?: TenantCallEntry; emittedAt?: number }
        if (parsed?.type === 'CALL_TRIGGERED' && parsed.payload) {
          const payload = parsed.payload
          const emittedAt = Number(parsed.emittedAt || 0)
          const isRecent = emittedAt > 0 && Date.now() - emittedAt < 10 * 60 * 1000
          if (isRecent && (!tenantSlug || !payload.slug || payload.slug === tenantSlug)) {
            applyPayload(payload)
          }
        }
      }
    } catch (error) {
      console.warn('[ChamadaPage] Falha ao ler latestCallAnnouncement', error)
    }

    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [speakAnnouncement, tenantSlug])

  const brandColor = branding?.primaryColor ?? '#059669'
  const backgroundColor = branding?.callsConfig?.corFundoChamada ?? '#ffffff'
  const textColor = branding?.callsConfig?.corTextoChamada ?? '#0f172a'
  const lineColor = branding?.callsConfig?.corDestaqueChamada ?? brandColor
  const borderColor = hexToRgba(lineColor, 0.28)
  const historyBgA = hexToRgba(backgroundColor, 0.95)
  const historyBgB = hexToRgba(backgroundColor, 0.84)
  const historicCalls = history.slice(0, 3)

  if (!tenantSlug) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-3xl font-semibold text-slate-600">
        Slug do município não informado.
      </div>
    )
  }

  /* ── Layout principal: grid com 4 linhas de altura fixa ─────────────────── */
  return (
    <div
      className="w-screen overflow-hidden"
      style={{
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: '14vh 54vh 9vh 23vh',
        backgroundColor,
        color: textColor,
      }}
    >
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between overflow-hidden"
        style={{ backgroundColor: lineColor, padding: '0 4vw' }}
      >
        <h1
          className="font-black tracking-[0.15em] leading-none"
          style={{ color: textColor, fontSize: 'clamp(1.2rem, 3.5vw, 3rem)' }}
        >
          PRÓXIMO ATENDIMENTO
        </h1>

        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="h-[92%] w-auto max-w-[560px] object-contain"
            draggable={false}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <span
            className="font-bold tracking-wider"
            style={{ color: textColor, opacity: 0.9, fontSize: 'clamp(1rem, 2.4vw, 1.9rem)' }}
          >
            {branding?.name ?? tenantSlug?.toUpperCase() ?? ''}
          </span>
        )}
      </header>

      {/* ── Conteúdo principal ────────────────────────────────────────────── */}
      <main
        className="overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: '7fr 1.2fr 3.8fr',
          padding: '2.5vh 4vw',
          gap: '0 2vw',
          backgroundColor,
        }}
      >
        {isLoadingBrand && (
          <div
            className="col-span-3 flex items-center justify-center"
            style={{ color: textColor, opacity: 0.7, fontSize: 'clamp(1.4rem, 2.8vw, 2.4rem)' }}
          >
            Carregando painel...
          </div>
        )}

        {!isLoadingBrand && error && (
          <div className="col-span-3 flex flex-col items-center justify-center gap-6 text-center" style={{ color: textColor }}>
            <p style={{ fontSize: 'clamp(1.2rem, 2.5vw, 2rem)' }} className="font-semibold">
              Não foi possível carregar as chamadas.
            </p>
            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.6rem)', opacity: 0.8 }}>
              {error}
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-full font-semibold"
              style={{
                backgroundColor: lineColor,
                color: textColor,
                padding: '1.2vh 3vw',
                fontSize: 'clamp(0.9rem, 1.8vw, 1.5rem)',
              }}
              onClick={() => setRefreshIndex((v) => v + 1)}
            >
              <ArrowsClockwise size={24} /> Tentar novamente
            </button>
          </div>
        )}

        {!isLoadingBrand && !error && !currentCall && (
          <div
            className="col-span-3 flex items-center justify-center font-semibold"
            style={{ color: textColor, opacity: 0.7, fontSize: 'clamp(1.4rem, 2.8vw, 2.4rem)' }}
          >
            Nenhum atendimento disponível.
          </div>
        )}

        {!isLoadingBrand && !error && currentCall && (
          <>
            {/* Coluna esquerda: nome + prioridade */}
            <div className="flex flex-col justify-center overflow-hidden">
              <p
                className="font-semibold"
                style={{ color: textColor, opacity: 0.7, fontSize: 'clamp(0.85rem, 1.8vw, 1.5rem)' }}
              >
                NOME
              </p>
              <p
                className="font-black"
                style={{
                  color: textColor,
                  fontSize: 'clamp(1.7rem, 4.2vw, 3.8rem)',
                  lineHeight: 1.05,
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {currentCall.nome}
              </p>

              <p
                className="font-semibold"
                style={{
                  color: textColor,
                  opacity: 0.7,
                  fontSize: 'clamp(0.75rem, 1.5vw, 1.3rem)',
                  marginTop: '2vh',
                }}
              >
                PRIORIDADE
              </p>
              <p
                className="font-black"
                style={{ color: textColor, fontSize: 'clamp(1.3rem, 2.8vw, 2.5rem)' }}
              >
                {PRIORITY_LABELS[(currentCall.prioridade ?? 'normal') as AppointmentPriority] ?? 'NORMAL'}
              </p>
            </div>

            {/* Coluna central: seta */}
            <div className="flex items-center justify-center">
              <ArrowRight
                weight="fill"
                color={lineColor}
                style={{ width: 'clamp(40px, 6vw, 90px)', height: 'clamp(40px, 6vw, 90px)' }}
              />
            </div>

            {/* Coluna direita: sala */}
            <div className="flex flex-col items-center justify-center overflow-hidden">
              <p
                className="font-semibold tracking-[0.2em]"
                style={{ color: textColor, fontSize: 'clamp(1.3rem, 2.5vw, 2.2rem)' }}
              >
                SALA
              </p>
              <p
                className="font-black leading-none"
                style={{ color: textColor, fontSize: 'clamp(5rem, 13vw, 10rem)' }}
              >
                {currentCall.sala ?? '--'}
              </p>
              {currentCall.guiche && (
                <p
                  className="font-semibold"
                  style={{ color: textColor, opacity: 0.8, fontSize: 'clamp(0.9rem, 2vw, 1.8rem)' }}
                >
                  GUICHÊ {currentCall.guiche}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Banda do histórico ────────────────────────────────────────────── */}
      <div
        className="flex items-center overflow-hidden"
        style={{ backgroundColor: lineColor, padding: '0 4vw' }}
      >
        <p
          className="font-black tracking-[0.25em]"
          style={{ color: textColor, fontSize: 'clamp(0.9rem, 2.4vw, 2rem)' }}
        >
          HISTÓRICO DE CHAMADAS
        </p>
      </div>

      {/* ── Lista do histórico ────────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden">
        {historicCalls.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center font-semibold"
            style={{ color: textColor, opacity: 0.7, fontSize: 'clamp(1rem, 2vw, 1.7rem)' }}
          >
            Sem registros recentes
          </div>
        ) : (
          historicCalls.map((call, idx) => (
            <div
              key={call.id}
              className="flex flex-1 items-center justify-between overflow-hidden border-t"
              style={{
                borderColor,
                backgroundColor: idx % 2 === 0 ? historyBgA : historyBgB,
                padding: '0 4vw',
                minHeight: 0,
              }}
            >
              <span
                className="font-black truncate pr-4"
                style={{ color: textColor, fontSize: 'clamp(0.9rem, 2vw, 1.7rem)' }}
              >
                {call.nome}
              </span>
              <span
                className="font-bold shrink-0"
                style={{ color: textColor, opacity: 0.82, fontSize: 'clamp(0.85rem, 1.8vw, 1.5rem)' }}
              >
                SALA {call.sala ?? '--'}
                {call.guiche ? ` • GUICHÊ ${call.guiche}` : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
