import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, File, FileCsv, CheckCircle, XCircle, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { importFromJSON, importFromCSV, importFromExcel, type ImportResult } from '@/lib/import-utils'
import type { Appointment } from '@/lib/types'

interface DataImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (data: Partial<Appointment>[]) => void
}

export function DataImportDialog({ open, onOpenChange, onImport }: DataImportDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo para importar')
      return
    }

    setIsProcessing(true)
    setResult(null)

    try {
      let importResult: ImportResult

      const extension = selectedFile.name.split('.').pop()?.toLowerCase()

      switch (extension) {
        case 'json':
          importResult = await importFromJSON(selectedFile)
          break
        case 'csv':
          importResult = await importFromCSV(selectedFile)
          break
        case 'xls':
        case 'xlsx':
          importResult = await importFromExcel(selectedFile)
          break
        default:
          toast.error('Formato de arquivo não suportado')
          setIsProcessing(false)
          return
      }

      setResult(importResult)

      if (importResult.success && importResult.data) {
        toast.success(`${importResult.imported} registro(s) importado(s) com sucesso!`)
      } else {
        toast.error('Falha na importação. Verifique os erros.')
      }
    } catch (error) {
      toast.error('Erro ao processar arquivo')
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmImport = () => {
    if (result?.data) {
      onImport(result.data)
      toast.success('Dados importados para o sistema!')
      handleClose()
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setResult(null)
    setIsProcessing(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'json':
        return <File size={24} weight="duotone" className="text-blue-500" />
      case 'csv':
        return <FileCsv size={24} weight="duotone" className="text-green-500" />
      case 'xls':
      case 'xlsx':
        return <File size={24} weight="duotone" className="text-emerald-600" />
      default:
        return <Upload size={24} weight="duotone" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload size={24} weight="duotone" />
            Importar Dados
          </DialogTitle>
          <DialogDescription>
            Importe agendamentos de arquivos JSON, CSV ou Excel
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(85vh-200px)] px-1">
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selecionar Arquivo</CardTitle>
                <CardDescription>
                  Formatos suportados: JSON, CSV, XLS, XLSX
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.csv,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-import"
                    />
                    <label htmlFor="file-import">
                      <Button variant="outline" asChild>
                        <span className="gap-2 cursor-pointer">
                          <Upload size={18} />
                          Escolher Arquivo
                        </span>
                      </Button>
                    </label>
                    {selectedFile && (
                      <div className="flex items-center gap-2">
                        {getFileIcon(selectedFile.name)}
                        <div>
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedFile && !result && (
                    <Button 
                      onClick={handleImport} 
                      disabled={isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Processando...' : 'Processar Arquivo'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {isProcessing && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Processando arquivo...</span>
                      <span className="text-muted-foreground">Por favor, aguarde</span>
                    </div>
                    <Progress value={undefined} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {result.success ? (
                      <>
                        <CheckCircle size={20} className="text-green-600" weight="duotone" />
                        Resultado da Importação
                      </>
                    ) : (
                      <>
                        <XCircle size={20} className="text-destructive" weight="duotone" />
                        Falha na Importação
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Registros Importados</span>
                    <Badge variant={result.imported > 0 ? 'default' : 'secondary'} className="text-base">
                      {result.imported}
                    </Badge>
                  </div>

                  {result.errors.length > 0 && (
                    <Alert variant="destructive">
                      <Warning size={18} />
                      <AlertDescription>
                        <p className="font-semibold mb-2">
                          {result.errors.length} erro(s) encontrado(s):
                        </p>
                        <ScrollArea className="h-32">
                          <ul className="text-sm space-y-1">
                            {result.errors.map((error, idx) => (
                              <li key={idx}>• {error}</li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </AlertDescription>
                    </Alert>
                  )}

                  {result.success && result.data && result.data.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Pré-visualização dos dados:</p>
                      <ScrollArea className="h-48 border rounded-lg">
                        <div className="p-3 space-y-2">
                          {result.data.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="p-2 bg-muted rounded text-sm">
                              <p><strong>Nome:</strong> {item.fullName}</p>
                              <p><strong>CPF:</strong> {item.cpf}</p>
                              <p><strong>Data:</strong> {item.date} às {item.time}</p>
                            </div>
                          ))}
                          {result.data.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center pt-2">
                              +{result.data.length - 5} registro(s) adicionais
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-sm">Formato Esperado</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p><strong>Campos obrigatórios:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Nome Completo (nome e sobrenome)</li>
                  <li>CPF (11 dígitos)</li>
                  <li>Telefone (10 ou 11 dígitos)</li>
                  <li>Email (formato válido)</li>
                  <li>Data (formato: dd/MM/yyyy ou yyyy-MM-dd)</li>
                  <li>Horário (formato: HH:mm)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {result?.success && result.data && (
            <Button onClick={handleConfirmImport}>
              Confirmar Importação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
