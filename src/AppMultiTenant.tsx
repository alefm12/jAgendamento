import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Router, Route, Switch, useLocation } from 'wouter'
import { Toaster, toast } from 'sonner'
import App from './App'
import { NovoAgendamento } from '@/components/public/NovoAgendamento'
import PublicHome from '@/components/public/PublicHome'
import { ConsultationStatus } from '@/components/public/ConsultationStatus'
import { SuperAdminLogin } from '@/components/SuperAdminLogin'
import { SuperAdminPanel } from '@/components/SuperAdminPanel'
import { TenantUserManagement } from '@/components/TenantUserManagement'
import TenantConfig from '@/pages/super-admin/TenantConfig'
import ChamadaPage from '@/pages/ChamadaPage'
import RelatorioImpressao from '@/pages/RelatorioImpressao'
import { AylaButton } from '@/components/ayla/AylaButton'
import type {
  Appointment,
  BlockedDate,
  Location,
  SystemConfig,
  Tenant,
  SuperAdmin,
  SecretaryUser
} from '@/lib/types'
import { tenantService } from '@/lib/tenants-service'
import { usersService } from '@/lib/users-service'
import { api } from '@/lib/api'

const DEFAULT_WORKING_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

const DEFAULT_MAX_APPOINTMENTS_PER_SLOT = 2

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  systemName: 'Agendamento CIN',
  primaryColor: 'oklch(0.45 0.15 145)',
  secondaryColor: 'oklch(0.65 0.1 180)',
  accentColor: 'oklch(0.55 0.18 145)'
}

const TENANT_CONFIG_ID_PREFIX = 'tenant-config:'
const TENANT_CONFIG_SLUG_PREFIX = 'tenant-config-slug:'

const readConfigFromStorage = (key: string) => {
  if (typeof window === 'undefined') return undefined
  const raw = window.localStorage.getItem(key)
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as SystemConfig
  } catch (error) {
    console.warn('[tenant-config] Invalid JSON in storage', error)
    return undefined
  }
}

const storeConfigInStorage = (tenantId: string, slug: string, config: SystemConfig) => {
  if (typeof window === 'undefined') return
  const serialized = JSON.stringify(config)
  window.localStorage.setItem(`${TENANT_CONFIG_ID_PREFIX}${tenantId}`, serialized)
  window.localStorage.setItem(`${TENANT_CONFIG_SLUG_PREFIX}${slug}`, serialized)
}

const removeConfigFromStorage = (tenantId: string, slug: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(`${TENANT_CONFIG_ID_PREFIX}${tenantId}`)
  window.localStorage.removeItem(`${TENANT_CONFIG_SLUG_PREFIX}${slug}`)
}

const hydrateTenantConfig = (tenant: Tenant): Tenant => {
  const storedConfig =
    readConfigFromStorage(`${TENANT_CONFIG_ID_PREFIX}${tenant.id}`) ||
    readConfigFromStorage(`${TENANT_CONFIG_SLUG_PREFIX}${tenant.slug}`)
  return storedConfig ? { ...tenant, config: storedConfig } : tenant
}

const setTenantContext = (tenantId?: string, slug?: string) => {
  if (typeof window === 'undefined') return
  if (tenantId) {
    window.localStorage.setItem('tenantId', tenantId)
  }
  if (slug) {
    window.localStorage.setItem('tenantSlug', slug)
  }
}

export default function MultiTenantApp() {
  return (
    <Router>
      <Switch>
        <Route path="/admin/tenant/:id/config">
          <TenantConfig />
        </Route>
        <Route path="/admin">
          <SecretaryPortal />
        </Route>
        <Route path="/:tenantSlug/admin">
          {(params) => <SecretaryPortal tenantSlug={params.tenantSlug} />}
        </Route>
        <Route path="/:tenantSlug/agendar">
          {(params) => <PublicPortal tenantSlug={params.tenantSlug} />}
        </Route>
        <Route path="/:tenantSlug/consultar">
          {(params) => <ConsultPortal tenantSlug={params.tenantSlug} />}
        </Route>
        <Route path="/:tenantSlug/chamada">
          {(params) => <ChamadaPage tenantSlug={params.tenantSlug} />}
        </Route>
        <Route path="/:tenantSlug/relatorio">
          <RelatorioImpressao />
        </Route>
        <Route path="/agendar">
          <PublicPortal />
        </Route>
        <Route path="/consultar">
          <ConsultPortal />
        </Route>
        <Route path="/:tenantSlug">
          {(params) => <TenantPublicScheduler tenantSlug={params.tenantSlug} />}
        </Route>
        <Route path="/">
          <SuperAdminShell />
        </Route>
        <Route>
          <NotFoundScreen />
        </Route>
      </Switch>
      <Toaster position="top-center" richColors />
    </Router>
  )
}

function SuperAdminShell() {
  const [, navigate] = useLocation()
  const [currentAdmin, setCurrentAdmin] = useState<SuperAdmin | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoadingTenants, setIsLoadingTenants] = useState(false)
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [view, setView] = useState<'panel' | 'users'>('panel')
  const [tenantUsers, setTenantUsers] = useState<SecretaryUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  const activeTenant = useMemo(() => tenants.find((tenant) => tenant.id === activeTenantId) ?? null, [activeTenantId, tenants])

  const loadTenants = useCallback(async () => {
    setIsLoadingTenants(true)
    try {
      const response = await tenantService.list()
      const enriched = response.map(hydrateTenantConfig)
      setTenants(enriched)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar prefeituras'
      toast.error(message)
    } finally {
      setIsLoadingTenants(false)
    }
  }, [])

  const loadTenantUsers = useCallback(async (tenantId: string) => {
    setIsLoadingUsers(true)
    try {
      const users = await usersService.getUsers({ tenantId })
      setTenantUsers(users)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar usuários da secretaria'
      toast.error(message)
      setTenantUsers([])
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  const handleAddTenant = useCallback(async (payload: Omit<Tenant, 'id' | 'createdAt'>) => {
    try {
      const created = await tenantService.create(payload)
      const hydrated = hydrateTenantConfig(created)
      setTenants((prev) => [...prev, { ...hydrated, createdBy: payload.createdBy || hydrated.createdBy }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar prefeitura'
      toast.error(message)
      throw error
    }
  }, [])

  const handleTenantUpdate = useCallback(async (tenantId: string, updates: Partial<Tenant>) => {
    const { config, ...serverUpdates } = updates
    try {
      let updatedFromServer: Tenant | undefined
      if (Object.keys(serverUpdates).length > 0) {
        updatedFromServer = await tenantService.update(tenantId, serverUpdates)
      }

      setTenants((prev) =>
        prev.map((tenant) => {
          if (tenant.id !== tenantId) return tenant
          const baseTenant = updatedFromServer ? hydrateTenantConfig(updatedFromServer) : tenant
          const mergedTenant: Tenant = { ...tenant, ...baseTenant }
          if (config) {
            mergedTenant.config = config
            storeConfigInStorage(tenant.id, tenant.slug, config)
          }
          return mergedTenant
        })
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar prefeitura'
      toast.error(message)
      throw error
    }
  }, [])

  const handleDeleteTenant = useCallback(async (tenantId: string) => {
    const tenantToRemove = tenants.find((tenant) => tenant.id === tenantId)
    try {
      await tenantService.remove(tenantId)
      setTenants((prev) => prev.filter((tenant) => tenant.id !== tenantId))
      if (tenantToRemove) {
        removeConfigFromStorage(tenantToRemove.id, tenantToRemove.slug)
      }
      if (activeTenantId === tenantId) {
        setActiveTenantId(null)
        setView('panel')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover prefeitura'
      toast.error(message)
      throw error
    }
  }, [activeTenantId, tenants])

  const handleManageUsers = useCallback(
    async (tenant: Tenant) => {
      setActiveTenantId(tenant.id)
      setView('users')
      await loadTenantUsers(tenant.id)
    },
    [loadTenantUsers]
  )

  const handleCreateTenantUser = useCallback(
    async (userData: Omit<SecretaryUser, 'id' | 'createdAt'>) => {
      if (!activeTenant) throw new Error('Prefeitura não selecionada')
      await usersService.createUser({ ...userData, password: userData.password || '123456' }, { tenantId: activeTenant.id })
      await loadTenantUsers(activeTenant.id)
    },
    [activeTenant, loadTenantUsers]
  )

  const handleUpdateTenantUser = useCallback(
    async (userId: string, updates: Partial<SecretaryUser>) => {
      if (!activeTenant) throw new Error('Prefeitura não selecionada')
      await usersService.updateUser(userId, updates, { tenantId: activeTenant.id })
      await loadTenantUsers(activeTenant.id)
    },
    [activeTenant, loadTenantUsers]
  )

  const handleDeleteTenantUser = useCallback(
    async (userId: string) => {
      if (!activeTenant) throw new Error('Prefeitura não selecionada')
      await usersService.deleteUser(userId, { tenantId: activeTenant.id })
      await loadTenantUsers(activeTenant.id)
    },
    [activeTenant, loadTenantUsers]
  )

  useEffect(() => {
    if (currentAdmin) {
      loadTenants()
    }
  }, [currentAdmin, loadTenants])

  if (!currentAdmin) {
    return (
      <SuperAdminLogin
        onLogin={(admin) => {
          setCurrentAdmin(admin)
          setView('panel')
          void loadTenants()
        }}
      />
    )
  }

  if (view === 'users' && activeTenant) {
    if (isLoadingUsers) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-muted-foreground">Carregando usuários...</p>
        </div>
      )
    }

    return (
      <TenantUserManagement
        tenant={activeTenant}
        users={tenantUsers}
        onAddUser={handleCreateTenantUser}
        onUpdateUser={handleUpdateTenantUser}
        onDeleteUser={handleDeleteTenantUser}
        onBack={() => setView('panel')}
      />
    )
  }

  return (
    <SuperAdminPanel
      tenants={tenants}
      isLoadingTenants={isLoadingTenants}
      currentAdmin={currentAdmin}
      onAddTenant={handleAddTenant}
      onUpdateTenant={handleTenantUpdate}
      onDeleteTenant={handleDeleteTenant}
      onSelectTenant={(tenant) => {
        setTenantContext(tenant.id, tenant.slug)
        navigate(`/${tenant.slug}/admin`)
      }}
      onConfigureTenant={(tenant) => {
        setActiveTenantId(tenant.id)
        navigate(`/admin/tenant/${tenant.id}/config`)
      }}
      onManageUsers={handleManageUsers}
      onLogout={() => {
        setCurrentAdmin(null)
        setActiveTenantId(null)
        setTenantUsers([])
        setView('panel')
      }}
    />
  )
}

function TenantPublicScheduler({ tenantSlug }: { tenantSlug: string }) {
  const [appointments, setAppointments] = useState<Appointment[] | undefined>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [blockedDates] = useState<BlockedDate[]>([])
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG)
  const [view, setView] = useState<'home' | 'wizard' | 'consult'>('home')
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [, navigate] = useLocation()

  const hydrateSystemConfig = useCallback((slug: string) => {
    const stored = readConfigFromStorage(`${TENANT_CONFIG_SLUG_PREFIX}${slug}`)
    setSystemConfig(stored || DEFAULT_SYSTEM_CONFIG)
  }, [])

  const loadTenantData = useCallback(async (slug: string) => {
    setIsLoadingData(true)
    setErrorMessage(null)
    try {
      setTenantContext(undefined, slug)
      const [locationsResponse, appointmentsResponse, horariosResponse] = await Promise.all([
        api.get<Location[]>(`/public/locations/${slug}`, { skipAuthHeaders: true }),
        api.get<Appointment[]>('/agendamentos'),
        api.get<{
          workingHours: string[] | null
          maxAppointmentsPerSlot: number
          bookingWindowDays: number
        }>(`/public/horarios/${slug}`, { skipAuthHeaders: true }).catch(() => null)
      ])
      setLocations(locationsResponse)
      setAppointments(appointmentsResponse)

      // Aplica os horários/vagas vindos do servidor sobre o config local
      if (horariosResponse) {
        setSystemConfig(prev => ({
          ...prev,
          ...(horariosResponse.workingHours ? { workingHours: horariosResponse.workingHours } : {}),
          maxAppointmentsPerSlot: horariosResponse.maxAppointmentsPerSlot,
          bookingWindowDays: horariosResponse.bookingWindowDays
        }))
      }

      setHasLoadedData(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar dados deste município'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (!tenantSlug) {
      setErrorMessage('Prefeitura não encontrada')
      return
    }
    hydrateSystemConfig(tenantSlug)
    setTenantContext(undefined, tenantSlug)
  }, [tenantSlug, hydrateSystemConfig])

  useEffect(() => {
    if (view === 'wizard' && tenantSlug && !hasLoadedData) {
      void loadTenantData(tenantSlug)
    }
  }, [view, tenantSlug, hasLoadedData, loadTenantData])

  const requiresLgpdConsent = systemConfig?.lgpdSettings?.enabled !== false

  if (!tenantSlug) {
    return <NotFoundScreen />
  }

  const handleStartSchedule = () => {
    if (tenantSlug) {
      navigate(`/${tenantSlug}/agendar`)
    } else {
      setView('wizard')
    }
  }

  if (view === 'home') {
    return (
      <PublicHome
        tenantSlug={tenantSlug}
        onStartSchedule={handleStartSchedule}
        onConsult={() => setView('consult')}
      />
    )
  }

  if (view === 'consult') {
    return <ConsultationStatus onBack={() => setView('home')} tenantSlug={tenantSlug} />
  }

  if (isLoadingData && !hasLoadedData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">Carregando agenda pública...</p>
      </div>
    )
  }

  if (errorMessage && !hasLoadedData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <p className="text-lg font-semibold text-gray-900 mb-2">Ops!</p>
        <p className="text-muted-foreground mb-6 max-w-md">{errorMessage}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="rounded-lg bg-primary px-5 py-2 font-semibold text-white shadow"
            onClick={() => tenantSlug && loadTenantData(tenantSlug)}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            className="rounded-lg border border-input px-5 py-2 font-semibold text-muted-foreground"
            onClick={() => setView('home')}
          >
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
            onClick={() => setView('home')}
          >
            <span aria-hidden="true">←</span>
            Voltar para o início
          </button>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Prefeitura</p>
            <p className="text-lg font-semibold text-foreground">{systemConfig?.systemName || tenantSlug}</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-black/5">
          <NovoAgendamento
            appointments={appointments}
            setAppointments={setAppointments}
            locations={locations}
            blockedDates={blockedDates}
            systemConfig={systemConfig}
            requiresLgpdConsent={requiresLgpdConsent}
            defaultWorkingHours={systemConfig?.workingHours || DEFAULT_WORKING_HOURS}
            defaultMaxAppointmentsPerSlot={systemConfig?.maxAppointmentsPerSlot || DEFAULT_MAX_APPOINTMENTS_PER_SLOT}
            tenantSlug={tenantSlug}
          />
        </div>
      </div>

      {/* Assistente Virtual Ayla */}
      <AylaButton tenantSlug={tenantSlug} />
    </div>
  )
}

function PublicPortal({ tenantSlug }: { tenantSlug?: string }) {
  useTenantContextSync(tenantSlug)
  return <App initialView="user" />
}

function ConsultPortal({ tenantSlug }: { tenantSlug?: string }) {
  useTenantContextSync(tenantSlug)
  const [, navigate] = useLocation()
  
  const handleBack = () => {
    if (tenantSlug) {
      navigate(`/${tenantSlug}`)
    } else {
      navigate('/')
    }
  }
  
  return <ConsultationStatus onBack={handleBack} tenantSlug={tenantSlug} />
}

function SecretaryPortal({ tenantSlug }: { tenantSlug?: string }) {
  useTenantContextSync(tenantSlug)
  return <App initialView="secretary" />
}

function useTenantContextSync(tenantSlug?: string) {
  const appliedSlugRef = useRef<string | undefined>(undefined)

  if (tenantSlug && appliedSlugRef.current !== tenantSlug) {
    setTenantContext(undefined, tenantSlug)
    appliedSlugRef.current = tenantSlug
  }
}

function NotFoundScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center gap-4">
      <h1 className="text-2xl font-bold text-gray-900">Página não encontrada</h1>
      <p className="text-muted-foreground max-w-md">
        Verifique se a URL está correta ou retorne para a página inicial para escolher uma prefeitura.
      </p>
      <a
        href="/"
        className="rounded-lg bg-primary px-5 py-2 font-semibold text-white shadow"
      >
        Voltar para o início
      </a>
    </div>
  )
}
