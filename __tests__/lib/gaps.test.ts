// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildDigest, checkTask, renderDigest } from '@/lib/gaps'
import type { ClickUpCustomField, ClickUpTask } from '@/lib/ros/types'

const opts = (...names: string[]) => names.map((name, i) => ({ id: `o-${name}`, name, orderindex: i }))
const dd = (id: string, names: string[], pick: string | null): ClickUpCustomField => ({
  id,
  name: id,
  type: 'drop_down',
  value: pick === null ? null : names.indexOf(pick),
  type_config: { options: opts(...names) },
})
const val = (id: string, value: unknown): ClickUpCustomField => ({ id, name: id, type: 'x', value })

// Wed Oct 21 2026, 7:00 AM PDT
const NOW = new Date('2026-10-21T14:00:00Z')
const at = (iso: string) => String(new Date(iso).getTime())

// A complete event on Thu Oct 22: setup 4:30 PM, service 6:30–8:30 PM, tear down 9:30 PM
function task(over: Partial<ClickUpTask> = {}, fields: Record<string, unknown> = {}): ClickUpTask {
  const base: Record<string, ClickUpCustomField> = {
    intake: dd('dbeda913-50e7-4988-9f1d-d28ec26a9a6d', ['Yes', 'No'], 'Yes'),
    package: dd('72edb0f2-022a-4db4-8ec4-88d694cd54b0', ['Sandcastle', 'Cabana', 'Villa'], 'Cabana'),
    svcStart: val('f6483054-1434-4c04-ac53-06af6042a96f', at('2026-10-23T01:30:00Z')),
    svcEnd: val('c4bcdf67-b72d-4531-953e-5cb542b14a3e', at('2026-10-23T03:30:00Z')),
    location: val('b92b1e46-363e-4453-9888-b530ecdeefce', { formatted_address: '1500 Orange Ave' }),
    loadIn: val('967038c5-4d18-41d5-8c63-f01bf20ece7a', { formatted_address: 'Laundry lot' }),
    phone: val('2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48', '+16195550100'),
    qty: val('3e9943e1-4e51-466b-9d6d-f01e862a1bec', 75),
    readyBy: val('54389f19-e059-4418-b842-1b1cd12539ca', 0),
    garnish: dd('b9341990-5265-41a1-ba1e-4cbd3c767084', ['Orchids', 'Umbrellas', 'Pineapple Leaves', 'Other', 'N/A'], 'Orchids'),
    otherGarnish: val('8de89e8b-2d7d-4269-b5cb-d8d6e6d3ab7c', null),
    setupProvided: dd('87c25b9c-21b0-4420-8ad9-3d36265d567b', ['Yes', 'No', 'N/A'], 'No'),
    delivery: val('b4457a6a-5d84-4505-9e9b-6883303331b3', 'Beach side gate'),
    headcount: val('019ed06a-6a3a-4782-877f-ec4e94b0ac30', 50),
  }
  for (const [k, v] of Object.entries(fields)) base[k] = { ...base[k], value: v }
  return {
    id: 't1',
    name: 'Hosts Global x Merc Tech',
    status: { status: 'intake form verified' },
    start_date: at('2026-10-22T23:30:00Z'),
    due_date: at('2026-10-23T04:30:00Z'),
    custom_fields: Object.values(base),
    ...over,
  }
}

describe('checkTask', () => {
  it('finds nothing on a complete, consistent event', () => {
    expect(checkTask(task())).toEqual({ critical: [], important: [] })
  })

  it('flags the Hosts Global case: no setup, teardown on the next day', () => {
    const t = task({ start_date: null, due_date: at('2026-10-23T23:30:00Z') }, { intake: 1, svcEnd: null })
    expect(checkTask(t).critical).toEqual([
      'intake form not complete',
      'no setup time',
      'no service end',
      'tear down on Oct 23, service on Oct 22',
    ])
  })

  it('collapses an untouched intake to one line plus date problems', () => {
    const t = task({ start_date: null }, { intake: null, package: null, phone: null, headcount: null })
    expect(checkTask(t)).toEqual({ critical: ['intake form not started', 'no setup time'], important: [] })
  })

  it('flags setup after service start and teardown before service end', () => {
    const t = task({ start_date: at('2026-10-23T02:00:00Z'), due_date: at('2026-10-23T03:00:00Z') })
    expect(checkTask(t).critical).toEqual(['setup is after service start', 'tear down is before service end'])
  })

  it('skips service and readiness checks for Sandcastle, but checks the delivery window', () => {
    const t = task(
      { due_date: at('2026-10-24T01:00:00Z') },
      { package: 0, svcStart: null, svcEnd: null, readyBy: null, setupProvided: null }
    )
    expect(checkTask(t)).toEqual({ critical: ['delivery window spans Oct 22 to Oct 23'], important: [] })
  })

  it('flags blank fields, undescribed Other garnish and pre-event status', () => {
    const t = task(
      { status: { status: 'pre-event' } },
      { location: { formatted_address: '' }, phone: '', qty: null, garnish: 3, headcount: null }
    )
    expect(checkTask(t)).toEqual({
      critical: ['no event location', 'no client phone', 'no coconut quantity'],
      important: ['garnish "Other" not described', 'no headcount', 'still in pre-event status'],
    })
  })
})

describe('buildDigest', () => {
  it('keeps only events within 72 hours that have gaps, soonest first', () => {
    const tomorrow = task({ id: 'tomorrow' }, { headcount: null })
    const today = task(
      { id: 'today', start_date: at('2026-10-21T22:00:00Z'), due_date: at('2026-10-22T03:00:00Z') },
      { svcStart: at('2026-10-21T23:00:00Z'), svcEnd: at('2026-10-22T02:00:00Z'), intake: 1 }
    )
    const clean = task({ id: 'clean' })
    const nextWeek = task(
      { id: 'next-week', start_date: at('2026-10-28T20:00:00Z'), due_date: at('2026-10-28T23:00:00Z') },
      { svcStart: at('2026-10-28T21:00:00Z'), svcEnd: at('2026-10-28T22:00:00Z'), headcount: null }
    )
    const past = task(
      { id: 'past', start_date: at('2026-10-10T20:00:00Z'), due_date: at('2026-10-10T23:00:00Z') },
      { svcStart: at('2026-10-10T21:00:00Z'), svcEnd: at('2026-10-10T22:00:00Z'), headcount: null }
    )
    expect(buildDigest([tomorrow, nextWeek, clean, past, today], NOW).events.map((e) => e.id)).toEqual([
      'today',
      'tomorrow',
    ])
  })

  it('uses the earliest upcoming date, so a wrong teardown still lands in the window', () => {
    const t = task(
      { start_date: null, due_date: at('2026-10-22T23:30:00Z') },
      { svcStart: at('2026-10-30T01:30:00Z'), svcEnd: at('2026-10-30T03:30:00Z') }
    )
    expect(buildDigest([t], NOW).events).toHaveLength(1)
  })

  it('lists open tasks with no dates at all and ignores completed ones', () => {
    const undated = task({ id: 'u', name: 'No dates', start_date: null, due_date: null }, { svcStart: null })
    const done = task({ id: 'd', status: { status: 'completed' } }, { headcount: null })
    expect(buildDigest([undated, done], NOW)).toEqual({ events: [], undated: [{ id: 'u', name: 'No dates' }] })
  })
})

describe('renderDigest', () => {
  it('returns null when there is nothing to report', () => {
    expect(renderDigest({ events: [], undated: [] }, NOW)).toBeNull()
  })

  it('dates the subject and escapes task names', () => {
    const t = task({ name: 'A <b> & C' }, { headcount: null })
    const u = task({ id: 'u', name: 'Undated', start_date: null, due_date: null }, { svcStart: null })
    const out = renderDigest(buildDigest([t, u], NOW), NOW)!
    expect(out.subject).toBe('72 Hour Event Check: Wed, Oct 21')
    expect(out.html).toContain('A &lt;b&gt; &amp; C')
    expect(out.html).toContain('Oct 22, 4:30 PM (in 34 hrs)')
    expect(out.html).toContain('https://app.clickup.com/t/u')
  })
})
