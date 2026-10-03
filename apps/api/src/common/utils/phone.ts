/**
 * Normalisasi nomor HP Indonesia ke bentuk E.164: +628xxxxxxxxx.
 * Tanpa ini, "0812-3456-7890" dan "081234567890" menjadi dua pelanggan berbeda.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (digits.length === 0) return trimmed

  if (hasPlus) return `+${digits}`
  if (digits.startsWith('62')) return `+${digits}`
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`
  if (digits.startsWith('8')) return `+62${digits}`
  return `+${digits}`
}
