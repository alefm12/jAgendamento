import type { Appointment } from './types'
import { parseISO } from 'date-fns'

export interface ImportResult {
  success: boolean
  imported: number
  errors: string[]
  data?: Partial<Appointment>[]
}

export async function importFromJSON(file: File): Promise<ImportResult> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    
    if (!Array.isArray(data)) {
      return {
        success: false,
        imported: 0,
        errors: ['O arquivo JSON deve conter um array de agendamentos']
      }
    }

    const errors: string[] = []
    const validData: Partial<Appointment>[] = []

    data.forEach((item, index) => {
      const validation = validateAppointmentData(item, index)
      if (validation.valid) {
        validData.push(item)
      } else {
        errors.push(...validation.errors)
      }
    })

    return {
      success: validData.length > 0,
      imported: validData.length,
      errors,
      data: validData
    }
  } catch (error) {
    return {
      success: false,
      imported: 0,
      errors: [`Erro ao processar arquivo JSON: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
    }
  }
}

export async function importFromCSV(file: File): Promise<ImportResult> {
  try {
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return {
        success: false,
        imported: 0,
        errors: ['Arquivo CSV vazio ou sem dados']
      }
    }

    const headers = parseCSVLine(lines[0])
    const errors: string[] = []
    const validData: Partial<Appointment>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      
      if (values.length !== headers.length) {
        errors.push(`Linha ${i + 1}: Número de colunas incorreto`)
        continue
      }

      const item: any = {}
      headers.forEach((header, idx) => {
        item[normalizeHeader(header)] = values[idx]
      })

      const validation = validateAppointmentData(item, i)
      if (validation.valid) {
        validData.push(item)
      } else {
        errors.push(...validation.errors)
      }
    }

    return {
      success: validData.length > 0,
      imported: validData.length,
      errors,
      data: validData
    }
  } catch (error) {
    return {
      success: false,
      imported: 0,
      errors: [`Erro ao processar arquivo CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
    }
  }
}

export async function importFromExcel(file: File): Promise<ImportResult> {
  return importFromCSV(file)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

function normalizeHeader(header: string): string {
  const map: Record<string, string> = {
    'protocolo': 'protocol',
    'nome completo': 'fullName',
    'nome': 'fullName',
    'cpf': 'cpf',
    'cin': 'CIN',
    'telefone': 'phone',
    'email': 'email',
    'data': 'date',
    'horário': 'time',
    'horario': 'time',
    'hora': 'time',
    'status': 'status',
    'local': 'locationId',
    'localidade': 'locationId',
    'endereço': 'street',
    'endereco': 'street',
    'rua': 'street',
    'número': 'number',
    'numero': 'number',
    'bairro': 'neighborhood',
    'prioridade': 'priority'
  }

  const normalized = header.toLowerCase().trim()
  return map[normalized] || normalized
}

function validateAppointmentData(item: any, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const lineRef = `Linha ${index + 1}`

  if (!item.fullName || typeof item.fullName !== 'string' || item.fullName.trim().split(' ').length < 2) {
    errors.push(`${lineRef}: Nome completo inválido (deve conter nome e sobrenome)`)
  }

  if (!item.cpf || !validateCPF(String(item.cpf))) {
    errors.push(`${lineRef}: CPF inválido`)
  }

  if (!item.phone || !validatePhone(String(item.phone))) {
    errors.push(`${lineRef}: Telefone inválido`)
  }

  if (!item.email || !validateEmail(String(item.email))) {
    errors.push(`${lineRef}: Email inválido`)
  }

  if (!item.date || !isValidDate(String(item.date))) {
    errors.push(`${lineRef}: Data inválida (use formato dd/MM/yyyy ou yyyy-MM-dd)`)
  }

  if (!item.time || !isValidTime(String(item.time))) {
    errors.push(`${lineRef}: Horário inválido (use formato HH:mm)`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '')
  
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let digit = 11 - (sum % 11)
  if (digit > 9) digit = 0
  if (digit !== parseInt(cpf.charAt(9))) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i)
  }
  digit = 11 - (sum % 11)
  if (digit > 9) digit = 0
  if (digit !== parseInt(cpf.charAt(10))) return false

  return true
}

function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 11
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidDate(dateStr: string): boolean {
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/
  ]
  
  if (!formats.some(format => format.test(dateStr))) {
    return false
  }

  try {
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/')
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return !isNaN(date.getTime())
    } else {
      const date = parseISO(dateStr)
      return !isNaN(date.getTime())
    }
  } catch {
    return false
  }
}

function isValidTime(timeStr: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/
  return timeRegex.test(timeStr)
}
