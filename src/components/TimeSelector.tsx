import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Clock, CheckCircle, Sparkle, CalendarCheck } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { TimeSlot } from '@/lib/types'

interface TimeSelectorProps {
  date: Date
  slots: TimeSlot[]
  selectedTime: string | undefined
  onTimeSelect: (time: string) => void
}

export function TimeSelector({ date, slots, selectedTime, onTimeSelect }: TimeSelectorProps) {
  const availableSlots = slots.filter(slot => slot.available)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
    >
      <Card className="card-border-glow p-8 shadow-2xl bg-white dark:bg-gray-800 border-0 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-gradient-to-tr from-purple-100/40 to-transparent rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-start gap-4 mb-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-xl flex-shrink-0">
              <Clock className="text-white" size={26} weight="duotone" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                Escolha o Horário
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
                >
                  <Sparkle size={20} weight="fill" className="text-purple-600" />
                </motion.div>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Para <span className="font-semibold text-gray-800 dark:text-white">{format(date, "dd 'de' MMMM", { locale: ptBR })}</span>
              </p>
            </div>
          </motion.div>

          {availableSlots.length === 0 ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="p-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200"
            >
              <div className="flex items-center gap-3 justify-center text-center">
                <Clock size={24} weight="fill" className="text-red-600" />
                <div>
                  <h3 className="font-bold text-red-800">Sem horários disponíveis</h3>
                  <p className="text-sm text-red-700 mt-1">Por favor, escolha outra data</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="grid grid-cols-5 gap-3 max-h-[320px] overflow-y-auto pr-2"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent'
              }}
            >
              {slots.map((slot, index) => (
                <motion.div
                  key={slot.time}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                >
                  <Button
                    variant={selectedTime === slot.time ? "default" : "outline"}
                    onClick={() => slot.available && onTimeSelect(slot.time)}
                    disabled={!slot.available}
                    className={`
                      button-glow w-full h-14 text-base font-semibold rounded-xl transition-all duration-200 transform relative
                      ${selectedTime === slot.time
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 scale-105 border-0 ring-2 ring-blue-400'
                        : slot.available
                        ? 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-100 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:shadow-md hover:scale-102'
                        : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center gap-1.5 relative z-10">
                      {selectedTime === slot.time && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <CheckCircle size={18} weight="fill" />
                        </motion.div>
                      )}
                      <span>{slot.time}</span>
                    </div>
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          )}

          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center gap-3">
              <CalendarCheck size={22} weight="fill" className="text-blue-700 dark:text-blue-400 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-200">
                <span className="font-bold text-blue-700 dark:text-blue-400">{availableSlots.length} horário(s)</span> disponível(is). Selecione o melhor para você.
              </p>
            </div>
          </motion.div>
        </div>
      </Card>
    </motion.div>
  )
}
