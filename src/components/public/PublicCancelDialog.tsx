import { useState } from 'react'
import { XCircle, Lock, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface PublicCancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentId: number
  appointmentName: string
  appointmentDate: string
  appointmentTime: string
  supportPhone?: string | null
  onCancelSuccess: () => void
}

export function PublicCancelDialog({
  open,
  onOpenChange,
  appointmentId,
  appointmentName,
  appointmentDate,
  appointmentTime,
  supportPhone,
  onCancelSuccess
}: PublicCancelDialogProps) {
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const supportPhoneDigits = supportPhone ? supportPhone.replace(/\D/g, '') : ''
  const contactGuidance = supportPhone && supportPhone.trim().length > 0
    ? `Caso você não consiga realizar o cancelamento, entre em contato pelo número ${supportPhone}.`
    : 'Caso você não consiga realizar o cancelamento, entre em contato com a secretaria responsável.'

  const parseResponseData = async (response: Response) => {
    const raw = await response.text()
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return { message: raw }
    }
  }

  const handleRequestCode = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/agendamentos/${appointmentId}/solicitar-cancelamento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await parseResponseData(response)

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao solicitar código')
      }

      // Se em desenvolvimento e o código vier na resposta, mostrar no toast
      if (data.developmentCode) {
        toast.success(`Código enviado! (Dev: ${data.developmentCode})`, {
          duration: 10000,
          description: 'Digite o código abaixo para confirmar o cancelamento'
        })
      } else {
        toast.success('Código enviado!', {
          description: 'Verifique seu WhatsApp e digite o código abaixo'
        })
      }

      setStep('verify')
    } catch (error) {
      console.error('Erro ao solicitar código:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao solicitar código de cancelamento', {
        description: contactGuidance
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!code || code.length !== 6) {
      toast.error('Digite o código de 6 dígitos')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/agendamentos/${appointmentId}/confirmar-cancelamento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })

      const data = await parseResponseData(response)

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao confirmar cancelamento')
      }

      toast.success('Agendamento cancelado com sucesso!')
      onCancelSuccess()
      onOpenChange(false)
      // Reseta o estado do diálogo
      setTimeout(() => {
        setStep('request')
        setCode('')
      }, 300)
    } catch (error) {
      console.error('Erro ao confirmar cancelamento:', error)
      toast.error(error instanceof Error ? error.message : 'Código inválido ou expirado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false)
      // Reseta após um pequeno delay para evitar ver a mudança durante o fechamento
      setTimeout(() => {
        setStep('request')
        setCode('')
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle size={24} />
            Cancelar Agendamento
          </DialogTitle>
          <DialogDescription>
            {step === 'request' 
              ? 'Você tem certeza que deseja cancelar este agendamento?'
              : 'Digite o código enviado para seu WhatsApp'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <div>
              <span className="text-sm font-semibold text-gray-700">Nome:</span>
              <p className="text-sm text-gray-900">{appointmentName}</p>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-700">Data:</span>
              <p className="text-sm text-gray-900">{appointmentDate}</p>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-700">Horário:</span>
              <p className="text-sm text-gray-900">{appointmentTime}</p>
            </div>
          </div>

          {step === 'verify' && (
            <div className="space-y-2">
              <Label htmlFor="code" className="flex items-center gap-2">
                <Lock size={16} />
                Código de Verificação
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Digite o código de 6 dígitos enviado para seu WhatsApp
              </p>
            </div>
          )}

          {step === 'request' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Atenção:</strong> Um código de verificação será enviado para o WhatsApp 
                cadastrado no agendamento. Esta ação não pode ser desfeita.
              </p>
              <p className="mt-2 text-xs text-amber-900">
                {supportPhone && supportPhone.trim().length > 0 ? (
                  <>
                    Caso você não consiga realizar o cancelamento, entre em contato pelo número{' '}
                    <a
                      href={`tel:${supportPhoneDigits}`}
                      className="font-semibold underline hover:no-underline"
                    >
                      {supportPhone}
                    </a>
                    .
                  </>
                ) : (
                  contactGuidance
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Voltar
          </Button>
          {step === 'request' ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRequestCode}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Solicitar Cancelamento
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isLoading || code.length !== 6}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirmar Cancelamento
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
