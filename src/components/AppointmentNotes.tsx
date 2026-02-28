import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Note, Plus, Trash } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Appointment, AppointmentNote } from '@/lib/types'

interface AppointmentNotesProps {
  appointment: Appointment
  onAddNote: (appointmentId: string, note: string, options?: { contextLabel?: string }) => void
  onDeleteNote: (appointmentId: string, noteId: string) => void
  contextLabel?: string
}

export function AppointmentNotes({ appointment, onAddNote, onDeleteNote, contextLabel }: AppointmentNotesProps) {
  const [newNote, setNewNote] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const handleAddNote = () => {
    if (newNote.trim()) {
      onAddNote(appointment.id, newNote.trim(), contextLabel ? { contextLabel } : undefined)
      setNewNote('')
    }
  }

  const notes = appointment.notes || []

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Note size={16} />
          Notas
          {notes.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
              {notes.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Note size={24} className="text-primary" />
            Notas - {appointment.fullName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Digite uma nota sobre este agendamento..."
              className="min-h-[100px] resize-none"
            />
            <Button 
              onClick={handleAddNote} 
              disabled={!newNote.trim()}
              className="w-full gap-2"
            >
              <Plus size={16} weight="bold" />
              Adicionar Nota
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Histórico de Notas ({notes.length})
            </h3>
            
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <Note className="mx-auto text-muted-foreground mb-2" size={48} weight="thin" />
                <p className="text-sm text-muted-foreground">Nenhuma nota adicionada ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {notes.map((note) => (
                    <Card key={note.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {note.contextLabel && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                {note.contextLabel}
                              </span>
                            )}
                            <span className="font-medium">{note.author}</span>
                            <span>•</span>
                            <span>
                              {format(new Date(note.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteNote(appointment.id, note.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash size={16} />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
