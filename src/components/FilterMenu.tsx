import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Funnel, X } from '@phosphor-icons/react'
import type { Location } from '@/lib/types'

interface FilterMenuProps {
  locations: Location[]
  neighborhoods: string[]
  onFilterChange: (filters: FilterState) => void
  currentFilters: FilterState
}

export interface FilterState {
  locationId: string
  neighborhood: string
  month: string
  year: string
  status: string
  priority: string
  dateFrom: string
  dateTo: string
  searchCPF: string
  searchProtocol: string
  rgType: string
}

export function FilterMenu({ locations, neighborhoods, onFilterChange, currentFilters }: FilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ]

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...currentFilters, [key]: value })
  }

  const handleClearFilters = () => {
    onFilterChange({ 
      locationId: 'all', 
      neighborhood: 'all', 
      month: 'all', 
      year: 'all',
      status: 'all',
      priority: 'all',
      dateFrom: '',
      dateTo: '',
      searchCPF: '',
      searchProtocol: '',
      rgType: 'all'
    })
  }

  const hasActiveFilters = (currentFilters.locationId && currentFilters.locationId !== 'all') || 
    (currentFilters.neighborhood && currentFilters.neighborhood !== 'all') || 
    (currentFilters.month && currentFilters.month !== 'all') || 
    (currentFilters.year && currentFilters.year !== 'all') || 
    (currentFilters.status && currentFilters.status !== 'all') || 
    (currentFilters.priority && currentFilters.priority !== 'all') || 
    currentFilters.dateFrom || 
    currentFilters.dateTo || 
    currentFilters.searchCPF || 
    currentFilters.searchProtocol || 
    (currentFilters.rgType && currentFilters.rgType !== 'all')

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)} className="gap-2">
        <Funnel size={18} />
        Filtros Avançados
        {hasActiveFilters && (
          <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
            Ativos
          </span>
        )}
      </Button>
    )
  }

  return (
    <Card className="border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Funnel size={20} weight="duotone" />
              Filtros Avançados
            </CardTitle>
            <CardDescription>Filtre agendamentos por localidade, bairro e período</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X size={18} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Local de Atendimento</label>
            <Select value={currentFilters.locationId} onValueChange={(v) => handleFilterChange('locationId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os locais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os locais</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bairro</label>
            <Select value={currentFilters.neighborhood} onValueChange={(v) => handleFilterChange('neighborhood', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os bairros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bairros</SelectItem>
                {neighborhoods.map((neighborhood) => (
                  <SelectItem key={neighborhood} value={neighborhood}>
                    {neighborhood}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={currentFilters.status} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="awaiting-issuance">Aguardando Emissão</SelectItem>
                <SelectItem value="cin-ready">CIN Pronta</SelectItem>
                <SelectItem value="cin-delivered">CIN Entregue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Prioridade</label>
            <Select value={currentFilters.priority} onValueChange={(v) => handleFilterChange('priority', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mês</label>
            <Select value={currentFilters.month} onValueChange={(v) => handleFilterChange('month', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ano</label>
            <Select value={currentFilters.year} onValueChange={(v) => handleFilterChange('year', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os anos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de CIN</label>
            <Select value={currentFilters.rgType} onValueChange={(v) => handleFilterChange('rgType', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="1ª via">1ª via</SelectItem>
                <SelectItem value="2ª via">2ª via</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Inicial</label>
            <Input
              type="date"
              value={currentFilters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Final</label>
            <Input
              type="date"
              value={currentFilters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm text-muted-foreground">Filtros ativos aplicados</p>
            <Button variant="outline" size="sm" onClick={handleClearFilters} className="gap-2">
              <X size={16} />
              Limpar Filtros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
