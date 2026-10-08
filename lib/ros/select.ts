import { INTAKE_COMPLETE_FIELD_ID } from '@/lib/intake-fields'
import type { ClickUpTask } from './types'

export const SERVICE_START_FIELD_ID = 'f6483054-1434-4c04-ac53-06af6042a96f'
export const WINDOW_DAYS = 14
const PACIFIC = 'America/Los_Angeles'

/** YYYY-MM-DD for an instant, on the Pacific calendar. */
export function pacificDate(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const toMs = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Service Start Date and Time, else task start date, else task due date. */
export function eventDateMs(task: ClickUpTask): number | null {
  const svc = task.custom_fields?.find((f) => f.id === SERVICE_START_FIELD_ID)
  return toMs(svc?.value) ?? toMs(task.start_date) ?? toMs(task.due_date)
}

/** True when Intake Form Complete resolves to the option NAMED "Yes" (never by position). */
export function isIntakeComplete(task: ClickUpTask): boolean {
  const f = task.custom_fields?.find((cf) => cf.id === INTAKE_COMPLETE_FIELD_ID)
  if (!f || f.value === null || f.value === undefined) return false
  const opt = f.type_config?.options?.find((o) => o.orderindex === f.value || o.id === f.value)
  return opt?.name === 'Yes'
}

export interface Selection {
  candidates: ClickUpTask[]
  skippedNoDate: string[]
}

/**
 * Intake-complete tasks whose event date is within [today, today + 14] on the
 * Pacific calendar, soonest first. Tasks with no date are reported, not processed.
 */
export function selectCandidates(tasks: ClickUpTask[], now: Date = new Date()): Selection {
  const from = pacificDate(now.getTime())
  const to = pacificDate(now.getTime() + WINDOW_DAYS * 86_400_000)
  const skippedNoDate: string[] = []
  const dated: Array<{ task: ClickUpTask; ms: number }> = []
  for (const task of tasks) {
    if (!isIntakeComplete(task)) continue
    const ms = eventDateMs(task)
    if (ms === null) {
      skippedNoDate.push(task.id)
      continue
    }
    const day = pacificDate(ms)
    if (day >= from && day <= to) dated.push({ task, ms })
  }
  dated.sort((a, b) => a.ms - b.ms)
  return { candidates: dated.map((d) => d.task), skippedNoDate }
}
