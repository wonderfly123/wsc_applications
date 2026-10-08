// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { eventDateMs, isIntakeComplete, selectCandidates, pacificDate } from '@/lib/ros/select'
import type { ClickUpTask } from '@/lib/ros/types'

const INTAKE = 'dbeda913-50e7-4988-9f1d-d28ec26a9a6d'
const SERVICE_START = 'f6483054-1434-4c04-ac53-06af6042a96f'
const intakeField = (value: number | string) => ({
  id: INTAKE,
  name: 'Intake Form Complete',
  type: 'drop_down',
  value,
  type_config: { options: [{ id: 'yes-id', name: 'Yes', orderindex: 0 }, { id: 'no-id', name: 'No', orderindex: 1 }] },
})
const DAY = 86_400_000
// Fixed "now": Thu Oct 8 2026 14:00 UTC (7 AM Pacific)
const NOW = new Date('2026-10-08T14:00:00Z')
const task = (id: string, over: Partial<ClickUpTask> = {}, intake: number | string = 0): ClickUpTask => ({
  id,
  name: id,
  status: { status: 'to do' },
  custom_fields: [intakeField(intake)],
  ...over,
})

describe('eventDateMs', () => {
  it('prefers service start, then start_date, then due_date', () => {
    expect(
      eventDateMs(
        task('a', {
          start_date: '5',
          due_date: '6',
          custom_fields: [{ id: SERVICE_START, name: 'Service Start', type: 'date', value: '4' }],
        })
      )
    ).toBe(4)
    expect(eventDateMs(task('b', { start_date: '5', due_date: '6' }))).toBe(5)
    expect(eventDateMs(task('c', { due_date: '6' }))).toBe(6)
    expect(eventDateMs(task('d'))).toBeNull()
  })
})

describe('isIntakeComplete', () => {
  it('resolves by option name for legacy (orderindex) and new (uuid) dropdowns', () => {
    expect(isIntakeComplete(task('a', {}, 0))).toBe(true)
    expect(isIntakeComplete(task('b', {}, 1))).toBe(false)
    expect(isIntakeComplete(task('c', {}, 'yes-id'))).toBe(true)
    expect(isIntakeComplete({ ...task('d'), custom_fields: [] })).toBe(false)
  })
})

describe('pacificDate', () => {
  it('formats a UTC instant as the Pacific calendar day', () => {
    expect(pacificDate(new Date('2026-10-09T06:30:00Z').getTime())).toBe('2026-10-08') // 11:30 PM Pacific the day before
  })
})

describe('selectCandidates', () => {
  it('keeps intake-complete tasks from today through day 14, sorted by event date', () => {
    const t = (id: string, offsetDays: number, intake = 0) =>
      task(id, { start_date: String(NOW.getTime() + offsetDays * DAY) }, intake)
    const { candidates, skippedNoDate } = selectCandidates(
      [t('d14', 14), t('d0', 0), t('d15', 15), t('past', -1), t('noIntake', 3, 1), t('d7', 7)],
      NOW
    )
    expect(candidates.map((c) => c.id)).toEqual(['d0', 'd7', 'd14'])
    expect(skippedNoDate).toEqual([])
  })
  it('reports intake-complete tasks that have no date at all', () => {
    const { candidates, skippedNoDate } = selectCandidates([task('nodate')], NOW)
    expect(candidates).toEqual([])
    expect(skippedNoDate).toEqual(['nodate'])
  })
})
