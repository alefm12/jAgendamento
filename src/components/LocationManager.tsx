import { useCallback, useEffect, useState } from 'react'
import { useConfirm } from '@/components/ConfirmDialog'
import axios, { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MapPin, Trash, Plus, MapTrifold } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { LocationMapDialog } from '@/components/LocationMapDialog'
import type { Location } from '@/lib/types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const buildTenantHeaders = () => {
  const tenantId = localStorage.getItem('tenantId')
  const tenantSlug = localStorage.getItem('tenantSlug')

  if (tenantId) {
    return { 'x-tenant-id': tenantId }
  }

  if (tenantSlug) {
    return { 'x-prefeitura-slug': tenantSlug }
  }

  return { 'x-tenant-id': '1' }
}

type ApiLocation = Omit<Location, 'id'> & { id: string | number }

const normalizeLocation = (location: ApiLocation): Location => ({
  ...location,
  id: String(location.id),
  address: location.address || '',
  googleMapsUrl: location.googleMapsUrl || undefined,
  isActive: location.isActive ?? true,
  createdAt: location.createdAt || new Date().toISOString()
})

const getErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | string | undefined
    if (typeof data === 'string') {
      return data
    }
    if (data?.message) {
      return data.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Não foi possível comunicar com a API de locais'
}

interface LocationManagerProps {
  locations?: Location[]
  onAddLocation?: (location: Omit<Location, 'id' | 'createdAt'>) => Promise<void>
  onUpdateLocation?: (id: string, location: Omit<Location, 'id' | 'createdAt'>) => Promise<void>
  onDeleteLocation?: (id: string) => Promise<void>
}

export function LocationManager(_legacyProps: LocationManagerProps = {}) {
  const { confirm, ConfirmDialogNode } = useConfirm()
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [showMapDialog, setShowMapDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    googleMapsUrl: '',
    isActive: true
  })

  const fetchLocations = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await axios.get<ApiLocation[]>(`${API_BASE_URL}/locais-atendimento`, {
        headers: buildTenantHeaders()
      })
      const normalized = (response.data || []).map(normalizeLocation)
      setLocations(normalized)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Informe o nome do local de atendimento')
      return
    }

    if (!formData.address.trim()) {
      toast.error('Informe o endereço completo')
      return
    }

    if (isSaving) return

    setIsSaving(true)
    try {
      const payload = {
        nome: formData.name.trim(),
        endereco: formData.address.trim(),
        ativo: formData.isActive,
        linkMapa: formData.googleMapsUrl.trim() || null
      }

      await axios.post<ApiLocation>(`${API_BASE_URL}/locais-atendimento`, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...buildTenantHeaders()
        }
      })

      setFormData({
        name: '',
        address: '',
        googleMapsUrl: '',
        isActive: true
      })
      setIsAdding(false)
      toast.success('Local de atendimento cadastrado com sucesso!')
      await fetchLocations()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (location: Location) => {
    const ok = await confirm({
      title: 'Excluir local',
      description: `Deseja excluir o local "${location.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      variant: 'danger'
    })
    if (!ok) return

    const locationId = Number(location.id)
    if (Number.isNaN(locationId)) {
      toast.error('Identificador do local inválido')
      return
    }

    setDeletingId(location.id)
    try {
      await axios.delete(`${API_BASE_URL}/locais-atendimento/${locationId}`, {
        headers: buildTenantHeaders()
      })
      toast.success('Local removido com sucesso')
      await fetchLocations()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {ConfirmDialogNode}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Locais de Atendimento</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre os endereços oficiais e inclua o link do Google Maps para facilitar o acesso
          </p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="button-glow gap-2">
            <Plus size={16} />
            Nova Localidade
          </Button>
        )}
      </div>

      {isAdding && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Nova Localidade</CardTitle>
            <CardDescription>Cadastre um novo endereço oficial de atendimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Nome da Localidade *</Label>
              <Input
                id="location-name"
                placeholder="Ex: Central de Atendimento, Unidade Bairro Azul"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-address">Endereço completo *</Label>
              <Input
                id="location-address"
                placeholder="Rua, número, bairro, cidade"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-maps">Link do Google Maps (iframe ou URL)</Label>
              <Input
                id="location-maps"
                placeholder="https://maps.google.com/... ou cole o código iframe"
                value={formData.googleMapsUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, googleMapsUrl: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <Label className="text-sm font-semibold">Local ativo</Label>
                <p className="text-xs text-muted-foreground">Desative temporariamente para ocultar no agendamento público</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsAdding(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} className="button-glow flex-1" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && (
          <Card className="border-dashed animate-pulse">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Carregando localidades cadastradas...
            </CardContent>
          </Card>
        )}

        {!isLoading && locations?.map((location) => (
          <Card key={location.id} className="card-float">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-primary" weight="duotone" />
                  <div>
                    <CardTitle className="text-base">{location.name}</CardTitle>
                    <CardDescription>{location.address}</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deletingId === location.id}
                  onClick={() => handleDelete(location)}
                >
                  <Trash size={16} className="text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {location.googleMapsUrl ? (
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedLocation(location)
                    setShowMapDialog(true)
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-green-300 text-green-700 hover:bg-green-50"
                >
                  <MapTrifold size={16} weight="duotone" />
                  Ver no Mapa
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs italic">Sem localização no mapa</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <LocationMapDialog
        location={selectedLocation}
        open={showMapDialog}
        onOpenChange={setShowMapDialog}
      />

      {locations?.length === 0 && !isAdding && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhuma localidade cadastrada</p>
            <Button onClick={() => setIsAdding(true)} className="gap-2">
              <Plus size={16} />
              Cadastrar Primeira Localidade
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
