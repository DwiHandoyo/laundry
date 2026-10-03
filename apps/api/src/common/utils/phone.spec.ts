import { normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('menyatukan variasi penulisan nomor yang sama', () => {
    const variants = ['0812-3456-7890', '081234567890', '0812 3456 7890', '+6281234567890', '6281234567890']
    const normalized = variants.map(normalizePhone)
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('+6281234567890')
  })

  it('0 di depan menjadi +62', () => {
    expect(normalizePhone('08123456789')).toBe('+628123456789')
  })

  it('tanpa awalan 0 maupun 62', () => {
    expect(normalizePhone('8123456789')).toBe('+628123456789')
  })

  it('membuang tanda kurung dan spasi', () => {
    expect(normalizePhone('(0812) 3456 7890')).toBe('+6281234567890')
  })
})
