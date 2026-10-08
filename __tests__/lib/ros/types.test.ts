// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { RosDocumentSchema } from '@/lib/ros/types'

const minimal = {
  header: { clientName: 'Acme', eventName: 'Acme Launch', subtitle: 'Acme | Launch Party' },
  info: [{ label: 'Date', value: 'Friday, October 9, 2026' }],
  stampBox: ['Brand Stamp Logo', 'Acme wordmark'],
  entrance: 'Call the day-of contact on arrival.',
  callout: null,
  changes: null,
  days: [{ heading: 'EVENT DAY — FRIDAY, OCTOBER 9', blocks: [{ time: '12:00 PM', title: 'Arrive', bullets: ['Park in lot B'] }] }],
  setTimes: null,
  breakdown: [{ item: 'Total coconuts', detail: '100' }],
  supplies: [{ heading: 'Delivery', bullets: ['1x dolly'] }],
  contacts: [{ label: 'Windansea', value: 'Trent LiVolsi, 732-575-5774' }],
  openItems: [],
}

describe('RosDocumentSchema', () => {
  it('accepts a complete document', () => {
    expect(RosDocumentSchema.safeParse(minimal).success).toBe(true)
  })

  it('rejects a document missing a section', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { supplies, ...rest } = minimal
    expect(RosDocumentSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a block without bullets', () => {
    const bad = { ...minimal, days: [{ heading: 'X', blocks: [{ time: '1 PM', title: 'Y' }] }] }
    expect(RosDocumentSchema.safeParse(bad).success).toBe(false)
  })
})
