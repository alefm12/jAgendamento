import { useState, useMemo, useRef } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  Package, 
  CheckCircle, 
  User, 
  IdentificationCard,
  Clock,
  MapPin,
  MagnifyingGlass,
  Phone,
  EnvelopeSimple,
  PaperPlaneRight,
  Warning
} from '@phosphor-icons/react'
import type { Appointment, AppointmentStatus, Location, RGDelivery } from '@/lib/types'
import { toast } from 'sonner'
import { DeliveryConfirmation } from '@/components/DeliveryConfirmation'
import { ScrollToTop } from '@/components/ScrollToTop'

interface RGDeliveryQueueProps {
  appointments: Appointment[]
  locations: Location[]
  onMarkAsDelivered: (appointmentId: string, deliveryData: RGDelivery) => void
  onResendNotification?: (appointmentId: string) => Promise<void>
  onStatusChange: (appointmentId: string, status: AppointmentStatus, reason?: string) => void
  currentUserName: string
}

export function RGDeliveryQueue({ 
  appointments, 
  locations,
  onMarkAsDelivered,
  onResendNotification,
  onStatusChange,
  currentUserName
}: RGDeliveryQueueProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationAppointment, setConfirmationAppointment] = useState<Appointment | null>(null)
  const [resendingNotification, setResendingNotification] = useState<string | null>(null)
  const [deliveryForm, setDeliveryForm] = useState({
    receivedByName: '',
    receivedByDocument: '',
    notes: ''
  })
  const [selectedForReady, setSelectedForReady] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false)
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchDetectedAppointments, setBatchDetectedAppointments] = useState<Appointment[]>([])
  const [batchUnmatchedEntries, setBatchUnmatchedEntries] = useState<string[]>([])
  const [batchSourceName, setBatchSourceName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const awaitingIssuance = useMemo(() => {
    return appointments.filter(apt => apt.status === 'awaiting-issuance')
      .sort((a, b) => {
        const dateA = a.completedAt || a.lastModified || a.createdAt
        const dateB = b.completedAt || b.lastModified || b.createdAt
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
  }, [appointments])

  const cinReady = useMemo(() => {
    return appointments.filter(apt => apt.status === 'cin-ready')
      .sort((a, b) => {
        const dateA = a.completedAt || a.lastModified || a.createdAt
        const dateB = b.completedAt || b.lastModified || b.createdAt
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
  }, [appointments])

  const delivered = useMemo(() => {
    return appointments.filter(apt => apt.status === 'cin-delivered')
      .sort((a, b) => {
        const dateA = a.rgDelivery?.deliveredAt || a.createdAt
        const dateB = b.rgDelivery?.deliveredAt || b.createdAt
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
  }, [appointments])

  const locationsById = useMemo(() => {
    const map = new Map<string, string>()
    locations.forEach((location) => {
      map.set(String(location.id).trim(), location.name)
    })
    return map
  }, [locations])

  const resolveAppointmentLocationName = (appointment: Appointment) => {
    const directName = appointment.locationName?.trim()
    if (directName) return directName

    const locationId = String(appointment.locationId || '').trim()
    if (!locationId) return 'Não informado'

    return locationsById.get(locationId) || 'Não informado'
  }

  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

  const matchesSearchQuery = (appointment: Appointment, query: string) => {
    const normalizedQuery = normalizeText(query)
    const queryDigits = normalizedQuery.replace(/\D/g, '')

    const matchesName = normalizeText(appointment.fullName || '').includes(normalizedQuery)
    const matchesProtocol = normalizeText(appointment.protocol || '').includes(normalizedQuery)
    const matchesCpf = queryDigits.length > 0
      ? (appointment.cpf || '').replace(/\D/g, '').includes(queryDigits)
      : false

    return matchesName || matchesProtocol || matchesCpf
  }

  const filteredAwaitingIssuance = useMemo(() => {
    if (!searchQuery.trim()) return awaitingIssuance
    return awaitingIssuance.filter(apt => matchesSearchQuery(apt, searchQuery))
  }, [awaitingIssuance, searchQuery])

  const filteredCinReady = useMemo(() => {
    if (!searchQuery.trim()) return cinReady
    return cinReady.filter(apt => matchesSearchQuery(apt, searchQuery))
  }, [cinReady, searchQuery])

  const filteredDelivered = useMemo(() => {
    if (!searchQuery.trim()) return delivered
    return delivered.filter(apt => matchesSearchQuery(apt, searchQuery))
  }, [delivered, searchQuery])

  const onlyDigits = (value?: string) => (value || '').replace(/\D/g, '')

  const toggleReadySelection = (appointmentId: string) => {
    setSelectedForReady((prev) => {
      const next = new Set(prev)
      if (next.has(appointmentId)) {
        next.delete(appointmentId)
      } else {
        next.add(appointmentId)
      }
      return next
    })
  }

  const toggleReadySelectionAll = () => {
    const visibleIds = awaitingIssuance.map((apt) => apt.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedForReady.has(id))
    if (allSelected) {
      setSelectedForReady(new Set())
      return
    }
    setSelectedForReady(new Set(visibleIds))
  }

  const markAppointmentsAsReady = async (appointmentsToMark: Appointment[], source: 'manual' | 'file-ai') => {
    if (appointmentsToMark.length === 0) {
      toast.error('Nenhum agendamento selecionado para marcar como CIN pronta.')
      return
    }
    setBatchProcessing(true)
    try {
      for (const appointment of appointmentsToMark) {
        const reason =
          source === 'file-ai'
            ? 'CIN liberada para retirada via processamento de arquivo (IA assistida)'
            : 'CIN liberada para retirada em lote na fila de emissão'
        await Promise.resolve(onStatusChange(appointment.id, 'cin-ready', reason))
      }
      setSelectedForReady(new Set())
      toast.success(`${appointmentsToMark.length} CIN(s) marcada(s) como pronta(s) para retirada.`)
    } finally {
      setBatchProcessing(false)
    }
  }

  const detectAppointmentsFromText = (rawContent: string) => {
    const lines = rawContent
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)

    const matched = new Map<string, Appointment>()
    const unmatched: string[] = []

    for (const line of lines) {
      const normalizedLine = normalizeText(line)
      const lineDigits = onlyDigits(line)
      const protocolCandidates = (line.match(/[A-Z0-9-]{6,}/gi) || []).map((token) => token.toUpperCase())

      let found: Appointment | undefined

      // 1) protocolo
      found = awaitingIssuance.find((apt) => {
        const protocol = (apt.protocol || '').toUpperCase()
        return protocolCandidates.some((candidate) => protocol.includes(candidate))
      })

      // 2) CPF
      if (!found && lineDigits.length >= 11) {
        found = awaitingIssuance.find((apt) => onlyDigits(apt.cpf) === lineDigits.slice(0, 11))
      }

      // 3) Nome aproximado (contém palavras-chave)
      if (!found) {
        found = awaitingIssuance.find((apt) => {
          const normalizedName = normalizeText(apt.fullName)
          if (!normalizedName) return false
          const keywords = normalizedName.split(/\s+/).filter((part) => part.length >= 4).slice(0, 3)
          return keywords.length > 0 && keywords.every((word) => normalizedLine.includes(word))
        })
      }

      if (found) {
        matched.set(found.id, found)
      } else {
        unmatched.push(line)
      }
    }

    setBatchDetectedAppointments(Array.from(matched.values()))
    setBatchUnmatchedEntries(unmatched.slice(0, 20))
    setBatchPreviewOpen(true)
  }

  const handleAnalyzeBatchFile = async (file: File) => {
    setBatchSourceName(file.name)
    const extension = file.name.toLowerCase()

    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const tenantId = localStorage.getItem('tenantId')
      const tenantSlug = localStorage.getItem('tenantSlug')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      if (tenantId) headers['x-tenant-id'] = tenantId
      if (!tenantId && tenantSlug) headers['x-prefeitura-slug'] = tenantSlug

      const apiBaseUrl = (import.meta.env?.VITE_API_URL?.trim() || 'http://localhost:4000/api').replace(/\/$/, '')
      const responseRaw = await fetch(`${apiBaseUrl}/agendamentos/cin-ready/detect-batch`, {
        method: 'POST',
        headers,
        body: formData
      })
      if (!responseRaw.ok) {
        throw new Error('Falha ao processar arquivo para detecção de CIN pronta.')
      }
      const response = (await responseRaw.json()) as {
        fileName: string
        extractedLineCount: number
        matched: Array<{ id: string; fullName: string; cpf: string; protocol: string }>
        unmatched: string[]
        note?: string
      }

      const matchedIds = new Set((response?.matched || []).map((item) => String(item.id)))
      const matchedAppointments = awaitingIssuance.filter((apt) => matchedIds.has(apt.id))

      if (response?.note) {
        toast.info(response.note)
      }

      // Fallback local quando o backend não encontrar nada
      if (matchedAppointments.length === 0) {
        try {
          const content = await file.text()
          detectAppointmentsFromText(content)
          return
        } catch {
          // arquivo binário (xlsx) — abre modal vazia
        }
      }

      setBatchDetectedAppointments(matchedAppointments)
      setBatchUnmatchedEntries(response?.unmatched || [])
      setBatchPreviewOpen(true)
    } catch (error) {
      console.error('[RGDeliveryQueue] Erro ao processar arquivo em lote:', error)
      // Tenta fallback local para qualquer tipo de arquivo legível como texto
      try {
        const content = await file.text()
        detectAppointmentsFromText(content)
      } catch {
        // arquivo binário sem fallback — abre modal vazia assim mesmo
        setBatchDetectedAppointments([])
        setBatchUnmatchedEntries([])
        setBatchPreviewOpen(true)
      }
    }
  }

  const handleOpenDeliveryDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setDeliveryForm({
      receivedByName: appointment.fullName,
      receivedByDocument: appointment.cpf,
      notes: ''
    })
    setDeliveryDialogOpen(true)
  }

  const handleConfirmDelivery = () => {
    if (!selectedAppointment) return

    if (!deliveryForm.receivedByName.trim() || !deliveryForm.receivedByDocument.trim()) {
      toast.error('Preencha o nome e documento de quem recebeu')
      return
    }

    setDeliveryDialogOpen(false)
    setConfirmationAppointment(selectedAppointment)
    setShowConfirmation(true)
  }

  const handleFinalConfirmation = () => {
    if (!confirmationAppointment) return

    const deliveryData: RGDelivery = {
      id: crypto.randomUUID(),
      deliveredAt: new Date().toISOString(),
      deliveredBy: currentUserName,
      receivedByName: deliveryForm.receivedByName,
      receivedByDocument: deliveryForm.receivedByDocument,
      notes: deliveryForm.notes || undefined,
      deliveryConfirmedBy: currentUserName,
      deliveryConfirmedAt: new Date().toISOString()
    }

    onMarkAsDelivered(confirmationAppointment.id, deliveryData)
    
    setShowConfirmation(false)
    setConfirmationAppointment(null)
    setSelectedAppointment(null)
    setDeliveryForm({
      receivedByName: '',
      receivedByDocument: '',
      notes: ''
    })
  }

  const handleResendNotification = async (appointmentId: string) => {
    if (!onResendNotification) {
      toast.error('Função de reenvio não disponível')
      return
    }

    setResendingNotification(appointmentId)
    try {
      await onResendNotification(appointmentId)
    } catch (error) {
      console.error('Erro ao reenviar notificação:', error)
    } finally {
      setResendingNotification(null)
    }
  }

  const handleMoveToCinReady = (appointment: Appointment) => {
    onStatusChange(appointment.id, 'cin-ready', 'CIN liberada para retirada via aba Entrega CIN')
  }

  const handleRevertToEmission = (appointment: Appointment) => {
    onStatusChange(appointment.id, 'awaiting-issuance', 'CIN voltou para a etapa de emissão')
  }

  return (
    <>
      <ScrollToTop />
      {showConfirmation && confirmationAppointment && (
        <DeliveryConfirmation
          citizenName={confirmationAppointment.fullName}
          protocol={confirmationAppointment.protocol}
          onConfirm={handleFinalConfirmation}
        />
      )}
      
      <div className="space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package size={28} weight="duotone" className="text-purple-600" />
              <div>
                <CardTitle>Fila de Entrega de CIN</CardTitle>
                <CardDescription>
                  Controle os CINs em emissão e os já liberados para entrega
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {awaitingIssuance.length + cinReady.length} aguardando
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs defaultValue="emissao">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="emissao" className="flex-1 gap-2">
                Aguardando Emissão
                <Badge variant="secondary" className="ml-1">{awaitingIssuance.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pronta" className="flex-1 gap-2">
                CIN Prontas para Entrega
                <Badge variant="secondary" className="ml-1">{cinReady.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="entregue" className="flex-1 gap-2">
                CINs Entregues
                <Badge variant="secondary" className="ml-1">{delivered.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── Barra de Busca ── */}
            <div className="relative mb-4">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome, CPF ou protocolo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* ── ABA 1: Aguardando Emissão ── */}
            <TabsContent value="emissao">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">CINs concluídos que ainda aguardam a emissão</p>
                <div className="flex items-center gap-2">
                  {awaitingIssuance.length > 0 && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleReadySelectionAll}
                      >
                        {awaitingIssuance.every((apt) => selectedForReady.has(apt.id)) ? 'Desmarcar todos' : 'Marcar todos'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Anexar arquivo (IA)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={selectedForReady.size === 0 || batchProcessing}
                        onClick={() =>
                          markAppointmentsAsReady(
                            awaitingIssuance.filter((apt) => selectedForReady.has(apt.id)),
                            'manual'
                          )
                        }
                      >
                        {batchProcessing ? 'Processando...' : `Marcar selecionados (${selectedForReady.size})`}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {filteredAwaitingIssuance.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
                  <Clock size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{searchQuery.trim() ? 'Nenhum resultado encontrado.' : 'Nenhuma CIN aguardando emissão no momento.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                      {filteredAwaitingIssuance.map((apt) => {
                        const appointmentLocationName = resolveAppointmentLocationName(apt)
                        const completedDate = apt.completedAt ? parseISO(apt.completedAt) : null
                        const daysWaiting = completedDate ? differenceInDays(new Date(), completedDate) : 0
                        const isOverdue = daysWaiting > 7

                        return (
                          <Card key={apt.id} className={isOverdue ? 'border-orange-500 bg-orange-50/30' : 'border-purple-200 bg-purple-50/30'}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <Checkbox
                                          checked={selectedForReady.has(apt.id)}
                                          onCheckedChange={() => toggleReadySelection(apt.id)}
                                          aria-label={`Selecionar ${apt.fullName}`}
                                        />
                                        <User size={18} weight="bold" className="text-purple-600" />
                                        <span className="font-semibold text-lg">{apt.fullName}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <IdentificationCard size={14} />
                                          CPF: {apt.cpf}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Phone size={14} />
                                          {apt.phone}
                                        </span>
                                      </div>
                                    </div>
                                    <Badge className="bg-purple-600">Protocolo: {apt.protocol}</Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Clock size={16} className="text-muted-foreground" />
                                      <div>
                                        <p className="font-medium">Concluído em</p>
                                        <p className="text-muted-foreground">
                                          {completedDate ? format(completedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não registrada'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <MapPin size={16} className="text-muted-foreground" />
                                      <div>
                                        <p className="font-medium">Local</p>
                                        <p className="text-muted-foreground">{appointmentLocationName}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {isOverdue && (
                                    <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-100 p-2 rounded">
                                      <Warning size={16} weight="fill" />
                                      <span className="font-medium">Aguardando emissão há {daysWaiting} dias</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Button
                                    onClick={() => handleMoveToCinReady(apt)}
                                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                                  >
                                    <Package size={18} weight="bold" />
                                    Marcar CIN Pronta
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                </div>
              )}
            </TabsContent>

            {/* ── ABA 2: CIN Prontas para Entrega ── */}
            <TabsContent value="pronta">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">Após registrar a entrega, o status muda automaticamente para CIN Entregue</p>
              </div>
              {filteredCinReady.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
                  <Package size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{searchQuery.trim() ? 'Nenhum resultado encontrado.' : 'Nenhuma CIN aguardando retirada.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                      {filteredCinReady.map((apt) => {
                        const appointmentLocationName = resolveAppointmentLocationName(apt)
                        const completedDate = apt.completedAt ? parseISO(apt.completedAt) : null
                        const daysWaiting = completedDate ? differenceInDays(new Date(), completedDate) : 0
                        const isOverdue = daysWaiting > 7

                        return (
                          <Card key={apt.id} className={isOverdue ? 'border-orange-500 bg-orange-50/30' : 'border-indigo-200 bg-indigo-50/30'}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <User size={18} weight="bold" className="text-indigo-600" />
                                        <span className="font-semibold text-lg">{apt.fullName}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <IdentificationCard size={14} />
                                          CPF: {apt.cpf}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Phone size={14} />
                                          {apt.phone}
                                        </span>
                                      </div>
                                    </div>
                                    <Badge className="bg-indigo-600">Protocolo: {apt.protocol}</Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Clock size={16} className="text-muted-foreground" />
                                      <div>
                                        <p className="font-medium">Concluído em</p>
                                        <p className="text-muted-foreground">
                                          {completedDate ? format(completedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não registrada'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <MapPin size={16} className="text-muted-foreground" />
                                      <div>
                                        <p className="font-medium">Local</p>
                                        <p className="text-muted-foreground">{appointmentLocationName}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {isOverdue && (
                                    <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-100 p-2 rounded">
                                      <Warning size={16} weight="fill" />
                                      <span className="font-medium">Aguardando retirada há {daysWaiting} dias</span>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    {apt.completedBy && (
                                      <span className="bg-muted/50 px-2 py-1 rounded">Concluído por: {apt.completedBy}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Button 
                                    onClick={() => handleOpenDeliveryDialog(apt)}
                                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                                  >
                                    <CheckCircle size={18} weight="bold" />
                                    Registrar Entrega
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => handleRevertToEmission(apt)}
                                    className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    <Clock size={16} />
                                    Voltar para Emissão
                                  </Button>
                                  {onResendNotification && (
                                    <Button
                                      variant="ghost"
                                      onClick={() => handleResendNotification(apt.id)}
                                      disabled={resendingNotification === apt.id}
                                      className="gap-2 text-indigo-700 hover:bg-indigo-100"
                                    >
                                      <PaperPlaneRight 
                                        size={18} 
                                        weight="bold"
                                        className={resendingNotification === apt.id ? 'animate-pulse' : ''}
                                      />
                                      {resendingNotification === apt.id ? 'Enviando...' : 'Reenviar Notificação'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                </div>
              )}
            </TabsContent>

            {/* ── ABA 3: CINs Entregues ── */}
            <TabsContent value="entregue">
              {filteredDelivered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                  <p>{searchQuery.trim() ? 'Nenhum resultado encontrado.' : 'Nenhuma CIN entregue ainda'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                      {filteredDelivered.map((apt) => {
                        const delivery = apt.rgDelivery
                        if (!delivery) return null
                        return (
                          <div key={apt.id} className="p-3 rounded-lg border bg-teal-50/30 border-teal-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle size={18} weight="fill" className="text-teal-600" />
                                <span className="font-semibold">{apt.fullName}</span>
                              </div>
                              <Badge variant="outline" className="text-xs border-teal-300">{apt.protocol}</Badge>
                            </div>
                            <div className="text-sm space-y-1 text-muted-foreground">
                              <p><strong>Recebido por:</strong> {delivery.receivedByName} ({delivery.receivedByDocument})</p>
                              <p><strong>Data/Hora:</strong> {format(parseISO(delivery.deliveredAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                              <p><strong>Registrado por:</strong> {delivery.deliveredBy}</p>
                              {delivery.notes && (
                                <p className="text-xs italic mt-2 p-2 bg-white/50 rounded">{delivery.notes}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                </div>
              )}
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".txt,.csv,.json,.xls,.xlsx,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          await handleAnalyzeBatchFile(file)
          // Reset via ref para garantir que o mesmo arquivo pode ser selecionado novamente
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
      />

      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={24} weight="duotone" className="text-teal-600" />
              Registrar Entrega de CIN
            </DialogTitle>
            <DialogDescription>
              Confirme os dados de quem está recebendo o CIN
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm font-medium">Cidadão Titular</p>
                <p className="font-semibold">{selectedAppointment.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  CPF: {selectedAppointment.cpf} | Protocolo: {selectedAppointment.protocol}
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="received-by-name">
                    Nome de quem está recebendo *
                  </Label>
                  <Input
                    id="received-by-name"
                    placeholder="Nome completo"
                    value={deliveryForm.receivedByName}
                    onChange={(e) => setDeliveryForm(prev => ({ ...prev, receivedByName: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pode ser o próprio titular ou um responsável
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="received-by-document">
                    CPF de quem está recebendo *
                  </Label>
                  <Input
                    id="received-by-document"
                    placeholder="000.000.000-00"
                    value={deliveryForm.receivedByDocument}
                    onChange={(e) => setDeliveryForm(prev => ({ ...prev, receivedByDocument: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery-notes">
                    Observações (opcional)
                  </Label>
                  <Textarea
                    id="delivery-notes"
                    placeholder="Alguma observação sobre a entrega..."
                    value={deliveryForm.notes}
                    onChange={(e) => setDeliveryForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                <p className="font-medium text-blue-900 mb-1">Informações da Entrega</p>
                <p className="text-blue-700">
                  Registrado por: <strong>{currentUserName}</strong>
                </p>
                <p className="text-blue-700">
                  Data/Hora: <strong>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong>
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeliveryDialogOpen(false)
                setSelectedAppointment(null)
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmDelivery}
              className="gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <CheckCircle size={18} weight="bold" />
              Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchPreviewOpen} onOpenChange={(open) => {
        setBatchPreviewOpen(open)
        if (!open && fileInputRef.current) fileInputRef.current.value = ''
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia de marcação por arquivo (IA assistida)</DialogTitle>
            <DialogDescription>
              Arquivo analisado: <strong>{batchSourceName || 'não informado'}</strong>. Confira os registros detectados antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">Detectados para marcar como CIN Pronta: {batchDetectedAppointments.length}</p>
              {batchDetectedAppointments.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                  {batchDetectedAppointments.map((apt) => (
                    <div key={apt.id} className="text-sm border rounded p-2">
                      <p className="font-medium">{apt.fullName}</p>
                      <p className="text-xs text-muted-foreground">CPF: {apt.cpf} • Protocolo: {apt.protocol}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Nenhum registro identificado automaticamente.</p>
              )}
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchPreviewOpen(false)}>Cancelar</Button>
            <Button
              disabled={batchProcessing}
              onClick={async () => {
                await markAppointmentsAsReady(batchDetectedAppointments, 'file-ai')
                setBatchPreviewOpen(false)
              }}
            >
              {batchProcessing ? 'Processando...' : 'Confirmar e marcar CIN pronta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
