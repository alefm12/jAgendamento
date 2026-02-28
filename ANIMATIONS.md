# Animações de Hover Personalizadas

Este documento descreve todas as classes de animação disponíveis no sistema para cards e botões.

## Animações para Cards

### `.card-hover`
Animação básica de elevação com efeito de luz deslizante.
- Eleva o card levemente
- Adiciona brilho de luz que passa da esquerda para direita
- Aumenta a sombra e adiciona brilho da cor primária

### `.card-lift`
Animação de elevação com efeito de glow.
- Eleva o card significativamente (12px)
- Aumenta ligeiramente a escala (1.03)
- Adiciona glow colorido com gradiente abaixo do card
- Transição suave e elástica

### `.card-border-glow`
Borda animada com gradiente rotativo.
- Mantém elevação moderada (6px)
- Borda com gradiente colorido animado
- Gradiente rotaciona continuamente
- Cores da paleta do sistema (primary, accent, secondary)

### `.card-tilt`
Efeito 3D de inclinação.
- Rotação 3D em dois eixos
- Perspectiva realista
- Elevação moderada (8px)
- Efeito de profundidade

### `.card-zoom`
Zoom interno do conteúdo.
- Mantém card no lugar
- Aumenta escala do conteúdo interno (1.05)
- Transição elástica suave
- Ótimo para cards com imagens

### `.card-float`
Elevação máxima com múltiplas sombras.
- Elevação alta (10px + translateZ)
- Sombras em camadas
- Glow da cor primária
- Efeito de flutuação

### `.card-neon`
Efeito neon pulsante.
- Borda com efeito neon animado
- Pulsação contínua do gradiente
- Blur intenso para efeito de luz
- Elevação moderada (8px)

### `.card-perspective`
Rotação 3D com perspectiva.
- Rotação nos eixos X e Y
- Sombra assimétrica para realismo
- Perspectiva de 1000px
- Elevação (10px)

### `.card-shadow-intense`
Múltiplas camadas de sombras.
- 4 camadas de sombras progressivas
- Elevação alta (12px)
- Glow da cor primária
- Transição suave

### `.card-scale-rotate`
Combinação de escala e rotação.
- Aumenta escala (1.05)
- Rotação leve (2deg)
- Elevação moderada (8px)
- Transição elástica

### `.card-glow-edge`
Borda superior iluminada.
- Linha de 3px no topo com gradiente
- Cores do sistema em sequência
- Elevação moderada (6px)
- Aparecimento suave da linha

## Animações para Botões

### `.button-glow`
Efeito de onda circular ao hover.
- Círculo branco expandindo do centro
- Elevação sutil (2px)
- Box-shadow com cor primária
- Transição de 600ms

### `.button-shine`
Brilho deslizante diagonal.
- Luz diagonal atravessando o botão
- Rotação de 45 graus
- Transição de 600ms
- Efeito de reflexo

### `.button-bounce`
Salto suave e repetido.
- Animação de bounce sutil
- 4 estágios de bounce
- Duração de 600ms
- Não repetitivo (apenas ao hover)

### `.button-pulse`
Pulso expansivo.
- Onda circular expandindo
- Usa cor primária
- Animação infinita ao hover
- Transição suave de opacidade

### `.button-gradient-shift`
Deslocamento de gradiente.
- Gradiente se movimenta para direita
- Background-size de 200%
- Elevação leve (2px)
- Shadow com cor primária

### `.button-slide`
Barra de luz deslizante.
- Luz horizontal da esquerda para direita
- Opacidade de 20%
- Transição de 500ms
- Shadow com cor primária

### `.button-3d`
Efeito de botão físico 3D.
- Sombra sólida simulando profundidade
- Movimento ao pressionar
- Estados: default, hover, active
- Transição rápida (200ms)

### `.button-ripple`
Onda circular expansiva.
- Similar ao Material Design
- Círculo branco expandindo
- Opacidade diminuindo
- Transição de 600ms

### `.button-elastic`
Transformação elástica.
- Escala aumentada (1.1)
- Rotação leve (2deg)
- Função de easing elástica
- Compressão ao clicar

### `.button-flip`
Rotação 3D completa.
- Rotação de 180° no eixo Y
- Transform-style preserve-3d
- Transição de 600ms
- Efeito de virar carta

### `.button-morph`
Transformação de border-radius.
- Border-radius dobra ao hover
- Escala aumentada (1.05)
- Transição elástica
- Shadow com cor primária

### `.button-squeeze`
Compressão horizontal.
- ScaleX aumenta, ScaleY diminui
- Efeito de apertar
- Inversão ao clicar
- Transição de 300ms

## Classes Utilitárias

### `.interactive-hover`
Classe genérica para elementos interativos.
- Elevação leve (3px)
- Escala pequena (1.02)
- Cursor pointer
- Transição suave

## Como Usar

### Em Cards:

```tsx
<Card className="card-lift">
  {/* Conteúdo do card */}
</Card>
```

### Em Botões:

```tsx
<Button className="button-glow">
  Confirmar
</Button>
```

### Combinando Classes:

```tsx
<Button className="button-glow gap-2">
  <Icon size={16} />
  Texto
</Button>
```

## Componentes Helper

### AnimatedCard

```tsx
import { AnimatedCard } from '@/components/AnimatedCard'

<AnimatedCard animation="lift" intensity="strong">
  {/* Conteúdo */}
</AnimatedCard>
```

Opções de `animation`:
- `hover`, `lift`, `border-glow`, `tilt`, `zoom`, `float`, `none`

Opções de `intensity`:
- `subtle`, `normal`, `strong`

### AnimatedButton

```tsx
import { AnimatedButton } from '@/components/AnimatedButton'

<AnimatedButton animation="glow" intensity="normal">
  Clique aqui
</AnimatedButton>
```

Opções de `animation`:
- `glow`, `shine`, `bounce`, `pulse`, `gradient-shift`, `slide`, `none`

Opções de `intensity`:
- `subtle`, `normal`, `strong`

## Dicas de Uso

1. **Performance**: Use animações mais leves (`card-hover`, `button-glow`) para listas longas
2. **Consistência**: Mantenha o mesmo tipo de animação para elementos similares
3. **Hierarquia**: Use animações mais intensas para ações primárias
4. **Acessibilidade**: As animações respeitam `prefers-reduced-motion`
5. **Mobile**: Animações são otimizadas para touch devices

## Customização de Cores

As animações usam variáveis CSS do sistema:
- `--color-primary`
- `--color-accent`
- `--color-secondary`

Essas cores são configuradas no painel de administração e aplicadas automaticamente em todas as animações.
