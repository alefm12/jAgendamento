import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  PaperPlaneRight,
  Envelope,
  WhatsappLogo,
  CheckCircle,
  XCircle,
  ClockCounterClockwise,
  Eye,
  Trash,
} from '@phosphor-icons/react'
import type { SystemConfig, Location } from '@/lib/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { api } from '@/lib/api'

const DEFAULT_TEST_MESSAGE =
  `Olá {nome}, seu agendamento para {tipo_rg} está confirmado!\n\n` +
  `📅 Data: {data}\n` +
  `🕐 Horário: {hora}\n` +
  `📍 Local: {local}\n\n` +
  `Este é um teste do sistema de notificações. ✅`

function resolvePreview(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replaceAll(`{${key}}`, val),
    template
  )
}

interface NotificationTestPanelProps {
  config: SystemConfig
  locations: Location[]
}

// ── Máscara e validação de telefone ──────────────────────────────────────────
function applyPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function validatePhone(masked: string): string | null {
  const digits = masked.replace(/\D/g, '')
  if (digits.length !== 11) return 'Número de telefone inválido. Informe um celular com DDD e 11 dígitos.'
  if (digits[0] === '0') return 'Número de telefone inválido. Informe um celular com DDD e 11 dígitos.'
  if (digits[2] !== '9') return 'Número de telefone inválido. Informe um celular com DDD e 11 dígitos.'
  if (/^(\d)\1{10}$/.test(digits)) return 'Número de telefone inválido. Informe um celular com DDD e 11 dígitos.'
  return null
}

export function NotificationTestPanel({ config, locations }: NotificationTestPanelProps) {
  const [testData, setTestData] = useState({
    fullName: 'João da Silva',
    cpf: '123.456.789-00',
    phone: '(88) 99999-9999',
    email: 'joao.silva@email.com',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    rgType: '1ª via' as '1ª via' | '2ª via',
    locationId: locations[0]?.id || ''
  })

  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [enabledChannels, setEnabledChannels] = useState({
    email: config?.emailSettings?.enabled !== false,
    whatsapp: config?.whatsappSettings?.enabled !== false
  })

  const [customMessage, setCustomMessage] = useState(DEFAULT_TEST_MESSAGE)
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean
    emailSent: boolean
    whatsappSent: boolean
    emailError?: string
    whatsappError?: string
    timestamp: string
  } | null>(null)

  const [notificationLogs, setNotificationLogs] = useState<Array<{
    id: string
    status: 'sent' | 'failed'
    timestamp: string
    message: string
    channels: string
  }>>([])

  const previewVars = useMemo(() => ({
    nome: testData.fullName || 'João da Silva',
    cpf: testData.cpf || '123.456.789-00',
    data: format(testData.date ? new Date(testData.date + 'T12:00:00') : new Date(), "dd/MM/yyyy", { locale: ptBR }),
    hora: testData.time || '09:00',
    local: locations.find(l => l.id === testData.locationId)?.name || 'Localidade',
    tipo_rg: testData.rgType || '1ª via',
  }), [testData, locations])

  const previewText = useMemo(() => resolvePreview(customMessage, previewVars), [customMessage, previewVars])

  const handleInputChange = (field: string, value: string) => {
    if (field === 'phone') {
      const masked = applyPhoneMask(value)
      setTestData(prev => ({ ...prev, phone: masked }))
      // Só valida se o campo já tem comprimento suficiente para ter opinião
      const digits = value.replace(/\D/g, '')
      if (digits.length > 0) {
        setPhoneError(validatePhone(masked))
      } else {
        setPhoneError(null)
      }
      return
    }
    setTestData(prev => ({ ...prev, [field]: value }))
  }

  const handleClearHistory = () => {
    setNotificationLogs([])
    toast.success('Histórico de testes limpo.')
  }

  const handleTestNotification = async () => {
    if (!testData.fullName || !testData.phone || !testData.email) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    const phoneValidationError = validatePhone(testData.phone)
    if (phoneValidationError) {
      setPhoneError(phoneValidationError)
      toast.error(phoneValidationError)
      return
    }
    if (!enabledChannels.email && !enabledChannels.whatsapp) {
      toast.error('Selecione ao menos um canal para testar')
      return
    }

    setSending(true)

    let emailSent = false
    let whatsappSent = false
    let emailError: string | undefined
    let whatsappError: string | undefined

    try {
      const resolvedMessage = resolvePreview(customMessage, previewVars)

      // ── Email real via SMTP ──────────────────────────────────────────────
      if (enabledChannels.email) {
        try {
          await api.post('/notifications/test-email', {
            prefeituraId: 1,
            to: testData.email,
            subject: 'Teste de E-mail - Sistema de Agendamento',
            message: resolvedMessage
          })
          emailSent = true
        } catch (err) {
          emailError = err instanceof Error ? err.message : 'Falha ao enviar e-mail'
          console.error('[teste] E-mail:', emailError)
        }
      }

      // ── WhatsApp real via Z-API ──────────────────────────────────────────
      if (enabledChannels.whatsapp) {
        try {
          await api.post('/notifications/test-whatsapp', {
            prefeituraId: 1,
            phone: testData.phone.replace(/\D/g, ''),
            message: resolvedMessage
          })
          whatsappSent = true
        } catch (err) {
          whatsappError = err instanceof Error ? err.message : 'Falha ao enviar WhatsApp'
          console.error('[teste] WhatsApp:', whatsappError)
        }
      }

      const success = emailSent || whatsappSent
      setLastTestResult({
        success,
        emailSent,
        whatsappSent,
        emailError,
        whatsappError,
        timestamp: new Date().toISOString()
      })

      const channels: string[] = []
      if (emailSent) channels.push('Email')
      if (whatsappSent) channels.push('WhatsApp')

      setNotificationLogs(prev => [{
        id: crypto.randomUUID(),
        status: success ? 'sent' : 'failed',
        timestamp: new Date().toISOString(),
        message: `Teste para ${testData.fullName}`,
        channels: channels.join(', ')
      }, ...prev].slice(0, 5))

      if (success) {
        toast.success('Teste concluído!', { description: `Enviado via: ${channels.join(', ')}` })
      } else {
        const errors = [emailError, whatsappError].filter(Boolean).join(' | ')
        toast.error('Falha no teste', { description: errors || 'Verifique as configurações' })
      }
    } finally {
      setSending(false)
    }
  }

  const selectedLocation = locations.find(loc => loc.id === testData.locationId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaperPlaneRight size={24} weight="duotone" className="text-primary" />
            Testar Notificações
          </CardTitle>
          <CardDescription className="mt-1">
            Envie notificações reais para verificar E-mail e WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Dados do destinatário */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-name">Nome Completo</Label>
              <Input id="test-name" value={testData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="Nome completo do cidadão" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-phone">
                Telefone / WhatsApp <span className="text-xs text-muted-foreground">(com DDD)</span>
              </Label>
              <Input
                id="test-phone"
                inputMode="numeric"
                value={testData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(85) 99999-9999"
                maxLength={16}
                className={phoneError ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              {phoneError && (
                <p className="text-xs text-red-600">{phoneError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-email">E-mail</Label>
              <Input id="test-email" type="email" value={testData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-location">Localidade</Label>
              <select id="test-location" value={testData.locationId}
                onChange={(e) => handleInputChange('locationId', e.target.value)}
                disabled={locations.length === 0}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                {locations.length === 0
                  ? <option value="">Nenhuma localidade cadastrada</option>
                  : locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} - {loc.city}</option>
                  ))}
              </select>
            </div>
          </div>

          {selectedLocation && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm space-y-1">
              <p className="font-medium">📍 {selectedLocation.name}</p>
              <p className="text-muted-foreground">{selectedLocation.address}, {selectedLocation.city}</p>
            </div>
          )}

          <Separator />

          {/* Mensagem personalizada */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Mensagem de Teste</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(p => !p)}
                className="gap-1.5 text-xs"
              >
                <Eye size={15} />
                {showPreview ? 'Ocultar prévia' : 'Ver prévia'}
              </Button>
            </div>

            <div className="space-y-1">
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                className="font-mono text-sm resize-none"
                placeholder="Digite a mensagem de teste..."
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{data}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{hora}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{local}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{tipo_rg}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{cpf}'}</code>
              </p>
            </div>

            {showPreview && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Pré-visualização da mensagem</p>
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                  {previewText}
                </pre>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="link"
                size="sm"
                className="text-xs text-muted-foreground h-auto p-0"
                onClick={() => setCustomMessage(DEFAULT_TEST_MESSAGE)}
              >
                Restaurar mensagem padrão
              </Button>
            </div>
          </div>

          <Separator />

          {/* Canais */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Canais para Testar</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <Envelope size={24} weight="duotone" className="text-blue-600" />
                  <div>
                    <p className="font-medium">E-mail</p>
                    <p className="text-xs text-muted-foreground">Envio real via SMTP</p>
                  </div>
                </div>
                <Switch checked={enabledChannels.email}
                  onCheckedChange={(v) => setEnabledChannels(p => ({ ...p, email: v }))} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <WhatsappLogo size={24} weight="duotone" className="text-green-500" />
                  <div>
                    <p className="font-medium">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Envio real via Z-API</p>
                  </div>
                </div>
                <Switch checked={enabledChannels.whatsapp}
                  onCheckedChange={(v) => setEnabledChannels(p => ({ ...p, whatsapp: v }))} />
              </div>
            </div>
          </div>

          <Button
            onClick={handleTestNotification}
            disabled={sending || !testData.fullName || !testData.phone || !testData.email || locations.length === 0}
            size="lg"
            className="w-full gap-2 h-14 text-base font-semibold"
          >
            <PaperPlaneRight size={20} weight="bold" />
            {sending ? 'Enviando...' : 'Enviar Notificação de Teste'}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {lastTestResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastTestResult.success
                ? <CheckCircle size={24} weight="duotone" className="text-green-600" />
                : <XCircle size={24} weight="duotone" className="text-red-600" />}
              Resultado do Último Teste
            </CardTitle>
            <CardDescription>
              {format(new Date(lastTestResult.timestamp), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {/* Email */}
              <div className={`p-4 rounded-lg border-2 ${lastTestResult.emailSent ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Envelope size={20} weight="duotone" className={lastTestResult.emailSent ? 'text-green-600' : 'text-gray-400'} />
                  <span className="font-semibold">E-mail</span>
                </div>
                {lastTestResult.emailSent
                  ? <Badge className="bg-green-600">✓ Enviado</Badge>
                  : <div className="space-y-1">
                      <Badge variant="secondary">✗ Não enviado</Badge>
                      {lastTestResult.emailError && (
                        <p className="text-xs text-red-600 mt-1">{lastTestResult.emailError}</p>
                      )}
                    </div>
                }
              </div>

              {/* WhatsApp */}
              <div className={`p-4 rounded-lg border-2 ${lastTestResult.whatsappSent ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <WhatsappLogo size={20} weight="duotone" className={lastTestResult.whatsappSent ? 'text-green-600' : 'text-gray-400'} />
                  <span className="font-semibold">WhatsApp</span>
                </div>
                {lastTestResult.whatsappSent
                  ? <Badge className="bg-green-600">✓ Enviado</Badge>
                  : <div className="space-y-1">
                      <Badge variant="secondary">✗ Não enviado</Badge>
                      {lastTestResult.whatsappError && (
                        <p className="text-xs text-red-600 mt-1">{lastTestResult.whatsappError}</p>
                      )}
                    </div>
                }
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {notificationLogs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClockCounterClockwise size={24} weight="duotone" className="text-primary" />
                  Histórico de Testes
                </CardTitle>
                <CardDescription className="mt-1">
                  Últimos {notificationLogs.length} testes (máx. 5)
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                className="gap-1.5 text-muted-foreground hover:text-red-600 hover:border-red-300"
              >
                <Trash size={15} />
                Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notificationLogs.map((log) => (
                <div key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {log.status === 'sent'
                      ? <CheckCircle size={18} weight="fill" className="text-green-600 flex-shrink-0" />
                      : <XCircle size={18} weight="fill" className="text-red-600 flex-shrink-0" />}
                    <div>
                      <p className="font-medium text-sm">{log.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {log.channels && (
                    <Badge variant="outline" className="flex-shrink-0">{log.channels}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
