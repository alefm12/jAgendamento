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
import { XCircle } from '@phosphor-icons/react'
import type { Appointment } from '@/lib/types'

interface CancelAppointmentDialogProps {
  appointment: Appointment
  onCancel: (appointmentId: string, reason: string) => void
}

export function CancelAppointmentDialog({ appointment, onCancel }: CancelAppointmentDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const handleCancel = () => {
    onCancel(appointment.id, reason)
    setOpen(false)
    setReason('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <XCircle size={18} className="mr-2" />
          Cancelar Agendamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar Agendamento</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo do cancelamento (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Não poderei comparecer, preciso remarcar..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              ℹ️ Ao cancelar, você receberá uma confirmação por email e WhatsApp. 
              Você poderá fazer um novo agendamento a qualquer momento.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={handleCancel}>
            <XCircle size={18} className="mr-2" />
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
