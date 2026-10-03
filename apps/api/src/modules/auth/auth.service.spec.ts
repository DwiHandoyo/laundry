import { parseDuration } from './auth.service'

describe('parseDuration', () => {
  it.each([
    ['15m', 900],
    ['30d', 2_592_000],
    ['1h', 3600],
    ['45s', 45],
  ])('%s -> %i detik', (input, expected) => {
    expect(parseDuration(input)).toBe(expected)
  })
})
