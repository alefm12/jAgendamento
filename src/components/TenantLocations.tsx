import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Buildings,
  CaretDown,
  HouseSimple,
  MapPin,
  MapTrifold,
  PencilSimpleLine,
  Plus,
  TrashSimple,
  PlusCircle,
  WarningCircle
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface AddressData {
  id: number
  nome: string
  tipo: 'Sede' | 'Distrito' | 'Bairro' | 'Comunidade'
  vinculo?: string | null
  entityType: 'locality' | 'neighborhood'
  localityId?: number
}

interface ServicePoint {
  id: number
  name: string
  address: string
  isActive: boolean
  googleMapsUrl?: string | null
}

interface Locality {
  id: number
  name: string
}

interface Neighborhood {
  id: number
  name: string
  localityId: number
}

type AddressFormType = 'Sede' | 'Distrito' | 'Bairro'

const TYPE_OPTIONS: Array<{ label: string; value: AddressFormType; icon: ReactNode }> = [
  { label: 'Sede', value: 'Sede', icon: <Buildings size={14} weight="duotone" /> },
  { label: 'Distrito', value: 'Distrito', icon: <MapPin size={14} weight="duotone" /> },
  { label: 'Bairro', value: 'Bairro', icon: <CaretDown size={12} weight="bold" /> }
]

const TYPE_STYLES: Record<string, { label: string; bg: string; text: string; icon: ReactNode }> = {
  Sede: {
    label: 'Região Sede',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    icon: <Buildings size={18} weight="duotone" />
  },
  Distrito: {
    label: 'Distrito',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: <MapTrifold size={18} weight="duotone" />
  },
  Bairro: {
    label: 'Bairro',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    icon: <HouseSimple size={18} weight="duotone" />
  },
  Comunidade: {
    label: 'Comunidade',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    icon: <HouseSimple size={18} weight="duotone" />
  },
  default: {
    label: 'Localidade',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    icon: <MapPin size={18} weight="duotone" />
  }
}

export default function TenantLocations() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addressData, setAddressData] = useState<AddressData[]>([])
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([])
  const [localities, setLocalities] = useState<Locality[]>([])
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [addressSubmitting, setAddressSubmitting] = useState(false)
  const [serviceSubmitting, setServiceSubmitting] = useState(false)
  const [editingAddress, setEditingAddress] = useState<AddressData | null>(null)
  const [editingServicePoint, setEditingServicePoint] = useState<ServicePoint | null>(null)
  const [addressDeleteTarget, setAddressDeleteTarget] = useState<AddressData | null>(null)
  const [serviceDeleteTarget, setServiceDeleteTarget] = useState<ServicePoint | null>(null)
  const [addressDeleting, setAddressDeleting] = useState(false)
  const [serviceDeleting, setServiceDeleting] = useState(false)
  const [addressForm, setAddressForm] = useState({
    type: 'Distrito' as AddressFormType,
    name: '',
    parentId: ''
  })
  const [serviceForm, setServiceForm] = useState({
    name: '',
    address: '',
    googleMapsUrl: '',
    isActive: true
  })
  const [expandedLocalities, setExpandedLocalities] = useState<Record<number, boolean>>({})
  const [restrictToNeighborhood, setRestrictToNeighborhood] = useState(false)
  const [quickParentName, setQuickParentName] = useState('')

  const notifyServiceLocationsUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('service-locations-updated'))
    }
  }

  const notifyLocationDataUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('location-data-updated'))
    }
  }

  const fetchNeighborhoods = useCallback(async (localityList: Locality[]) => {
    if (localityList.length === 0) {
      return []
    }

    const results = await Promise.all(
      localityList.map(async (locality) => {
        try {
          const payload = await api.get<Neighborhood[]>(`/localidades-origem/${locality.id}/bairros`)
          return payload.map((item) => ({
            ...item,
            localityId: item.localityId ?? locality.id
          }))
        } catch (err) {
          console.error('[TenantLocations] Erro ao buscar bairros', err)
          return []
        }
      })
    )

    return results.flat()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [localityResult, serviceResult] = await Promise.allSettled([
        api.get<Locality[]>('/localidades-origem'),
        api.get<
          Array<{ id: number | string; name: string; address: string; isActive: boolean; googleMapsUrl?: string | null }>
        >('/locais-atendimento')
      ])

      const localityPayload = localityResult.status === 'fulfilled' ? localityResult.value : []
      if (localityResult.status === 'rejected') {
        console.warn('[TenantLocations] Falha ao carregar localidades', localityResult.reason)
        setError('Não foi possível carregar as localidades de origem (sedes/distritos). Verifique se as migrações mais recentes foram executadas.')
      } else {
        setError(null)
      }
      setLocalities(localityPayload)

      const neighborhoods = await fetchNeighborhoods(localityPayload)

      const localityNameById = new Map<number, string>(localityPayload.map((item) => [item.id, item.name]))
      const compiledAddresses: AddressData[] = []

      localityPayload.forEach((locality) => {
        const lower = locality.name.toLowerCase()
        const type: AddressData['tipo'] =
          lower.includes('sede') || lower.includes('matriz') ? 'Sede' : 'Distrito'
        compiledAddresses.push({
          id: locality.id,
          nome: locality.name,
          tipo: type,
          entityType: 'locality',
          localityId: locality.id
        })
      })

      neighborhoods.forEach((neighborhood) => {
        compiledAddresses.push({
          id: neighborhood.id,
          nome: neighborhood.name,
          tipo: 'Bairro',
          vinculo: localityNameById.get(neighborhood.localityId) ?? null,
          entityType: 'neighborhood',
          localityId: neighborhood.localityId
        })
      })

      setAddressData(compiledAddresses)

      if (serviceResult.status === 'fulfilled') {
        const servicePayload = serviceResult.value
        setServicePoints(
          servicePayload.map((point) => ({
            id: Number(point.id),
            name: point.name,
            address: point.address,
            isActive: point.isActive,
            googleMapsUrl: point.googleMapsUrl ?? null
          }))
        )
      } else {
        throw serviceResult.reason
      }
    } catch (err) {
      console.error('[TenantLocations] Erro ao buscar dados', err)
      setError('Não foi possível carregar os dados de localidades.')
      setAddressData([])
      setServicePoints([])
    } finally {
      setLoading(false)
    }
  }, [fetchNeighborhoods])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = useMemo(
    () => ({
      sede: addressData.find((item) => item.tipo === 'Sede')?.nome || 'Sede',
      districtCount: addressData.filter((item) => item.tipo === 'Distrito').length,
      neighborhoodCount: addressData.filter((item) => item.tipo === 'Bairro' || item.tipo === 'Comunidade').length
    }),
    [addressData]
  )

  const neighborhoodsByLocality = useMemo(() => {
    return addressData
      .filter((item) => item.entityType === 'neighborhood')
      .reduce<Record<string, AddressData[]>>((acc, neighborhood) => {
        const key = neighborhood.localityId ? String(neighborhood.localityId) : 'unlinked'
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(neighborhood)
        return acc
      }, {})
  }, [addressData])

  const groupedLocalities = useMemo(() => {
    return addressData
      .filter((item) => item.entityType === 'locality')
      .map((locality) => ({
        ...locality,
        neighborhoods: neighborhoodsByLocality[String(locality.id)] ?? []
      }))
  }, [addressData, neighborhoodsByLocality])

  const shouldShowParentSelect = !restrictToNeighborhood && (addressForm.type === 'Bairro' || editingAddress?.entityType === 'neighborhood')

  const parentSelectOptions = useMemo(() => {
    const typeByLocalityId = addressData
      .filter((item) => item.entityType === 'locality')
      .reduce<Record<string, AddressData['tipo']>>((acc, locality) => {
        acc[String(locality.id)] = locality.tipo
        return acc
      }, {})

    const inferType = (name: string): AddressData['tipo'] => {
      const normalized = name.toLowerCase()
      if (normalized.includes('sede')) return 'Sede'
      return 'Distrito'
    }

    return localities.map((locality) => {
      const id = String(locality.id)
      const resolvedType = typeByLocalityId[id] ?? inferType(locality.name)
      return {
        id,
        name: locality.name,
        type: resolvedType
      }
    })
  }, [addressData, localities])

  const orphanNeighborhoods = useMemo(
    () => neighborhoodsByLocality.unlinked ?? [],
    [neighborhoodsByLocality]
  )

  const resolveFormType = (record?: AddressData): AddressFormType => {
    if (!record) {
      return 'Distrito'
    }
    if (record.tipo === 'Sede') {
      return 'Sede'
    }
    if (record.tipo === 'Bairro' || record.tipo === 'Comunidade') {
      return 'Bairro'
    }
    return 'Distrito'
  }

  const resetAddressForm = () => {
    setAddressForm({ type: 'Distrito', name: '', parentId: '' })
    setEditingAddress(null)
    setRestrictToNeighborhood(false)
    setQuickParentName('')
  }

  const resetServiceForm = () => {
    setServiceForm({ name: '', address: '', googleMapsUrl: '', isActive: true })
    setEditingServicePoint(null)
  }

  const toggleLocalitySection = (id: number) => {
    setExpandedLocalities((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleCreateAddress = () => {
    resetAddressForm()
    setAddressDialogOpen(true)
  }

  const handleEditAddress = (record: AddressData) => {
    setEditingAddress(record)
    setAddressForm({
      type: resolveFormType(record),
      name: record.nome,
      parentId: record.entityType === 'neighborhood' && record.localityId ? String(record.localityId) : ''
    })
    setAddressDialogOpen(true)
  }

  const handleDeleteAddress = (record: AddressData) => {
    setAddressDeleteTarget(record)
  }

  const handleQuickAddNeighborhood = (record: AddressData) => {
    const parentId = record.localityId ?? record.id
    if (!parentId) {
      toast.error('Não foi possível identificar a localidade selecionada.')
      return
    }

    const exists = localities.some((locality) => locality.id === parentId)
    if (!exists) {
      setLocalities((prev) => [...prev, { id: parentId, name: record.nome }])
    }

    setEditingAddress(null)
    setAddressForm({
      type: 'Bairro',
      name: '',
      parentId: String(parentId)
    })
    setRestrictToNeighborhood(true)
    setQuickParentName(record.nome)
    setAddressDialogOpen(true)
  }

  const handleCreateServicePoint = () => {
    resetServiceForm()
    setServiceDialogOpen(true)
  }

  const handleEditServicePoint = (point: ServicePoint) => {
    setEditingServicePoint(point)
    setServiceForm({
      name: point.name,
      address: point.address,
      googleMapsUrl: point.googleMapsUrl || '',
      isActive: point.isActive
    })
    setServiceDialogOpen(true)
  }

  const handleDeleteServicePoint = (point: ServicePoint) => {
    setServiceDeleteTarget(point)
  }

  const getDuplicateAddressMessage = () => {
    const trimmedName = addressForm.name.trim()
    if (!trimmedName) {
      return null
    }

    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    const normalizedName = normalize(trimmedName)
    const editingId = editingAddress?.id

    if (addressForm.type === 'Bairro') {
      const duplicateNeighborhood = addressData.find((item) => {
        if (item.entityType !== 'neighborhood') {
          return false
        }
        if (editingId && item.id === editingId) {
          return false
        }
        return normalize(item.nome.trim()) === normalizedName
      })

      if (duplicateNeighborhood) {
        const parent = duplicateNeighborhood.localityId
          ? addressData.find(
              (item) => item.entityType === 'locality' && item.id === duplicateNeighborhood.localityId
            )
          : null

        if (parent) {
          const parentTypeLabel = parent.tipo?.toLowerCase() || 'localidade'
          const article = parent.tipo === 'Distrito' ? 'no' : 'na'
          return `Bairro ${trimmedName.toUpperCase()} já existe ${article} ${parentTypeLabel} ${parent.nome}.`
        }

        if (duplicateNeighborhood.vinculo) {
          return `Bairro ${trimmedName.toUpperCase()} já existe vinculado a ${duplicateNeighborhood.vinculo}.`
        }

        return `Bairro ${trimmedName.toUpperCase()} já existe em uma localidade já cadastrada.`
      }
      return null
    }

    const duplicateLocality = addressData.find((item) => {
      if (item.entityType !== 'locality') {
        return false
      }
      if (item.tipo !== addressForm.type) {
        return false
      }
      if (editingId && item.id === editingId) {
        return false
      }
      return normalize(item.nome.trim()) === normalizedName
    })

    if (duplicateLocality) {
      const label = addressForm.type === 'Sede' ? 'Sede' : 'Distrito'
      return `${label.toUpperCase()} ${trimmedName.toUpperCase()} já existe.`
    }

    return null
  }

  const submitAddressForm = async () => {
    if (!addressForm.name.trim()) {
      toast.error('Informe o nome da localidade ou bairro')
      return
    }

    if (!editingAddress && addressForm.type === 'Bairro' && !addressForm.parentId) {
      toast.error('Selecione a localidade vinculada para o bairro')
      return
    }

    const duplicateMessage = getDuplicateAddressMessage()
    if (duplicateMessage) {
      toast.error(duplicateMessage)
      return
    }

    setAddressSubmitting(true)
    try {
      if (editingAddress) {
        const endpoint =
          editingAddress.entityType === 'neighborhood'
            ? `/bairros/${editingAddress.id}`
            : `/localidades-origem/${editingAddress.id}`

        await api.patch(endpoint, { nome: addressForm.name.trim() })
      } else if (addressForm.type === 'Bairro') {
        const payload = {
          localidadeId: Number(addressForm.parentId),
          nome: addressForm.name.trim()
        }

        await api.post('/bairros', payload)
      } else {
        await api.post('/localidades-origem', { nome: addressForm.name.trim() })
      }

      toast.success(editingAddress ? 'Registro atualizado com sucesso!' : 'Registro salvo com sucesso!')
      setAddressDialogOpen(false)
      resetAddressForm()
      notifyLocationDataUpdated()
      fetchData()
    } catch (err) {
      console.error('[TenantLocations] Erro ao salvar endereço', err)
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o registro')
    } finally {
      setAddressSubmitting(false)
    }
  }

  const submitServiceForm = async () => {
    if (!serviceForm.name.trim()) {
      toast.error('Informe o nome do local de atendimento')
      return
    }
    if (!serviceForm.address.trim()) {
      toast.error('Informe o endereço completo')
      return
    }

    setServiceSubmitting(true)
    try {
      const payload = {
        nome: serviceForm.name.trim(),
        endereco: serviceForm.address.trim(),
        linkMapa: serviceForm.googleMapsUrl.trim() || null,
        ativo: serviceForm.isActive
      }

      const endpoint = editingServicePoint
        ? `/locais-atendimento/${editingServicePoint.id}`
        : '/locais-atendimento'

      if (editingServicePoint) {
        await api.put(endpoint, payload)
      } else {
        await api.post(endpoint, payload)
      }

      toast.success(editingServicePoint ? 'Local atualizado com sucesso!' : 'Local cadastrado com sucesso!')
      setServiceDialogOpen(false)
      resetServiceForm()
      notifyServiceLocationsUpdated()
      notifyLocationDataUpdated()
      fetchData()
    } catch (err) {
      console.error('[TenantLocations] Erro ao salvar local de atendimento', err)
      toast.error(err instanceof Error ? err.message : 'Não foi possível cadastrar o local')
    } finally {
      setServiceSubmitting(false)
    }
  }

  const confirmDeleteAddress = async () => {
    if (!addressDeleteTarget) {
      return
    }

    setAddressDeleting(true)
    try {
      const endpoint =
        addressDeleteTarget.entityType === 'neighborhood'
          ? `/bairros/${addressDeleteTarget.id}`
          : `/localidades-origem/${addressDeleteTarget.id}`

      await api.delete(endpoint)
      toast.success('Registro removido com sucesso!')
      setAddressDeleteTarget(null)
      notifyLocationDataUpdated()
      fetchData()
    } catch (err) {
      console.error('[TenantLocations] Erro ao excluir registro', err)
      toast.error(err instanceof Error ? err.message : 'Falha ao remover o registro')
    } finally {
      setAddressDeleting(false)
    }
  }

  const confirmDeleteServicePoint = async () => {
    if (!serviceDeleteTarget) {
      return
    }

    setServiceDeleting(true)
    try {
      await api.delete(`/locais-atendimento/${serviceDeleteTarget.id}`)
      toast.success('Local removido com sucesso!')
      setServiceDeleteTarget(null)
      notifyServiceLocationsUpdated()
      notifyLocationDataUpdated()
      fetchData()
    } catch (err) {
      console.error('[TenantLocations] Erro ao excluir local', err)
      toast.error(err instanceof Error ? err.message : 'Falha ao remover o local')
    } finally {
      setServiceDeleting(false)
    }
  }

  const renderEmptyState = (message: string) => (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-200/60 bg-gradient-to-br from-white via-white to-emerald-50/70 px-6 py-10 text-center text-sm text-emerald-900">
      <WarningCircle size={32} weight="duotone" className="mb-2 text-emerald-600/80" />
      <span className="max-w-sm text-muted-foreground">{message}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-border/60 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <MapPin size={26} weight="duotone" />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold text-gray-800">Gerenciar Localidades</CardTitle>
              <CardDescription className="text-gray-500">
                Mantenha sedes, distritos e bairros alinhados ao fluxo público de cadastro.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-4 py-1 text-sm text-gray-600">
              {addressData.length + servicePoints.length} registros monitorados
            </Badge>
            <Button
              size="sm"
              onClick={handleCreateAddress}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus size={16} weight="bold" /> Nova localidade
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              <WarningCircle size={16} weight="duotone" />
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Região Sede</p>
                  <p className="mt-2 text-lg font-semibold text-gray-800">{stats.sede?.replace(/\bSede\b/i, '').trim() || stats.sede}</p>
                  <p className="text-xs text-gray-500">Nome exibido no formulário público</p>
                </div>
                <div className="rounded-full bg-white/80 p-2 text-blue-600 shadow-sm">
                  <Buildings size={20} weight="duotone" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-yellow-100 bg-yellow-50 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600">Distritos</p>
                  <p className="mt-2 text-2xl font-bold text-gray-800">{stats.districtCount}</p>
                  <p className="text-xs text-gray-500">Regiões vinculadas ao cadastro</p>
                </div>
                <div className="rounded-full bg-white/80 p-2 text-yellow-600 shadow-sm">
                  <MapTrifold size={20} weight="duotone" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-purple-100 bg-purple-50 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Bairros/Comunidades</p>
                  <p className="mt-2 text-2xl font-bold text-gray-800">{stats.neighborhoodCount}</p>
                  <p className="text-xs text-gray-500">Detalhes adicionais por localidade</p>
                </div>
                <div className="rounded-full bg-white/80 p-2 text-purple-600 shadow-sm">
                  <HouseSimple size={20} weight="duotone" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50">
            {loading ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">Carregando localidades...</div>
            ) : groupedLocalities.length === 0 ? (
              renderEmptyState('Nenhuma localidade cadastrada até o momento.')
            ) : (
              <div className="divide-y divide-slate-100">
                {groupedLocalities.map((locality) => {
                  const isOpen = Boolean(expandedLocalities[locality.id])
                  const style = TYPE_STYLES[locality.tipo] || TYPE_STYLES.default
                  return (
                    <div key={locality.id}>
                      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={`rounded-full p-2.5 ${style.bg} ${style.text}`}>
                            {style.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-gray-800">{locality.nome}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                              <span>{style.label}</span>
                              <span aria-hidden="true">•</span>
                              <span>
                                {locality.neighborhoods.length > 0
                                  ? `${locality.neighborhoods.length} bairros vinculados`
                                  : 'Ainda sem bairros associados'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {locality.neighborhoods.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-gray-500 hover:text-gray-800"
                              onClick={() => toggleLocalitySection(locality.id)}
                            >
                              <CaretDown
                                size={18}
                                weight="bold"
                                className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:text-emerald-600"
                            title="Cadastrar bairros/comunidades"
                            onClick={() => handleQuickAddNeighborhood(locality)}
                          >
                            <PlusCircle size={18} weight="duotone" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:text-gray-800"
                            onClick={() => handleEditAddress(locality)}
                          >
                            <PencilSimpleLine size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:text-red-600"
                            onClick={() => handleDeleteAddress(locality)}
                          >
                            <TrashSimple size={16} />
                          </Button>
                        </div>
                      </div>

                      {isOpen && locality.neighborhoods.length > 0 && (
                        <div className="bg-white/70">
                          {locality.neighborhoods.map((bairro) => (
                            <div
                              key={bairro.id}
                              className="flex items-center justify-between border-t border-slate-100 px-8 py-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="rounded-full bg-purple-100 p-2 text-purple-600">
                                  <HouseSimple size={16} weight="duotone" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{bairro.nome}</p>
                                  <p className="text-xs text-gray-500">Vinculado a {locality.nome}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-gray-500 hover:text-gray-800"
                                  onClick={() => handleEditAddress(bairro)}
                                >
                                  <PencilSimpleLine size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-gray-500 hover:text-red-600"
                                  onClick={() => handleDeleteAddress(bairro)}
                                >
                                  <TrashSimple size={14} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {orphanNeighborhoods.length > 0 && !loading && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Existem {orphanNeighborhoods.length} bairros sem vínculo definido. Associe-os a uma localidade para aparecerem no formulário público.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border/60 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
              <Buildings size={24} weight="duotone" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-800">Locais de Atendimento</CardTitle>
              <CardDescription className="text-gray-500">
                Pontos presenciais onde os cidadãos comparecem para finalizar serviços.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full px-4 py-1 text-sm text-gray-600">
              {servicePoints.length} locais
            </Badge>
            <Button
              size="sm"
              onClick={handleCreateServicePoint}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus size={16} weight="bold" /> Novo local
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">Carregando locais de atendimento...</div>
          ) : servicePoints.length === 0 ? (
            renderEmptyState('Nenhum local de atendimento cadastrado no momento.')
          ) : (
            <div className="divide-y divide-slate-100">
              {servicePoints.map((point) => (
                <div key={point.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-full p-2.5 ${
                        point.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      <MapPin size={18} weight="duotone" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{point.name}</p>
                      <p className="text-sm text-gray-500">{point.address}</p>
                      {point.googleMapsUrl && (
                        <Button
                          variant="link"
                          className="px-0 text-xs text-emerald-600"
                          onClick={() => window.open(point.googleMapsUrl || undefined, '_blank')}
                        >
                          Ver no mapa
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        point.isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {point.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-gray-800"
                        onClick={() => handleEditServicePoint(point)}
                      >
                        <PencilSimpleLine size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-red-600"
                        onClick={() => handleDeleteServicePoint(point)}
                      >
                        <TrashSimple size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addressDialogOpen} onOpenChange={(open) => {
        setAddressDialogOpen(open)
        if (!open) {
          resetAddressForm()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Editar registro' : 'Novo registro'}</DialogTitle>
            <DialogDescription>
              {editingAddress
                ? 'Atualize o nome exibido no formulário público.'
                : restrictToNeighborhood
                  ? 'Cadastre rapidamente um bairro/comunidade vinculado à região selecionada.'
                  : 'Adicione uma nova região, distrito ou bairro para o formulário público.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!restrictToNeighborhood && (
              <div className="space-y-2">
                <Label className="flex items-center justify-between text-sm font-semibold text-foreground">
                  Tipo de localidade
                  <span className="text-xs font-normal text-muted-foreground">Selecione antes de preencher o endereço</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      disabled={Boolean(editingAddress)}
                      variant={addressForm.type === option.value ? 'default' : 'outline'}
                      className="flex-1 min-w-[100px] justify-center gap-1.5 rounded-full"
                      onClick={() => setAddressForm((prev) => ({ ...prev, type: option.value }))}
                    >
                      {option.icon}
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex.: Centro"
                value={addressForm.name}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            {shouldShowParentSelect && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Região/Distrito vinculado</Label>
                <Select
                  value={addressForm.parentId}
                  disabled={Boolean(editingAddress)}
                  onValueChange={(value) => setAddressForm((prev) => ({ ...prev, parentId: value }))}
                >
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue placeholder="Selecione a localidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentSelectOptions.length === 0 && (
                      <SelectItem value="" disabled>
                        Nenhuma localidade cadastrada
                      </SelectItem>
                    )}
                    {parentSelectOptions.map((locality) => (
                      <SelectItem key={locality.id} value={locality.id}>
                        {locality.type === 'Sede' ? 'Sede' : 'Distrito'} • {locality.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Os bairros disponíveis dependem das regiões cadastradas no painel de Localidades. Cadastre a região antes
                  de associar novos bairros.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitAddressForm} disabled={addressSubmitting}>
              {addressSubmitting ? 'Salvando...' : editingAddress ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={serviceDialogOpen} onOpenChange={(open) => {
        setServiceDialogOpen(open)
        if (!open) {
          resetServiceForm()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingServicePoint ? 'Editar local de atendimento' : 'Novo local de atendimento'}</DialogTitle>
            <DialogDescription>
              {editingServicePoint
                ? 'Atualize os dados exibidos para os cidadãos.'
                : 'Cadastre o endereço físico que os cidadãos utilizarão para o atendimento presencial.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do local</Label>
              <Input
                placeholder="Ex.: SIPS - Central"
                value={serviceForm.name}
                onChange={(event) => setServiceForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço completo</Label>
              <Input
                placeholder="Rua, número, bairro, cidade"
                value={serviceForm.address}
                onChange={(event) => setServiceForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Link do Google Maps (opcional)</Label>
              <Input
                placeholder="https://maps.google.com/..."
                value={serviceForm.googleMapsUrl}
                onChange={(event) => setServiceForm((prev) => ({ ...prev, googleMapsUrl: event.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Local ativo</p>
                <p className="text-xs text-muted-foreground">Desative para ocultar temporariamente no formulário público.</p>
              </div>
              <Switch
                checked={serviceForm.isActive}
                onCheckedChange={(checked) => setServiceForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitServiceForm} disabled={serviceSubmitting}>
              {serviceSubmitting ? 'Salvando...' : editingServicePoint ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(addressDeleteTarget)} onOpenChange={(open) => {
        if (!open) {
          setAddressDeleteTarget(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {addressDeleteTarget?.nome}</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação removerá o registro da listagem pública. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={addressDeleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmDeleteAddress}
              disabled={addressDeleting}
              className="gap-2"
            >
              {addressDeleting ? 'Removendo...' : 'Excluir'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(serviceDeleteTarget)} onOpenChange={(open) => {
        if (!open) {
          setServiceDeleteTarget(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {serviceDeleteTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Esse local deixará de aparecer no agendamento público imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={serviceDeleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmDeleteServicePoint}
              disabled={serviceDeleting}
              className="gap-2"
            >
              {serviceDeleting ? 'Removendo...' : 'Excluir'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
