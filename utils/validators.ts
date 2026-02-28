export const stripNonDigits = (value: string) => value.replace(/\D/g, '')

const isRepeatedSequence = (cpf: string) => /^([0-9])\1{10}$/.test(cpf)

const calculateCheckDigit = (digits: string, factor: number) => {
  let total = 0
  for (let index = 0; index < digits.length; index += 1) {
    total += Number(digits[index]) * (factor - index)
  }
  const remainder = total % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export const isValidCPF = (cpf: string): boolean => {
  const digits = stripNonDigits(cpf)

  if (digits.length !== 11) {
    return false
  }

  if (isRepeatedSequence(digits)) {
    return false
  }

  const firstDigit = calculateCheckDigit(digits.slice(0, 9), 10)
  if (firstDigit !== Number(digits[9])) {
    return false
  }

  const secondDigit = calculateCheckDigit(digits.slice(0, 10), 11)
  if (secondDigit !== Number(digits[10])) {
    return false
  }

  return true
}
