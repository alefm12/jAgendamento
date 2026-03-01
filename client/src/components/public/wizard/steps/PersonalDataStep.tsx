import { CSSProperties, useEffect, useState } from 'react'
import { User, Phone, Calendar, CreditCard, ArrowRight, Loader2, MapPin, Home, Baby, Hash } from 'lucide-react'

interface PersonalDataStepProps {
  onFinish: (data: any) => void
  loading: boolean
  color: string
}

interface FormData {
  nome: string
  cpf: string
  nascimento: string
  telefone: string
  mae: string
  regiao: string
  distritoId: string
  bairroId: string
  logradouro: string
  numero: string
}

const INITIAL_STATE: FormData = {
  nome: '',
  cpf: '',
  nascimento: '',
  telefone: '',
  mae: '',
  regiao: '',
  distritoId: '',
  bairroId: '',
  logradouro: '',
  numero: ''
}

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition ' +
  'placeholder:text-gray-400 ' +
  'focus:border-transparent focus:ring-2 focus:ring-offset-0 ' +
  'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ' +
  'dark:placeholder:text-gray-500 ' +
  'dark:focus:ring-offset-gray-800 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 dark:disabled:opacity-40'

export function PersonalDataStep({ onFinish, loading, color }: PersonalDataStepProps) {
  const [data, setData] = useState<FormData>(INITIAL_STATE)
  const [distritos, setDistritos] = useState<any[]>([])
  const [bairros, setBairros] = useState<any[]>([])
  const [fetchingLocals, setFetchingLocals] = useState(true)

  useEffect(() => {
    setFetchingLocals(true)
    fetch('/api/public/address-options')
      .then((res) => res.json())
      .then((payload) => {
        setDistritos(payload.distritos || [])
        setBairros(payload.bairros || [])
      })
      .catch(() => {
        setDistritos([])
        setBairros([])
      })
      .finally(() => setFetchingLocals(false))
  }, [])

  const digitsOnly = (value: string) => value.replace(/\D/g, '')
  const isDistrito = data.regiao === 'Distrito'
  const filteredBairros = bairros.filter((bairro) => {
    if (data.regiao === 'Sede') return bairro.isSede
    if (isDistrito && data.distritoId) return Number(bairro.distritoId) === Number(data.distritoId)
    return false
  })
  const canShowAddressDetails = Boolean(data.bairroId)

  const isIdentityValid =
    data.nome.trim().length > 3 &&
    digitsOnly(data.cpf).length >= 11 &&
    Boolean(data.nascimento) &&
    digitsOnly(data.telefone).length >= 10

  const isAddressValid = (() => {
    if (!data.regiao) return false
    if (isDistrito && !data.distritoId) return false
    if (!data.bairroId) return false
    if (!data.logradouro.trim() || !data.numero.trim()) return false
    return true
  })()

  const isFormValid = isIdentityValid && isAddressValid
  const fieldStyle: CSSProperties = { ['--ring-color' as string]: color }

  const handleChange = (field: keyof FormData, value: string) => {
    setData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'regiao') {
        next.distritoId = ''
        next.bairroId = ''
        next.logradouro = ''
        next.numero = ''
      }
      if (field === 'distritoId') {
        next.bairroId = ''
        next.logradouro = ''
        next.numero = ''
      }
      if (field === 'bairroId') {
        next.logradouro = ''
        next.numero = ''
      }
      return next
    })
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (isFormValid) onFinish(data)
      }}
    >
      <div className="space-y-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <User size={14} /> Identificação
        </h3>
        <input
          required
          placeholder="Nome Completo (Sem abreviações)"
          className={INPUT_CLASS}
          value={data.nome}
          onChange={(event) => handleChange('nome', event.target.value)}
          style={fieldStyle}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-3 top-3.5 text-gray-400" size={16} />
            <input
              required
              placeholder="CPF (Apenas números)"
              className={`${INPUT_CLASS} pl-10`}
              value={data.cpf}
              onChange={(event) => handleChange('cpf', event.target.value)}
              style={fieldStyle}
            />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-3.5 text-gray-400" size={16} />
            <input
              required
              type="date"
              className={`${INPUT_CLASS} pl-10`}
              value={data.nascimento}
              onChange={(event) => handleChange('nascimento', event.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-3.5 text-gray-400" size={16} />
            <input
              required
              placeholder="Celular / WhatsApp"
              className={`${INPUT_CLASS} pl-10`}
              value={data.telefone}
              onChange={(event) => handleChange('telefone', event.target.value)}
              style={fieldStyle}
            />
          </div>
          <div className="relative">
            <Baby className="pointer-events-none absolute left-3 top-3.5 text-gray-400" size={16} />
            <input
              placeholder="Nome da Mãe (Opcional)"
              className={`${INPUT_CLASS} pl-10`}
              value={data.mae}
              onChange={(event) => handleChange('mae', event.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>
      </div>

      <div className="relative space-y-4 overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div
          className={`absolute left-0 top-0 h-full w-1 transition-colors ${isAddressValid ? '' : 'bg-gray-200 dark:bg-gray-600'}`}
          style={isAddressValid ? { backgroundColor: color } : {}}
        />
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <MapPin size={14} /> Endereço Residencial
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <select
            required
            className={INPUT_CLASS}
            value={data.regiao}
            onChange={(event) => handleChange('regiao', event.target.value)}
            style={fieldStyle}
          >
            <option value="">Selecione a Região...</option>
            <option value="Sede">Sede (Cidade)</option>
            <option value="Distrito">Distrito (Interior)</option>
          </select>
          {isDistrito && (
            <select
              required
              className={`${INPUT_CLASS} animate-in fade-in`}
              value={data.distritoId}
              onChange={(event) => handleChange('distritoId', event.target.value)}
              disabled={fetchingLocals}
              style={fieldStyle}
            >
              <option value="">Qual Distrito?</option>
              {distritos.map((distrito) => (
                <option key={distrito.id} value={String(distrito.id)}>
                  {distrito.nome}
                </option>
              ))}
            </select>
          )}
        </div>
        {(data.regiao === 'Sede' || data.distritoId) && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <select
              required
              className={INPUT_CLASS}
              value={data.bairroId}
              onChange={(event) => handleChange('bairroId', event.target.value)}
              disabled={filteredBairros.length === 0}
              style={fieldStyle}
            >
              <option value="">{isDistrito ? 'Selecione a Comunidade...' : 'Selecione o Bairro...'}</option>
              {filteredBairros.map((bairro) => (
                <option key={bairro.id} value={String(bairro.id)}>
                  {bairro.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        {canShowAddressDetails && (
          <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Home className="pointer-events-none absolute left-3 top-3.5 text-gray-400" size={16} />
              <input
                required
                placeholder="Digite o nome da rua"
                className={`${INPUT_CLASS} pl-10`}
                value={data.logradouro}
                onChange={(event) => handleChange('logradouro', event.target.value)}
                style={fieldStyle}
              />
            </div>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-3.5 text-gray-400" size={16} />
              <input
                required
                placeholder="Número da casa"
                className={`${INPUT_CLASS} pl-10`}
                value={data.numero}
                onChange={(event) => handleChange('numero', event.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!isFormValid || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white shadow-lg transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none dark:disabled:opacity-40"
        style={{ backgroundColor: isFormValid ? color : '#6b7280' }}
      >
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            <span>FINALIZAR AGENDAMENTO</span>
            <ArrowRight size={20} />
          </>
        )}
      </button>
    </form>
  )
}
