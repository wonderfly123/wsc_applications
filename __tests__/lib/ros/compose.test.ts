// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, composeRos, type ComposeInputs, type ParseClient } from '@/lib/ros/compose'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'

const inputs: ComposeInputs = {
  mode: 'create',
  task: {
    id: 't',
    name: 'Palm Tree Music Festival',
    status: { status: 'to do' },
    custom_fields: [{ id: 'x', name: 'Coconut Quantity', type: 'number', value: '750' }],
    attachments: [{ id: 'a', title: '[DELIVERY MAP] site.pdf', url: 'u' }],
  },
  fieldSummary: { 'Coconut Quantity': '750', Package: 'Villa' },
  comments: [{ id: 'c', comment_text: 'Client confirmed 750', date: '1' }],
  emails: [
    {
      mailbox: 'harrison@windanseacoconuts.com',
      messageId: '<m1>',
      date: '2026-10-01T00:00:00Z',
      from: 'rj@olukai.com',
      to: 'harrison@windanseacoconuts.com',
      subject: 'Load in',
      body: 'Use the Field 3 entrance',
    },
  ],
  existingRosText: null,
  previousVersion: null,
}

describe('prompts', () => {
  it('system prompt carries house style, rules, and the exemplar', () => {
    const s = buildSystemPrompt()
    expect(s).toContain('9040 Kenamar Dr')
    expect(s).toContain('Never invent a fact')
    expect(s).toContain('LJBTC | End of Summer Luau Drop-Off')
  })
  it('user prompt includes fields, comments, emails, and update context when present', () => {
    const create = buildUserPrompt(inputs)
    expect(create).toContain('Coconut Quantity: 750')
    expect(create).toContain('Client confirmed 750')
    expect(create).toContain('Use the Field 3 entrance')
    expect(create).toContain('MODE: CREATE')
    const update = buildUserPrompt({ ...inputs, mode: 'update', existingRosText: 'EXISTING ROS TEXT', previousVersion: 2 })
    expect(update).toContain('MODE: UPDATE')
    expect(update).toContain('EXISTING ROS TEXT')
    expect(update).toContain('since v2')
  })
})

describe('composeRos', () => {
  it('returns the parsed document from the client', async () => {
    const parse = vi.fn(async (_params: Record<string, unknown>) => ({
      stop_reason: 'end_turn',
      parsed_output: LJBTC_EXEMPLAR as unknown,
    }))
    const client: ParseClient = { messages: { parse } }
    const doc = await composeRos(inputs, client)
    expect(doc.header.subtitle).toBe('LJBTC | End of Summer Luau Drop-Off')
    const call = parse.mock.calls[0][0]
    expect(call.model).toBe('claude-opus-5-5')
    expect((call.output_config as Record<string, unknown>).effort).toBe('high')
  })
  it('throws on refusal or null parsed_output', async () => {
    const refused: ParseClient = { messages: { parse: vi.fn(async () => ({ stop_reason: 'refusal', parsed_output: null })) } }
    await expect(composeRos(inputs, refused)).rejects.toThrow(/refus/i)
    const empty: ParseClient = { messages: { parse: vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: null })) } }
    await expect(composeRos(inputs, empty)).rejects.toThrow(/parse/i)
  })
})
