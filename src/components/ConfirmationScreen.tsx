import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, CalendarBlank, Clock, User, Phone, EnvelopeSimple, IdentificationCard, MapPin, ChatCircleDots, Bell, CreditCard, MapTrifold } from '@phosphor-icons/react'
import type { Appointment, Location } from '@/lib/types'
import { parseDateOnly } from '@/lib/date-utils'

interface ConfirmationScreenProps {
  appointment: Appointment
  locations: Location[]
  onNewAppointment: () => void
}

export function ConfirmationScreen({ appointment, locations, onNewAppointment }: ConfirmationScreenProps) {
  const location = locations.find(loc => loc.id === appointment.locationId)
  const notificationsAccepted = appointment.lgpdConsent?.notificationAccepted !== false
  const openLocationOnMaps = () => {
    if (!location) return
    if (location.googleMapsUrl) {
      window.open(location.googleMapsUrl, '_blank', 'noopener,noreferrer')
      return
    }
    const address = encodeURIComponent(`${location.address}, ${location.city || ''}`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-2xl"
      >
        <Card className="p-8">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-4"
            >
              <CheckCircle weight="fill" className="text-accent" size={48} />
            </motion.div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">
              Agendamento Confirmado!
            </h1>
            <p className="text-muted-foreground text-lg">
              Seu protocolo foi gerado com sucesso
            </p>
          </div>

          <div className="bg-primary/5 rounded-lg p-6 mb-6">
            <p className="text-sm text-muted-foreground mb-2 text-center">Número do Protocolo</p>
            <p className="text-3xl font-bold text-primary text-center tracking-wider">
              {appointment.protocol}
            </p>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Anote ou tire uma foto deste número
            </p>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Detalhes do Agendamento</h3>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <CalendarBlank className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium text-foreground">
                  {format(parseDateOnly(appointment.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <Clock className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horário</p>
                <p className="font-medium text-foreground">{appointment.time}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <User className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground">{appointment.fullName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <IdentificationCard className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium text-foreground">{appointment.cpf}</p>
              </div>
            </div>

            {appointment.rgType && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <CreditCard className="text-primary" size={20} weight="duotone" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de CIN</p>
                  <p className="font-medium text-foreground">{appointment.rgType}</p>
                </div>
              </div>
            )}

            {appointment.gender && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <User className="text-primary" size={20} weight="duotone" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gênero</p>
                  <p className="font-medium text-foreground">{appointment.gender.replace('Outro:', 'Outro: ')}</p>
                </div>
              </div>
            )}

            {(appointment.regionType || appointment.street || appointment.neighborhood) && (
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <MapTrifold className="text-primary" size={20} weight="duotone" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground mb-2">Endereço Residencial</p>
                  {appointment.street && (
                    <p className="text-sm font-medium text-foreground">
                      Logradouro: {appointment.street}{appointment.number ? `, Nº ${appointment.number}` : ''}
                    </p>
                  )}
                  {appointment.neighborhood && (
                    <p className="text-sm font-medium text-foreground">Bairro/Comunidade: {appointment.neighborhood}</p>
                  )}
                  {appointment.regionType && (
                    <p className="text-sm font-medium text-foreground">
                      Região: {appointment.regionType} - {appointment.regionName || appointment.sedeId || appointment.districtId}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <Phone className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium text-foreground">{appointment.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <EnvelopeSimple className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{appointment.email}</p>
              </div>
            </div>

            {location && (
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <MapPin className="text-primary" size={20} weight="duotone" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Local de Atendimento</p>
                  <p className="font-medium text-foreground">{location.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
                  <p className="text-sm text-foreground">{location.city}</p>
                  <Button
                    type="button"
                    onClick={openLocationOnMaps}
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <MapTrifold size={16} weight="duotone" />
                    Ver no Mapa
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-6" />

          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bell className="text-accent" size={20} />
              Notificações Enviadas
            </h4>
            {notificationsAccepted ? (
              <>
                <p className="text-sm text-foreground mb-3">
                  Você receberá confirmações e lembretes através de:
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-md border">
                    <EnvelopeSimple className="text-accent" size={18} />
                    <span className="text-sm font-medium">Email</span>
                  </div>
                  <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-md border">
                    <ChatCircleDots className="text-accent" size={18} weight="fill" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  💡 Verifique sua caixa de entrada e mensagens para as confirmações
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você optou por não receber notificações no momento do aceite dos termos.
              </p>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">📑 Documentos Obrigatórios:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>CPF</li>
                <li>Comprovante de endereço</li>
                <li>Telefone atualizado</li>
                <li>Certidão de nascimento ou casamento (com averbações visíveis, se houver)</li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-2">👶 Para menores ou pessoas com acompanhamento:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Menores de 16 anos: presença do responsável legal com comprovação do vínculo.</li>
                <li>Maiores de 16 anos considerados incapazes: apresentar curador ou responsável legal.</li>
                <li>Casos com Conselho Tutelar: levar declaração assinada e carimbada.</li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-2">⚠️ Atenção:</p>
              <p className="text-sm text-muted-foreground">
                É obrigatório apresentar os documentos originais no atendimento presencial. Sem eles, o atendimento não será realizado. Chegue com 15 minutos de antecedência.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-2">🚨 Importante:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>A cada 3 (Três) faltas em um período de 7 dias, o acesso ao agendamento fica bloqueado por 7 dias.</li>
                <li>A cada 3 (Três) cancelamentos em 7 dias, o agendamento também fica bloqueado por 7 dias.</li>
              </ul>
            </div>
          </div>

          <Button 
            onClick={onNewAppointment} 
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            Fazer Novo Agendamento
          </Button>
        </Card>
      </motion.div>
    </div>
  )
}
