import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Bell, Clock, CheckCircle, XCircle, Envelope, WhatsappLogo } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { SystemConfig } from '@/lib/types'

interface ReminderSettingsProps {
  config: SystemConfig
  onUpdateConfig: (config: SystemConfig) => void
}

export function ReminderSettings({ config, onUpdateConfig }: ReminderSettingsProps) {
  const [reminderEnabled, setReminderEnabled] = useState(config.reminderSettings?.enabled !== false)
  const [hoursBeforeReminder, setHoursBeforeReminder] = useState(config.reminderSettings?.hoursBeforeAppointment || 24)
  const [emailEnabled, setEmailEnabled] = useState(config.emailSettings?.enabled !== false)
  const [whatsappEnabled, setWhatsappEnabled] = useState(config.whatsappSettings?.enabled !== false)
  const [customMessage, setCustomMessage] = useState(
    config.reminderSettings?.customMessage || 
    'Olá {nome}, lembramos que você tem agendamento para {data} às {hora}. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!'
  )

  const handleSave = () => {
    const updatedConfig: SystemConfig = {
      ...config,
      reminderSettings: {
        enabled: reminderEnabled,
        hoursBeforeAppointment: hoursBeforeReminder,
        customMessage: customMessage
      },
      emailSettings: {
        ...config.emailSettings,
        enabled: emailEnabled
      },
      whatsappSettings: {
        ...config.whatsappSettings,
        enabled: whatsappEnabled
      }
    }

    onUpdateConfig(updatedConfig)
    toast.success('Configurações de lembrete atualizadas com sucesso!')
  }

  const hasAnyChannelEnabled = emailEnabled || whatsappEnabled

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Bell size={32} weight="duotone" className="text-blue-600" />
              Lembretes Automáticos
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Configure notificações automáticas enviadas antes dos agendamentos
            </CardDescription>
          </div>
          <Badge 
            variant={reminderEnabled && hasAnyChannelEnabled ? "default" : "secondary"}
            className="text-sm px-4 py-2"
          >
            {reminderEnabled && hasAnyChannelEnabled ? (
              <span className="flex items-center gap-2">
                <CheckCircle size={18} weight="fill" />
                Ativo
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <XCircle size={18} weight="fill" />
                Inativo
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-8 pt-8">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <Clock size={32} weight="duotone" className="text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-blue-900">Ativar Lembretes Automáticos</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Envia notificações automaticamente antes dos agendamentos
                  </p>
                </div>
                <Switch
                  checked={reminderEnabled}
                  onCheckedChange={setReminderEnabled}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>

              {reminderEnabled && (
                <div className="space-y-4 pt-4 border-t-2 border-blue-200">
                  <div>
                    <Label htmlFor="hours-before" className="text-base font-semibold text-blue-900">
                      Tempo de Antecedência
                    </Label>
                    <p className="text-sm text-blue-600 mb-3">
                      Quanto tempo antes do agendamento o lembrete deve ser enviado?
                    </p>
                    <div className="flex items-center gap-4">
                      <Input
                        id="hours-before"
                        type="number"
                        min={1}
                        max={168}
                        value={hoursBeforeReminder}
                        onChange={(e) => setHoursBeforeReminder(Number(e.target.value))}
                        className="max-w-[120px] text-lg font-bold border-2"
                      />
                      <span className="text-lg font-semibold text-blue-900">horas antes</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-2">
                      {hoursBeforeReminder === 24 && '(Padrão: 1 dia antes)'}
                      {hoursBeforeReminder === 48 && '(2 dias antes)'}
                      {hoursBeforeReminder === 72 && '(3 dias antes)'}
                      {hoursBeforeReminder < 24 && hoursBeforeReminder > 0 && `(Menos de 1 dia)`}
                      {hoursBeforeReminder > 72 && `(${Math.floor(hoursBeforeReminder / 24)} dias antes)`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {reminderEnabled && (
          <>
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Bell size={24} weight="duotone" />
                Canais de Notificação
              </h3>
              <p className="text-sm text-muted-foreground">
                Selecione quais canais devem ser usados para enviar os lembretes
              </p>

              <div className="grid gap-4">
                <Card className={`border-2 transition-all ${emailEnabled ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${emailEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                          <Envelope size={28} weight="duotone" className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">Email</h4>
                          <p className="text-sm text-muted-foreground">
                            Envio de lembretes por email
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={emailEnabled}
                        onCheckedChange={setEmailEnabled}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 transition-all ${whatsappEnabled ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${whatsappEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <WhatsappLogo size={28} weight="duotone" className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">WhatsApp</h4>
                          <p className="text-sm text-muted-foreground">
                            Envio de lembretes por WhatsApp
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={whatsappEnabled}
                        onCheckedChange={setWhatsappEnabled}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {!hasAnyChannelEnabled && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                  <XCircle size={24} weight="fill" className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Atenção!</p>
                    <p className="text-sm text-red-700 mt-1">
                      Você precisa ativar pelo menos um canal de notificação para que os lembretes sejam enviados.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="custom-message" className="text-base font-semibold">
                  Mensagem Personalizada (Opcional)
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Personalize a mensagem do lembrete. Use as variáveis: {'{nome}'}, {'{data}'}, {'{hora}'}, {'{endereco}'}
                </p>
                <Textarea
                  id="custom-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  className="font-mono text-sm border-2"
                  placeholder="Olá {nome}, lembramos que você tem agendamento para {data} às {hora}..."
                />
              </div>
            </div>

            <div className="space-y-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 rounded-full p-2">
                  <Bell size={24} weight="fill" className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-purple-900">
                    Preview dos Lembretes
                  </h3>
                  <p className="text-sm text-purple-700">
                    Veja como os lembretes aparecerão em cada canal
                  </p>
                </div>
              </div>

              {emailEnabled && (
                <Card className="border-2 border-green-300 shadow-md">
                  <CardHeader className="bg-green-50 border-b-2 border-green-200">
                    <CardTitle className="flex items-center gap-2 text-green-900">
                      <Envelope size={24} weight="duotone" className="text-green-600" />
                      Email
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 bg-white">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-start pb-2 border-b">
                        <span className="font-semibold text-gray-600">Assunto:</span>
                        <span className="text-right font-bold">Lembrete: Agendamento Amanhã - Sistema de Agendamento CIN</span>
                      </div>
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 font-mono text-xs leading-relaxed whitespace-pre-wrap">
{`Olá João Silva,

Passando para lhe lembrar que você está agendado para AMANHÃ!

📅 Data: 15 de janeiro de 2025 (AMANHÃ)
🕐 Horário: 09:00
📋 Protocolo: CIN-20250114-ABC123

📍 Local: Avenida Paulo Bastos, 100, Centro
🗺️ Ver no Google Maps: [link do mapa]

⚠️ NÃO ESQUEÇA DE TRAZER SEUS DOCUMENTOS:
- Documento de identidade atual (CIN antigo, se tiver)
- CPF original
- Comprovante de residência recente (últimos 90 dias)
- Certidão de nascimento ou casamento

⏰ Por favor, chegue com 10 minutos de antecedência.

Se não puder comparecer, cancele pelo sistema.

Atenciosamente,
Equipe Sistema de Agendamento CIN`}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}


              {whatsappEnabled && (
                <Card className="border-2 border-emerald-300 shadow-md">
                  <CardHeader className="bg-emerald-50 border-b-2 border-emerald-200">
                    <CardTitle className="flex items-center gap-2 text-emerald-900">
                      <WhatsappLogo size={24} weight="duotone" className="text-emerald-600" />
                      WhatsApp
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 bg-gradient-to-br from-emerald-50 to-teal-50">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>Formato: Rich Text com Emojis</span>
                        <span>Entrega: Confirmada</span>
                      </div>
                      <div className="bg-[#e5ddd5] rounded-lg p-4">
                        <div className="flex gap-2">
                          <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            📱
                          </div>
                          <div className="flex-1">
                            <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-md">
                              <p className="text-xs font-bold text-emerald-700 mb-2">
                                Sistema de Agendamento CIN
                              </p>
                              <div className="text-sm leading-relaxed space-y-1">
                                <p>Olá <strong>João Silva</strong>! 👋</p>
                                <p className="mt-2">🔔 <strong>LEMBRETE</strong> - Seu agendamento é <strong>AMANHÃ</strong>!</p>
                                <p className="mt-2">📅 <strong>Data:</strong> 15 de janeiro de 2025 (AMANHÃ)</p>
                                <p>🕐 <strong>Horário:</strong> 09:00</p>
                                <p>📋 <strong>Protocolo:</strong> CIN-20250114-ABC123</p>
                                <p className="mt-2">📍 <strong>Local:</strong> Avenida Paulo Bastos, 100, Centro</p>
                                <p>🗺️ <strong>Ver no mapa:</strong> [link]</p>
                                <p className="mt-3">⚠️ <strong>NÃO ESQUEÇA DE TRAZER:</strong> 📄</p>
                                <p className="text-xs leading-relaxed ml-2">
                                  • Documento de identidade atual<br/>
                                  • CPF original<br/>
                                  • Comprovante de residência recente<br/>
                                  • Certidão de nascimento ou casamento
                                </p>
                                <p className="mt-3">⏰ Chegue com <strong>10 minutos de antecedência</strong>.</p>
                                <p className="text-xs mt-2">Se não puder comparecer, cancele pelo sistema! 🙏</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 mt-1 ml-2">
                              <p className="text-xs text-gray-600">
                                Agora
                              </p>
                              <CheckCircle size={16} weight="fill" className="text-blue-500" />
                              <CheckCircle size={16} weight="fill" className="text-blue-500 -ml-3" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
          <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
            <CheckCircle size={24} weight="duotone" className="text-blue-600" />
            Como Funciona
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold flex-shrink-0">1.</span>
              <span>O sistema verifica automaticamente os agendamentos a cada hora</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold flex-shrink-0">2.</span>
              <span>Quando faltarem {hoursBeforeReminder} horas para o agendamento, um lembrete é enviado automaticamente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold flex-shrink-0">3.</span>
              <span>Os lembretes são enviados apenas para agendamentos com status "Pendente" ou "Confirmado"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold flex-shrink-0">4.</span>
              <span>Cada agendamento recebe apenas um lembrete automático (não envia duplicatas)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold flex-shrink-0">5.</span>
              <span>Os canais ativos (Email e WhatsApp) são usados para garantir que o cidadão receba o lembrete</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleSave}
            size="lg"
            className="flex-1 text-lg font-bold h-14 gap-3"
            disabled={reminderEnabled && !hasAnyChannelEnabled}
          >
            <CheckCircle size={24} weight="fill" />
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
