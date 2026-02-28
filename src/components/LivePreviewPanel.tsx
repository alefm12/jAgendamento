import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowRight, CheckCircle, Circle, Sparkle, CalendarBlank, MapPin, Bell, Eye } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface LivePreviewPanelProps {
  activeElement: 'primary' | 'secondary' | 'accent' | 'title' | 'subtitle' | 'button' | 'border' | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  titleSize?: number
  subtitleSize?: number
  buttonSize?: number
  borderRadius?: number
  systemName?: string
}

export function LivePreviewPanel({
  activeElement,
  primaryColor,
  secondaryColor,
  accentColor,
  titleSize = 24,
  subtitleSize = 14,
  buttonSize = 16,
  borderRadius = 12,
  systemName = 'Sistema de Agendamento'
}: LivePreviewPanelProps) {
  const getHighlightClass = (element: string) => {
    if (activeElement === element) {
      return 'ring-4 ring-yellow-400 ring-offset-4 shadow-2xl shadow-yellow-400/50 scale-105'
    }
    return ''
  }

  const showIndicator = (element: string) => activeElement === element

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 border-2">
      <CardHeader className="border-b bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkle size={24} weight="duotone" className="text-purple-600 animate-pulse" />
            Preview em Tempo Real
          </CardTitle>
          <Badge variant="secondary" className="animate-pulse">
            {activeElement ? `Editando: ${getElementName(activeElement)}` : 'Selecione uma configuração'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="relative bg-white rounded-2xl p-8 shadow-lg">
          <div className="space-y-6">
            <div className="relative">
              <motion.div
                className={cn(
                  'transition-all duration-300',
                  getHighlightClass('title')
                )}
                animate={{
                  scale: activeElement === 'title' ? 1.05 : 1,
                }}
              >
                <h1 
                  className="font-bold text-foreground"
                  style={{ fontSize: `${titleSize}px` }}
                >
                  {systemName}
                </h1>
              </motion.div>
              
              <AnimatePresence>
                {showIndicator('title') && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute -left-4 top-0 flex items-center gap-2"
                  >
                    <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <ArrowRight size={12} weight="bold" />
                      Tamanho: {titleSize}px
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <motion.p
                className={cn(
                  'text-muted-foreground transition-all duration-300',
                  getHighlightClass('subtitle')
                )}
                style={{ fontSize: `${subtitleSize}px` }}
                animate={{
                  scale: activeElement === 'subtitle' ? 1.05 : 1,
                }}
              >
                Sistema de Agendamento Online
              </motion.p>
              
              <AnimatePresence>
                {showIndicator('subtitle') && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute -left-4 top-0 flex items-center gap-2"
                  >
                    <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <ArrowRight size={12} weight="bold" />
                      Tamanho: {subtitleSize}px
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="relative">
                <motion.div
                  className={cn('transition-all duration-300', getHighlightClass('primary'))}
                  animate={{
                    scale: activeElement === 'primary' ? 1.1 : 1,
                  }}
                >
                  <Button
                    className="w-full relative overflow-visible"
                    style={{ 
                      backgroundColor: primaryColor,
                      fontSize: `${buttonSize}px`,
                      borderRadius: `${borderRadius}px`
                    }}
                  >
                    Agendar
                  </Button>
                </motion.div>
                
                <AnimatePresence>
                  {showIndicator('primary') && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute -bottom-20 left-0 right-0 flex flex-col items-center gap-1 z-50"
                    >
                      <div className="w-0.5 h-8 bg-yellow-400" />
                      <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                        <div className="font-semibold">✓ Cor Primária</div>
                        <div className="text-[10px] opacity-80">Botões de ação principal</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <motion.div
                  className={cn('transition-all duration-300', getHighlightClass('secondary'))}
                  animate={{
                    scale: activeElement === 'secondary' ? 1.1 : 1,
                  }}
                >
                  <Button
                    variant="secondary"
                    className="w-full relative overflow-visible"
                    style={{ 
                      backgroundColor: secondaryColor,
                      fontSize: `${buttonSize}px`,
                      borderRadius: `${borderRadius}px`
                    }}
                  >
                    Cancelar
                  </Button>
                </motion.div>

                <AnimatePresence>
                  {showIndicator('secondary') && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute -bottom-20 left-0 right-0 flex flex-col items-center gap-1 z-50"
                    >
                      <div className="w-0.5 h-8 bg-yellow-400" />
                      <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                        <div className="font-semibold">✓ Cor Secundária</div>
                        <div className="text-[10px] opacity-80">Ações secundárias</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <motion.div
                  className={cn('transition-all duration-300', getHighlightClass('accent'))}
                  animate={{
                    scale: activeElement === 'accent' ? 1.1 : 1,
                  }}
                >
                  <Button
                    variant="outline"
                    className="w-full relative overflow-visible hover:bg-accent"
                    style={{ 
                      fontSize: `${buttonSize}px`,
                      borderRadius: `${borderRadius}px`,
                      borderColor: accentColor
                    }}
                  >
                    Ver Mais
                  </Button>
                </motion.div>

                <AnimatePresence>
                  {showIndicator('accent') && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute -bottom-20 left-0 right-0 flex flex-col items-center gap-1 z-50"
                    >
                      <div className="w-0.5 h-8 bg-yellow-400" />
                      <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                        <div className="font-semibold">✓ Cor de Destaque</div>
                        <div className="text-[10px] opacity-80">Bordas e hover</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {activeElement === 'primary' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-6 mt-12 space-y-3 border-t"
                >
                  <div className="text-sm font-semibold text-yellow-900 flex items-center gap-2 mb-3">
                    <Eye size={18} weight="duotone" />
                    Exemplos onde a Cor Primária aparece:
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarBlank size={20} style={{ color: primaryColor }} weight="duotone" />
                        <span className="text-xs font-semibold">Ícones do sistema</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Todos os ícones principais usam esta cor</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <div className="mb-2">
                        <a href="#" style={{ color: primaryColor }} className="text-xs font-semibold underline">
                          Link de exemplo
                        </a>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Links e textos de ênfase</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <Badge style={{ backgroundColor: primaryColor }} className="text-white text-xs mb-1">
                        Confirmado
                      </Badge>
                      <div className="text-[10px] text-muted-foreground">Badges de status</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <Input 
                        placeholder="Digite aqui" 
                        className="text-xs h-7" 
                        style={{ 
                          borderRadius: `${borderRadius * 0.6}px`,
                          outlineColor: primaryColor
                        }}
                      />
                      <div className="text-[10px] text-muted-foreground mt-1">Foco nos campos</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeElement === 'secondary' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-6 mt-12 space-y-3 border-t"
                >
                  <div className="text-sm font-semibold text-yellow-900 flex items-center gap-2 mb-3">
                    <Eye size={18} weight="duotone" />
                    Exemplos onde a Cor Secundária aparece:
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border-2 border-yellow-200" style={{ backgroundColor: secondaryColor }}>
                      <div className="text-xs font-semibold mb-1">Fundo de Cards</div>
                      <div className="text-[10px] opacity-70">Backgrounds suaves para conteúdo</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <Badge variant="secondary" style={{ backgroundColor: secondaryColor }} className="text-xs mb-1">
                        Pendente
                      </Badge>
                      <div className="text-[10px] text-muted-foreground">Badges secundários</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <div className="flex gap-1 mb-1">
                        <div className="w-8 h-2 rounded" style={{ backgroundColor: secondaryColor }} />
                        <div className="w-8 h-2 rounded" style={{ backgroundColor: secondaryColor }} />
                        <div className="w-4 h-2 rounded bg-gray-200" />
                      </div>
                      <div className="text-[10px] text-muted-foreground">Barras de progresso</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <Button variant="ghost" size="sm" className="h-6 text-xs" style={{ backgroundColor: secondaryColor }}>
                        Opção
                      </Button>
                      <div className="text-[10px] text-muted-foreground mt-1">Botões ghost/subtle</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeElement === 'accent' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-6 mt-12 space-y-3 border-t"
                >
                  <div className="text-sm font-semibold text-yellow-900 flex items-center gap-2 mb-3">
                    <Eye size={18} weight="duotone" />
                    Exemplos onde a Cor de Destaque aparece:
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg border-2" style={{ borderColor: accentColor }}>
                      <div className="text-xs font-semibold mb-1">Bordas importantes</div>
                      <div className="text-[10px] text-muted-foreground">Destaque de elementos selecionados</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Bell size={18} style={{ color: accentColor }} weight="fill" />
                        <span className="text-xs font-semibold">Notificações</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Alertas e destaques</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200">
                      <div 
                        className="h-1 rounded-full mb-2" 
                        style={{ 
                          background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` 
                        }}
                      />
                      <div className="text-[10px] text-muted-foreground">Gradientes decorativos</div>
                    </div>
                    
                    <div className="p-3 bg-white rounded-lg border-2 border-yellow-200 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="text-xs font-semibold mb-1" style={{ color: accentColor }}>
                        Hover Aqui
                      </div>
                      <div className="text-[10px] text-muted-foreground">Estados hover interativos</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(activeElement === 'button' || activeElement === 'border') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-6 mt-12 space-y-4 border-t"
                >
                  {activeElement === 'button' && (
                    <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-400">
                      <CheckCircle size={24} className="text-yellow-600" weight="fill" />
                      <div>
                        <div className="font-semibold text-sm">Tamanho de Fonte dos Botões</div>
                        <div className="text-xs text-muted-foreground">Atualmente: {buttonSize}px - Afeta texto dentro de todos os botões</div>
                      </div>
                    </div>
                  )}

                  {activeElement === 'border' && (
                    <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-400">
                      <Circle size={24} className="text-yellow-600" weight="fill" />
                      <div>
                        <div className="font-semibold text-sm">Raio das Bordas (Border Radius)</div>
                        <div className="text-xs text-muted-foreground">Atualmente: {borderRadius}px - Afeta todos os elementos arredondados</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative pt-6 border-t">
              <motion.div
                className={cn('transition-all duration-300', getHighlightClass('border'))}
                animate={{
                  scale: activeElement === 'border' ? 1.05 : 1,
                }}
              >
                <Card style={{ borderRadius: `${borderRadius}px` }}>
                  <CardHeader>
                    <CardTitle style={{ fontSize: `${Math.round(titleSize * 0.75)}px` }}>
                      Exemplo de Card
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p style={{ fontSize: `${subtitleSize}px` }}>
                      Os cards também seguem o raio de borda configurado
                    </p>
                    <Input 
                      placeholder="Campo de exemplo" 
                      className="mt-4"
                      style={{ borderRadius: `${borderRadius * 0.6}px` }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
              
              <AnimatePresence>
                {showIndicator('border') && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="absolute -right-4 top-8 flex items-center gap-2"
                  >
                    <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                      <div className="font-semibold">Raio: {borderRadius}px</div>
                      <div className="text-[10px] opacity-80">Bordas arredondadas</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div className="p-3 bg-white rounded-lg border">
            <div 
              className="w-8 h-8 rounded-full mx-auto mb-2 border-2"
              style={{ backgroundColor: primaryColor }}
            />
            <div className="font-semibold">Primária</div>
            <div className="text-muted-foreground text-[10px] mt-1">Botões principais, links</div>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <div 
              className="w-8 h-8 rounded-full mx-auto mb-2 border-2"
              style={{ backgroundColor: secondaryColor }}
            />
            <div className="font-semibold">Secundária</div>
            <div className="text-muted-foreground text-[10px] mt-1">Botões secundários</div>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <div 
              className="w-8 h-8 rounded-full mx-auto mb-2 border-2"
              style={{ backgroundColor: accentColor }}
            />
            <div className="font-semibold">Destaque</div>
            <div className="text-muted-foreground text-[10px] mt-1">Hover, foco, ênfase</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getElementName(element: string): string {
  const names: Record<string, string> = {
    primary: 'Cor Primária',
    secondary: 'Cor Secundária',
    accent: 'Cor de Destaque',
    title: 'Tamanho do Título',
    subtitle: 'Tamanho do Subtítulo',
    button: 'Tamanho do Botão',
    border: 'Raio das Bordas'
  }
  return names[element] || element
}
