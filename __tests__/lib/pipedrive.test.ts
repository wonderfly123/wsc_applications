import { describe, it, expect } from 'vitest'
import { findMissingDealFields } from '@/lib/pipedrive'

const complete = {
  deal_title: 'SDSU Pacific Islander Night (Oct 17) - Cuento Marketing',
  contact_name: 'Kanani Beebe',
  contact_email: 'kanani@example.com',
  contact_phone: '(619) 395-6031',
  pipedrive_deal_id: '1126',
  event_date: '2026-10-17',
  coconut_qty: '100',
}

describe('findMissingDealFields', () => {
  it('returns nothing when every field is present', () => {
    expect(findMissingDealFields(complete)).toEqual([])
  })

  it('names the event date when it is blank', () => {
    expect(findMissingDealFields({ ...complete, event_date: '' })).toEqual(['Event Date'])
  })

  it('treats a missing key, blank, and whitespace-only value as missing', () => {
    const { contact_phone: _drop, ...noPhone } = complete
    expect(findMissingDealFields(noPhone)).toEqual(['Contact Phone'])
    expect(findMissingDealFields({ ...complete, coconut_qty: '   ' })).toEqual(['Coconut Quantity'])
  })

  it('lists every missing field in a stable, human-readable order', () => {
    expect(
      findMissingDealFields({ ...complete, contact_name: '', event_date: '', coconut_qty: '' })
    ).toEqual(['Contact Name', 'Event Date', 'Coconut Quantity'])
  })
})
