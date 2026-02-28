import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  Palette, 
  Image as ImageIcon,
  Download,
  Plus,
  FileText
} from '@phosphor-icons/react'
import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ReportTemplateDesignerProps {
  systemName: string
  userName: string
  onSave?: (template: TemplateDesign) => void
}

interface TemplateDesign {
  id: string
  name: string
  logoUrl: string | null
  secretariaName: string
  primaryColor: string
  headerColor: string
  fontFamily: string
  createdAt: string
  createdBy: string
}

const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Calibri, sans-serif', label: 'Calibri' }
]

const COLOR_PRESETS = [
  { name: 'Azul Clássico', primary: '#4A90E2', header: '#2E5C8A' },
  { name: 'Verde Institucional', primary: '#2ECC71', header: '#27AE60' },
  { name: 'Roxo Elegante', primary: '#9B59B6', header: '#8E44AD' },
  { name: 'Vermelho Formal', primary: '#E74C3C', header: '#C0392B' },
  { name: 'Cinza Corporativo', primary: '#7F8C8D', header: '#34495E' }
]

export function ReportTemplateDesigner({ systemName, userName, onSave }: ReportTemplateDesignerProps) {
  const [templateName, setTemplateName] = useState('Relatório Analítico')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [secretariaName, setSecretariaName] = useState('SECRETARIA DE INCLUSÃO E PROMOÇÃO SOCIAL')
  const [primaryColor, setPrimaryColor] = useState('#000000')
  const [headerColor, setHeaderColor] = useState('#000000')
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const applyColorPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setPrimaryColor(preset.primary)
    setHeaderColor(preset.header)
    toast.success(`Esquema de cores "${preset.name}" aplicado`)
  }

  const handleSaveTemplate = () => {
    const template: TemplateDesign = {
      id: crypto.randomUUID(),
      name: templateName,
      logoUrl,
      secretariaName,
      primaryColor,
      headerColor,
      fontFamily,
      createdAt: new Date().toISOString(),
      createdBy: userName
    }
    
    onSave?.(template)
    toast.success('Template salvo com sucesso!')
  }

  const exportToPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 25
    
    pdf.setFont('helvetica')
    
    // Página 1 - Capa
    pdf.setFontSize(48)
    pdf.setFont('helvetica', 'bold')
    pdf.text(format(new Date(), 'yyyy'), pageWidth / 2, 40, { align: 'center' })
    
    pdf.setFontSize(32)
    pdf.text('RELATORIO ANALITICO', pageWidth / 2, 80, { align: 'center' })
    
    pdf.setFontSize(14)
    pdf.text(secretariaName.toUpperCase(), pageWidth / 2, 100, { align: 'center' })
    
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`EMITIDO POR ${userName.toUpperCase()} - ${format(new Date(), "dd/MM/yyyy 'as' HH:mm")}`, pageWidth / 2, 115, { align: 'center' })
    
    pdf.setFontSize(9)
    pdf.text(`Relatorio emitido pelo sistema ${systemName} - JEOS SISTEMAS E GOVERNO`, pageWidth / 2, pageHeight - 30, { align: 'center' })
    
    if (logoUrl) {
      try {
        pdf.addImage(logoUrl, 'PNG', pageWidth / 2 - 30, 150, 60, 60)
      } catch {
        pdf.setFontSize(24)
        pdf.setTextColor(150, 150, 150)
        pdf.text('BRASAO', pageWidth / 2, 180, { align: 'center' })
      }
    } else {
      pdf.setFontSize(24)
      pdf.setTextColor(150, 150, 150)
      pdf.text('BRASAO', pageWidth / 2, 180, { align: 'center' })
    }
    
    // Demais páginas...
    pdf.addPage()
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text('RESUMO EXECUTIVO', margin, 30)
    
    pdf.save(`relatorio-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`)
    toast.success('PDF exportado!')
  }

  return (
    <div className="space-y-4">
      {/* Barra de ferramentas estilo Word */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Palette size={24} className="text-primary" />
              <div>
                <CardTitle className="text-lg">Editor de Template</CardTitle>
                <CardDescription className="text-xs">Personalize o documento</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveTemplate} size="sm" variant="outline" className="gap-2">
                <Plus size={16} />
                Salvar
              </Button>
              <Button onClick={exportToPDF} size="sm" className="gap-2">
                <Download size={16} />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* Painel lateral esquerdo - Configurações */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Nome da Secretaria</Label>
                <Input
                  value={secretariaName}
                  onChange={(e) => setSecretariaName(e.target.value)}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <Label className="text-xs">Logo/Brasão</Label>
                {logoUrl && (
                  <div className="w-20 h-20 border rounded mt-1 mb-2 flex items-center justify-center">
                    <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <div className="flex gap-1">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 flex-1"
                  >
                    <ImageIcon size={12} className="mr-1" />
                    {logoUrl ? 'Alterar' : 'Upload'}
                  </Button>
                  {logoUrl && (
                    <Button
                      onClick={() => setLogoUrl(null)}
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-destructive"
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs">Fonte</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="mt-1 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                      <SelectItem key={font.value} value={font.value} className="text-xs">
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <Label className="text-xs mb-2 block">Esquemas de Cores</Label>
                <div className="space-y-1">
                  {COLOR_PRESETS.map((preset) => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="sm"
                      onClick={() => applyColorPreset(preset)}
                      className="w-full justify-start text-xs h-7"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.header }} />
                        </div>
                        <span className="text-xs">{preset.name}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Área principal - Documento estilo Word */}
        <div className="col-span-9">
          <div className="bg-gray-200 p-8 min-h-[calc(100vh-250px)] rounded-lg">
            {/* Página A4 simulada */}
            <div 
              className="bg-white shadow-2xl mx-auto p-16 min-h-[1122px] w-[794px]"
              style={{ fontFamily }}
            >
              {/* PÁGINA 1 - CAPA */}
              <div className="h-[1050px] flex flex-col">
                {/* Ano */}
                <div className="text-center mt-8">
                  <h1 className="text-8xl font-bold" style={{ color: headerColor }}>
                    {format(new Date(), 'yyyy')}
                  </h1>
                </div>

                {/* Título */}
                <div className="text-center mt-16">
                  <h2 className="text-5xl font-bold leading-tight" style={{ color: headerColor }}>
                    RELATÓRIO<br/>ANALÍTICO
                  </h2>
                </div>

                {/* Secretaria */}
                <div className="text-center mt-12">
                  <p 
                    className="text-lg font-bold uppercase px-8"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setSecretariaName(e.currentTarget.textContent || '')}
                    style={{ color: primaryColor }}
                  >
                    {secretariaName}
                  </p>
                </div>

                {/* Info emissão */}
                <div className="text-center mt-8">
                  <p className="text-sm" style={{ color: primaryColor }}>
                    EMITIDO POR {userName.toUpperCase()} - {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {/* Logo/Brasão */}
                <div className="flex-1 flex items-center justify-center my-12">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="text-6xl text-gray-300 font-bold">
                      BRASÃO
                    </div>
                  )}
                </div>

                {/* Rodapé */}
                <div className="text-center mt-auto">
                  <p className="text-xs text-gray-600">
                    Relatório emitido pelo sistema {systemName} - JEOS SISTEMAS E GOVERNO
                  </p>
                </div>
              </div>
            </div>

            {/* Página 2 - Preview do Resumo */}
            <div 
              className="bg-white shadow-2xl mx-auto p-16 min-h-[1122px] w-[794px] mt-8"
              style={{ fontFamily }}
            >
              <div className="space-y-8">
                <h2 className="text-3xl font-bold" style={{ color: headerColor }}>
                  RESUMO EXECUTIVO
                </h2>

                <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                  <div>
                    <p className="text-sm text-gray-600">Total de Agendamentos</p>
                    <p className="text-5xl font-bold mt-2" style={{ color: headerColor }}>10</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total de Agendamentos</p>
                    <p className="text-sm text-gray-600">Concluídos</p>
                    <p className="text-5xl font-bold mt-2" style={{ color: headerColor }}>5</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total CIN Entregues</p>
                    <p className="text-5xl font-bold mt-2" style={{ color: headerColor }}>3</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Aguardando</p>
                    <p className="text-sm text-gray-600">Confecção</p>
                    <p className="text-5xl font-bold mt-2" style={{ color: headerColor }}>3</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-500 italic mt-8">
                  <p>Filtros aplicados: __________________</p>
                  <p>Período aplicados: __________________</p>
                </div>
              </div>
            </div>

            {/* Página 3 - Distribuição por Status */}
            <div 
              className="bg-white shadow-2xl mx-auto p-16 min-h-[1122px] w-[794px] mt-8"
              style={{ fontFamily }}
            >
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold" style={{ color: headerColor }}>
                    DISTRIBUIÇÃO POR STATUS
                  </h2>
                  <p className="text-sm text-gray-600 mt-2">Quantidade por categoria</p>
                </div>

                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-base">
                  <p>Pendente: 0</p>
                  <p>CIN Prontas:</p>
                  <p>Confirmados:</p>
                  <p>CIN Entregues:</p>
                  <p>Aguardando Emissão:</p>
                  <p>Cancelado: 3</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
