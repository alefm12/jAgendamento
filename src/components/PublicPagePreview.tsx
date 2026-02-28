import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { IdentificationCard } from '@phosphor-icons/react'
import type { SystemConfig } from '@/lib/types'

interface PublicPagePreviewProps {
  config: SystemConfig
  onUpdateConfig: (config: SystemConfig) => void
}

export function PublicPagePreview({ config, onUpdateConfig }: PublicPagePreviewProps) {
  const logoSize = config.logoSize || 40
  const titleSize = config.titleSize || 24
  const subtitleSize = config.subtitleSize || 14
  const buttonSize = config.buttonSize || 16
  const borderRadius = config.borderRadiusPreview || 12

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Controles de Aparência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Tamanho da Logo: {logoSize}px</Label>
              <Slider
                value={[logoSize]}
                onValueChange={([value]) => onUpdateConfig({ ...config, logoSize: value })}
                min={24}
                max={120}
                step={4}
              />
            </div>

            <div className="space-y-3">
              <Label>Tamanho do Título: {titleSize}px</Label>
              <Slider
                value={[titleSize]}
                onValueChange={([value]) => onUpdateConfig({ ...config, titleSize: value })}
                min={16}
                max={48}
                step={2}
              />
            </div>

            <div className="space-y-3">
              <Label>Tamanho do Subtítulo: {subtitleSize}px</Label>
              <Slider
                value={[subtitleSize]}
                onValueChange={([value]) => onUpdateConfig({ ...config, subtitleSize: value })}
                min={10}
                max={24}
                step={1}
              />
            </div>

            <div className="space-y-3">
              <Label>Tamanho do Texto dos Botões: {buttonSize}px</Label>
              <Slider
                value={[buttonSize]}
                onValueChange={([value]) => onUpdateConfig({ ...config, buttonSize: value })}
                min={12}
                max={24}
                step={1}
              />
            </div>

            <div className="space-y-3">
              <Label>Arredondamento dos Cantos: {borderRadius}px</Label>
              <Slider
                value={[borderRadius]}
                onValueChange={([value]) => onUpdateConfig({ ...config, borderRadiusPreview: value })}
                min={0}
                max={24}
                step={2}
              />
            </div>

            <div className="pt-4 border-t space-y-3">
              <Label>Fonte do Título</Label>
              <Input
                value={config.titleFont || 'Work Sans'}
                onChange={(e) => onUpdateConfig({ ...config, titleFont: e.target.value })}
                placeholder="Work Sans"
              />
              <p className="text-xs text-muted-foreground">
                Use fontes do Google Fonts (ex: Work Sans, Inter, Roboto)
              </p>
            </div>

            <div className="space-y-3">
              <Label>Fonte do Corpo</Label>
              <Input
                value={config.bodyFont || 'Inter'}
                onChange={(e) => onUpdateConfig({ ...config, bodyFont: e.target.value })}
                placeholder="Inter"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Preview da Página Pública</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="border-2 rounded-lg overflow-hidden bg-background"
              style={{ 
                fontFamily: config.bodyFont || 'Inter, system-ui, sans-serif',
              }}
            >
              <div 
                className="border-b p-4"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <div className="flex items-center gap-3">
                  {config.logo ? (
                    <img 
                      src={config.logo} 
                      alt="Logo" 
                      style={{ 
                        height: `${logoSize}px`, 
                        width: `${logoSize}px`,
                        objectFit: 'contain' 
                      }} 
                    />
                  ) : (
                    <div style={{ color: config.primaryColor }}>
                      <IdentificationCard size={logoSize} weight="duotone" />
                    </div>
                  )}
                  <div>
                    <h1 
                      style={{ 
                        fontSize: `${titleSize}px`,
                        fontFamily: config.titleFont || 'Work Sans, system-ui, sans-serif',
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        lineHeight: 1.2
                      }}
                    >
                      {config.systemName || 'Agendamento CIN'}
                    </h1>
                    <p 
                      style={{ 
                        fontSize: `${subtitleSize}px`,
                        color: 'var(--muted-foreground)',
                        marginTop: '2px'
                      }}
                    >
                      Sistema de Agendamento da Carteira de Identidade Nacional
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div 
                  className="p-4 border"
                  style={{ 
                    borderRadius: `${borderRadius}px`,
                    backgroundColor: 'var(--card)'
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{ 
                        backgroundColor: config.primaryColor,
                        color: config.primaryColor?.includes('oklch(0.9') || config.primaryColor?.includes('oklch(1') ? '#000' : '#fff'
                      }}
                    >
                      1
                    </div>
                    <span style={{ fontSize: `${subtitleSize}px`, fontWeight: 500 }}>
                      Escolher Data
                    </span>
                  </div>
                  
                  <div 
                    className="border p-3"
                    style={{ borderRadius: `${borderRadius}px` }}
                  >
                    <div className="text-center mb-2" style={{ fontSize: `${subtitleSize}px`, fontWeight: 600 }}>
                      Janeiro 2025
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                        <div key={i} style={{ fontSize: `${subtitleSize - 2}px`, color: 'var(--muted-foreground)' }}>
                          {day}
                        </div>
                      ))}
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                        <button
                          key={day}
                          className="aspect-square rounded flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{
                            fontSize: `${subtitleSize - 2}px`,
                            backgroundColor: day === 3 ? config.primaryColor : 'transparent',
                            color: day === 3 ? '#fff' : 'var(--foreground)',
                            border: day === 3 ? 'none' : '1px solid var(--border)',
                            borderRadius: `${Math.min(borderRadius, 8)}px`
                          }}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label style={{ fontSize: `${subtitleSize}px`, fontWeight: 500 }}>
                    Horário
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['08:00', '09:00', '10:00'].map((time) => (
                      <button
                        key={time}
                        className="p-2 border rounded text-center hover:opacity-80 transition-opacity"
                        style={{
                          fontSize: `${subtitleSize}px`,
                          backgroundColor: time === '09:00' ? config.secondaryColor : 'transparent',
                          color: time === '09:00' ? '#fff' : 'var(--foreground)',
                          borderColor: time === '09:00' ? config.secondaryColor : 'var(--border)',
                          borderRadius: `${borderRadius}px`
                        }}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="w-full py-3 rounded font-medium transition-opacity hover:opacity-90"
                  style={{
                    fontSize: `${buttonSize}px`,
                    backgroundColor: config.accentColor,
                    color: '#fff',
                    borderRadius: `${borderRadius}px`
                  }}
                >
                  Confirmar Agendamento
                </button>

                <button
                  className="w-full py-2 rounded border font-medium transition-opacity hover:opacity-80"
                  style={{
                    fontSize: `${buttonSize - 2}px`,
                    backgroundColor: 'transparent',
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)',
                    borderRadius: `${borderRadius}px`
                  }}
                >
                  Voltar
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            👆 As alterações são aplicadas em tempo real
          </p>
        </div>
      </div>
    </div>
  )
}
