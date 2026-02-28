import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ScrollProgressIndicatorProps {
  className?: string
  trackClassName?: string
  thumbClassName?: string
}

export function ScrollProgressIndicator({ 
  className,
  trackClassName,
  thumbClassName 
}: ScrollProgressIndicatorProps) {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = containerRef.current?.closest('[data-scroll-container]') as HTMLElement
      
      if (!scrollContainer) return

      const scrollTop = scrollContainer.scrollTop
      const scrollHeight = scrollContainer.scrollHeight
      const clientHeight = scrollContainer.clientHeight
      
      const maxScroll = scrollHeight - clientHeight
      
      if (maxScroll > 0) {
        const progress = (scrollTop / maxScroll) * 100
        setScrollProgress(Math.min(Math.max(progress, 0), 100))
        setIsVisible(maxScroll > 10)
      } else {
        setIsVisible(false)
      }
    }

    const scrollContainer = containerRef.current?.closest('[data-scroll-container]') as HTMLElement
    
    if (scrollContainer) {
      handleScroll()
      scrollContainer.addEventListener('scroll', handleScroll)
      
      const resizeObserver = new ResizeObserver(() => {
        handleScroll()
      })
      
      resizeObserver.observe(scrollContainer)

      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll)
        resizeObserver.disconnect()
      }
    }
  }, [])

  if (!isVisible) return null

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed right-6 top-1/2 -translate-y-1/2 z-40",
        "flex flex-col items-center gap-2",
        className
      )}
    >
      <div className={cn(
        "relative h-48 w-1.5 rounded-full bg-muted/40 backdrop-blur-sm",
        "shadow-sm border border-border/50",
        trackClassName
      )}>
        <div 
          className={cn(
            "absolute top-0 left-0 w-full rounded-full",
            "bg-gradient-to-b from-primary via-accent to-primary",
            "transition-all duration-150 ease-out",
            "shadow-lg shadow-primary/30",
            thumbClassName
          )}
          style={{ 
            height: `${scrollProgress}%`,
          }}
        >
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/50 animate-pulse" />
        </div>
      </div>
      
      <div className="text-xs font-medium text-muted-foreground bg-card/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50 shadow-sm">
        {Math.round(scrollProgress)}%
      </div>
    </div>
  )
}
