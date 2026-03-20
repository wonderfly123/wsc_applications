import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTask, parseCustomFields } from '@/lib/clickup'
import { BEOData } from '@/lib/types'

// Mock ClickUp API response shape
const mockClickUpTask = {
  id: 'abc123',
  name: 'Smith Wedding',
  custom_fields: [
    { id: '6448e40e-5c59-4aeb-b99a-5755536b9463', value: 'Jane' },
    { id: '7ec644ea-814a-4a79-ab52-4a4543466cfb', value: 'Smith' },
    { id: '75e86982-b682-4c56-86c4-2007b87d89df', value: 'Smith Co' },
    { id: 'a4316b37-4646-4db8-93d7-c37561d17a77', value: 'jane@example.com' },
    { id: '2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48', value: '555-1234' },
    { id: 'afb623cf-472e-4d03-b220-bf3b3ce11bc6', type_config: { options: [{ id: '1', name: 'Wedding', orderindex: 1 }] }, value: 1 },
    { id: 'f6483054-1434-4c04-ac53-06af6042a96f', value: '1711900800000' },
    { id: 'c4bcdf67-b72d-4531-953e-5cb542b14a3e', value: '1711915200000' },
    { id: 'b92b1e46-363e-4453-9888-b530ecdeefce', value: 'The Grand Ballroom' },
    { id: '72edb0f2-022a-4db4-8ec4-88d694cd54b0', type_config: { options: [{ id: '2', name: 'Premium', orderindex: 2 }] }, value: 2 },
    { id: '3e9943e1-4e51-466b-9d6d-f01e862a1bec', value: '150' },
    { id: '54389f19-e059-4418-b842-1b1cd12539ca', value: '100' },
    { id: 'b9341990-5265-41a1-ba1e-4cbd3c767084', value: 'Orchid + Umbrella' },
    { id: '87c25b9c-21b0-4420-8ad9-3d36265d567b', value: true },
    { id: '843a7dd5-b277-4429-8240-78515c297a05', type_config: { options: [{ id: '3', name: 'Approved', orderindex: 3 }] }, value: 3 },
    { id: 'f459ee0d-aa89-4d9e-aeff-bf714b7728d6', value: 'Health Dept Permit' },
    { id: '967038c5-4d18-41d5-8c63-f01bf20ece7a', value: 'Loading Dock B' },
    { id: 'b4457a6a-5d84-4505-9e9b-6883303331b3', value: 'Use service entrance' },
    { id: 'd4ac6c86-d0d6-48e2-8958-b0ede74e3456', value: 'Bride is allergic to peanuts' },
  ],
}

describe('parseCustomFields', () => {
  it('extracts all BEO fields from ClickUp custom_fields array', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    expect(data.clientFirstName).toBe('Jane')
    expect(data.clientLastName).toBe('Smith')
    expect(data.companyName).toBe('Smith Co')
    expect(data.clientEmail).toBe('jane@example.com')
    expect(data.eventLocation).toBe('The Grand Ballroom')
    expect(data.deliveryInstructions).toBe('Use service entrance')
    expect(data.eventNotes).toBe('Bride is allergic to peanuts')
  })

  it('returns em dash for missing fields', () => {
    const data = parseCustomFields([])
    expect(data.clientFirstName).toBe('\u2014')
    expect(data.eventNotes).toBe('\u2014')
  })

  it('returns em dash for null/undefined values', () => {
    const fields = [
      { id: '6448e40e-5c59-4aeb-b99a-5755536b9463', value: null },
    ]
    const data = parseCustomFields(fields)
    expect(data.clientFirstName).toBe('\u2014')
  })

  it('resolves dropdown fields to their label name', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    expect(data.eventType).toBe('Wedding')
    expect(data.package).toBe('Premium')
    expect(data.stampStatus).toBe('Approved')
  })

  it('formats boolean fields as Yes/No', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    expect(data.setupProvided).toBe('Yes')
  })

  it('formats date fields as readable strings', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    // Dates should be human-readable, not raw timestamps
    expect(data.serviceStart).not.toBe('1711900800000')
    expect(data.serviceStart).toContain('2024')
  })
})

describe('fetchTask', () => {
  beforeEach(() => {
    vi.stubEnv('CLICKUP_API_KEY', 'test-api-key')
  })

  it('fetches a task from ClickUp API and returns parsed BEO data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockClickUpTask),
    })

    const result = await fetchTask('abc123')
    expect(result).not.toBeNull()
    expect(result!.clientFirstName).toBe('Jane')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.clickup.com/api/v2/task/abc123?custom_task_ids=false&include_subtasks=false',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'test-api-key',
        }),
      })
    )
  })

  it('returns null when API returns non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await fetchTask('nonexistent')
    expect(result).toBeNull()
  })
})
