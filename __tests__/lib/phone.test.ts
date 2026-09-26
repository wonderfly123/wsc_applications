import { describe, it, expect } from 'vitest'
import { normalizePhone } from '@/lib/phone'

describe('normalizePhone', () => {
  it.each([
    ['858.551.4654', '+18585514654'],
    ['(858) 551-4654', '+18585514654'],
    ['858-551-4654', '+18585514654'],
    ['1 858 551 4654', '+18585514654'],
    ['+1 (858) 551-4654', '+18585514654'],
    ['O. 858.551.4654', '+18585514654'],
    ['858-551-4654 ext. 100', '+18585514654'],
    ['858-551-4654 x22', '+18585514654'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each([
    ['', null],
    ['   ', null],
    ['551-4654', null],
    ['858-551-46540', null],
    ['858-551-4654 100', null],
    ['test', null],
    ['+1', null],
  ])('rejects %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })
})
