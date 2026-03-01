import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { User, IdentificationCard, Phone, EnvelopeSimple, CheckCircle, MapPin, HouseLine, NumberCircleThree, CreditCard, MapTrifold, Buildings } from '@phosphor-icons/react'
import { validateCPF, validatePhone, formatCPF, formatPhone } from '@/lib/validators'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Location, CustomField } from '@/lib/types'

interface AddressLocalityOption {
  id: number
  nome: string
}

interface AddressNeighborhood {
  id: number
  nome: string
  localidadeId?: number | null
  parentType?: 'Sede' | 'Distrito'
}

interface AddressOptions {
  headquarters: AddressLocalityOption[]
  districts: AddressLocalityOption[]
  neighborhoods: AddressNeighborhood[]
}

interface PersonalInfoFormProps {
  formData: {
    fullName: string
    cpf: string
    rg: string
    phone: string
    email: string
    locationId: string
    street: string
    number: string
    neighborhood: string
    rgType: string
    regionType: string
    sedeId: string
    districtId: string
    neighborhoodId: string
    [key: string]: string
  }
  onChange: (field: string, value: string) => void
  locations: Location[]
  customFields?: CustomField[]
  emailError?: string | null
  addressOptions?: AddressOptions
  addressOptionsLoading?: boolean
  addressOptionsError?: string | null
  onCpfBlur?: (cpf: string) => void
}

export function PersonalInfoForm({
    formData,
    onChange,
    locations,
    customFields,
    emailError,
    addressOptions,
    addressOptionsLoading,
    addressOptionsError,
    onCpfBlur
  }: PersonalInfoFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const selectedLocation = locations.find(loc => loc.id === formData.locationId)
  const enabledCustomFields = customFields?.filter(field => field.enabled).sort((a, b) => a.order - b.order) || []
  const rawHeadquarters = addressOptions?.headquarters ?? []
  const rawDistricts = addressOptions?.districts ?? []
  const neighborhoods = addressOptions?.neighborhoods ?? []
  const headquarters = useMemo(() => {
    if (!rawHeadquarters.length || !neighborhoods.length) return []
    const headquarterIds = new Set(rawHeadquarters.map((item) => String(item.id)))
    const linkedIds = new Set<string>()
    neighborhoods.forEach((neighborhood) => {
      if (neighborhood.localidadeId == null) return
      const localityId = String(neighborhood.localidadeId)
      if (neighborhood.parentType === 'Distrito') return
      if (neighborhood.parentType === 'Sede' || headquarterIds.has(localityId)) {
        linkedIds.add(localityId)
      }
    })
    return rawHeadquarters.filter((headquarter) => linkedIds.has(String(headquarter.id)))
  }, [rawHeadquarters, neighborhoods])
  const districts = useMemo(() => {
    if (!rawDistricts.length || !neighborhoods.length) return []
    const districtIds = new Set(rawDistricts.map((item) => String(item.id)))
    const linkedIds = new Set<string>()
    neighborhoods.forEach((neighborhood) => {
      if (neighborhood.localidadeId == null) return
      const localityId = String(neighborhood.localidadeId)
      if (neighborhood.parentType === 'Sede') return
      if (neighborhood.parentType === 'Distrito' || districtIds.has(localityId)) {
        linkedIds.add(localityId)
      }
    })
    return rawDistricts.filter((district) => linkedIds.has(String(district.id)))
  }, [rawDistricts, neighborhoods])
  const hasStructuredAddress = headquarters.length > 0 || districts.length > 0
  const showDistrictSelect = formData.regionType === 'Distrito' && districts.length > 1
  const filteredNeighborhoods = useMemo(() => {
    const selectedLocalityId = formData.regionType === 'Sede' ? formData.sedeId : formData.districtId
    if (!selectedLocalityId) {
      return []
    }
    return neighborhoods.filter((item) =>
      item.localidadeId !== null && String(item.localidadeId) === selectedLocalityId
    )
  }, [formData.regionType, formData.sedeId, formData.districtId, neighborhoods])
  const shouldShowNeighborhoodSelect = hasStructuredAddress && (
    (formData.regionType === 'Sede' && !!formData.sedeId) || (formData.regionType === 'Distrito' && !!formData.districtId)
  )
  const shouldRenderStreetInputs = hasStructuredAddress ? Boolean(formData.regionType) : true

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateField(field, formData[field as keyof typeof formData])
  }

  const validateField = (field: string, value: string) => {
    let error = ''
    
    switch (field) {
      case 'fullName':
        if (!value.trim()) error = 'Nome completo é obrigatório'
        else if (value.trim().split(' ').length < 2) error = 'Digite nome e sobrenome'
        break
      case 'cpf':
        if (!value) error = 'CPF é obrigatório'
        else if (!validateCPF(value)) error = 'CPF inválido'
        break
      case 'phone':
        if (!value) error = 'Telefone é obrigatório'
        else if (!validatePhone(value)) error = 'Telefone inválido'
        break
      case 'locationId':
        if (!value) error = 'Selecione onde você deseja ser atendido'
        break
      case 'rgType':
        if (!value) error = 'Selecione o tipo de CIN'
        break
      case 'gender':
        if (!value) error = 'Selecione o gênero'
        break
      case 'regionType':
        if (hasStructuredAddress && !value) error = 'Selecione primeiro a região'
        break
      case 'sedeId':
        if (hasStructuredAddress && formData.regionType === 'Sede' && headquarters.length > 0 && !value) {
          error = 'Selecione a sede'
        }
        break
      case 'districtId':
        if (hasStructuredAddress && formData.regionType === 'Distrito' && districts.length > 0 && !value) {
          error = 'Selecione o distrito'
        }
        break
      case 'neighborhoodId':
        if (hasStructuredAddress && shouldShowNeighborhoodSelect && !value) {
          error = 'Selecione o bairro ou comunidade'
        }
        break
      case 'street':
        if (!value.trim()) error = 'Logradouro é obrigatório'
        break
      case 'number':
        if (!value.trim()) error = 'Número é obrigatório'
        break
      case 'neighborhood':
        if (!hasStructuredAddress && !value.trim()) error = 'Bairro/Comunidade é obrigatório'
        break
      default:
        const customField = customFields?.find(f => f.id === field)
        if (customField && customField.required && !value.trim()) {
          error = `${customField.label} é obrigatório`
        }
        break
    }
    
    setErrors(prev => ({ ...prev, [field]: error }))
    return !error
  }

  const handleChange = (field: string, value: string) => {
    let formattedValue = value
    
    if (field === 'cpf') {
      formattedValue = formatCPF(value)
    } else if (field === 'phone') {
      formattedValue = formatPhone(value)
    }
    
    onChange(field, formattedValue)
    
    if (touched[field]) {
      validateField(field, formattedValue)
    }
  }

  const resetAddressDetails = () => {
    handleChange('neighborhoodId', '')
    handleChange('neighborhood', '')
    handleChange('street', '')
    handleChange('number', '')
    setTouched(prev => ({
      ...prev,
      neighborhoodId: false,
      neighborhood: false,
      street: false,
      number: false
    }))
    setErrors(prev => ({
      ...prev,
      neighborhoodId: '',
      neighborhood: '',
      street: '',
      number: ''
    }))
  }

  const handleRegionSelect = (value: string) => {
    if (!value) {
      handleChange('regionType', '')
      handleChange('sedeId', '')
      handleChange('districtId', '')
      resetAddressDetails()
      setTouched(prev => ({
        ...prev,
        regionType: false,
        sedeId: false,
        districtId: false
      }))
      setErrors(prev => ({
        ...prev,
        regionType: '',
        sedeId: '',
        districtId: ''
      }))
      return
    }
    const requiresSedeSelection = value === 'Sede' && headquarters.length > 1
    const requiresDistrictSelection = value === 'Distrito' && districts.length > 1

    handleChange('regionType', value)
    setTouched(prev => ({
      ...prev,
      regionType: true,
      sedeId: requiresSedeSelection ? true : false,
      districtId: requiresDistrictSelection ? true : false
    }))
    validateField('regionType', value)
    setErrors(prev => ({
      ...prev,
      sedeId: requiresSedeSelection ? 'Selecione a sede' : '',
      districtId: requiresDistrictSelection ? 'Selecione o distrito' : ''
    }))
    handleChange('sedeId', '')
    handleChange('districtId', '')
    resetAddressDetails()
  }

  const handleHeadquarterSelect = (value: string) => {
    handleChange('sedeId', value)
    setTouched(prev => ({ ...prev, sedeId: true }))
    validateField('sedeId', value)
    resetAddressDetails()
  }

  const handleDistrictSelect = (value: string) => {
    handleChange('districtId', value)
    setTouched(prev => ({ ...prev, districtId: true }))
    validateField('districtId', value)
    resetAddressDetails()
  }

  const handleNeighborhoodSelect = (value: string) => {
    handleChange('neighborhoodId', value)
    setTouched(prev => ({ ...prev, neighborhoodId: true }))
    validateField('neighborhoodId', value)
    const selected = neighborhoods.find((item) => String(item.id) === value)
    handleChange('neighborhood', selected?.nome ?? '')
    if (!value) {
      handleChange('street', '')
      handleChange('number', '')
    }
  }

  useEffect(() => {
    if (formData.regionType === 'Sede' && headquarters.length === 1) {
      const autoId = String(headquarters[0].id)
      if (formData.sedeId !== autoId) {
        handleHeadquarterSelect(autoId)
      }
    }
  }, [formData.regionType, formData.sedeId, headquarters])

  useEffect(() => {
    if (formData.regionType === 'Distrito' && districts.length === 1) {
      const autoId = String(districts[0].id)
      if (formData.districtId !== autoId) {
        handleDistrictSelect(autoId)
      }
    }
  }, [formData.regionType, formData.districtId, districts])

  useEffect(() => {
    if (formData.regionType === 'Sede' && headquarters.length === 0) {
      handleRegionSelect('')
      return
    }
    if (formData.regionType === 'Distrito' && districts.length === 0) {
      handleRegionSelect('')
    }
  }, [formData.regionType, headquarters.length, districts.length])

  useEffect(() => {
    if (shouldShowNeighborhoodSelect && !formData.neighborhoodId) {
      setTouched(prev => ({ ...prev, neighborhoodId: true }))
      setErrors(prev => ({ ...prev, neighborhoodId: 'Selecione o bairro ou comunidade' }))
    }
  }, [shouldShowNeighborhoodSelect, formData.neighborhoodId])

  const isFieldValid = (field: string) => {
    return touched[field] && !errors[field] && formData[field as keyof typeof formData]
  }

  const renderCustomField = (field: CustomField) => {
    const fieldValue = formData[field.id] || field.defaultValue || ''
    const showError = touched[field.id] && errors[field.id]
    const showValid = isFieldValid(field.id)

    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={field.id} className="text-sm font-semibold text-gray-700">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>
        {field.type === 'textarea' ? (
          <Textarea
            id={field.id}
            value={fieldValue}
            onChange={(e) => handleChange(field.id, e.target.value)}
            onBlur={() => handleBlur(field.id)}
            placeholder={field.placeholder}
            className={cn(
              "transition-all duration-200",
              showError && "border-red-500 focus:ring-red-500",
              showValid && "border-emerald-500 focus:ring-emerald-500"
            )}
          />
        ) : field.type === 'select' && field.options ? (
          <Select value={fieldValue} onValueChange={(value) => handleChange(field.id, value)}>
            <SelectTrigger
              className={cn(
                "transition-all duration-200",
                showError && "border-red-500 focus:ring-red-500",
                showValid && "border-emerald-500 focus:ring-emerald-500"
              )}
            >
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={field.id}
            type={field.type}
            value={fieldValue}
            onChange={(e) => handleChange(field.id, e.target.value)}
            onBlur={() => handleBlur(field.id)}
            placeholder={field.placeholder}
            className={cn(
              "transition-all duration-200",
              showError && "border-red-500 focus:ring-red-500",
              showValid && "border-emerald-500 focus:ring-emerald-500"
            )}
          />
        )}
        {showError && (
          <motion.p 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-600 font-medium"
          >
            {errors[field.id]}
          </motion.p>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="p-6 bg-white border shadow-sm">
        
        <div className="">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-start gap-4 mb-8"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-xl flex-shrink-0">
              <IdentificationCard className="text-white" size={26} weight="duotone" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                Dados Pessoais
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Sparkle size={20} weight="fill" className="text-pink-600" />
                </motion.div>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Preencha suas informações para concluir o agendamento</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <User size={16} weight="duotone" className="text-purple-600" />
                  Nome Completo <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    onBlur={() => handleBlur('fullName')}
                    placeholder="Digite seu nome completo"
                    className={cn(
                      "h-11 text-base transition-all duration-200 pl-3 pr-10",
                      touched.fullName && errors.fullName && "border-red-500 focus:ring-red-500",
                      isFieldValid('fullName') && "border-emerald-500 focus:ring-emerald-500"
                    )}
                  />
                  {isFieldValid('fullName') && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <CheckCircle size={20} weight="fill" className="text-emerald-500" />
                    </motion.div>
                  )}
                </div>
                {touched.fullName && errors.fullName && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-600 font-medium"
                  >
                    {errors.fullName}
                  </motion.p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <IdentificationCard size={16} weight="duotone" className="text-blue-600" />
                  CPF <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => handleChange('cpf', e.target.value)}
                    onBlur={() => {
                      handleBlur('cpf')
                      if (onCpfBlur && validateCPF(formData.cpf)) {
                        onCpfBlur(formData.cpf)
                      }
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={cn(
                      "h-11 text-base transition-all duration-200 pl-3 pr-10",
                      touched.cpf && errors.cpf && "border-red-500 focus:ring-red-500",
                      isFieldValid('cpf') && "border-emerald-500 focus:ring-emerald-500"
                    )}
                  />
                  {isFieldValid('cpf') && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <CheckCircle size={20} weight="fill" className="text-emerald-500" />
                    </motion.div>
                  )}
                </div>
                {touched.cpf && errors.cpf && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-600 font-medium"
                  >
                    {errors.cpf}
                  </motion.p>
                )}
              </div>

              <div className={cn(
                "md:col-span-2 grid gap-4",
                formData.rgType === '2ª via' ? "md:grid-cols-2" : "md:grid-cols-1"
              )}>
                <div className="space-y-2">
                  <Label htmlFor="rgType" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <CreditCard size={16} weight="duotone" className="text-violet-600" />
                    Tipo de CIN <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.rgType} onValueChange={(value) => handleChange('rgType', value)}>
                    <SelectTrigger 
                      id="rgType"
                      className={cn(
                        "h-11 text-base transition-all duration-200",
                        touched.rgType && errors.rgType && "border-red-500 focus:ring-red-500",
                        isFieldValid('rgType') && "border-emerald-500 focus:ring-emerald-500"
                      )}
                    >
                      <SelectValue placeholder="Selecione 1ª ou 2ª via" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1ª via">1ª via (Primeira via)</SelectItem>
                      <SelectItem value="2ª via">2ª via (Segunda via)</SelectItem>
                    </SelectContent>
                  </Select>
                  {touched.rgType && errors.rgType && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-600 font-medium"
                    >
                      {errors.rgType}
                    </motion.p>
                  )}
                </div>

                {formData.rgType === '2ª via' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-right-2">
                    <Label htmlFor="rg" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <IdentificationCard size={16} weight="duotone" className="text-cyan-600" />
                      RG (se tiver)
                    </Label>
                    <Input
                      id="rg"
                      value={formData.rg}
                      onChange={(e) => handleChange('rg', e.target.value)}
                      placeholder="Digite seu RG anterior (opcional)"
                      className="h-11 text-base"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="gender" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <User size={16} weight="duotone" className="text-blue-600" />
                  Gênero <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.gender?.startsWith('Outro:') ? 'Outro' : formData.gender || ''} onValueChange={(value) => {
                  if (value === 'Outro') {
                    handleChange('gender', 'Outro:')
                  } else {
                    handleChange('gender', value)
                  }
                }}>
                  <SelectTrigger 
                    id="gender"
                    className={cn(
                      "h-11 text-base transition-all duration-200",
                      touched.gender && errors.gender && "border-red-500 focus:ring-red-500",
                      isFieldValid('gender') && "border-emerald-500 focus:ring-emerald-500"
                    )}
                  >
                    <SelectValue placeholder="Selecione seu gênero" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Não binário">Não binário</SelectItem>
                    <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                    <SelectItem value="Outro">Outro (especificar)</SelectItem>
                  </SelectContent>
                </Select>
                {touched.gender && errors.gender && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-600 font-medium"
                  >
                    {errors.gender}
                  </motion.p>
                )}
              </div>

              {formData.gender?.startsWith('Outro:') && (
                <div className="space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-2">
                  <Label htmlFor="genderOther" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <User size={16} weight="duotone" className="text-blue-600" />
                    Especifique seu gênero <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="genderOther"
                    value={formData.gender.replace('Outro:', '')}
                    onChange={(e) => handleChange('gender', `Outro:${e.target.value}`)}
                    placeholder="Digite aqui"
                    className="h-11 text-base"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Phone size={16} weight="duotone" className="text-green-600" />
                  Telefone <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    onBlur={() => handleBlur('phone')}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className={cn(
                      "h-11 text-base transition-all duration-200 pl-3 pr-10",
                      touched.phone && errors.phone && "border-red-500 focus:ring-red-500",
                      isFieldValid('phone') && "border-emerald-500 focus:ring-emerald-500"
                    )}
                  />
                  {isFieldValid('phone') && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <CheckCircle size={20} weight="fill" className="text-emerald-500" />
                    </motion.div>
                  )}
                </div>
                {touched.phone && errors.phone && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-600 font-medium"
                  >
                    {errors.phone}
                  </motion.p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <EnvelopeSimple size={16} weight="duotone" className="text-orange-600" />
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className={cn(
                      "h-11 text-base transition-all duration-200 pl-3 pr-10",
                      emailError && "border-red-500 focus:ring-red-500 bg-red-50"
                    )}
                  />
                </div>
                {emailError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-600 font-medium"
                  >
                    {emailError}
                  </motion.p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <HouseLine size={20} weight="duotone" className="text-indigo-600" />
                Seu Endereço Residencial
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Informações do local onde você mora</p>
              
              <div className="space-y-4">
                {hasStructuredAddress ? (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <MapTrifold size={16} weight="duotone" className="text-indigo-600" />
                          Escolha primeiro a região <span className="text-red-500">*</span>
                        </Label>
                        <div
                          className={cn(
                            "grid gap-3 md:max-w-md",
                            headquarters.length > 0 && districts.length > 0 ? "grid-cols-2" : "grid-cols-1"
                          )}
                        >
                          {headquarters.length > 0 && (
                            <Button
                              type="button"
                              variant={formData.regionType === 'Sede' ? 'default' : 'outline'}
                              className="h-11 gap-2"
                              disabled={addressOptionsLoading}
                              onClick={() => handleRegionSelect('Sede')}
                            >
                              <Buildings size={16} weight="duotone" />
                              Sede
                            </Button>
                          )}
                          {districts.length > 0 && (
                            <Button
                              type="button"
                              variant={formData.regionType === 'Distrito' ? 'default' : 'outline'}
                              className="h-11 gap-2"
                              disabled={addressOptionsLoading}
                              onClick={() => handleRegionSelect('Distrito')}
                            >
                              <MapPin size={16} weight="duotone" />
                              Distrito
                            </Button>
                          )}
                        </div>
                        {addressOptionsLoading && (
                          <p className="text-xs font-medium text-muted-foreground">
                            Carregando catálogo oficial de regiões. Aguarde um instante.
                          </p>
                        )}
                        {addressOptionsError && (
                          <p className="text-xs font-medium text-red-600">{addressOptionsError}</p>
                        )}
                        {touched.regionType && errors.regionType && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-600 font-medium"
                          >
                            {errors.regionType}
                          </motion.p>
                        )}
                      </div>

                      {formData.regionType === 'Sede' && headquarters.length > 0 && (
                        headquarters.length > 1 ? (
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                              <Buildings size={16} weight="duotone" className="text-emerald-600" />
                              Qual Sede? <span className="text-red-500">*</span>
                            </Label>
                            <Select value={formData.sedeId} onValueChange={handleHeadquarterSelect}>
                              <SelectTrigger className="h-11 text-base">
                                <SelectValue placeholder="Selecione a sede" />
                              </SelectTrigger>
                              <SelectContent>
                                {headquarters.map((sede) => (
                                  <SelectItem key={sede.id} value={String(sede.id)}>
                                    {sede.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {touched.sedeId && errors.sedeId && (
                              <motion.p 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-red-600 font-medium"
                              >
                                {errors.sedeId}
                              </motion.p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            Sede selecionada automaticamente: <strong>{headquarters[0].nome}</strong>
                          </div>
                        )
                      )}

                      {formData.regionType === 'Distrito' && districts.length > 0 && (
                        showDistrictSelect ? (
                          <div className="space-y-2 animate-in fade-in">
                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                              <MapPin size={16} weight="duotone" className="text-emerald-600" />
                              Qual Distrito? <span className="text-red-500">*</span>
                            </Label>
                            <Select
                              value={formData.districtId}
                              onValueChange={handleDistrictSelect}
                            >
                              <SelectTrigger className="h-11 text-base">
                                <SelectValue placeholder="Selecione o distrito" />
                              </SelectTrigger>
                              <SelectContent>
                                {districts.map((district) => (
                                  <SelectItem key={district.id} value={String(district.id)}>
                                    {district.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {touched.districtId && errors.districtId && (
                              <motion.p 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-red-600 font-medium"
                              >
                                {errors.districtId}
                              </motion.p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            Distrito selecionado automaticamente: <strong>{districts[0]?.nome}</strong>
                          </div>
                        )
                      )}

                      {shouldRenderStreetInputs && (
                        <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 md:grid-cols-3">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="street" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                              <HouseLine size={16} weight="duotone" className="text-indigo-600" />
                              Logradouro <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="street"
                              value={formData.street}
                              onChange={(e) => handleChange('street', e.target.value)}
                              onBlur={() => handleBlur('street')}
                              placeholder="Nome do logradouro onde você mora com endereço (Ex: Rua 21 de Abril)"
                              className="h-11 text-base"
                            />
                            {touched.street && errors.street && (
                              <motion.p 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-red-600 font-medium"
                              >
                                {errors.street}
                              </motion.p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="number" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                              <NumberCircleThree size={16} weight="duotone" className="text-pink-600" />
                              Número <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="number"
                              value={formData.number}
                              onChange={(e) => handleChange('number', e.target.value)}
                              onBlur={() => handleBlur('number')}
                              placeholder="Nº"
                              className="h-11 text-base"
                            />
                            {touched.number && errors.number && (
                              <motion.p 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-red-600 font-medium"
                              >
                                {errors.number}
                              </motion.p>
                            )}
                          </div>
                        </div>
                      )}

                      {shouldShowNeighborhoodSelect && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <HouseLine size={16} weight="duotone" className="text-indigo-600" />
                            Bairro / Comunidade <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={formData.neighborhoodId}
                            onValueChange={handleNeighborhoodSelect}
                            disabled={filteredNeighborhoods.length === 0}
                          >
                            <SelectTrigger className="h-11 text-base">
                              <SelectValue
                                placeholder={filteredNeighborhoods.length === 0 ? 'Nenhuma localidade vinculada' : 'Selecione a localidade'}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredNeighborhoods.map((bairro) => (
                                <SelectItem key={bairro.id} value={String(bairro.id)}>
                                  {bairro.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {touched.neighborhoodId && errors.neighborhoodId && (
                            <motion.p 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-xs text-red-600 font-medium"
                            >
                              {errors.neighborhoodId}
                            </motion.p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {addressOptionsError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">
                        {addressOptionsError}
                      </div>
                    )}
                    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-900">
                      Nenhum catálogo de regiões com bairros vinculados está disponível. Informe manualmente os dados do seu endereço.
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="street" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <HouseLine size={16} weight="duotone" className="text-indigo-600" />
                          Logradouro <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="street"
                          value={formData.street}
                          onChange={(e) => handleChange('street', e.target.value)}
                          onBlur={() => handleBlur('street')}
                          placeholder="Nome do logradouro onde você mora (Rua, Avenida, etc.)"
                          className="h-11 text-base"
                        />
                        {touched.street && errors.street && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-600 font-medium"
                          >
                            {errors.street}
                          </motion.p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="number" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <NumberCircleThree size={16} weight="duotone" className="text-pink-600" />
                          Número <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="number"
                          value={formData.number}
                          onChange={(e) => handleChange('number', e.target.value)}
                          onBlur={() => handleBlur('number')}
                          placeholder="Nº"
                          className="h-11 text-base"
                        />
                        {touched.number && errors.number && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-600 font-medium"
                          >
                            {errors.number}
                          </motion.p>
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="neighborhood" className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <MapPin size={16} weight="duotone" className="text-teal-600" />
                          Bairro / Comunidade <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="neighborhood"
                          value={formData.neighborhood}
                          onChange={(e) => handleChange('neighborhood', e.target.value)}
                          onBlur={() => handleBlur('neighborhood')}
                          placeholder="Nome do bairro onde você mora"
                          className="h-11 text-base"
                        />
                        {touched.neighborhood && errors.neighborhood && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-600 font-medium"
                          >
                            {errors.neighborhood}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {enabledCustomFields.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Sparkle size={20} weight="duotone" className="text-purple-600" />
                  Informações Adicionais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {enabledCustomFields.map(renderCustomField)}
                </div>
              </div>
            )}
          </motion.div>

          {selectedLocation ? (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-5 p-4 bg-blue-50 rounded-xl border border-blue-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <MapPin size={22} weight="fill" className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-1">Local selecionado:</p>
                  <p className="text-sm text-gray-700 font-bold">{selectedLocation.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{selectedLocation.address}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedLocation.city}</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => {
                  const target = selectedLocation.googleMapsUrl || `${selectedLocation.name} ${selectedLocation.address} ${selectedLocation.city ?? ''}`
                  window.open(selectedLocation.googleMapsUrl ? target : `https://www.google.com/maps?q=${encodeURIComponent(target)}`, '_blank')
                }}
                className="h-11 gap-2 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 button-glow"
              >
                <MapTrifold size={20} weight="duotone" />
                Ver no mapa
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-6 p-5 bg-yellow-50 border border-yellow-200 rounded-xl"
            >
              <p className="text-sm text-yellow-800 font-medium">
                Selecione um local de atendimento na etapa anterior para visualizar os detalhes aqui.
              </p>
            </motion.div>
          )}

        </div>
      </Card>
    </motion.div>
  )
}
