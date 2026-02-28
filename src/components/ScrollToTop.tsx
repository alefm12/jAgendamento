import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUp } from '@phosphor-icons/react'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)
  const { scrollYProgress } = useScroll()
  const scaleProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    toggleVisibility()
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    const duration = 800
    const start = window.scrollY
    const startTime = performance.now()

    const easeInOutCubic = (t: number) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = easeInOutCubic(progress)

      window.scrollTo(0, start * (1 - easeProgress))

      if (progress < 1) {
        requestAnimationFrame(animateScroll)
      }
    }

    requestAnimationFrame(animateScroll)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 100 }}
          transition={{ 
            type: 'spring',
            stiffness: 260,
            damping: 20
          }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={scrollToTop}
              size="icon"
              className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary via-accent to-secondary hover:shadow-primary/50 transition-all duration-300 group overflow-hidden"
              aria-label="Voltar ao topo"
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent"
                style={{ scale: scaleProgress }}
              />
              
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <ArrowUp 
                  size={24}
                  weight="bold" 
                  className="text-white relative z-10 drop-shadow-lg sm:w-7 sm:h-7" 
                />
              </motion.div>

              <motion.div
                className="absolute inset-0 rounded-full bg-white/30"
                initial={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            </Button>
          </motion.div>

          <motion.div
            className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 blur-xl -z-10"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
