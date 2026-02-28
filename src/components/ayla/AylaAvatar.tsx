import { motion } from 'framer-motion'

interface AylaAvatarProps {
  size?: number
  animate?: boolean
}

export function AylaAvatar({ size = 80, animate = true }: AylaAvatarProps) {
  return (
    <motion.div
      className="relative"
      animate={animate ? {
        y: [0, -10, 0],
      } : {}}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <div 
        className="rounded-full overflow-hidden bg-gradient-to-br from-purple-400 via-purple-500 to-blue-500 border-4 border-white shadow-2xl"
        style={{ width: size, height: size }}
      >
        <img 
          src="/ayla-avatar.png" 
          alt="Ayla - Assistente Virtual" 
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback se a imagem não carregar - mostra letra A estilizada
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            if (target.parentElement) {
              target.parentElement.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-600">
                  <span class="text-white font-black" style="font-size: ${size * 0.5}px">A</span>
                </div>
              `
            }
          }}
        />
      </div>
      
      {/* Indicador de status online */}
      <motion.div
        className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg"
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      />
    </motion.div>
  )
}
