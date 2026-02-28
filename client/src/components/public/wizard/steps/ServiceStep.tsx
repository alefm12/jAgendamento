import { useState } from 'react'
import { FileText, CheckCircle2, ArrowRight } from 'lucide-react'

interface ServiceStepProps {
  onNext: (serviceId: string) => void
  color: string
}

const SERVICES = [
  { id: '1', name: '1ª Via do RG', desc: 'Primeira emissão (Grátis)' },
  { id: '2', name: '2ª Via do RG', desc: 'Perda, Roubo ou Renovação' },
  { id: '3', name: 'Nova CIN', desc: 'Carteira de Identidade Nacional' },
  { id: '4', name: 'Atualização', desc: 'Correção de dados cadastrais' }
]

export function ServiceStep({ onNext, color }: ServiceStepProps) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
          <FileText size={18} />
          Escolha o serviço desejado
        </div>
        <div className="space-y-4">
          {SERVICES.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelected(service.id)}
              className={`w-full rounded-2xl border px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-gray-700 dark:text-white ${
                selected === service.id
                  ? 'border-transparent shadow-lg'
                  : 'border-gray-200 hover:-translate-y-0.5 hover:border-gray-300'
              }`}
              style={{ backgroundColor: selected === service.id ? color : undefined, color: selected === service.id ? '#fff' : undefined }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{service.name}</p>
                  <p className={`text-sm ${selected === service.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                    {service.desc}
                  </p>
                </div>
                {selected === service.id && <CheckCircle2 size={24} className="text-white" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => selected && onNext(selected)}
        disabled={!selected}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: color }}
      >
        Continuar <ArrowRight size={20} />
      </button>
    </div>
  )
}
