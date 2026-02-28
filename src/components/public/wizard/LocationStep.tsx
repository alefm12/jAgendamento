import { useEffect, useMemo, useState } from 'react'
import { MapPin, CheckCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { Location } from '@/lib/types'
import { useRoute } from 'wouter'

interface LocationStepProps {
  locations: Location[]
  selectedLocationId?: string
  onSelect: (locationId: string) => void
  onLocationsLoaded?: (locations: Location[]) => void
  onContinue?: () => void
  autoAdvance?: boolean
  tenantSlug?: string
}

export function LocationStep({
  locations,
  selectedLocationId,
  onSelect,
  onLocationsLoaded,
  onContinue,
  autoAdvance,
  tenantSlug
}: LocationStepProps) {
  const [locationOptions, setLocationOptions] = useState<Location[]>(locations)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matched, params] = useRoute('/:tenantSlug/:rest*')
  const slugFromRoute = matched ? params?.tenantSlug : undefined
  const resolvedSlug = useMemo(() => tenantSlug ?? slugFromRoute, [tenantSlug, slugFromRoute])

  useEffect(() => {
    setLocationOptions(locations)
  }, [locations])

  useEffect(() => {
    let isMounted = true

    const loadLocations = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Sempre usar a rota padrão /api/locais-atendimento
        const endpoint = '/api/locais-atendimento'
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error(`Falha ao carregar locais (${response.status})`)
        }
        const data: Location[] = await response.json()
        if (!isMounted) return
        setLocationOptions(data)
        onLocationsLoaded?.(data)
      } catch (fetchError) {
        if (!isMounted) return
        console.error('[LocationStep] Erro ao buscar locais', fetchError)
        setError('Não foi possível carregar os locais de atendimento.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadLocations()

    return () => {
      isMounted = false
    }
  }, [onLocationsLoaded, resolvedSlug])

  const activeLocations = locationOptions.filter((location) => location.isActive !== false)

  if (isLoading && activeLocations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-primary">
        <p className="font-semibold">Carregando locais de atendimento...</p>
        <p className="text-sm opacity-80">Aguarde um instante enquanto buscamos as opções disponíveis.</p>
      </div>
    )
  }

  if (activeLocations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-400 bg-amber-50 p-6 text-amber-900">
        <p className="font-semibold">Nenhum local disponível.</p>
        <p className="text-sm opacity-80">
          Retorne mais tarde ou contate a secretaria para liberar novos endereços de atendimento.
        </p>
        {error && <p className="mt-2 text-xs font-medium text-amber-700">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Passo 1</p>
        <h2 className="text-2xl font-semibold text-foreground">Escolha o Local de Atendimento</h2>
        <p className="text-sm text-muted-foreground">
          As próximas etapas serão liberadas após selecionar um local disponível.
        </p>
        {error && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Não foi possível atualizar a lista automaticamente ({error})
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {activeLocations.map((location) => {
          const isSelected = selectedLocationId === location.id

          return (
            <motion.button
              key={location.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onSelect(location.id)
                if (autoAdvance) {
                  onContinue?.()
                }
              }}
              className={`relative h-full rounded-2xl border p-5 text-left transition-shadow ${
                isSelected
                  ? 'border-primary shadow-lg shadow-primary/20'
                  : 'border-border hover:border-primary/40 hover:shadow-md'
              }`}
              aria-pressed={isSelected}
              disabled={isLoading}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <MapPin size={20} weight="duotone" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-lg font-semibold text-foreground">{location.name}</p>
                  <p className="text-sm text-muted-foreground">{location.address}</p>
                  {location.city && (
                    <p className="text-xs text-muted-foreground/80">{location.city}</p>
                  )}
                </div>
                {isSelected && (
                  <CheckCircle className="text-primary" size={24} weight="fill" aria-label="Selecionado" />
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      {!autoAdvance && (
        <div className="flex justify-end">
          <Button
            size="lg"
            className="min-w-[200px]"
            disabled={!selectedLocationId}
            onClick={() => onContinue?.()}
          >
            Continuar
          </Button>
        </div>
      )}
    </div>
  )
}
