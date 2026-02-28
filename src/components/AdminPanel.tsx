import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Palette, TextT, Phone, EnvelopeSimple, MapPin, ChatText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { SystemConfig } from '@/lib/types'

interface AdminPanelProps {
  config: SystemConfig
  onUpdateConfig: (config: SystemConfig) => void
}

export function AdminPanel({ config, onUpdateConfig }: AdminPanelProps) {
  const [localConfig, setLocalConfig] = useState<SystemConfig>(config)

  const handleUpdate = (field: keyof SystemConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleContactUpdate = (field: string, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      contactInfo: {
        ...prev.contactInfo,
        [field]: value
      }
    }))
  }

  const handleSave = () => {
    if (!localConfig.systemName.trim()) {
      toast.error('Nome do sistema é obrigatório')
      return
    }

    if (!isValidColor(localConfig.primaryColor) || 
        !isValidColor(localConfig.secondaryColor) || 
        !isValidColor(localConfig.accentColor)) {
      toast.error('Cores devem estar no formato OKLCH válido')
      return
    }

    onUpdateConfig(localConfig)
    toast.success('Configurações salvas com sucesso!')
  }

  const isValidColor = (color: string): boolean => {
    return color.startsWith('oklch(') && color.endsWith(')')
  }

  const handleReset = () => {
    setLocalConfig(config)
    toast.info('Alterações descartadas')
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-3xl font-semibold mb-2">Painel de Administração</h2>
        <p className="text-muted-foreground">Configure a aparência e informações do sistema</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TextT className="text-primary" size={24} weight="duotone" />
              <CardTitle>Identidade Visual</CardTitle>
            </div>
            <CardDescription>Nome e branding do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-name">Nome do Sistema</Label>
              <Input
                id="system-name"
                value={localConfig.systemName}
                onChange={(e) => handleUpdate('systemName', e.target.value)}
                placeholder="Agendamento CIN"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo-url">URL do Logo (opcional)</Label>
              <Input
                id="logo-url"
                value={localConfig.logo || ''}
                onChange={(e) => handleUpdate('logo', e.target.value)}
                placeholder="https://exemplo.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Cole o link de uma imagem hospedada online
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="text-primary" size={24} weight="duotone" />
              <CardTitle>Paleta de Cores</CardTitle>
            </div>
            <CardDescription>Personalize as cores do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  value={localConfig.primaryColor}
                  onChange={(e) => handleUpdate('primaryColor', e.target.value)}
                  placeholder="oklch(0.45 0.15 145)"
                  className="font-mono text-sm"
                />
                <div 
                  className="w-12 h-10 rounded-md border-2 border-border flex-shrink-0"
                  style={{ background: localConfig.primaryColor }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-color">Cor Secundária</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  value={localConfig.secondaryColor}
                  onChange={(e) => handleUpdate('secondaryColor', e.target.value)}
                  placeholder="oklch(0.65 0.1 180)"
                  className="font-mono text-sm"
                />
                <div 
                  className="w-12 h-10 rounded-md border-2 border-border flex-shrink-0"
                  style={{ background: localConfig.secondaryColor }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  value={localConfig.accentColor}
                  onChange={(e) => handleUpdate('accentColor', e.target.value)}
                  placeholder="oklch(0.55 0.18 145)"
                  className="font-mono text-sm"
                />
                <div 
                  className="w-12 h-10 rounded-md border-2 border-border flex-shrink-0"
                  style={{ background: localConfig.accentColor }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Use o formato OKLCH: oklch(lightness chroma hue)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="text-primary" size={24} weight="duotone" />
              <CardTitle>Informações de Contato</CardTitle>
            </div>
            <CardDescription>Dados para exibição no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Telefone</Label>
              <Input
                id="contact-phone"
                value={localConfig.contactInfo?.phone || ''}
                onChange={(e) => handleContactUpdate('phone', e.target.value)}
                placeholder="(88) 3442-1234"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={localConfig.contactInfo?.email || ''}
                onChange={(e) => handleContactUpdate('email', e.target.value)}
                placeholder="contato@prefeitura.gov.br"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-address">Endereço</Label>
              <Input
                id="contact-address"
                value={localConfig.contactInfo?.address || ''}
                onChange={(e) => handleContactUpdate('address', e.target.value)}
                placeholder="Av. Principal, 123 - Centro"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChatText className="text-primary" size={24} weight="duotone" />
              <CardTitle>Mensagem de Lembrete</CardTitle>
            </div>
            <CardDescription>Texto enviado nos lembretes automáticos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reminder-message">Mensagem Personalizada</Label>
              <Textarea
                id="reminder-message"
                value={localConfig.reminderMessage || ''}
                onChange={(e) => handleUpdate('reminderMessage', e.target.value)}
                placeholder="Olá {nome}, lembramos que você tem agendamento para {data} às {hora} para emissão de CIN. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!"
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Use as variáveis: {'{nome}'}, {'{data}'}, {'{hora}'}, {'{endereco}'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold mb-1">Salvar Alterações</p>
              <p className="text-sm text-muted-foreground">
                As alterações serão aplicadas imediatamente em todo o sistema
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset}>
                Descartar
              </Button>
              <Button onClick={handleSave}>
                Salvar Configurações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview das Cores</CardTitle>
          <CardDescription>Visualize como as cores ficarão no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Primária</p>
              <div 
                className="h-20 rounded-lg border-2 border-border"
                style={{ background: localConfig.primaryColor }}
              />
              <Button 
                className="w-full"
                style={{ 
                  background: localConfig.primaryColor,
                  color: 'white'
                }}
              >
                Botão Primário
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Secundária</p>
              <div 
                className="h-20 rounded-lg border-2 border-border"
                style={{ background: localConfig.secondaryColor }}
              />
              <Button 
                variant="secondary"
                className="w-full"
                style={{ 
                  background: localConfig.secondaryColor,
                  color: 'white'
                }}
              >
                Botão Secundário
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Destaque</p>
              <div 
                className="h-20 rounded-lg border-2 border-border"
                style={{ background: localConfig.accentColor }}
              />
              <Button 
                className="w-full"
                style={{ 
                  background: localConfig.accentColor,
                  color: 'white'
                }}
              >
                Botão Destaque
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
