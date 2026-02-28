export const parseDateOnly = (value?: string | null): Date => {
  if (!value) {
    return new Date(NaN)
  }

  if (value.includes('T')) {
    return new Date(value)
  }

  return new Date(`${value}T00:00:00`)
}
