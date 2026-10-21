import type { ClickUpTask } from '@/lib/ros/types'
import { SERVICE_START_FIELD_ID, isIntakeComplete, pacificDate } from '@/lib/ros/select'
import { formatForDisplay } from '@/lib/intake-fields'

const PACIFIC = 'America/Los_Angeles'
const HOUR = 3_600_000
export const WINDOW_HOURS = 72

const F = {
  serviceEnd: 'c4bcdf67-b72d-4531-953e-5cb542b14a3e',
  package: '72edb0f2-022a-4db4-8ec4-88d694cd54b0',
  eventLocation: 'b92b1e46-363e-4453-9888-b530ecdeefce',
  loadIn: '967038c5-4d18-41d5-8c63-f01bf20ece7a',
  phone: '2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48',
  coconutQty: '3e9943e1-4e51-466b-9d6d-f01e862a1bec',
  readyBy: '54389f19-e059-4418-b842-1b1cd12539ca',
  garnish: 'b9341990-5265-41a1-ba1e-4cbd3c767084',
  otherGarnish: '8de89e8b-2d7d-4269-b5cb-d8d6e6d3ab7c',
  setupProvided: '87c25b9c-21b0-4420-8ad9-3d36265d567b',
  deliveryInstructions: 'b4457a6a-5d84-4505-9e9b-6883303331b3',
  headcount: '019ed06a-6a3a-4782-877f-ec4e94b0ac30',
}

export interface TaskGaps {
  id: string
  name: string
  /** Soonest of setup, service start and teardown that is today or later. */
  eventMs: number
  hoursOut: number
  critical: string[]
  important: string[]
}

export interface Digest {
  /** Events within 72 hours with at least one gap, soonest first. */
  events: TaskGaps[]
  /** Open tasks with no setup, service or teardown date, so the 72-hour check can't see them. */
  undated: Array<{ id: string; name: string }>
}

const toMs = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

const fieldOf = (task: ClickUpTask, id: string) => task.custom_fields?.find((f) => f.id === id)

function isBlank(task: ClickUpTask, id: string): boolean {
  const v = fieldOf(task, id)?.value
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (typeof v === 'object') return !(v as { formatted_address?: string }).formatted_address
  return false
}

/** Selected dropdown option name, resolved by id or orderindex (never position). */
function optionName(task: ClickUpTask, id: string): string | null {
  const f = fieldOf(task, id)
  if (!f || f.value === null || f.value === undefined) return null
  return f.type_config?.options?.find((o) => o.orderindex === f.value || o.id === f.value)?.name ?? null
}

const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { timeZone: PACIFIC, month: 'short', day: 'numeric' })

/** Problems with the setup / service / teardown dates, which drive the calendar. */
function dateGaps(task: ClickUpTask, sandcastle: boolean): string[] {
  const out: string[] = []
  const setup = toMs(task.start_date)
  const teardown = toMs(task.due_date)
  const svcStart = toMs(fieldOf(task, SERVICE_START_FIELD_ID)?.value)
  const svcEnd = toMs(fieldOf(task, F.serviceEnd)?.value)

  if (sandcastle) {
    if (!setup) out.push('no delivery start')
    if (!teardown) out.push('no delivery end')
    if (setup && teardown && setup > teardown) out.push('delivery start is after delivery end')
    else if (setup && teardown && pacificDate(setup) !== pacificDate(teardown)) {
      out.push(`delivery window spans ${day(setup)} to ${day(teardown)}`)
    }
    return out
  }

  if (!setup) out.push('no setup time')
  if (!teardown) out.push('no tear down time')
  if (!svcStart) out.push('no service start')
  if (!svcEnd) out.push('no service end')
  if (setup && teardown && setup > teardown) out.push('setup is after tear down')

  // Setup and teardown must fall on the service day(s).
  const anchor = svcStart ?? svcEnd
  if (!anchor) return out
  const firstDay = pacificDate(svcStart ?? anchor)
  const lastDay = pacificDate(svcEnd ?? anchor)
  if (setup) {
    if (svcStart && setup > svcStart) out.push('setup is after service start')
    else if (pacificDate(setup) < firstDay || pacificDate(setup) > lastDay) {
      out.push(`setup on ${day(setup)}, service on ${day(anchor)}`)
    }
  }
  if (teardown) {
    if (svcEnd && teardown < svcEnd) out.push('tear down is before service end')
    else if (pacificDate(teardown) < firstDay || pacificDate(teardown) > lastDay) {
      out.push(`tear down on ${day(teardown)}, service on ${day(anchor)}`)
    }
  }
  return out
}

/** Critical and important gaps for one task, as short phrases. */
export function checkTask(task: ClickUpTask): { critical: string[]; important: string[] } {
  const pkg = optionName(task, F.package)
  const sandcastle = pkg === 'Sandcastle'
  const intakeDone = isIntakeComplete(task)
  const dates = dateGaps(task, sandcastle)

  // Nothing filled in yet: one line says it all, plus anything wrong with the dates.
  if (!intakeDone && !pkg) return { critical: ['intake form not started', ...dates], important: [] }

  const critical: string[] = []
  const important: string[] = []
  if (!intakeDone) critical.push('intake form not complete')
  if (!pkg) critical.push('no package')
  critical.push(...dates)
  if (isBlank(task, F.eventLocation)) critical.push('no event location')
  if (isBlank(task, F.loadIn)) critical.push('no load-in location')
  if (isBlank(task, F.phone)) critical.push('no client phone')
  if (isBlank(task, F.coconutQty)) critical.push('no coconut quantity')

  const garnish = optionName(task, F.garnish)
  if (!garnish) important.push('no garnish')
  else if (garnish === 'Other' && isBlank(task, F.otherGarnish)) important.push('garnish "Other" not described')
  if (!sandcastle) {
    if (isBlank(task, F.readyBy)) important.push('no opened-by-service count')
    if (!optionName(task, F.setupProvided)) important.push('setup provided? blank')
  }
  if (isBlank(task, F.deliveryInstructions)) important.push('no delivery instructions')
  if (isBlank(task, F.headcount)) important.push('no headcount')
  if (task.status?.status?.toLowerCase() === 'pre-event') important.push('still in pre-event status')
  return { critical, important }
}

/**
 * Open events whose soonest upcoming date (setup, service start or teardown)
 * is within 72 hours and that have a gap, plus every open event with no dates.
 */
export function buildDigest(tasks: ClickUpTask[], now: Date = new Date()): Digest {
  const today = pacificDate(now.getTime())
  const events: TaskGaps[] = []
  const undated: Digest['undated'] = []

  for (const task of tasks) {
    if (task.status?.status?.toLowerCase() === 'completed') continue
    const dates = [toMs(task.start_date), toMs(fieldOf(task, SERVICE_START_FIELD_ID)?.value), toMs(task.due_date)].filter(
      (d): d is number => d !== null
    )
    if (dates.length === 0) {
      undated.push({ id: task.id, name: task.name })
      continue
    }
    const upcoming = dates.filter((d) => pacificDate(d) >= today)
    if (upcoming.length === 0) continue
    const eventMs = Math.min(...upcoming)
    const hoursOut = (eventMs - now.getTime()) / HOUR
    if (hoursOut > WINDOW_HOURS) continue

    const { critical, important } = checkTask(task)
    if (critical.length === 0 && important.length === 0) continue
    events.push({ id: task.id, name: task.name, eventMs, hoursOut, critical, important })
  }

  events.sort((a, b) => a.eventMs - b.eventMs)
  return { events, undated }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const taskUrl = (id: string) => `https://app.clickup.com/t/${id}`

function whenLabel(e: TaskGaps): string {
  const when = formatForDisplay(e.eventMs, PACIFIC).replace(/, \d{4},/, ',').replace(/ P[DS]T$/, '')
  if (e.hoursOut <= 0) return `${when} (now)`
  return `${when} (in ${Math.max(1, Math.round(e.hoursOut))} hrs)`
}

function eventHtml(e: TaskGaps): string {
  const line = (items: string[], color: string) =>
    items.length ? `<div style="color: ${color};">${items.map(esc).join(' · ')}</div>` : ''
  return `
    <li style="margin: 0 0 10px;">
      <a href="${taskUrl(e.id)}" style="color: #1a1a1a; font-weight: bold;">${esc(e.name)}</a>
      <span style="color: #666;"> ${esc(whenLabel(e))}</span>
      ${line(e.critical, '#b3261e')}${line(e.important, '#8a6100')}
    </li>`
}

/** Subject and HTML for the morning digest, or null when nothing needs attention. */
export function renderDigest(digest: Digest, now: Date = new Date()): { subject: string; html: string } | null {
  const { events, undated } = digest
  if (events.length === 0 && undated.length === 0) return null
  const dateLabel = now.toLocaleDateString('en-US', { timeZone: PACIFIC, weekday: 'short', month: 'short', day: 'numeric' })

  const subject = `72 Hour Event Check: ${dateLabel}`

  const ul = (items: string) => `<ul style="margin: 0; padding-left: 18px;">${items}</ul>`
  const h = (title: string) => `<p style="margin: 20px 0 8px; font-weight: bold; font-size: 15px;">${title}</p>`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a; font-size: 14px; line-height: 1.5;">
      ${events.length ? h('Events in the next 72 hours with missing or questionable info') + ul(events.map(eventHtml).join('')) : ''}
      ${undated.length ? h('No event dates in ClickUp') + '<p style="margin: 0 0 8px; color: #666;">These won\'t show on the calendar, and this email can\'t warn you 72 hours out until dates are added.</p>' + ul(undated.map((u) => `<li><a href="${taskUrl(u.id)}" style="color: #1a1a1a;">${esc(u.name)}</a></li>`).join('')) : ''}
      <p style="color: #999; font-size: 12px; margin-top: 20px;"><span style="color: #b3261e;">Red</span> = could miss the event or show up wrong. <span style="color: #8a6100;">Amber</span> = could show up underprepared. Fix it in ClickUp and it drops off tomorrow.</p>
    </div>`
  return { subject, html }
}
