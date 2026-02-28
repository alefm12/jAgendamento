import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, Bell, Sparkle, Check, X } from '@phosphor-icons/react'

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
  description?: string
  usageExamples?: { text: string; icon?: React.ReactNode }[]
}

function ColorPreviewExamples({ color, label }: { color: string; label: string }) {
  if (label.includes('Primária')) {
    return (
      <div className="mt-4 p-4 border-2 rounded-lg bg-muted/30 space-y-3">
        <Label className="text-sm font-semibold">Exemplos Visuais - Onde esta cor aparece:</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Botão Principal</Label>
            <Button 
              className="w-full"
              style={{ backgroundColor: color, borderColor: color }}
            >
              <Check size={16} className="mr-2" />
              Agendar
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Link de Navegação</Label>
            <div className="p-3 bg-card rounded border">
              <a href="#" className="font-medium underline-offset-4 hover:underline" style={{ color }}>
                Ver Detalhes →
              </a>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Input com Foco</Label>
            <Input 
              placeholder="Digite aqui..." 
              className="focus-visible:ring-2"
              style={{ 
                '--tw-ring-color': color,
                borderColor: color
              } as any}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ícone de Destaque</Label>
            <div className="p-3 bg-card rounded border flex items-center gap-2">
              <CalendarCheck size={24} weight="duotone" style={{ color }} />
              <span className="text-sm">Agendamento</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (label.includes('Secundária')) {
    return (
      <div className="mt-4 p-4 border-2 rounded-lg bg-muted/30 space-y-3">
        <Label className="text-sm font-semibold">Exemplos Visuais - Onde esta cor aparece:</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Botão Secundário</Label>
            <Button 
              variant="secondary"
              className="w-full"
              style={{ backgroundColor: color, borderColor: color }}
            >
              <X size={16} className="mr-2" />
              Cancelar
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Badge de Status</Label>
            <div className="p-3 bg-card rounded border">
              <Badge style={{ backgroundColor: color }}>
                Pendente
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Card de Fundo</Label>
            <div 
              className="p-3 rounded border-2"
              style={{ backgroundColor: `${color}20`, borderColor: `${color}60` }}
            >
              <p className="text-xs font-medium">Card Informativo</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Hover de Menu</Label>
            <div className="p-2 rounded border">
              <div 
                className="p-2 rounded font-medium text-sm"
                style={{ backgroundColor: `${color}40` }}
              >
                Item de Menu
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (label.includes('Destaque')) {
    return (
      <div className="mt-4 p-4 border-2 rounded-lg bg-muted/30 space-y-3">
        <Label className="text-sm font-semibold">Exemplos Visuais - Onde esta cor aparece:</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Notificação Badge</Label>
            <div className="p-3 bg-card rounded border relative inline-block">
              <Bell size={24} />
              <span 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: color }}
              >
                3
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Call-to-Action</Label>
            <Button 
              className="w-full font-bold"
              style={{ 
                backgroundColor: color, 
                borderColor: color,
                boxShadow: `0 4px 14px ${color}60`
              }}
            >
              <Sparkle size={16} weight="fill" className="mr-2" />
              Destaque!
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Borda de Foco</Label>
            <div 
              className="p-3 rounded-lg border-2 bg-card"
              style={{ 
                borderColor: color,
                boxShadow: `0 0 0 3px ${color}30`
              }}
            >
              <p className="text-xs font-medium">Elemento em Foco</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tag Especial</Label>
            <div className="p-3 bg-card rounded border">
              <Badge 
                className="font-semibold"
                style={{ 
                  backgroundColor: color,
                  color: 'white'
                }}
              >
                ⭐ Urgente
              </Badge>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  r = r / 255
  g = g / 255
  b = b / 255

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

  const C = Math.sqrt(A * A + B * B)
  let H = Math.atan2(B, A) * (180 / Math.PI)
  if (H < 0) H += 360

  return {
    l: Math.max(0, Math.min(1, L)),
    c: Math.max(0, Math.min(0.4, C)),
    h: H
  }
}

function oklchToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hRad = h * (Math.PI / 180)
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  let b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3

  r = Math.max(0, Math.min(1, r))
  g = Math.max(0, Math.min(1, g))
  b2 = Math.max(0, Math.min(1, b2))

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b2 * 255)
  }
}

export function ColorPicker({ label, value, onChange, description, usageExamples }: ColorPickerProps) {
  const parseOklch = (oklchStr: string): { l: number; c: number; h: number } => {
    const match = oklchStr.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/)
    if (match) {
      return {
        l: parseFloat(match[1]),
        c: parseFloat(match[2]),
        h: parseFloat(match[3])
      }
    }
    return { l: 0.5, c: 0.1, h: 145 }
  }

  const [oklch, setOklch] = useState(parseOklch(value))
  const [rgb, setRgb] = useState({ r: 128, g: 128, b: 128 })
  const [hexInput, setHexInput] = useState('#808080')

  useEffect(() => {
    const parsed = parseOklch(value)
    setOklch(parsed)
    const rgbVal = oklchToRgb(parsed.l, parsed.c, parsed.h)
    setRgb(rgbVal)
    setHexInput(`#${rgbVal.r.toString(16).padStart(2, '0')}${rgbVal.g.toString(16).padStart(2, '0')}${rgbVal.b.toString(16).padStart(2, '0')}`)
  }, [value])

  const updateFromOklch = (newOklch: { l: number; c: number; h: number }) => {
    setOklch(newOklch)
    const rgbVal = oklchToRgb(newOklch.l, newOklch.c, newOklch.h)
    setRgb(rgbVal)
    setHexInput(`#${rgbVal.r.toString(16).padStart(2, '0')}${rgbVal.g.toString(16).padStart(2, '0')}${rgbVal.b.toString(16).padStart(2, '0')}`)
    onChange(`oklch(${newOklch.l.toFixed(3)} ${newOklch.c.toFixed(3)} ${newOklch.h.toFixed(3)})`)
  }

  const updateFromRgb = (newRgb: { r: number; g: number; b: number }) => {
    setRgb(newRgb)
    const newOklch = rgbToOklch(newRgb.r, newRgb.g, newRgb.b)
    setOklch(newOklch)
    setHexInput(`#${newRgb.r.toString(16).padStart(2, '0')}${newRgb.g.toString(16).padStart(2, '0')}${newRgb.b.toString(16).padStart(2, '0')}`)
    onChange(`oklch(${newOklch.l.toFixed(3)} ${newOklch.c.toFixed(3)} ${newOklch.h.toFixed(3)})`)
  }

  const updateFromHex = (hex: string) => {
    setHexInput(hex)
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (match) {
      const newRgb = {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16)
      }
      updateFromRgb(newRgb)
    }
  }

  const presetColors = [
    { name: 'Verde', oklch: 'oklch(0.45 0.15 145)' },
    { name: 'Azul', oklch: 'oklch(0.45 0.15 250)' },
    { name: 'Vermelho', oklch: 'oklch(0.55 0.22 25)' },
    { name: 'Laranja', oklch: 'oklch(0.65 0.20 60)' },
    { name: 'Roxo', oklch: 'oklch(0.45 0.20 290)' },
    { name: 'Cinza', oklch: 'oklch(0.50 0.02 250)' },
  ]

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="flex-1">
            <Label className="text-base font-semibold">{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            {usageExamples && usageExamples.length > 0 && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs text-muted-foreground">Esta cor é usada em:</Label>
                <div className="flex flex-wrap gap-2">
                  {usageExamples.map((example, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="gap-1.5 py-1.5 px-3"
                      style={{ 
                        backgroundColor: `${value}15`,
                        borderColor: value,
                        color: value
                      }}
                    >
                      {example.icon}
                      {example.text}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div 
            className="w-24 h-24 rounded-xl border-4 shadow-lg transition-all flex-shrink-0"
            style={{ 
              backgroundColor: value,
              borderColor: value,
              boxShadow: `0 8px 24px ${value}40`
            }}
          />
        </div>

        <ColorPreviewExamples color={value} label={label} />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Matiz (Hue) - {Math.round(oklch.h)}°</Label>
            <Slider
              value={[oklch.h]}
              onValueChange={([h]) => updateFromOklch({ ...oklch, h })}
              min={0}
              max={360}
              step={1}
              className="w-full"
            />
            <div className="h-6 rounded"
              style={{
                background: 'linear-gradient(to right, oklch(0.6 0.15 0), oklch(0.6 0.15 60), oklch(0.6 0.15 120), oklch(0.6 0.15 180), oklch(0.6 0.15 240), oklch(0.6 0.15 300), oklch(0.6 0.15 360))'
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Luminosidade (Lightness) - {Math.round(oklch.l * 100)}%</Label>
            <Slider
              value={[oklch.l * 100]}
              onValueChange={([l]) => updateFromOklch({ ...oklch, l: l / 100 })}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Saturação (Chroma) - {Math.round(oklch.c * 100)}%</Label>
            <Slider
              value={[oklch.c * 100]}
              onValueChange={([c]) => updateFromOklch({ ...oklch, c: c / 100 })}
              min={0}
              max={40}
              step={0.5}
              className="w-full"
            />
          </div>
        </div>

        <div className="pt-4 border-t space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">R</Label>
              <Input
                type="number"
                value={rgb.r}
                onChange={(e) => updateFromRgb({ ...rgb, r: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) })}
                min={0}
                max={255}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">G</Label>
              <Input
                type="number"
                value={rgb.g}
                onChange={(e) => updateFromRgb({ ...rgb, g: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) })}
                min={0}
                max={255}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">B</Label>
              <Input
                type="number"
                value={rgb.b}
                onChange={(e) => updateFromRgb({ ...rgb, b: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) })}
                min={0}
                max={255}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">HEX</Label>
            <Input
              value={hexInput}
              onChange={(e) => updateFromHex(e.target.value)}
              placeholder="#000000"
              className="h-9 font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">OKLCH</Label>
            <Input
              value={value}
              readOnly
              className="h-9 font-mono text-xs bg-muted"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Label className="text-xs mb-2 block">Cores Predefinidas</Label>
          <div className="grid grid-cols-6 gap-2">
            {presetColors.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                className="h-10 p-0"
                style={{ backgroundColor: preset.oklch }}
                onClick={() => onChange(preset.oklch)}
                title={preset.name}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
