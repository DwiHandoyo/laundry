/**
 * Batas hari mengikuti zona waktu aplikasi (default Asia/Jakarta), bukan UTC.
 * Kalau ini dilewatkan, pesanan sore hari jatuh ke tanggal yang salah pada laporan.
 */

function offsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>

  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return asUtc - date.getTime()
}

/** "2026-08-22" untuk instant tertentu menurut zona waktu aplikasi. */
export function zonedDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** "20260822" — dipakai sebagai kunci OrderSequence dan bagian orderNumber. */
export function zonedDateKey(date: Date, timeZone: string): string {
  return zonedDateString(date, timeZone).replace(/-/g, '')
}

/**
 * Rentang UTC [start, end) untuk satu tanggal kalender di zona waktu aplikasi.
 * Untuk Asia/Jakarta, "2026-08-22" -> 2026-08-21T17:00:00Z .. 2026-08-22T17:00:00Z
 */
export function zonedDayRange(
  dateString: string,
  timeZone: string,
): { start: Date; end: Date } {
  const [year, month, day] = dateString.split('-').map(Number)

  const resolve = (y: number, m: number, d: number): Date => {
    const wallClockAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
    // Dua langkah agar tetap benar pada batas pergantian offset (DST).
    const first = new Date(wallClockAsUtc - offsetMs(new Date(wallClockAsUtc), timeZone))
    return new Date(wallClockAsUtc - offsetMs(first, timeZone))
  }

  return { start: resolve(year, month, day), end: resolve(year, month, day + 1) }
}

/** Menambah n hari kalender. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}
