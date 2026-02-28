import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import type { AppointmentStatus } from '@/lib/types'

interface StatusChangeDialogProps {
  currentStatus: AppointmentStatus
  newStatus: AppointmentStatus
  onConfirm: (reason?: string) => void
  triggerButton: React.ReactNode
}

const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  'awaiting-issuance': 'Aguardando Emissão',
  'cin-ready': 'CIN Pronta',
  'cin-delivered': 'CIN Entregue'
}

const statusActions: Record<AppointmentStatus, { title: string; description: string; color: string }> = {
  confirmed: {
    title: 'Confirmar Agendamento',
    description: 'Confirmar que o agendamento está validado e o paciente será atendido.',
    color: 'text-blue-600'
  },
  cancelled: {
    title: 'Cancelar Agendamento',
    description: 'Cancelar o agendamento. O paciente será notificado por email e WhatsApp.',
    color: 'text-destructive'
  },
  completed: {
    title: 'Concluir Atendimento',
    description: 'Marcar o atendimento como concluído. O CIN entrará na fila de emissão.',
    color: 'text-accent'
  },
  pending: {
    title: 'Reverter para Pendente',
    description: 'Reverter o status para pendente.',
    color: 'text-yellow-600'
  },
  'awaiting-issuance': {
    title: 'Marcar como Aguardando Emissão',
    description: 'O CIN segue em processamento antes da liberação para retirada.',
    color: 'text-purple-600'
  },
  'cin-ready': {
    title: 'Marcar como CIN Pronta',
    description: 'Indica que o documento foi emitido e já pode ser retirado.',
    color: 'text-indigo-600'
  },
  'cin-delivered': {
    title: 'Marcar como CIN Entregue',
    description: 'Confirmar que o CIN foi entregue ao cidadão.',
    color: 'text-teal-600'
  }
}

export function StatusChangeDialog({ 
  currentStatus, 
  newStatus, 
  onConfirm, 
  triggerButton 
}: StatusChangeDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    onConfirm(reason || `Status alterado de ${statusLabels[currentStatus]} para ${statusLabels[newStatus]}`)
    setOpen(false)
    setReason('')
  }

  const action = statusActions[newStatus]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={action.color}>
            {action.title}
          </DialogTitle>
          <DialogDescription>
            {action.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-md text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status atual:</span>
              <span className="font-semibold">{statusLabels[currentStatus]}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold">{statusLabels[newStatus]}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da alteração (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Solicitado pelo paciente, reagendamento necessário, atendimento finalizado..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Este motivo será registrado no histórico de auditoria
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            {newStatus === 'cancelled' && <XCircle size={18} className="mr-2" />}
            {newStatus === 'completed' && <CheckCircle size={18} className="mr-2" />}
            {newStatus === 'confirmed' && <CheckCircle size={18} className="mr-2" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
