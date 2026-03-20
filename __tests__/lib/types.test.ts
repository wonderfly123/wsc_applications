import { describe, it, expect } from 'vitest'
import { FIELD_MAP, BEOData } from '@/lib/types'

describe('FIELD_MAP', () => {
  it('maps every BEOData key to a ClickUp field ID', () => {
    const beoKeys: (keyof BEOData)[] = [
      'clientFirstName', 'clientLastName', 'companyName', 'clientEmail',
      'clientPhone', 'eventType', 'serviceStart', 'serviceEnd',
      'eventLocation', 'package', 'coconutQty', 'readyBy', 'garnish',
      'setupProvided', 'stampStatus', 'certsNeeded', 'loadInLocation',
      'deliveryInstructions', 'eventNotes',
    ]
    for (const key of beoKeys) {
      expect(FIELD_MAP[key]).toBeDefined()
      expect(FIELD_MAP[key]).toMatch(/^[0-9a-f-]{36}$/)
    }
  })

  it('has no duplicate field IDs', () => {
    const ids = Object.values(FIELD_MAP)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
