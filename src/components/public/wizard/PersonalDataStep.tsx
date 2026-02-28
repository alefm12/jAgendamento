import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { PersonalInfoForm } from '@/components/PersonalInfoForm'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Bell } from '@phosphor-icons/react'
import type { Location, CustomField, LGPDConsent as LGPDConsentType } from '@/lib/types'

interface AddressLocalityOption {
  id: number
  nome: string
}

interface AddressNeighborhood {
  id: number
  nome: string
  localidadeId?: number | null
  parentType?: 'Sede' | 'Distrito'
}

interface AddressOptions {
  headquarters: AddressLocalityOption[]
  districts: AddressLocalityOption[]
  neighborhoods: AddressNeighborhood[]
}

interface PersonalDataStepProps {
  formData: {
    fullName: string
    cpf: string
    rg: string
    phone: string
    email: string
    locationId: string
    street: string
    number: string
    neighborhood: string
    rgType: string
    regionType: string
    sedeId: string
    districtId: string
    neighborhoodId: string
    [key: string]: string
  }
  onChange: (field: string, value: string) => void
  locations: Location[]
  customFields?: CustomField[]
  onBack: () => void
  onSubmit: () => void
  canSubmit: boolean
  isSubmitting?: boolean
  emailError?: string | null
  requiresLgpdConsent?: boolean
  lgpdConsent?: LGPDConsentType | null
  notificationConsentChecked?: boolean
  onNotificationConsentChange?: (checked: boolean) => void
  onOpenLgpdModal?: () => void
  tenantSlug?: string
  onCpfBlur?: (cpf: string) => void
  hasPendingAppointment?: boolean
  pendingAppointmentInfo?: { protocolo: string; data: string; hora: string } | null
}

export function PersonalDataStep({
  formData,
  onChange,
  locations,
  customFields,
  onBack,
  onSubmit,
  canSubmit,
  isSubmitting,
  emailError,
  requiresLgpdConsent,
  lgpdConsent,
  notificationConsentChecked,
  onNotificationConsentChange,
  onOpenLgpdModal,
  tenantSlug,
  onCpfBlur,
  hasPendingAppointment,
  pendingAppointmentInfo
}: PersonalDataStepProps) {
  const showLgpdConsent = !!requiresLgpdConsent
  const notificationsChecked = !!notificationConsentChecked
  const [addressOptions, setAddressOptions] = useState<AddressOptions | null>(null)
  const [addressOptionsLoading, setAddressOptionsLoading] = useState(false)
  const [addressOptionsError, setAddressOptionsError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const loadAddressOptions = async () => {
      setAddressOptionsLoading(true)
      setAddressOptionsError(null)
      try {
        const headers: Record<string, string> = {}
        if (typeof window !== 'undefined') {
          const storedTenantId = localStorage.getItem('tenantId')
          const storedTenantSlug = tenantSlug || localStorage.getItem('tenantSlug')
          if (storedTenantId) {
            headers['x-tenant-id'] = storedTenantId
          } else if (storedTenantSlug) {
            headers['x-prefeitura-slug'] = storedTenantSlug
          }
        } else if (tenantSlug) {
          headers['x-prefeitura-slug'] = tenantSlug
        }
        const response = await fetch('/api/public/address-options', {
          signal: controller.signal,
          headers
        })
        if (!response.ok) {
          throw new Error(`Falha ao carregar catálogo (${response.status})`)
        }
        const payload = await response.json()
        if (!isMounted) return
        const headquarters: AddressLocalityOption[] = (payload.sedes || payload.headquarters || []).map((item: any) => ({
          id: item.id,
          nome: item.nome || item.name || ''
        }))
        const districts: AddressLocalityOption[] = (payload.distritos || payload.districts || []).map((item: any) => ({
          id: item.id,
          nome: item.nome || item.name || ''
        }))
        const neighborhoods: AddressNeighborhood[] = (payload.bairros || payload.neighborhoods || []).map((item: any) => {
          const rawParentId = item.localidadeId ?? item.localidade_id ?? item.distritoId ?? item.districtId ?? item.parent_id ?? null
          const normalizedParentId = rawParentId === undefined ? null : rawParentId
          const parentIsSede = Boolean(
            item.isSede ??
              item.is_sede ??
              item.parentType === 'Sede' ??
              (normalizedParentId !== null && headquarters.some((hq) => hq.id === normalizedParentId))
          )
          return {
            id: item.id,
            nome: item.nome || item.name || '',
            localidadeId: normalizedParentId,
            parentType: parentIsSede ? 'Sede' : 'Distrito'
          }
        })

        const normalized: AddressOptions = {
          headquarters,
          districts,
          neighborhoods
        }
        setAddressOptions(normalized)
      } catch (error) {
        if (!isMounted) {
          return
        }
        const err = error as Error
        if (err?.name === 'AbortError') {
          return
        }
        console.error('[PersonalDataStep] Erro ao buscar regiões', error)
        setAddressOptionsError('Não foi possível carregar o catálogo de regiões. Tente novamente mais tarde.')
        setAddressOptions(null)
      } finally {
        if (isMounted) {
          setAddressOptionsLoading(false)
        }
      }
    }

    loadAddressOptions()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [tenantSlug])

  const [, setLocation] = useLocation()

  return (
    <div className="space-y-6">
      {/* Mensagem quando CPF tem agendamento pendente */}
      {hasPendingAppointment && pendingAppointmentInfo && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900 mb-2">
                Você já possui um agendamento pendente
              </h3>
              <div className="space-y-2 mb-4">
                <p className="text-amber-800">
                  <span className="font-semibold">Protocolo:</span> {pendingAppointmentInfo.protocolo}
                </p>
                {pendingAppointmentInfo.data && (
                  <p className="text-amber-800">
                    <span className="font-semibold">Data/Hora:</span>{' '}
                    {new Date(pendingAppointmentInfo.data).toLocaleDateString('pt-BR')} às {pendingAppointmentInfo.hora}
                  </p>
                )}
              </div>
              <p className="text-amber-900 mb-4">
                Para realizar um novo agendamento, você precisa cancelar o agendamento pendente atual. Por favor, vá na aba "CONSULTAR AGENDAMENTO" e realize o cancelamento.
              </p>
              <Button
                onClick={() => {
                  const targetPath = tenantSlug ? `/${tenantSlug}/consultar` : '/consultar'
                  setLocation(targetPath)
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md transition-all"
              >
                Ir para Consultar Agendamento
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Formulário - oculto quando tem agendamento pendente */}
      {!hasPendingAppointment && (
        <>
          <PersonalInfoForm
            formData={formData}
            onChange={onChange}
            locations={locations}
            customFields={customFields}
            emailError={emailError}
            addressOptions={addressOptions || undefined}
            addressOptionsLoading={addressOptionsLoading}
            addressOptionsError={addressOptionsError}
            onCpfBlur={onCpfBlur}
          />
      {showLgpdConsent && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Checkbox
              id="lgpd-toggle"
              checked={!!lgpdConsent?.dataUsageAccepted}
              onCheckedChange={() => onOpenLgpdModal?.()}
            />
            <Label htmlFor="lgpd-toggle" className="cursor-pointer space-y-1" onClick={onOpenLgpdModal}>
              <span className="flex items-center gap-2 font-semibold text-gray-900">
                <ShieldCheck size={18} className="text-primary" weight="duotone" />
                Li e concordo com os termos da LGPD
              </span>
              <span className="text-sm text-muted-foreground">
                Clique para ler o conteúdo completo e registrar seu consentimento.
              </span>
            </Label>
          </div>

          <button
            type="button"
            className="h-11 w-full rounded-xl border border-dashed border-primary/40 text-sm font-semibold text-primary transition hover:bg-primary/5"
            onClick={onOpenLgpdModal}
          >
            Ler termos completos
          </button>

          {lgpdConsent && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Consentimento registrado em {new Date(lgpdConsent.consentDate).toLocaleString('pt-BR')} —
              notificações {lgpdConsent.notificationAccepted ? 'autorizadas' : 'não autorizadas'}.
            </div>
          )}
        </div>
      )}

      {showLgpdConsent && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Checkbox
              id="notification-toggle"
              checked={notificationsChecked}
              onCheckedChange={(checked) => onNotificationConsentChange?.(Boolean(checked))}
            />
            <Label htmlFor="notification-toggle" className="cursor-pointer space-y-1">
              <span className="flex items-center gap-2 font-semibold text-gray-900">
                <Bell size={18} className="text-primary" weight="duotone" />
                Aceito receber notificações (opcional)
              </span>
              <span className="text-sm text-muted-foreground">
                Receba atualizações sobre o status do agendamento, lembretes e alertas de CIN pronto para retirada
                por email e WhatsApp.
              </span>
            </Label>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row">
        <Button variant="outline" onClick={onBack} className="h-12 flex-1 text-base" disabled={isSubmitting}>
          ← Voltar
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit || isSubmitting} className="h-12 flex-1 text-base font-semibold">
          {isSubmitting ? 'Enviando...' : 'Confirmar Agendamento →'}
        </Button>
      </div>
        </>
      )}
    </div>
  )
}
