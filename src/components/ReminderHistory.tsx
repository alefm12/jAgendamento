import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, CheckCircle, MagnifyingGlass, Envelope, DeviceMobile, WhatsappLogo, CalendarBlank, Clock, User } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Appointment, Location } from '@/lib/types'

interface ReminderHistoryProps {
  appointments: Appointment[]
  locations: Location[]
}

export function ReminderHistory({ appointments, locations }: ReminderHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const remindersData = useMemo(() => {
    const sent = appointments.filter(apt => apt.reminderSent)
    const pending = appointments.filter(apt => 
      !apt.reminderSent && 
      (apt.status === 'pending' || apt.status === 'confirmed') &&
      new Date(apt.date) > new Date()
    )

    return { sent, pending }
  }, [appointments])

  const filteredSent = useMemo(() => {
    if (!searchTerm) return remindersData.sent

    const term = searchTerm.toLowerCase()
    return remindersData.sent.filter(apt =>
      apt.fullName.toLowerCase().includes(term) ||
      apt.cpf.includes(term) ||
      apt.protocol.toLowerCase().includes(term) ||
      apt.phone.includes(term) ||
      apt.email.toLowerCase().includes(term)
    )
  }, [remindersData.sent, searchTerm])

  const getLocationName = (locationId: string) => {
    const location = locations.find(loc => loc.id === locationId)
    return location ? location.name : 'Local não encontrado'
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-green-300 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-green-500">
                <CheckCircle size={32} weight="fill" className="text-white" />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Lembretes Enviados</p>
                <p className="text-4xl font-bold text-green-900">{remindersData.sent.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-blue-500">
                <Bell size={32} weight="fill" className="text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Aguardando Envio</p>
                <p className="text-4xl font-bold text-blue-900">{remindersData.pending.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader className="border-b bg-white/50">
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Bell size={24} weight="duotone" className="text-purple-600" />
            Canais de Notificação
          </CardTitle>
          <CardDescription>
            Os lembretes são enviados através de Email e WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 border-2 border-blue-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Envelope size={24} weight="duotone" className="text-blue-600" />
                </div>
                <h4 className="font-bold text-blue-900">Email</h4>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Mensagens detalhadas com informações completas e links úteis
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border-2 border-emerald-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <WhatsappLogo size={24} weight="duotone" className="text-emerald-600" />
                </div>
                <h4 className="font-bold text-emerald-900">WhatsApp</h4>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Mensagens ricas com formatação, emojis e confirmação de leitura
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle size={20} weight="fill" className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  ✨ Envio Simultâneo em Todos os Canais
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Quando um lembrete é enviado, o cidadão recebe a notificação por Email e WhatsApp, 
                  garantindo que a mensagem chegue independente do canal preferido.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-3">
                <Bell size={28} weight="duotone" className="text-blue-600" />
                Histórico de Lembretes Enviados
              </CardTitle>
              <CardDescription className="mt-2">
                Lista de todos os lembretes automáticos que foram enviados aos cidadãos
              </CardDescription>
            </div>
          </div>

          <div className="mt-4 relative">
            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF, protocolo, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base border-2"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filteredSent.length === 0 ? (
            <div className="text-center py-12">
              <Bell size={64} weight="duotone" className="mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-semibold text-gray-600">
                {searchTerm ? 'Nenhum lembrete encontrado' : 'Nenhum lembrete foi enviado ainda'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm 
                  ? 'Tente buscar por outros termos' 
                  : 'Os lembretes automáticos aparecerão aqui quando forem enviados'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {filteredSent
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((apt) => (
                    <Card key={apt.id} className="border-2 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-green-100">
                            <CheckCircle size={32} weight="fill" className="text-green-600" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-bold text-foreground">{apt.fullName}</h3>
                                  <Badge variant="outline" className="text-xs">
                                    {apt.protocol}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1.5">
                                    <User size={16} weight="duotone" />
                                    CPF: {apt.cpf}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <CalendarBlank size={16} weight="duotone" />
                                    {format(parseISO(apt.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock size={16} weight="duotone" />
                                    {apt.time}
                                  </span>
                                </div>
                              </div>

                              <Badge className="bg-green-100 text-green-800 border-green-300 text-xs px-3 py-1 flex-shrink-0">
                                <CheckCircle size={14} weight="fill" className="mr-1" />
                                Lembrete Enviado
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div className="flex items-center gap-2 text-sm">
                                <Envelope size={18} weight="duotone" className="text-blue-600" />
                                <span className="text-muted-foreground truncate">{apt.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <DeviceMobile size={18} weight="duotone" className="text-green-600" />
                                <span className="text-muted-foreground">{apt.phone}</span>
                              </div>
                            </div>

                            <div className="pt-3 border-t">
                              <p className="text-sm font-medium text-muted-foreground mb-2">
                                📍 {getLocationName(apt.locationId)}
                              </p>
                              
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                                  <Envelope size={14} className="mr-1" />
                                  Email
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200">
                                  <WhatsappLogo size={14} className="mr-1" />
                                  WhatsApp
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {remindersData.pending.length > 0 && (
        <Card className="border-2 border-blue-300">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <Bell size={24} weight="duotone" className="text-blue-600" />
              Próximos Lembretes a Serem Enviados
            </CardTitle>
            <CardDescription>
              Agendamentos que receberão lembrete automático nas próximas 24h
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {remindersData.pending
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 10)
                  .map((apt) => (
                    <div key={apt.id} className="flex items-center gap-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
                      <div className="p-2 rounded-lg bg-blue-500">
                        <Bell size={20} weight="fill" className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{apt.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(apt.date), "dd/MM/yyyy", { locale: ptBR })} às {apt.time} - {getLocationName(apt.locationId)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 flex-shrink-0">
                        Aguardando
                      </Badge>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
