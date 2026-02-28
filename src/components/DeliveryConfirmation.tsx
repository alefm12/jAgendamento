import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Package, Confetti } from '@phosphor-icons/react'

interface DeliveryConfirmationProps {
  citizenName: string
  protocol: string
  onConfirm: () => void
}

export function DeliveryConfirmation({ citizenName, protocol, onConfirm }: DeliveryConfirmationProps) {
  const [showConfetti, setShowConfetti] = useState(false)

  const handleConfirm = () => {
    setShowConfetti(true)
    setTimeout(() => {
      onConfirm()
    }, 2000)
  }

  if (showConfetti) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <Card className="w-full max-w-md mx-4 shadow-2xl border-2 border-green-500">
          <CardContent className="p-8 text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: 360 }}
              transition={{ type: "spring", duration: 0.8 }}
              className="flex justify-center"
            >
              <div className="relative">
                <CheckCircle size={80} weight="fill" className="text-green-500" />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full bg-green-500/20 blur-xl"
                />
              </div>
            </motion.div>

            <div className="space-y-2">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-green-600"
              >
                CIN Entregue com Sucesso!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-muted-foreground"
              >
                {citizenName}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground"
              >
                Protocolo: {protocol}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex justify-center gap-2"
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 0 }}
                  animate={{ y: [-10, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.5,
                    delay: i * 0.1,
                    repeatType: "reverse"
                  }}
                >
                  <Confetti size={24} className="text-yellow-500" weight="fill" />
                </motion.div>
              ))}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardContent className="p-8 text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="p-4 rounded-full bg-primary/10">
              <Package size={64} weight="duotone" className="text-primary" />
            </div>
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Confirmar Entrega da CIN?</h2>
            <p className="text-lg text-muted-foreground">{citizenName}</p>
            <p className="text-sm text-muted-foreground">Protocolo: {protocol}</p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleConfirm}
              size="lg"
              className="w-full gap-2"
            >
              <CheckCircle size={20} weight="bold" />
              Confirmar Entrega
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
