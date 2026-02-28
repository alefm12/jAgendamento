import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  Palette, 
  TextAa, 
  Image as ImageIcon, 
  ListChecks,
  Clock,
  Bell,
  Gear,
  Plus,
  Trash,
  Eye,
  EyeSlash,
  ArrowUp,
  ArrowDown,
  PencilSimple,
  Briefcase,
  Sparkle,
  CalendarBlank,
  CheckCircle
} from '@phosphor-icons/react'
import { SecretaryConfigPanel } from '@/components/SecretaryConfigPanel'
import { ColorPicker } from '@/components/ColorPicker'
import { PublicPagePreview } from '@/components/PublicPagePreview'
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { LivePreviewPanel } from '@/components/LivePreviewPanel'
import { ReminderSettings } from '@/components/ReminderSettings'
import type { SystemConfig, CustomField, FieldType, SecretaryConfig, SecretaryUser } from '@/lib/types'

interface AdvancedAdminPanelProps {
  config: SystemConfig
  onUpdateConfig: (config: SystemConfig) => void
  currentUser?: SecretaryUser
}

const DEFAULT_CONFIG = {
  systemName: 'Agendamento CIN',
  primaryColor: 'oklch(0.45 0.15 145)',
  secondaryColor: 'oklch(0.65 0.1 180)',
  accentColor: 'oklch(0.55 0.18 145)',
  reminderMessage: 'Olá {nome}, lembramos que você tem agendamento para {data} às {hora} para emissão de CIN. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!',
  bookingWindowDays: 60
}

const BOOKING_WINDOW_PRESETS = [
  { label: '1 dia', value: 1 },
  { label: '1 semana', value: 7 },
  { label: '15 dias', value: 15 },
  { label: '30 dias', value: 30 },
  { label: '60 dias', value: 60 },
  { label: '90 dias', value: 90 },
  { label: '6 meses', value: 180 },
  { label: '1 ano', value: 365 }
]

export function AdvancedAdminPanel({ config, onUpdateConfig, currentUser }: AdvancedAdminPanelProps) {
  const [activeTab, setActiveTab] = useState('appearance')
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [activePreviewElement, setActivePreviewElement] = useState<'primary' | 'secondary' | 'accent' | 'title' | 'subtitle' | 'button' | 'border' | null>(null)
  const [newFieldData, setNewFieldData] = useState<Partial<CustomField>>({
    name: '',
    label: '',
    type: 'text',
    required: false,
    enabled: true,
    order: (config.customFields?.length || 0) + 1
  })

  const [tempAppearanceConfig, setTempAppearanceConfig] = useState({
    systemName: config.systemName,
    logo: config.logo,
    logoSize: config.logoSize,
    defaultTheme: config.defaultTheme || 'light'
  })

  const [tempColorConfig, setTempColorConfig] = useState({
    primaryColor: config.primaryColor,
    secondaryColor: config.secondaryColor,
    accentColor: config.accentColor
  })

  const [tempFontConfig, setTempFontConfig] = useState({
    titleFont: config.titleFont,
    bodyFont: config.bodyFont,
    titleSize: config.titleSize,
    subtitleSize: config.subtitleSize,
    buttonSize: config.buttonSize,
    borderRadiusPreview: config.borderRadiusPreview
  })

  const [tempScheduleConfig, setTempScheduleConfig] = useState({
    workingHours: config.workingHours,
    maxAppointmentsPerSlot: config.maxAppointmentsPerSlot,
    bookingWindowDays: config.bookingWindowDays ?? DEFAULT_CONFIG.bookingWindowDays
  })

  const [tempNotificationConfig, setTempNotificationConfig] = useState({
    emailSettings: config.emailSettings,
    smsSettings: config.smsSettings,
    whatsappSettings: config.whatsappSettings,
    reminderMessage: config.reminderMessage
  })

  const canChangeColors = !currentUser || currentUser.isAdmin || currentUser.permissions?.canChangeColors
  const canChangeSystemSettings = !currentUser || currentUser.isAdmin || currentUser.permissions?.canChangeSystemSettings
  const canManageCustomFields = !currentUser || currentUser.isAdmin || currentUser.permissions?.canManageCustomFields
  const canChangeWorkingHours = !currentUser || currentUser.isAdmin || currentUser.permissions?.canChangeWorkingHours

  useKeyboardShortcuts([
    {
      key: 's',
      ctrlKey: true,
      callback: () => {
        if (activeTab === 'colors') handleSaveColors()
        else if (activeTab === 'appearance') handleSaveAppearance()
        else if (activeTab === 'schedule') handleSaveSchedule()
        else if (activeTab === 'notifications') handleSaveNotifications()
        else if (activeTab === 'preview') handleSaveFonts()
        toast.success('⌨️ Atalho: Salvar configurações')
      },
      description: 'Salvar configurações da aba atual'
    },
    {
      key: 'r',
      ctrlKey: true,
      shiftKey: true,
      callback: () => {
        if (activeTab === 'colors') handleRestoreDefaultColors()
        else if (activeTab === 'appearance') handleRestoreDefaultAppearance()
        else if (activeTab === 'schedule') handleRestoreDefaultSchedule()
        else if (activeTab === 'notifications') handleRestoreDefaultNotifications()
        else if (activeTab === 'preview') handleRestoreDefaultFonts()
        toast.info('⌨️ Atalho: Restaurar padrões')
      },
      description: 'Restaurar padrões da aba atual'
    }
  ], true)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--primary', tempColorConfig.primaryColor)
    root.style.setProperty('--secondary', tempColorConfig.secondaryColor)
    root.style.setProperty('--accent', tempColorConfig.accentColor)
    root.style.setProperty('--ring', tempColorConfig.accentColor)
  }, [tempColorConfig])

  useEffect(() => {
    setTempAppearanceConfig({
      systemName: config.systemName,
      logo: config.logo,
      logoSize: config.logoSize,
      defaultTheme: config.defaultTheme || 'light'
    })
    setTempColorConfig({
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor
    })
    setTempFontConfig({
      titleFont: config.titleFont,
      bodyFont: config.bodyFont,
      titleSize: config.titleSize,
      subtitleSize: config.subtitleSize,
      buttonSize: config.buttonSize,
      borderRadiusPreview: config.borderRadiusPreview
    })
    setTempScheduleConfig({
      workingHours: config.workingHours,
      maxAppointmentsPerSlot: config.maxAppointmentsPerSlot,
      bookingWindowDays: config.bookingWindowDays ?? DEFAULT_CONFIG.bookingWindowDays
    })
    setTempNotificationConfig({
      emailSettings: config.emailSettings,
      smsSettings: config.smsSettings,
      whatsappSettings: config.whatsappSettings,
      reminderMessage: config.reminderMessage
    })
  }, [config])

  const handleColorChange = (key: 'primaryColor' | 'secondaryColor' | 'accentColor', value: string) => {
    if (!canChangeColors) {
      toast.error('Você não tem permissão para alterar cores')
      return
    }
    setTempColorConfig(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSaveColors = () => {
    if (!canChangeColors) {
      toast.error('Você não tem permissão para alterar cores')
      return
    }
    onUpdateConfig({
      ...config,
      ...tempColorConfig
    })
    toast.success('Cores salvas com sucesso!')
  }

  const handleRestoreDefaultColors = () => {
    const defaultColors = {
      primaryColor: DEFAULT_CONFIG.primaryColor,
      secondaryColor: DEFAULT_CONFIG.secondaryColor,
      accentColor: DEFAULT_CONFIG.accentColor
    }
    setTempColorConfig(defaultColors)
    toast.info('Cores restauradas para padrão (clique em Salvar para aplicar)')
  }

  const handleSaveAppearance = () => {
    if (!canChangeSystemSettings) {
      toast.error('Você não tem permissão para alterar aparência')
      return
    }
    onUpdateConfig({
      ...config,
      ...tempAppearanceConfig
    })
    toast.success('Aparência salva com sucesso!')
  }

  const handleRestoreDefaultAppearance = () => {
    const defaultAppearance = {
      systemName: DEFAULT_CONFIG.systemName,
      logo: undefined,
      logoSize: 40,
      defaultTheme: 'light' as const
    }
    setTempAppearanceConfig(defaultAppearance)
    toast.info('Aparência restaurada para padrão (clique em Salvar para aplicar)')
  }

  const handleSaveFonts = () => {
    if (!canChangeSystemSettings) {
      toast.error('Você não tem permissão para alterar fontes')
      return
    }
    onUpdateConfig({
      ...config,
      ...tempFontConfig
    })
    toast.success('Fontes e tamanhos salvos com sucesso!')
  }

  const handleRestoreDefaultFonts = () => {
    const defaultFonts = {
      titleFont: 'Work Sans',
      bodyFont: 'Inter',
      titleSize: 24,
      subtitleSize: 14,
      buttonSize: 16,
      borderRadiusPreview: 12
    }
    setTempFontConfig(defaultFonts)
    toast.info('Fontes restauradas para padrão (clique em Salvar para aplicar)')
  }

  const handleSaveSchedule = () => {
    if (!canChangeWorkingHours) {
      toast.error('Você não tem permissão para alterar horários')
      return
    }
    onUpdateConfig({
      ...config,
      ...tempScheduleConfig
    })
    toast.success('Horários salvos com sucesso!')
  }

  const handleRestoreDefaultSchedule = () => {
    const defaultSchedule = {
      workingHours: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'],
      maxAppointmentsPerSlot: 2,
      bookingWindowDays: DEFAULT_CONFIG.bookingWindowDays
    }
    setTempScheduleConfig(defaultSchedule)
    toast.info('Horários restaurados para padrão (clique em Salvar para aplicar)')
  }

  const handleSaveNotifications = () => {
    if (!canChangeSystemSettings) {
      toast.error('Você não tem permissão para alterar notificações')
      return
    }
    onUpdateConfig({
      ...config,
      ...tempNotificationConfig
    })
    toast.success('Configurações de notificações salvas com sucesso!')
  }

  const handleRestoreDefaultNotifications = () => {
    const defaultNotifications = {
      emailSettings: { enabled: true },
      smsSettings: { enabled: true },
      whatsappSettings: { enabled: true },
      reminderMessage: DEFAULT_CONFIG.reminderMessage
    }
    setTempNotificationConfig(defaultNotifications)
    toast.info('Notificações restauradas para padrão (clique em Salvar para aplicar)')
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setTempAppearanceConfig(prev => ({
          ...prev,
          logo: event.target?.result as string
        }))
        toast.info('Logo carregada (clique em Salvar para aplicar)')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddCustomField = () => {
    if (!canManageCustomFields) {
      toast.error('Você não tem permissão para gerenciar campos personalizados')
      return
    }
    
    if (!newFieldData.name || !newFieldData.label) {
      toast.error('Nome e Label são obrigatórios')
      return
    }

    const fieldId = `custom_${newFieldData.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
    const newField: CustomField = {
      id: fieldId,
      name: newFieldData.name,
      label: newFieldData.label,
      type: newFieldData.type || 'text',
      required: newFieldData.required || false,
      enabled: newFieldData.enabled !== false,
      order: newFieldData.order || (config.customFields?.length || 0) + 1,
      placeholder: newFieldData.placeholder,
      options: newFieldData.options,
      helpText: newFieldData.helpText,
      defaultValue: newFieldData.defaultValue,
      validationPattern: newFieldData.validationPattern
    }

    onUpdateConfig({
      ...config,
      customFields: [...(config.customFields || []), newField]
    })

    setNewFieldData({
      name: '',
      label: '',
      type: 'text',
      required: false,
      enabled: true,
      order: (config.customFields?.length || 0) + 2
    })

    toast.success('Campo adicionado com sucesso!')
  }

  const handleUpdateField = (fieldId: string, updates: Partial<CustomField>) => {
    if (!canManageCustomFields) {
      toast.error('Você não tem permissão para gerenciar campos personalizados')
      return
    }
    
    onUpdateConfig({
      ...config,
      customFields: (config.customFields || []).map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    })
    toast.success('Campo atualizado!')
  }

  const handleDeleteField = (fieldId: string) => {
    if (!canManageCustomFields) {
      toast.error('Você não tem permissão para gerenciar campos personalizados')
      return
    }
    
    onUpdateConfig({
      ...config,
      customFields: (config.customFields || []).filter(field => field.id !== fieldId)
    })
    toast.success('Campo removido!')
  }

  const handleMoveField = (fieldId: string, direction: 'up' | 'down') => {
    if (!canManageCustomFields) {
      toast.error('Você não tem permissão para gerenciar campos personalizados')
      return
    }
    
    const fields = [...(config.customFields || [])]
    const index = fields.findIndex(f => f.id === fieldId)
    
    if (direction === 'up' && index > 0) {
      [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]]
    } else if (direction === 'down' && index < fields.length - 1) {
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]]
    }

    fields.forEach((field, idx) => {
      field.order = idx + 1
    })

    onUpdateConfig({
      ...config,
      customFields: fields
    })
  }

  const clampBookingWindow = (value: number) => {
    const numeric = Number.isFinite(value) ? value : 1
    return Math.max(1, Math.min(365, numeric))
  }

  const handleWorkingHoursChange = (hours: string) => {
    if (!canChangeWorkingHours) {
      toast.error('Você não tem permissão para alterar horários de funcionamento')
      return
    }
    
    const hoursArray = hours.split(',').map(h => h.trim()).filter(h => h)
    setTempScheduleConfig(prev => ({
      ...prev,
      workingHours: hoursArray
    }))
  }

  const bookingWindowValue = tempScheduleConfig.bookingWindowDays ?? DEFAULT_CONFIG.bookingWindowDays

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground mb-2">Painel Administrativo</h2>
        <p className="text-muted-foreground">Gerencie todas as configurações do sistema</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full mb-6" style={{ gridTemplateColumns: `repeat(${[canChangeColors, canManageCustomFields, canChangeWorkingHours, canChangeSystemSettings, canChangeSystemSettings, canChangeSystemSettings, canChangeSystemSettings, canChangeColors].filter(Boolean).length}, 1fr)` }}>
          {canChangeColors && (
            <TabsTrigger value="appearance" className="gap-2">
              <Palette size={16} />
              Aparência
            </TabsTrigger>
          )}
          {canChangeColors && (
            <TabsTrigger value="colors" className="gap-2">
              <Palette size={16} />
              Cores
            </TabsTrigger>
          )}
          {canChangeColors && (
            <TabsTrigger value="preview" className="gap-2">
              <Eye size={16} />
              Preview
            </TabsTrigger>
          )}
          {canManageCustomFields && (
            <TabsTrigger value="fields" className="gap-2">
              <ListChecks size={16} />
              Campos
            </TabsTrigger>
          )}
          {canChangeWorkingHours && (
            <TabsTrigger value="schedule" className="gap-2">
              <Clock size={16} />
              Horários
            </TabsTrigger>
          )}
          {canChangeSystemSettings && (
            <>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell size={16} />
                Notificações
              </TabsTrigger>
              <TabsTrigger value="secretary" className="gap-2">
                <Briefcase size={16} />
                Secretaria
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-2">
                <Gear size={16} />
                Geral
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <Gear size={16} />
                Avançado
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TextAa size={20} />
                Nome do Sistema
              </CardTitle>
              <CardDescription>Define o nome exibido no topo da aplicação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={tempAppearanceConfig.systemName}
                onChange={(e) => setTempAppearanceConfig(prev => ({ ...prev, systemName: e.target.value }))}
                placeholder="Ex: Agendamento CIN"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon size={20} />
                Logo do Sistema
              </CardTitle>
              <CardDescription>Upload da logo (PNG, JPG ou SVG) - Tamanho ajustável</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tempAppearanceConfig.logo && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={tempAppearanceConfig.logo} 
                      alt="Logo" 
                      style={{ 
                        height: `${tempAppearanceConfig.logoSize || 40}px`,
                        width: 'auto',
                        maxWidth: '200px',
                        objectFit: 'contain'
                      }}
                      className="border rounded" 
                    />
                    <Button variant="outline" size="sm" onClick={() => setTempAppearanceConfig(prev => ({ ...prev, logo: undefined }))}>
                      <Trash size={16} className="mr-2" />
                      Remover Logo
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Tamanho da Logo: {tempAppearanceConfig.logoSize || 40}px</Label>
                    <input
                      type="range"
                      min="24"
                      max="120"
                      step="4"
                      value={tempAppearanceConfig.logoSize || 40}
                      onChange={(e) => setTempAppearanceConfig(prev => ({ ...prev, logoSize: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                💡 Recomendado: imagens em formato PNG com fundo transparente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette size={20} />
                Tema Padrão do Sistema
              </CardTitle>
              <CardDescription>Escolha o tema inicial que os usuários verão ao acessar o sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultTheme">Tema Padrão</Label>
                <Select
                  value={tempAppearanceConfig.defaultTheme}
                  onValueChange={(value: 'light' | 'dark') => 
                    setTempAppearanceConfig(prev => ({ ...prev, defaultTheme: value }))
                  }
                >
                  <SelectTrigger id="defaultTheme">
                    <SelectValue placeholder="Selecione o tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">☀️ Tema Claro</SelectItem>
                    <SelectItem value="dark">🌙 Tema Escuro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  ℹ️ Usuários podem alternar entre temas usando o botão no header
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette size={20} />
                Cores do Sistema (Input Manual)
              </CardTitle>
              <CardDescription>Digite valores OKLCH diretamente ou use a aba "Cores" para seleção visual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      value={tempColorConfig.primaryColor}
                      onChange={(e) => setTempColorConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                      placeholder="oklch(0.45 0.15 145)"
                    />
                    <div 
                      className="w-12 h-10 rounded border-2 flex-shrink-0"
                      style={{ backgroundColor: tempColorConfig.primaryColor }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      value={tempColorConfig.secondaryColor}
                      onChange={(e) => setTempColorConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      placeholder="oklch(0.65 0.1 180)"
                    />
                    <div 
                      className="w-12 h-10 rounded border-2 flex-shrink-0"
                      style={{ backgroundColor: tempColorConfig.secondaryColor }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Cor de Destaque</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      value={tempColorConfig.accentColor}
                      onChange={(e) => setTempColorConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                      placeholder="oklch(0.55 0.18 145)"
                    />
                    <div 
                      className="w-12 h-10 rounded border-2 flex-shrink-0"
                      style={{ backgroundColor: tempColorConfig.accentColor }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  💡 Use um gerador OKLCH como <a href="https://oklch.com" target="_blank" rel="noopener" className="text-primary underline">oklch.com</a> para escolher cores
                </p>
                <p className="text-sm text-muted-foreground">
                  ✨ <strong>Novo:</strong> Use a aba "Cores" para um seletor visual RGB completo!
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 bg-background p-4 border rounded-lg mt-6">
            <Button onClick={handleRestoreDefaultAppearance} variant="outline" className="flex-1">
              Restaurar Padrões (Ctrl+Shift+R)
            </Button>
            <Button onClick={handleSaveAppearance} className="flex-1">
              💾 Salvar Alterações (Ctrl+S)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="bg-purple-600 rounded-full p-3 shadow-lg">
                <Sparkle size={28} weight="fill" className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-purple-900 mb-2 flex items-center gap-2">
                  🎨 Como usar o seletor de cores
                </h3>
                <div className="space-y-2 text-sm text-purple-800">
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-purple-600">1.</span>
                    <span><strong>Passe o mouse</strong> sobre cada seletor de cor para ver exemplos visuais no preview acima</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-purple-600">2.</span>
                    <span>Os <strong>exemplos visuais</strong> mostram exatamente onde cada cor aparece no sistema (botões, ícones, links, etc)</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-purple-600">3.</span>
                    <span>Use os <strong>sliders RGB</strong> ou digite valores <strong>HEX</strong> para ajustar as cores</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-purple-600">4.</span>
                    <span>As mudanças aparecem <strong>instantaneamente</strong> em toda a interface do sistema</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-purple-600">5.</span>
                    <span>Clique em <strong>"💾 Salvar Cores"</strong> no final para aplicar permanentemente</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <LivePreviewPanel
            activeElement={activePreviewElement}
            primaryColor={tempColorConfig.primaryColor}
            secondaryColor={tempColorConfig.secondaryColor}
            accentColor={tempColorConfig.accentColor}
            titleSize={tempFontConfig.titleSize}
            subtitleSize={tempFontConfig.subtitleSize}
            buttonSize={tempFontConfig.buttonSize}
            borderRadius={tempFontConfig.borderRadiusPreview}
            systemName={tempAppearanceConfig.systemName}
          />

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Seletor Visual de Cores</h3>
            <p className="text-sm text-muted-foreground">
              👇 Escolha as cores usando controles visuais. Passe o mouse sobre cada seção para ver exemplos detalhados!
            </p>
          </div>

          <div 
            onMouseEnter={() => setActivePreviewElement('primary')}
            onMouseLeave={() => setActivePreviewElement(null)}
          >
            <ColorPicker
              label="Cor Primária"
              description="Cor principal da marca, usada em elementos de destaque"
              value={tempColorConfig.primaryColor}
              onChange={(color) => handleColorChange('primaryColor', color)}
              usageExamples={[
                { text: 'Botões principais', icon: <Sparkle size={14} weight="fill" /> },
                { text: 'Links e ícones', icon: <Bell size={14} weight="fill" /> },
                { text: 'Cabeçalho', icon: <CalendarBlank size={14} weight="fill" /> },
                { text: 'Foco de inputs', icon: <PencilSimple size={14} weight="fill" /> }
              ]}
            />
          </div>

          <div 
            onMouseEnter={() => setActivePreviewElement('secondary')}
            onMouseLeave={() => setActivePreviewElement(null)}
          >
            <ColorPicker
              label="Cor Secundária"
              description="Cor de suporte, usada em elementos menos proeminentes"
              value={tempColorConfig.secondaryColor}
              onChange={(color) => handleColorChange('secondaryColor', color)}
              usageExamples={[
                { text: 'Botões secundários', icon: <Sparkle size={14} /> },
                { text: 'Backgrounds', icon: <Briefcase size={14} /> },
                { text: 'Cards alternativos', icon: <ListChecks size={14} /> },
                { text: 'Badges', icon: <Bell size={14} /> }
              ]}
            />
          </div>

          <div 
            onMouseEnter={() => setActivePreviewElement('accent')}
            onMouseLeave={() => setActivePreviewElement(null)}
          >
            <ColorPicker
              label="Cor de Destaque"
              description="Cor de ênfase, usada para chamar atenção"
              value={tempColorConfig.accentColor}
              onChange={(color) => handleColorChange('accentColor', color)}
              usageExamples={[
                { text: 'CTAs importantes', icon: <Sparkle size={14} weight="fill" /> },
                { text: 'Notificações', icon: <Bell size={14} weight="fill" /> },
                { text: 'Destaques especiais', icon: <Eye size={14} weight="fill" /> },
                { text: 'Anel de foco', icon: <CalendarBlank size={14} weight="fill" /> }
              ]}
            />
          </div>

          <KeyboardShortcutsHelp 
            shortcuts={[
              { keys: ['Ctrl', 'S'], description: 'Salvar cores' },
              { keys: ['Ctrl', 'Shift', 'R'], description: 'Restaurar padrões' }
            ]}
          />

          <div className="flex gap-3 bg-background p-4 border rounded-lg mt-6">
            <Button onClick={handleRestoreDefaultColors} variant="outline" className="flex-1">
              Restaurar Padrões
            </Button>
            <Button onClick={handleSaveColors} className="flex-1">
              💾 Salvar Cores (Ctrl+S)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="bg-orange-600 rounded-full p-3 shadow-lg">
                <Eye size={28} weight="fill" className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-orange-900 mb-2 flex items-center gap-2">
                  👁️ Preview Interativo em Tempo Real
                </h3>
                <div className="space-y-2 text-sm text-orange-800">
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-orange-600">•</span>
                    <span>Use os <strong>controles deslizantes</strong> abaixo para ajustar tamanhos de fonte e bordas</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-orange-600">•</span>
                    <span><strong>Passe o mouse</strong> sobre cada controle para ver qual elemento está sendo alterado no preview acima</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-orange-600">•</span>
                    <span>Veja <strong>exemplos práticos</strong> de onde cada configuração é aplicada no sistema</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <LivePreviewPanel
            activeElement={activePreviewElement}
            primaryColor={tempColorConfig.primaryColor}
            secondaryColor={tempColorConfig.secondaryColor}
            accentColor={tempColorConfig.accentColor}
            titleSize={tempFontConfig.titleSize}
            subtitleSize={tempFontConfig.subtitleSize}
            buttonSize={tempFontConfig.buttonSize}
            borderRadius={tempFontConfig.borderRadiusPreview}
            systemName={tempAppearanceConfig.systemName}
          />

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Configurações de Tipografia e Espaçamento</h3>
            <p className="text-sm text-muted-foreground">
              👇 Ajuste os controles abaixo e veja as mudanças em tempo real no preview acima
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ajuste de Tamanhos e Espaçamentos</CardTitle>
              <CardDescription>Configure tamanhos de fontes, botões e bordas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="space-y-2 p-4 rounded-lg border-2 transition-all hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-lg cursor-pointer"
                  onMouseEnter={() => setActivePreviewElement('title')}
                  onMouseLeave={() => setActivePreviewElement(null)}
                >
                  <Label className="flex items-center gap-2 font-semibold">
                    <TextAa size={18} weight="duotone" />
                    Tamanho do Título: {tempFontConfig.titleSize || 24}px
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">Ajusta o título principal do sistema</p>
                  <input
                    type="range"
                    min="18"
                    max="36"
                    step="2"
                    value={tempFontConfig.titleSize || 24}
                    onChange={(e) => setTempFontConfig(prev => ({ ...prev, titleSize: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pequeno (18px)</span>
                    <span>Grande (36px)</span>
                  </div>
                </div>

                <div 
                  className="space-y-2 p-4 rounded-lg border-2 transition-all hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-lg cursor-pointer"
                  onMouseEnter={() => setActivePreviewElement('subtitle')}
                  onMouseLeave={() => setActivePreviewElement(null)}
                >
                  <Label className="flex items-center gap-2 font-semibold">
                    <TextAa size={14} weight="duotone" />
                    Tamanho do Subtítulo: {tempFontConfig.subtitleSize || 14}px
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">Ajusta textos secundários e descrições</p>
                  <input
                    type="range"
                    min="12"
                    max="18"
                    step="1"
                    value={tempFontConfig.subtitleSize || 14}
                    onChange={(e) => setTempFontConfig(prev => ({ ...prev, subtitleSize: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pequeno (12px)</span>
                    <span>Grande (18px)</span>
                  </div>
                </div>

                <div 
                  className="space-y-2 p-4 rounded-lg border-2 transition-all hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-lg cursor-pointer"
                  onMouseEnter={() => setActivePreviewElement('button')}
                  onMouseLeave={() => setActivePreviewElement(null)}
                >
                  <Label className="flex items-center gap-2 font-semibold">
                    <Sparkle size={16} weight="duotone" />
                    Tamanho dos Botões: {tempFontConfig.buttonSize || 16}px
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">Ajusta texto dentro de todos os botões</p>
                  <input
                    type="range"
                    min="12"
                    max="20"
                    step="1"
                    value={tempFontConfig.buttonSize || 16}
                    onChange={(e) => setTempFontConfig(prev => ({ ...prev, buttonSize: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pequeno (12px)</span>
                    <span>Grande (20px)</span>
                  </div>
                </div>

                <div 
                  className="space-y-2 p-4 rounded-lg border-2 transition-all hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-lg cursor-pointer"
                  onMouseEnter={() => setActivePreviewElement('border')}
                  onMouseLeave={() => setActivePreviewElement(null)}
                >
                  <Label className="flex items-center gap-2 font-semibold">
                    <Palette size={16} weight="duotone" />
                    Raio das Bordas: {tempFontConfig.borderRadiusPreview || 12}px
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">Define o arredondamento de cantos (cards, botões, inputs)</p>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="2"
                    value={tempFontConfig.borderRadiusPreview || 12}
                    onChange={(e) => setTempFontConfig(prev => ({ ...prev, borderRadiusPreview: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Quadrado (0px)</span>
                    <span>Muito Arredondado (24px)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <PublicPagePreview
            config={{
              ...config,
              ...tempAppearanceConfig,
              ...tempColorConfig,
              ...tempFontConfig
            }}
            onUpdateConfig={(newConfig) => {
              setTempAppearanceConfig({
                systemName: newConfig.systemName,
                logo: newConfig.logo,
                logoSize: newConfig.logoSize,
                defaultTheme: newConfig.defaultTheme || 'light'
              })
              setTempFontConfig({
                titleFont: newConfig.titleFont,
                bodyFont: newConfig.bodyFont,
                titleSize: newConfig.titleSize,
                subtitleSize: newConfig.subtitleSize,
                buttonSize: newConfig.buttonSize,
                borderRadiusPreview: newConfig.borderRadiusPreview
              })
            }}
          />

          <div className="flex gap-3 bg-background p-4 border rounded-lg mt-6">
            <Button onClick={handleRestoreDefaultFonts} variant="outline" className="flex-1">
              Restaurar Padrões (Ctrl+Shift+R)
            </Button>
            <Button onClick={handleSaveFonts} className="flex-1">
              💾 Salvar Tipografia (Ctrl+S)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="fields" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Novo Campo</CardTitle>
              <CardDescription>Crie campos personalizados para o formulário de agendamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Campo (identificador)</Label>
                  <Input
                    value={newFieldData.name || ''}
                    onChange={(e) => setNewFieldData({ ...newFieldData, name: e.target.value })}
                    placeholder="Ex: nome_mae"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Label (texto exibido)</Label>
                  <Input
                    value={newFieldData.label || ''}
                    onChange={(e) => setNewFieldData({ ...newFieldData, label: e.target.value })}
                    placeholder="Ex: Nome da Mãe"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Campo</Label>
                  <Select
                    value={newFieldData.type || 'text'}
                    onValueChange={(value: FieldType) => setNewFieldData({ ...newFieldData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="textarea">Texto Longo</SelectItem>
                      <SelectItem value="select">Seleção</SelectItem>
                      <SelectItem value="date">Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={newFieldData.placeholder || ''}
                    onChange={(e) => setNewFieldData({ ...newFieldData, placeholder: e.target.value })}
                    placeholder="Texto de ajuda"
                  />
                </div>
              </div>

              {newFieldData.type === 'select' && (
                <div className="space-y-2">
                  <Label>Opções (separadas por vírgula)</Label>
                  <Input
                    value={newFieldData.options?.join(', ') || ''}
                    onChange={(e) => setNewFieldData({ 
                      ...newFieldData, 
                      options: e.target.value.split(',').map(o => o.trim()) 
                    })}
                    placeholder="Opção 1, Opção 2, Opção 3"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Texto de Ajuda</Label>
                <Input
                  value={newFieldData.helpText || ''}
                  onChange={(e) => setNewFieldData({ ...newFieldData, helpText: e.target.value })}
                  placeholder="Explicação adicional sobre o campo"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newFieldData.required || false}
                    onCheckedChange={(checked) => setNewFieldData({ ...newFieldData, required: checked })}
                  />
                  <Label>Campo Obrigatório</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={newFieldData.enabled !== false}
                    onCheckedChange={(checked) => setNewFieldData({ ...newFieldData, enabled: checked })}
                  />
                  <Label>Campo Ativo</Label>
                </div>
              </div>

              <Button onClick={handleAddCustomField} className="w-full">
                <Plus size={16} className="mr-2" />
                Adicionar Campo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campos Cadastrados</CardTitle>
              <CardDescription>Gerencie os campos customizados existentes</CardDescription>
            </CardHeader>
            <CardContent>
              {(!config.customFields || config.customFields.length === 0) ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum campo personalizado cadastrado ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {config.customFields.sort((a, b) => a.order - b.order).map((field, index) => (
                    <div key={field.id} className="flex items-center gap-3 p-4 border rounded-lg">
                      <div className="flex flex-col gap-1 mr-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveField(field.id, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveField(field.id, 'down')}
                          disabled={index === config.customFields!.length - 1}
                        >
                          <ArrowDown size={14} />
                        </Button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{field.label}</span>
                          {field.required && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                              Obrigatório
                            </span>
                          )}
                          {!field.enabled && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              Desativado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Tipo: {field.type} • Nome: {field.name}
                        </p>
                        {field.helpText && (
                          <p className="text-xs text-muted-foreground mt-1">💡 {field.helpText}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUpdateField(field.id, { enabled: !field.enabled })}
                        >
                          {field.enabled ? <Eye size={18} /> : <EyeSlash size={18} />}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUpdateField(field.id, { required: !field.required })}
                        >
                          <PencilSimple size={18} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteField(field.id)}
                        >
                          <Trash size={18} className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Horários de Funcionamento</CardTitle>
              <CardDescription>Configure os horários disponíveis para agendamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Horários (separados por vírgula)</Label>
                <Textarea
                  value={tempScheduleConfig.workingHours?.join(', ') || ''}
                  onChange={(e) => handleWorkingHoursChange(e.target.value)}
                  placeholder="08:00, 08:30, 09:00, 09:30..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Exemplo: 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00
                </p>
              </div>

              <div className="space-y-2">
                <Label>Máximo de Agendamentos por Horário</Label>
                <Input
                  type="number"
                  value={tempScheduleConfig.maxAppointmentsPerSlot || 2}
                  onChange={(e) => setTempScheduleConfig(prev => ({ 
                    ...prev, 
                    maxAppointmentsPerSlot: parseInt(e.target.value) || 2 
                  }))}
                  min="1"
                  max="10"
                />
              </div>

              <div className="space-y-2">
                <Label>Período liberado para agendamentos</Label>
                <p className="text-sm text-muted-foreground">
                  Defina quantos dias à frente o público consegue agendar. Exemplos: 7 dias = 1 semana, 30 dias = 1 mês, 365 dias = 1 ano inteiro.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {BOOKING_WINDOW_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      type="button"
                      variant={bookingWindowValue === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTempScheduleConfig(prev => ({ ...prev, bookingWindowDays: preset.value }))}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={bookingWindowValue}
                    onChange={(e) => setTempScheduleConfig(prev => ({
                      ...prev,
                      bookingWindowDays: clampBookingWindow(parseInt(e.target.value, 10))
                    }))}
                  />
                  <span className="text-sm text-muted-foreground">dias liberados</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 bg-background p-4 border rounded-lg mt-6">
            <Button onClick={handleRestoreDefaultSchedule} variant="outline" className="flex-1">
              Restaurar Padrões (Ctrl+Shift+R)
            </Button>
            <Button onClick={handleSaveSchedule} className="flex-1">
              💾 Salvar Horários (Ctrl+S)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <KeyboardShortcutsHelp 
            shortcuts={[
              { keys: ['Ctrl', 'S'], description: 'Salvar configurações de notificações' },
              { keys: ['Ctrl', 'Shift', 'R'], description: 'Restaurar padrões' }
            ]}
          />
          
          <ReminderSettings 
            config={config}
            onUpdateConfig={onUpdateConfig}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Email</CardTitle>
              <CardDescription>Personalize o envio de notificações por email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={tempNotificationConfig.emailSettings?.enabled !== false}
                  onCheckedChange={(checked) => setTempNotificationConfig(prev => ({
                    ...prev,
                    emailSettings: { ...prev.emailSettings, enabled: checked }
                  }))}
                />
                <Label>Enviar emails automáticos</Label>
              </div>

              <div className="space-y-2">
                <Label>Nome do Remetente</Label>
                <Input
                  value={tempNotificationConfig.emailSettings?.senderName || ''}
                  onChange={(e) => setTempNotificationConfig(prev => ({
                    ...prev,
                    emailSettings: { ...prev.emailSettings, senderName: e.target.value }
                  }))}
                  placeholder="Ex: Secretaria Municipal"
                />
              </div>

              <div className="space-y-2">
                <Label>Email de Resposta</Label>
                <Input
                  type="email"
                  value={tempNotificationConfig.emailSettings?.replyTo || ''}
                  onChange={(e) => setTempNotificationConfig(prev => ({
                    ...prev,
                    emailSettings: { ...prev.emailSettings, replyTo: e.target.value }
                  }))}
                  placeholder="contato@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem de Lembrete</Label>
                <Textarea
                  value={tempNotificationConfig.reminderMessage || ''}
                  onChange={(e) => setTempNotificationConfig(prev => ({ ...prev, reminderMessage: e.target.value }))}
                  placeholder="Olá {nome}, lembramos que você tem agendamento..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Variáveis disponíveis: {'{nome}'}, {'{data}'}, {'{hora}'}, {'{endereco}'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Canal removido por requisito do projeto */}

          <Card>
            <CardHeader className="bg-emerald-50 border-b">
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <Bell size={24} weight="duotone" className="text-emerald-600" />
                Configurações de WhatsApp
              </CardTitle>
              <CardDescription>Configure o envio de notificações por WhatsApp Business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center gap-2 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                <Switch
                  checked={tempNotificationConfig.whatsappSettings?.enabled !== false}
                  onCheckedChange={(checked) => setTempNotificationConfig(prev => ({
                    ...prev,
                    whatsappSettings: { ...prev.whatsappSettings, enabled: checked }
                  }))}
                  className="data-[state=checked]:bg-emerald-600"
                />
                <Label className="text-base font-semibold">Enviar mensagens automáticas por WhatsApp</Label>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6">
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-emerald-900">
                    💬 Vantagens do WhatsApp
                  </h4>
                  <ul className="space-y-3 text-sm text-emerald-800">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span><strong>Formato Rico:</strong> Envie mensagens formatadas com emojis, negrito e quebras de linha</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span><strong>Confirmação de Leitura:</strong> Veja quando a mensagem foi entregue e lida</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <span><strong>Mensagens Longas:</strong> Sem limite de caracteres, envie todas as informações necessárias</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <span><strong>Mais Usado:</strong> 96% dos brasileiros usam WhatsApp diariamente</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                      <span><strong>Links Clicáveis:</strong> Inclua links do Google Maps para facilitar a localização</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label>Número do WhatsApp Business (com código do país)</Label>
                  <Input
                    value={tempNotificationConfig.whatsappSettings?.businessNumber || ''}
                    onChange={(e) => setTempNotificationConfig(prev => ({
                      ...prev,
                      whatsappSettings: { ...prev.whatsappSettings, businessNumber: e.target.value }
                    }))}
                    placeholder="Ex: +5585999999999"
                    className="font-mono"
                  />
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">💡</span>
                    Formato: +55 (código do país) + DDD + número
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Chave API do WhatsApp Business</Label>
                  <Input
                    type="password"
                    value={tempNotificationConfig.whatsappSettings?.apiKey || ''}
                    onChange={(e) => setTempNotificationConfig(prev => ({
                      ...prev,
                      whatsappSettings: { ...prev.whatsappSettings, apiKey: e.target.value }
                    }))}
                    placeholder="Sua chave de API"
                    className="font-mono"
                  />
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-amber-600 font-bold">🔒</span>
                    Chave fornecida pelo provedor de API do WhatsApp Business
                  </p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Bell size={20} weight="fill" className="text-blue-600" />
                    💬 Como configurar o WhatsApp Business API
                  </h4>
                  <div className="space-y-3 text-sm text-blue-800">
                    <p>
                      Para enviar mensagens automáticas via WhatsApp, você precisa de uma conta <strong>WhatsApp Business API</strong> 
                      (diferente do WhatsApp Business App normal).
                    </p>
                    <div className="space-y-2 mt-3">
                      <p className="font-semibold">📌 Provedores Recomendados:</p>
                      <ul className="ml-4 space-y-1">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span><strong>Twilio</strong> - Planos a partir de R$ 0,40 por mensagem</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span><strong>MessageBird</strong> - API robusta e confiável</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span><strong>360Dialog</strong> - Especializado em WhatsApp Business</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span><strong>Zenvia</strong> - Solução brasileira completa</span>
                        </li>
                      </ul>
                    </div>
                    <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
                      <p className="font-semibold text-blue-900 mb-2">
                        🚀 Passos para Ativar:
                      </p>
                      <ol className="space-y-1 text-xs">
                        <li>1. Escolha um provedor da lista acima</li>
                        <li>2. Crie uma conta e solicite acesso à API do WhatsApp</li>
                        <li>3. Configure seu número de telefone no provedor</li>
                        <li>4. Obtenha sua chave de API (token de autenticação)</li>
                        <li>5. Cole o número e a chave nos campos acima</li>
                        <li>6. Ative o envio de WhatsApp e teste com um agendamento</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle size={20} weight="fill" className="text-emerald-600" />
                    📋 Exemplo de mensagem WhatsApp:
                  </h4>
                  <div className="bg-[#e5ddd5] rounded-lg p-4">
                    <div className="bg-white rounded-2xl p-4 shadow-md max-w-md">
                      <p className="text-xs font-bold text-emerald-700 mb-2">
                        Sistema de Agendamento CIN
                      </p>
                      <div className="text-sm leading-relaxed space-y-1">
                        <p>Olá <strong>João Silva</strong>! 👋</p>
                        <p className="mt-2">🔔 <strong>LEMBRETE</strong> - Seu agendamento é <strong>AMANHÃ</strong>!</p>
                        <p className="mt-2">📅 <strong>Data:</strong> 15 de janeiro de 2025</p>
                        <p>🕐 <strong>Horário:</strong> 09:00</p>
                        <p>📋 <strong>Protocolo:</strong> RG-20250114-ABC123</p>
                        <p className="mt-2">📍 <strong>Local:</strong> Av. Paulo Bastos, 100</p>
                        <p>🗺️ <strong>Ver no mapa:</strong> [Google Maps]</p>
                        <p className="mt-3">⚠️ <strong>NÃO ESQUEÇA:</strong></p>
                        <p className="text-xs ml-2">
                          • CIN anterior<br/>
                          • CPF original<br/>
                          • Comprovante de residência<br/>
                          • Certidão de nascimento
                        </p>
                        <p className="mt-2">⏰ Chegue <strong>10 min antes</strong>!</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-3 italic">
                    ✅ Mensagem formatada, completa e visual para comunicação oficial com o cidadão.
                  </p>
                </div>

                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={28} weight="fill" className="text-green-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-green-900 mb-2">
                        ✨ Recomendação
                      </h4>
                      <p className="text-sm text-green-800">
                        <strong>Ative os canais Email e WhatsApp</strong> para garantir que
                        os cidadãos recebam as notificações em múltiplos canais.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 bg-background p-4 border rounded-lg mt-6">
            <Button onClick={handleRestoreDefaultNotifications} variant="outline" className="flex-1">
              Restaurar Padrões (Ctrl+Shift+R)
            </Button>
            <Button onClick={handleSaveNotifications} className="flex-1">
              💾 Salvar Notificações (Ctrl+S)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações de Contato</CardTitle>
              <CardDescription>Exibidas no sistema para os usuários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={config.contactInfo?.phone || ''}
                  onChange={(e) => onUpdateConfig({
                    ...config,
                    contactInfo: { ...config.contactInfo, phone: e.target.value }
                  })}
                  placeholder="(85) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={config.contactInfo?.email || ''}
                  onChange={(e) => onUpdateConfig({
                    ...config,
                    contactInfo: { ...config.contactInfo, email: e.target.value }
                  })}
                  placeholder="contato@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Endereço</Label>
                <Textarea
                  value={config.contactInfo?.address || ''}
                  onChange={(e) => onUpdateConfig({
                    ...config,
                    contactInfo: { ...config.contactInfo, address: e.target.value }
                  })}
                  placeholder="Av. Principal, 100 - Centro"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secretary" className="space-y-6">
          <SecretaryConfigPanel
            config={config.secretaryConfig || {
              dashboardColor: '#3b82f6',
              accentColor: '#10b981',
              enabledReports: ['appointments', 'by-location', 'by-neighborhood', 'by-status', 'by-period', 'audit-log'],
              allowDateBlocking: true,
              allowReschedule: true,
              allowCancel: true,
              allowPriorityChange: true
            }}
            onUpdateConfig={(secretaryConfig: SecretaryConfig) => {
              onUpdateConfig({
                ...config,
                secretaryConfig
              })
            }}
          />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Agendamento</CardTitle>
              <CardDescription>Regras avançadas para o sistema de agendamentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.appointmentSettings?.allowUserCancellation !== false}
                  onCheckedChange={(checked) => onUpdateConfig({
                    ...config,
                    appointmentSettings: { 
                      ...config.appointmentSettings, 
                      allowUserCancellation: checked 
                    }
                  })}
                />
                <Label>Permitir que usuários cancelem agendamentos</Label>
              </div>

              <div className="space-y-2">
                <Label>Prazo para Cancelamento (horas antes)</Label>
                <Input
                  type="number"
                  value={config.appointmentSettings?.cancellationDeadlineHours || 24}
                  onChange={(e) => onUpdateConfig({
                    ...config,
                    appointmentSettings: {
                      ...config.appointmentSettings,
                      cancellationDeadlineHours: parseInt(e.target.value) || 24
                    }
                  })}
                  min="0"
                  max="72"
                />
              </div>

              <div className="space-y-2">
                <Label>Enviar Lembrete (horas antes)</Label>
                <Input
                  type="number"
                  value={config.appointmentSettings?.reminderHoursBefore || 24}
                  onChange={(e) => onUpdateConfig({
                    ...config,
                    appointmentSettings: {
                      ...config.appointmentSettings,
                      reminderHoursBefore: parseInt(e.target.value) || 24
                    }
                  })}
                  min="1"
                  max="72"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={config.appointmentSettings?.autoConfirm || false}
                  onCheckedChange={(checked) => onUpdateConfig({
                    ...config,
                    appointmentSettings: {
                      ...config.appointmentSettings,
                      autoConfirm: checked
                    }
                  })}
                />
                <Label>Confirmar agendamentos automaticamente</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="text-yellow-900 dark:text-yellow-100">⚠️ Zona de Perigo</CardTitle>
              <CardDescription className="text-yellow-800 dark:text-yellow-200">
                Ações que afetam todo o sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline"
                className="w-full border-yellow-600 text-yellow-900 hover:bg-yellow-100"
                onClick={() => {
                  const confirmed = window.confirm('Tem certeza que deseja resetar todas as configurações?')
                  if (confirmed) {
                    onUpdateConfig({
                      systemName: 'Agendamento CIN',
                      primaryColor: 'oklch(0.45 0.15 145)',
                      secondaryColor: 'oklch(0.65 0.1 180)',
                      accentColor: 'oklch(0.55 0.18 145)',
                      customFields: []
                    })
                    toast.success('Configurações resetadas')
                  }
                }}
              >
                Resetar Todas as Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
