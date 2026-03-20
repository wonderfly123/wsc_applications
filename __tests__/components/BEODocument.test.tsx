import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BEODocument } from '@/components/BEODocument'
import { BEOData } from '@/lib/types'

const sampleData: BEOData = {
  clientFirstName: 'Jane',
  clientLastName: 'Smith',
  companyName: 'Smith Co',
  clientEmail: 'jane@example.com',
  clientPhone: '555-1234',
  eventType: 'Wedding',
  serviceStart: 'Mar 31, 2024, 12:00 PM',
  serviceEnd: 'Mar 31, 2024, 4:00 PM',
  eventLocation: 'The Grand Ballroom',
  package: 'Premium',
  coconutQty: '150',
  readyBy: '100',
  garnish: 'Orchid + Umbrella',
  setupProvided: 'Yes',
  stampStatus: 'Approved',
  certsNeeded: 'Health Dept Permit',
  loadInLocation: 'Loading Dock B',
  deliveryInstructions: 'Use service entrance',
  eventNotes: 'Bride is allergic to peanuts',
  headcount: '200',
  attachments: [],
}

afterEach(() => {
  cleanup()
})

describe('BEODocument', () => {
  it('renders the header with brand name', () => {
    render(<BEODocument data={sampleData} taskId="abc123" />)
    expect(screen.getByText('Windansea Coconuts')).toBeDefined()
    expect(screen.getByText('Banquet Event Order')).toBeDefined()
  })

  it('renders client information section', () => {
    render(<BEODocument data={sampleData} taskId="abc123" />)
    expect(screen.getByText('Jane')).toBeDefined()
    expect(screen.getByText('Smith')).toBeDefined()
    expect(screen.getByText('Smith Co')).toBeDefined()
    expect(screen.getByText('555-1234')).toBeDefined()
    expect(screen.getByText('jane@example.com')).toBeDefined()
  })

  it('renders event details section', () => {
    render(<BEODocument data={sampleData} taskId="abc123" />)
    expect(screen.getByText('Wedding')).toBeDefined()
    expect(screen.getByText('The Grand Ballroom')).toBeDefined()
    expect(screen.getByText('Mar 31, 2024, 12:00 PM')).toBeDefined()
    expect(screen.getByText('Mar 31, 2024, 4:00 PM')).toBeDefined()
  })

  it('renders service and package section', () => {
    render(<BEODocument data={sampleData} taskId="abc123" />)
    expect(screen.getByText('Premium')).toBeDefined()
    expect(screen.getByText('Orchid + Umbrella')).toBeDefined()
    expect(screen.getByText('150')).toBeDefined()
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('Yes')).toBeDefined()
    expect(screen.getByText('Approved')).toBeDefined()
    expect(screen.getByText('Health Dept Permit')).toBeDefined()
  })

  it('renders logistics section', () => {
    render(<BEODocument data={sampleData} taskId="abc123" />)
    expect(screen.getByText('Loading Dock B')).toBeDefined()
    expect(screen.getByText('Use service entrance')).toBeDefined()
  })

  it('renders event notes', () => {
    render(<BEODocument data={sampleData} taskId="abc123" />)
    expect(screen.getByText('Bride is allergic to peanuts')).toBeDefined()
  })

  it('renders footer with three separate items', () => {
    render(<BEODocument data={sampleData} taskId="abc123" />)
    expect(screen.getByText('windanseacoconuts.com')).toBeDefined()
    expect(screen.getByText('hello@windanseacoconuts.com')).toBeDefined()
    expect(screen.getByText('Confidential')).toBeDefined()
  })

  it('renders em dashes for missing data', () => {
    const emptyData: BEOData = {
      ...Object.fromEntries(
        Object.keys(sampleData).filter((k) => k !== 'attachments').map((k) => [k, '\u2014'])
      ),
      attachments: [],
    } as BEOData
    render(<BEODocument data={emptyData} taskId="abc123" />)
    const dashes = screen.getAllByText('\u2014')
    expect(dashes.length).toBeGreaterThanOrEqual(19)
  })
})
