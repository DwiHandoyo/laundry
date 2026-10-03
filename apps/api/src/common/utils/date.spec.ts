import { addDays, zonedDateKey, zonedDateString, zonedDayRange } from './date'

const TZ = 'Asia/Jakarta'

describe('batas hari Asia/Jakarta', () => {
  it('satu hari kalender WIB berjalan dari 17:00Z hari sebelumnya', () => {
    const { start, end } = zonedDayRange('2026-08-22', TZ)
    expect(start.toISOString()).toBe('2026-08-21T17:00:00.000Z')
    expect(end.toISOString()).toBe('2026-08-22T17:00:00.000Z')
  })

  it('pesanan sore WIB jatuh pada tanggal WIB yang benar, bukan tanggal UTC', () => {
    // 2026-08-22 23:30 WIB = 2026-08-22T16:30Z (masih tanggal 22 di UTC maupun WIB)
    const malam = new Date('2026-08-22T16:30:00.000Z')
    expect(zonedDateString(malam, TZ)).toBe('2026-08-22')

    // 2026-08-23 00:30 WIB = 2026-08-22T17:30Z (di UTC masih tanggal 22, di WIB sudah 23)
    const lewatTengahMalam = new Date('2026-08-22T17:30:00.000Z')
    expect(zonedDateString(lewatTengahMalam, TZ)).toBe('2026-08-23')

    const { start, end } = zonedDayRange('2026-08-22', TZ)
    expect(malam >= start && malam < end).toBe(true)
    expect(lewatTengahMalam >= end).toBe(true)
  })

  it('zonedDateKey dipakai sebagai bagian orderNumber', () => {
    expect(zonedDateKey(new Date('2026-08-22T02:00:00.000Z'), TZ)).toBe('20260822')
  })

  it('rentang berurutan tidak tumpang tindih dan tidak berlubang', () => {
    const a = zonedDayRange('2026-08-22', TZ)
    const b = zonedDayRange('2026-08-23', TZ)
    expect(a.end.getTime()).toBe(b.start.getTime())
  })

  it('addDays menambah hari kalender', () => {
    expect(addDays(new Date('2026-08-30T02:00:00.000Z'), 3).toISOString()).toBe(
      '2026-09-02T02:00:00.000Z',
    )
  })
})
