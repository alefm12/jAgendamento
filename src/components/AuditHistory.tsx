import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ClockCounterClockwise, ArrowRight, User, Calendar, WarningCircle, Desktop } from '@phosphor-icons/react'
import type { StatusChangeHistory, AppointmentStatus } from '@/lib/types'
import { api } from '@/lib/api'

interface AuditHistoryProps {
  history: StatusChangeHistory[]
  appointmentId?: string
}

interface CancelamentoInfo {
  id: number
  cancelado_por: 'cidadao' | 'secretaria' | 'sistema'
  cidadao_ip?: string
  cidadao_user_agent?: string
  usuario_nome?: string
  usuario_email?: string
  motivo?: string
  cancelado_em: string
}

const statusLabels: Partial<Record<AppointmentStatus, string>> & Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  'awaiting-issuance': 'Aguardando Emissão',
  'cin-ready': 'CIN Pronta',
  'cin-delivered': 'CIN Entregue',
  // legado
  'ready-for-delivery': 'Aguardando Entrega',
  delivered: 'Entregue',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
}

const statusColors: Partial<Record<AppointmentStatus, string>> & Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  confirmed: 'bg-blue-500/10 text-blue-700 border-blue-300',
  cancelled: 'bg-red-500/10 text-red-700 border-red-300',
  completed: 'bg-green-500/10 text-green-700 border-green-300',
  'awaiting-issuance': 'bg-purple-500/10 text-purple-700 border-purple-300',
  'cin-ready': 'bg-teal-500/10 text-teal-700 border-teal-300',
  'cin-delivered': 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
  // legado
  'ready-for-delivery': 'bg-purple-500/10 text-purple-700 border-purple-300',
  delivered: 'bg-teal-500/10 text-teal-700 border-teal-300',
  cancelado: 'bg-red-500/10 text-red-700 border-red-300',
  pendente: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
}

export function AuditHistory({ history, appointmentId }: AuditHistoryProps) {
  const [cancelamentoInfo, setCancelamentoInfo] = useState<CancelamentoInfo | null>(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    // Verificar se há status cancelado no histórico
    const hasCancelled = history.some(h => (h.to as string) === 'cancelled' || (h.to as string) === 'cancelado')
    
    if (hasCancelled && appointmentId) {
      setLoading(true)
      api.get(`/agendamentos/cancelamentos/${appointmentId}`)
        .then(data => {
          setCancelamentoInfo(data as CancelamentoInfo)
        })
        .catch(error => {
          console.error('[AuditHistory] Erro ao buscar cancelamento:', error)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [history, appointmentId])
  
  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClockCounterClockwise size={20} weight="duotone" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma alteração registrada
          </p>
        </CardContent>
      </Card>
    )
  }

  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClockCounterClockwise size={20} weight="duotone" />
          Histórico de Alterações ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {sortedHistory.map((entry, index) => (
              <div 
                key={entry.id}
                className="relative pl-6 pb-4 border-l-2 border-muted last:border-0"
              >
                <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.from ? (
                      <>
                        <Badge 
                          variant="outline" 
                          className={statusColors[entry.from] || 'bg-gray-100 text-gray-700 border-gray-300'}
                        >
                          {statusLabels[entry.from] || entry.from}
                        </Badge>
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Criação</span>
                    )}
                    <Badge 
                      variant="outline" 
                      className={statusColors[entry.to] || 'bg-gray-100 text-gray-700 border-gray-300'}
                    >
                      {statusLabels[entry.to] || entry.to}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <User size={14} />
                      <span>{entry.changedBy || 'Sistema'}</span>
                    </div>
                    {entry.changedAt && (
                      <div className="flex items-center gap-1">
                        <ClockCounterClockwise size={14} />
                        <span>
                          {format(parseISO(entry.changedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </div>

                  {entry.reason && (
                    <div className="bg-muted/50 rounded-md p-2 text-xs">
                      <span className="font-medium">Motivo:</span> {entry.reason}
                    </div>
                  )}
                  
                  {/* Informações detalhadas de cancelamento */}
                  {((entry.to as string) === 'cancelled' || (entry.to as string) === 'cancelado') && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-red-800">
                        <WarningCircle size={16} weight="fill" />
                        <span>INFORMAÇÕES DO CANCELAMENTO</span>
                      </div>
                      
                      {cancelamentoInfo ? (
                        <>
                          {cancelamentoInfo.cancelado_por === 'secretaria' && (
                            <div className="space-y-1">
                              <div className="font-medium text-red-700 uppercase">
                                CANCELADO PELA SECRETARIA
                              </div>
                              {cancelamentoInfo.usuario_nome && (
                                <div className="text-red-600">
                                  <span className="font-medium">👤 Usuário:</span> {cancelamentoInfo.usuario_nome}
                                </div>
                              )}
                              {cancelamentoInfo.usuario_email && (
                                <div className="text-red-600">
                                  <span className="font-medium">📧 Email:</span> {cancelamentoInfo.usuario_email}
                                </div>
                              )}
                              {cancelamentoInfo.cancelado_em && (
                                <div className="text-red-600">
                                  <span className="font-medium">📅 Data/Hora:</span>{' '}
                                  {format(parseISO(cancelamentoInfo.cancelado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </div>
                              )}
                              <div className="text-red-600">
                                <span className="font-medium">📍 Localização:</span> Sistema
                              </div>
                            </div>
                          )}
                          
                          {cancelamentoInfo.cancelado_por === 'cidadao' && (
                            <div className="space-y-1">
                              <div className="font-medium text-red-700 uppercase">
                                CANCELADO PELO CIDADÃO
                              </div>
                              {cancelamentoInfo.cancelado_em && (
                                <div className="text-red-600">
                                  <span className="font-medium">📅 Data/Hora:</span>{' '}
                                  {format(parseISO(cancelamentoInfo.cancelado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </div>
                              )}
                              {cancelamentoInfo.cidadao_ip && (
                                <div className="text-red-600 flex items-center gap-1">
                                  <Desktop size={14} />
                                  <span className="font-medium">IP do Dispositivo:</span> {cancelamentoInfo.cidadao_ip}
                                </div>
                              )}
                              <div className="text-red-600">
                                <span className="font-medium">📍 Localização:</span> Portal do Cidadão
                              </div>
                            </div>
                          )}
                          
                          {cancelamentoInfo.motivo && (
                            <div className="bg-white/50 rounded p-2 text-red-700">
                              <span className="font-medium">Motivo:</span> {cancelamentoInfo.motivo}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-medium text-red-700">
                            Cancelado por: {entry.changedBy || 'Sistema'}
                          </div>
                          {entry.changedAt && (
                            <div className="text-red-600">
                              <span className="font-medium">📅 Data/Hora:</span>{' '}
                              {format(parseISO(entry.changedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                          )}
                          {entry.reason && (
                            <div className="bg-white/50 rounded p-2 text-red-700 mt-2">
                              <span className="font-medium">Motivo:</span> {entry.reason}
                            </div>
                          )}
                          <div className="text-amber-600 text-xs mt-2 italic">
                            ⚠️ Cancelamento registrado antes da implementação do sistema de rastreamento detalhado
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {entry.metadata && (entry.metadata.oldDate || entry.metadata.newDate) && (
                    <div className="bg-accent/30 rounded-md p-2 text-xs space-y-1">
                      <div className="flex items-center gap-1 font-medium">
                        <Calendar size={14} />
                        <span>Reagendamento</span>
                      </div>
                      {entry.metadata.oldDate && entry.metadata.oldTime && (
                        <div className="text-muted-foreground">
                          De: {entry.metadata.oldDate && format(parseISO(entry.metadata.oldDate), 'dd/MM/yyyy', { locale: ptBR })} às {entry.metadata.oldTime}
                        </div>
                      )}
                      {entry.metadata.newDate && entry.metadata.newTime && (
                        <div className="text-foreground font-medium">
                          Para: {entry.metadata.newDate && format(parseISO(entry.metadata.newDate), 'dd/MM/yyyy', { locale: ptBR })} às {entry.metadata.newTime}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
