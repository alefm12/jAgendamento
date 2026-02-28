import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle } from 'lucide-react'
import { AylaAvatar } from './AylaAvatar'
import { AylaChat } from './AylaChat'

interface AylaButtonProps {
  tenantSlug?: string
}

export function AylaButton({ tenantSlug }: AylaButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Botão Flutuante */}
      <motion.button
        className="fixed bottom-6 right-6 z-[9999] focus:outline-none focus:ring-4 focus:ring-purple-300"
        style={{ position: 'fixed', bottom: '24px', right: '24px' }}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200 }}
      >
        <div className="relative">
          {/* Avatar */}
          {!isOpen && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <AylaAvatar size={90} />
            </motion.div>
          )}
          
          {/* Botão de Fechar */}
          {isOpen && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              className="w-[90px] h-[90px] bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg"
            >
              <X size={40} className="text-white" />
            </motion.div>
          )}

          {/* Badge de notificação */}
          {!isOpen && (
            <motion.div
              className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
            >
              <MessageCircle size={16} className="text-white" />
            </motion.div>
          )}
        </div>

        {/* Tooltip */}
        {!isOpen && (
          <motion.div
            className="absolute bottom-0 right-24 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl whitespace-nowrap"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2 }}
          >
            <div className="text-sm font-semibold">Olá! Eu sou a Ayla 👋</div>
            <div className="text-xs opacity-90">Como posso ajudar você?</div>
            {/* Seta do tooltip */}
            <div className="absolute top-1/2 -right-2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-gray-900 transform -translate-y-1/2" />
          </motion.div>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="fixed bottom-24 right-6 z-[9998] w-[400px] h-[600px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)]"
            style={{ position: 'fixed', bottom: '96px', right: '24px' }}
          >
            <div className="h-full bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
              <AylaChat tenantSlug={tenantSlug} onClose={() => setIsOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
