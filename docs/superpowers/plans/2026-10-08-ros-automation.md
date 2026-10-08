# Run of Show Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily Vercel cron that creates a Run of Show (ROS) Word document for every confirmed event in the next 14 days, updates it when the inputs change, and attaches it to the ClickUp Events task for Trent to review.

**Architecture:** A `GET /api/cron/ros` route lists open Events tasks, filters to intake-complete events within 14 days, and for each one computes a fingerprint of its inputs (ClickUp fields, attachments, comments, matching emails). New fingerprint means Claude composes or updates a `RosDocument` (Zod-validated structured output), the `docx` package renders it, and it is uploaded to the task with a `[ROS]` comment. Everything runs in `lib/ros/*` with injected dependencies so the orchestration is unit-testable without network.

**Tech Stack:** Next.js 14 App Router (Node runtime), TypeScript strict, Vitest, `@anthropic-ai/sdk` + `zod` (structured outputs), `docx` (render), `jszip` (read docx), `imapflow` + `mailparser` (Gmail IMAP), Nodemailer (existing).

**Spec:** `docs/superpowers/specs/2026-10-08-ros-automation-design.md`. Read it first. Reference files: `docs/ros/reference/` (template docx, Palm Tree docx, original generator).

**Conventions for every task:** run `npm test` after each change; commit after each task with a `feat:`/`test:`/`docs:` message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. New test files start with `// @vitest-environment node` because the project default is jsdom. Never commit `.env*`. Files stay under 500 lines. Phone numbers render as `###-###-####`. Dates and times are Pacific.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/ros/types.ts` | `RosDocumentSchema` (Zod) + inferred `RosDocument`; raw ClickUp shapes (`ClickUpTask`, `ClickUpAttachment`, `ClickUpComment`); `MailExcerpt`; `RunSummary` |
| `lib/ros/house-style.ts` | Fixed Windansea facts the model may state without them being in the inputs |
| `lib/ros/exemplar.ts` | The LJBTC ROS as a `RosDocument` constant (few-shot + render snapshot) |
| `lib/ros/render.ts` | `renderRos(doc, stampLogo?) → Buffer` (.docx), ported from `docs/ros/reference/palm-tree-generator.js` |
| `lib/ros/extract.ts` | `extractDocxText(buffer) → string` |
| `lib/ros/versions.ts` | `latestRosAttachment()`, `nextRosVersion()`, `rosFilename()` |
| `lib/ros/fingerprint.ts` | `computeFingerprint(inputs) → sha256 hex` with the `[ROS]` exclusions |
| `lib/ros/select.ts` | `eventDateMs()`, `isIntakeComplete()`, `selectCandidates()` (window + ordering) |
| `lib/ros/mail.ts` | IMAP search per mailbox, excerpt trimming, `searchAllMailboxes()` |
| `lib/ros/compose.ts` | Prompt builders + `composeRos()` via `client.messages.parse` |
| `lib/ros/run.ts` | `processTask()` and `runRos()` orchestration with injected deps |
| `lib/clickup.ts` | + `listOpenTasks`, `fetchRawTask`, `fetchTaskComments`, `findListFieldByName`, `uploadAttachment`, `postComment`, `setTextField`, `downloadAttachment` |
| `lib/email.ts` | + `sendRosDraftEmail` (dry-run) |
| `app/api/cron/ros/route.ts` | Auth, wiring of real deps, JSON summary |
| `vercel.json` | Cron schedule |
| `__tests__/lib/ros/*.test.ts`, `__tests__/api/cron-ros.test.ts` | Tests |

---

### Task 0: Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime and type dependencies**

```bash
npm install @anthropic-ai/sdk@^0.132.1 zod@^4.6.5 docx@^9.9.0 jszip@^3.10.2 imapflow@^2.3.0 mailparser@^3.9.37
npm install -D @types/mailparser@^3.9.0
```

- [ ] **Step 2: Verify the project still builds and tests pass**

Run: `npm test && npm run build`
Expected: existing tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ROS automation dependencies (anthropic sdk, zod, docx, jszip, imapflow, mailparser)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 1: Types and Zod schema

**Files:**
- Create: `lib/ros/types.ts`
- Test: `__tests__/lib/ros/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
    const { supplies, ...rest } = minimal
    expect(RosDocumentSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a block without bullets', () => {
    const bad = { ...minimal, days: [{ heading: 'X', blocks: [{ time: '1 PM', title: 'Y' }] }] }
    expect(RosDocumentSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/types.test.ts`
Expected: FAIL, cannot resolve `@/lib/ros/types`.

- [ ] **Step 3: Write the types module**

```ts
// lib/ros/types.ts
import { z } from 'zod'

/** One timed block in a day: "12:45 PM — Warehouse Pickup" plus its bullets. */
const BlockSchema = z.object({
  time: z.string().describe('Time label, e.g. "12:45 PM" or "Time TBD"'),
  title: z.string().describe('Short title, e.g. "Warehouse Pickup"'),
  bullets: z.array(z.string()).min(1),
})

const HeadedBulletsSchema = z.object({ heading: z.string(), bullets: z.array(z.string()).min(1) })
const LabelValueSchema = z.object({ label: z.string(), value: z.string() })

/**
 * The whole Run of Show. Claude fills this; render.ts turns it into a .docx.
 * Nullable (not optional) fields keep the structured-output schema strict.
 */
export const RosDocumentSchema = z.object({
  header: z.object({
    clientName: z.string(),
    eventName: z.string(),
    subtitle: z.string().describe('"<Client> | <Event> — <Package/Type>"'),
  }),
  info: z.array(LabelValueSchema).min(1).describe('Dates, Service, Location, Service Spot, Day-Of Contact, Total Coconuts, Garnish, Headcount…'),
  stampBox: z.array(z.string()).min(1).describe('Lines for the brand stamp box; first line is "Brand Stamp Logo"'),
  entrance: z.string().describe('Entrance & Check-In paragraph, without the label'),
  callout: z.string().nullable().describe('Bold all-caps warning, or null'),
  changes: z.array(z.string()).nullable().describe('UPDATE mode only: what changed since the previous version'),
  days: z.array(z.object({ heading: z.string(), blocks: z.array(BlockSchema).min(1) })).min(1),
  setTimes: z.array(HeadedBulletsSchema).nullable(),
  breakdown: z.array(LabelValueSchema.extend({ item: z.string(), detail: z.string() }).omit({ label: true, value: true })).min(1),
  supplies: z.array(HeadedBulletsSchema).min(1),
  contacts: z.array(LabelValueSchema).min(1),
  openItems: z.array(z.string()).describe('"Confirm before" list; every missing fact goes here'),
})

export type RosDocument = z.infer<typeof RosDocumentSchema>

// ---- Raw ClickUp shapes (only the fields this feature reads) ----

export interface ClickUpOption { id: string; name: string; orderindex: number }

export interface ClickUpCustomField {
  id: string
  name: string
  type: string
  value?: unknown
  type_config?: { options?: ClickUpOption[] }
}

export interface ClickUpAttachment {
  id: string
  title: string
  url: string
  mimetype?: string
  date?: string
}

export interface ClickUpComment {
  id: string
  comment_text: string
  date: string
  user?: { id: number; username: string }
}

export interface ClickUpTask {
  id: string
  name: string
  status?: { status: string }
  date_created?: string
  start_date?: string | null
  due_date?: string | null
  custom_fields: ClickUpCustomField[]
  attachments?: ClickUpAttachment[]
}

export interface MailExcerpt {
  mailbox: string
  messageId: string
  date: string
  from: string
  to: string
  subject: string
  body: string
}

export type TaskOutcome = 'created' | 'updated' | 'skipped'

export interface RunSummary {
  dryRun: boolean
  considered: number
  created: number
  updated: number
  skipped: number
  deferred: number
  failed: Array<{ taskId: string; error: string }>
  warnings: string[]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ros/types.ts __tests__/lib/ros/types.test.ts
git commit -m "feat(ros): RosDocument Zod schema and ClickUp/mail/run types

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: House style and exemplar

**Files:**
- Create: `lib/ros/house-style.ts`
- Create: `lib/ros/exemplar.ts`
- Test: `__tests__/lib/ros/exemplar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { RosDocumentSchema } from '@/lib/ros/types'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'
import { HOUSE_STYLE } from '@/lib/ros/house-style'

describe('exemplar and house style', () => {
  it('exemplar validates against the schema', () => {
    const r = RosDocumentSchema.safeParse(LJBTC_EXEMPLAR)
    expect(r.success).toBe(true)
  })
  it('exemplar carries the template landmarks', () => {
    expect(LJBTC_EXEMPLAR.header.subtitle).toBe('LJBTC | End of Summer Luau Drop-Off')
    expect(LJBTC_EXEMPLAR.days[0].heading).toBe('EVENT DAY — FRIDAY, OCTOBER 9')
    expect(LJBTC_EXEMPLAR.breakdown.map((b) => b.item)).toContain('Package')
  })
  it('house style has the warehouse and post-event steps', () => {
    expect(HOUSE_STYLE.warehouseAddress).toContain('9040 Kenamar Dr')
    expect(HOUSE_STYLE.postEventSteps.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/exemplar.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write house-style.ts**

```ts
// lib/ros/house-style.ts
/**
 * Fixed Windansea facts the ROS writer may use without them appearing in the
 * event inputs. Anything NOT here and not in the inputs is an open item.
 */
export const HOUSE_STYLE = {
  companyName: 'Windansea Coconuts',
  warehouseAddress: '9040 Kenamar Dr, Unit 403, San Diego',
  windanseaContact: 'Trent LiVolsi, 732-575-5774',
  postEventSteps: [
    'Add hours to the 2026 Timesheet',
    'Confirm final payment received, follow up on invoice if not',
  ],
  packages: {
    Sandcastle: 'Delivery only: custom branded coconuts, prepped and hand-delivered. No Windansea staff during service.',
    Cabana: 'Delivery plus live service: a coconut specialist serves guests from a styled service cart.',
    Villa: 'Top tier: delivery, live service, and premium brand activation with tailored presentation.',
  },
  /** Standard packing list by category. The writer trims to what the event needs. */
  packingList: {
    'Coconuts & Service': ['Coconuts (stamped if a brand stamp applies)', 'Garnish', 'Straws', 'Napkins', 'Sporks or spoons (cut-open style)', 'Coconut water in jugs (pre-opened orders)'],
    Tools: ['Coconut openers and mallets', 'Knives and wooden cutting board', 'Opening station', 'Scraper', 'Coolers and ice', 'Drain buckets and strainers'],
    'Display & Setup': ['Cart with Windansea decal', 'Umbrella', 'Windansea signage', 'Client signage', 'Table if client is not providing a bar', 'Weights or stakes to anchor on grass or wind'],
    'Cleaning & Safety': ['Food-safe sanitizer spray', 'Bar towels and paper towels', 'Nitrile or food-handling gloves', 'Floor mat or splash guard', 'Heavy-duty trash bags', 'Hand sanitizer pump', 'First aid kit'],
    Team: ['Aprons', 'Government photo ID when credentials are required'],
    Delivery: ['Foldable dolly'],
  },
  /** Rules repeated in every prompt. */
  rules: [
    'Never invent a fact. If it is not in the inputs or the house style, put it in openItems instead of the body.',
    'Times are Pacific. Write times like "2:00 PM". Write phone numbers like 858-551-4654.',
    'Keep the tone direct and operational, written for the crew on the day.',
    'Day headings are all caps: "EVENT DAY — FRIDAY, OCTOBER 9". Multi-day events get one heading per day plus a load-out day when strike is separate.',
    'Each block has a time label and a short title; bullets are complete instructions, no trailing periods.',
    'The breakdown table always includes Total coconuts, Opened by start of service, Garnish, Package, and Certifications.',
    'Contacts always end with the Windansea line from the house style.',
    'Post-event block always includes the house-style post-event steps.',
    'In UPDATE mode, keep the existing wording and any content that is not contradicted by new inputs, and list every change in changes.',
  ],
} as const
```

- [ ] **Step 4: Write exemplar.ts (transcribed from `docs/ros/reference/template-ljbtc-2026-10-09.docx`)**

```ts
// lib/ros/exemplar.ts
import type { RosDocument } from './types'

/** The LJBTC End of Summer Luau drop-off ROS (Oct 9, 2026), the structural template. */
export const LJBTC_EXEMPLAR: RosDocument = {
  header: {
    clientName: 'La Jolla Beach & Tennis Club',
    eventName: 'End of Summer Luau',
    subtitle: 'LJBTC | End of Summer Luau Drop-Off',
  },
  info: [
    { label: 'Date', value: 'Friday, October 9, 2026' },
    { label: 'Delivery Time', value: '2:00 PM (service 3:00 PM – 5:00 PM, run by LJBTC)' },
    { label: 'Location', value: 'La Jolla Beach & Tennis Club, 2000 Spindrift Dr, La Jolla, CA 92037' },
    { label: 'Service Spot', value: 'Drop-off only' },
    { label: 'Day-Of Contact', value: 'Ilona Ermolova 858-551-4654' },
    { label: 'Total Coconuts', value: '100' },
    { label: 'Garnish', value: 'Umbrellas' },
  ],
  stampBox: ['Brand Stamp Logo', '[Logo TBD]', 'Requested from Trina 10/3'],
  entrance:
    'Please call event contact to inform them of your ETA. Park between the two hotel properties, outside the Beach Club near the kayak loading area, and wheel everything through the side entry gate. LJBTC will have someone there to open the gate. If that route is tough, unload at the Spindrift Pavilion area and walk items over.',
  callout: 'FRONT DESK WILL DIRECT YOU WHERE TO GO AS WELL',
  changes: null,
  days: [
    {
      heading: 'EVENT DAY — FRIDAY, OCTOBER 9',
      blocks: [
        { time: '12:45 PM', title: 'Warehouse Pickup', bullets: ['Load 100 coconuts, umbrellas, straws, napkins, coconut water and supplies listed below', 'Warehouse: 9040 Kenamar Dr, Unit 403, San Diego'] },
        { time: '1:30 PM', title: 'Arrive & Load In', bullets: ['Park near the kayak loading area and call the day-of contact for the side gate', 'Backup: unload at Spindrift Pavilion and walk items over', 'Last time (Aug 12) vendors checked in at the Ambassador booth. Overflow parking was the Marine Room Extended Lot, 1950 Spindrift Dr'] },
        { time: '2:00 PM', title: 'Delivery & Handoff', bullets: ['Coconuts delivered by 2:00 PM, this is the time LJBTC asked for', 'Hand off coconuts, garnish, and service items to LJBTC staff', 'Walk them through how to open and serve the whole coconuts', 'Grab photos for socials before leaving'] },
        { time: '2:15 PM', title: 'Depart', bullets: ['Drop-off only, no Windansea staff during service'] },
        { time: 'Post Event', title: '', bullets: ['Add hours to the 2026 Timesheet', 'Confirm final payment received, follow up on invoice if not'] },
      ],
    },
  ],
  setTimes: null,
  breakdown: [
    { item: 'Total coconuts', detail: '100' },
    { item: 'Opened by start of service', detail: '100 cup-opened with coconut water on side' },
    { item: 'Garnish', detail: 'Umbrellas' },
    { item: 'Package', detail: 'Sandcastle' },
    { item: 'Certifications', detail: 'COI required' },
  ],
  supplies: [
    { heading: 'Delivery', bullets: ['1x foldable dolly for the walk through the side gate', 'Coconut water in jugs', 'Umbrella garnish, pack 100 (don’t count this out, just throw a bunch in a bag)', 'Straws, pack 1x of the large packs', 'Napkins, pack 100+', 'Medium food handling gloves'] },
  ],
  contacts: [
    { label: 'Event Manager', value: 'Trina Ngo, LJBTC, 858-551-4666, TNgo@ljbtc.com' },
    { label: 'Sales Coordinator', value: 'Ilona Ermolova, LJBTC, 858-551-4654, IErmolova@ljbtc.com' },
    { label: 'Client Team', value: 'Avery Huber, LJBTC, AHuber@ljbtc.com' },
    { label: 'Windansea', value: 'Trent LiVolsi, 732-575-5774' },
  ],
  openItems: ['Stamp logo file from Trina'],
}
```

Note the breakdown rows use `item`/`detail`. If the Zod `.extend().omit()` in Task 1 feels awkward, replace that line with a plain `z.object({ item: z.string(), detail: z.string() })`; the test in Task 1 still passes.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/exemplar.test.ts __tests__/lib/ros/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ros/house-style.ts lib/ros/exemplar.ts __tests__/lib/ros/exemplar.test.ts
git commit -m "feat(ros): house style constants and LJBTC exemplar document

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Render RosDocument to .docx

**Files:**
- Create: `lib/ros/render.ts`
- Create: `lib/ros/extract.ts`
- Test: `__tests__/lib/ros/render.test.ts`

Port of `docs/ros/reference/palm-tree-generator.js`. Read that file before writing; the formatting constants below come from it.

- [ ] **Step 1: Write the failing test (render and extract together, since extract is how we assert on render)**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { renderRos } from '@/lib/ros/render'
import { extractDocxText } from '@/lib/ros/extract'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'

describe('renderRos', () => {
  it('produces a docx zip with document.xml', async () => {
    const buf = await renderRos(LJBTC_EXEMPLAR)
    const zip = await JSZip.loadAsync(buf)
    expect(zip.file('word/document.xml')).toBeTruthy()
  })

  it('round-trips the main content through extractDocxText', async () => {
    const buf = await renderRos(LJBTC_EXEMPLAR)
    const text = await extractDocxText(buf)
    expect(text).toContain('WINDANSEA COCONUTS — RUN OF SHOW')
    expect(text).toContain('LJBTC | End of Summer Luau Drop-Off')
    expect(text).toContain('Entrance & Check-In:')
    expect(text).toContain('EVENT DAY — FRIDAY, OCTOBER 9')
    expect(text).toContain('12:45 PM — Warehouse Pickup')
    expect(text).toContain('Total coconuts | 100')
    expect(text).toContain('Windansea: Trent LiVolsi, 732-575-5774')
    expect(text).toContain('CONFIRM BEFORE EVENT')
  })

  it('renders a "What changed" block and set times when present', async () => {
    const doc = { ...LJBTC_EXEMPLAR, changes: ['Delivery moved to 2:30 PM'], setTimes: [{ heading: 'Friday', bullets: ['DJ 3:00–5:00'] }] }
    const text = await extractDocxText(await renderRos(doc))
    expect(text).toContain('WHAT CHANGED')
    expect(text).toContain('Delivery moved to 2:30 PM')
    expect(text).toContain('SET TIMES')
  })

  it('embeds a stamp logo when given one', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    )
    const buf = await renderRos(LJBTC_EXEMPLAR, { data: png, widthPx: 1, heightPx: 1 })
    const zip = await JSZip.loadAsync(buf)
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/render.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write extract.ts**

```ts
// lib/ros/extract.ts
import JSZip from 'jszip'

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

/**
 * Plain text of a .docx in document order. Paragraphs become lines; table rows
 * become "cell | cell" lines. Good enough for the model to read an existing ROS.
 */
export async function extractDocxText(docx: Buffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(docx)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('document.xml missing from docx')

  const body = xml.match(/<w:body>([\s\S]*?)<\/w:body>/)?.[1] ?? xml
  const lines: string[] = []
  const paraText = (p: string) => decode((p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))

  // Walk top-level tables and paragraphs in order. Tables can nest (the stamp
  // box sits inside the info table), so find a table's end by depth, not by
  // the first closing tag.
  const chunks: string[] = []
  let i = 0
  while (i < body.length) {
    const tbl = body.indexOf('<w:tbl>', i)
    const par = body.search(/<w:p\b/) === -1 ? -1 : body.slice(i).search(/<w:p\b/)
    const parAbs = par === -1 ? -1 : i + par
    if (tbl === -1 && parAbs === -1) break
    if (tbl !== -1 && (parAbs === -1 || tbl < parAbs)) {
      let depth = 0
      let j = tbl
      const tagRe = /<w:tbl>|<\/w:tbl>/g
      tagRe.lastIndex = tbl
      let t: RegExpExecArray | null
      while ((t = tagRe.exec(body))) {
        depth += t[0] === '<w:tbl>' ? 1 : -1
        if (depth === 0) { j = t.index + t[0].length; break }
      }
      chunks.push(body.slice(tbl, j))
      i = j
    } else {
      const end = body.indexOf('</w:p>', parAbs)
      if (end === -1) break
      chunks.push(body.slice(parAbs, end + 6))
      i = end + 6
    }
  }
  for (const chunk of chunks) {
    if (chunk.startsWith('<w:tbl>')) {
      for (const tr of chunk.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []) {
        const cells = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) =>
          (tc.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(paraText).filter(Boolean).join(' / ')
        )
        if (cells.some(Boolean)) lines.push(cells.join(' | '))
      }
    } else {
      const t = paraText(chunk)
      if (t.trim()) lines.push(t)
    }
  }
  return lines.join('\n')
}
```

Nested tables (the stamp box) sit inside a `<w:tc>` and are flattened into that cell's text by the inner paragraph scan, which is fine.

- [ ] **Step 4: Write render.ts**

```ts
// lib/ros/render.ts
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  BorderStyle, WidthType, LevelFormat, AlignmentType,
} from 'docx'
import type { RosDocument } from './types'

const BLUE = '3D72B8'
const BLACK = '000000'
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const LINE = (size: number, color: string) => ({ style: BorderStyle.SINGLE, size, color })

const run = (text: string, opts: Record<string, unknown> = {}) => new TextRun({ text, color: BLACK, size: 22, ...opts })
const bold = (text: string, opts: Record<string, unknown> = {}) => run(text, { bold: true, ...opts })
const labelLine = (label: string, value: string, spacing?: { before?: number }) =>
  new Paragraph({ spacing, children: [bold(`${label}: `), run(value)] })
const section = (text: string) =>
  new Paragraph({ keepNext: true, spacing: { before: 280, after: 120 }, children: [new TextRun({ text, bold: true, color: BLUE, size: 26 })] })
const timeHead = (text: string) =>
  new Paragraph({ keepNext: true, spacing: { before: 160, after: 40 }, children: [new TextRun({ text, bold: true, color: BLACK, size: 23 })] })
const subHead = (text: string) => new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [bold(text)] })
const bullet = (text: string) =>
  new Paragraph({ style: 'ListParagraph', numbering: { reference: 'bullets', level: 0 }, spacing: { after: 20 }, children: [run(text)] })

export interface StampLogo { data: Buffer | Uint8Array; widthPx: number; heightPx: number }

/** Scale an image to at most 173px wide (1.8"), keeping aspect ratio. */
function fitLogo(logo: StampLogo): { width: number; height: number } {
  const maxW = 173
  const w = Math.min(maxW, logo.widthPx || maxW)
  const h = logo.heightPx && logo.widthPx ? Math.round((w * logo.heightPx) / logo.widthPx) : 36
  return { width: w, height: Math.max(1, h) }
}

function infoTable(doc: RosDocument, logo?: StampLogo): Table {
  const left = new TableCell({
    width: { size: 6660, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: doc.info.map((i) => labelLine(i.label, i.value)),
  })
  const stampBox = new Table({
    width: { size: 2400, type: WidthType.DXA },
    columnWidths: [2400],
    margins: { left: 10, right: 10 },
    borders: { top: LINE(4, 'auto'), bottom: LINE(4, 'auto'), left: LINE(4, 'auto'), right: LINE(4, 'auto'), insideHorizontal: LINE(4, 'auto'), insideVertical: LINE(4, 'auto') },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: 2400, type: WidthType.DXA },
      borders: { top: LINE(6, BLACK), bottom: LINE(6, BLACK), left: LINE(6, BLACK), right: LINE(6, BLACK) },
      margins: { top: 60, bottom: 60, left: 120, right: 60 },
      children: doc.stampBox.map((line, i) => new Paragraph({ children: [new TextRun({ text: line, bold: i === 0, color: BLACK })] })),
    })] })],
  })
  const rightChildren: (Table | Paragraph)[] = [stampBox]
  if (logo) {
    const { width, height } = fitLogo(logo)
    rightChildren.push(new Paragraph({ spacing: { before: 160 }, children: [new ImageRun({ type: 'png', data: logo.data, transformation: { width, height }, altText: { title: 'Brand logo', description: 'Client brand stamp logo', name: 'Brand logo' } })] }))
  } else {
    rightChildren.push(new Paragraph({ children: [] }))
  }
  const right = new TableCell({
    width: { size: 2700, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
    margins: { left: 200 },
    children: rightChildren,
  })
  return new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [6660, 2700], margins: { left: 10, right: 10 },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({ children: [left, right] })],
  })
}

function breakdownTable(rows: RosDocument['breakdown']): Table {
  const cell = (text: string, isBold: boolean) => new TableCell({
    width: { size: 4680, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100 },
    children: [new Paragraph({ children: [isBold ? bold(text) : run(text)] })],
  })
  const all = [{ item: 'Item', detail: 'Detail' }, ...rows]
  return new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], margins: { left: 10, right: 10 },
    borders: { top: LINE(6, BLACK), bottom: LINE(6, BLACK), left: NONE, right: NONE, insideVertical: NONE, insideHorizontal: LINE(2, 'BFBFBF') },
    rows: all.map((r, i) => new TableRow({ children: [cell(r.item, i === 0), cell(r.detail, i === 0)] })),
  })
}

/** Render a RosDocument to a .docx buffer matching the LJBTC template layout. */
export async function renderRos(doc: RosDocument, logo?: StampLogo): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: 'WINDANSEA COCONUTS — RUN OF SHOW', bold: true, color: BLACK, size: 40 })] }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, space: 6, color: BLUE } }, spacing: { after: 160 },
      children: [new TextRun({ text: doc.header.subtitle, bold: true, color: BLUE, size: 26 })],
    }),
    infoTable(doc, logo),
    new Paragraph({ spacing: { before: 240 }, children: [bold('Entrance & Check-In: '), run(doc.entrance)] }),
  ]
  if (doc.callout) children.push(new Paragraph({ spacing: { before: 240 }, children: [bold(`**${doc.callout}**`)] }))
  if (doc.changes && doc.changes.length) {
    children.push(section('WHAT CHANGED'), ...doc.changes.map(bullet))
  }
  for (const day of doc.days) {
    children.push(section(day.heading))
    for (const b of day.blocks) {
      children.push(timeHead(b.title ? `${b.time} — ${b.title}` : b.time), ...b.bullets.map(bullet))
    }
  }
  if (doc.setTimes && doc.setTimes.length) {
    children.push(section('SET TIMES'))
    for (const s of doc.setTimes) children.push(subHead(s.heading), ...s.bullets.map(bullet))
  }
  children.push(section('COCONUT BREAKDOWN'), breakdownTable(doc.breakdown), section('SUPPLIES'))
  for (const s of doc.supplies) children.push(subHead(s.heading), ...s.bullets.map(bullet))
  children.push(section('CONTACTS'), ...doc.contacts.map((c) => labelLine(c.label, c.value)))
  children.push(section('CONFIRM BEFORE EVENT'), ...(doc.openItems.length ? doc.openItems.map(bullet) : [bullet('Nothing outstanding')]))

  const document = new Document({
    creator: 'Windansea Coconuts',
    title: `Windansea Coconuts — Run of Show — ${doc.header.subtitle}`,
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 22 } } },
      paragraphStyles: [{ id: 'ListParagraph', name: 'List Paragraph', basedOn: 'Normal', quickFormat: true }],
    },
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1440, right: 1440, header: 708, footer: 708, gutter: 0 } } },
      children,
    }],
  })
  return Packer.toBuffer(document)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/render.test.ts`
Expected: PASS (4 tests). If `extractDocxText` misses the table row, check that `jszip` returned `document.xml` and that the regex alternation handled `<w:p>` vs `<w:p w14:...>`; `<w:p\b` covers both.

- [ ] **Step 6: Commit**

```bash
git add lib/ros/render.ts lib/ros/extract.ts __tests__/lib/ros/render.test.ts
git commit -m "feat(ros): render RosDocument to docx and extract docx text

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Versions

**Files:**
- Create: `lib/ros/versions.ts`
- Test: `__tests__/lib/ros/versions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { latestRosAttachment, nextRosVersion, rosFilename, isRosAttachment } from '@/lib/ros/versions'
import type { ClickUpAttachment } from '@/lib/ros/types'

const att = (id: string, title: string, date: string): ClickUpAttachment => ({ id, title, url: `https://x/${id}`, date })

describe('versions', () => {
  it('detects [ROS] attachments by prefix only', () => {
    expect(isRosAttachment(att('1', '[ROS] Foo v1 — DRAFT.docx', '1'))).toBe(true)
    expect(isRosAttachment(att('2', '[STAMP LOGO] foo.png', '1'))).toBe(false)
    expect(isRosAttachment(att('3', 'ros notes.docx', '1'))).toBe(false)
  })
  it('returns the newest [ROS] attachment by date', () => {
    const list = [att('a', '[ROS] Foo v1 — DRAFT.docx', '100'), att('b', '[DELIVERY MAP] m.pdf', '300'), att('c', '[ROS] Foo v2 — DRAFT.docx', '200')]
    expect(latestRosAttachment(list)?.id).toBe('c')
    expect(latestRosAttachment([att('b', 'x', '1')])).toBeNull()
  })
  it('computes the next version from the highest vN seen', () => {
    expect(nextRosVersion([])).toBe(1)
    expect(nextRosVersion([att('a', '[ROS] Foo v3 — DRAFT.docx', '1'), att('b', '[ROS] Foo v10 — DRAFT.docx', '2')])).toBe(11)
    expect(nextRosVersion([att('a', '[ROS] Palm Tree.docx', '1')])).toBe(2)
  })
  it('builds the filename', () => {
    expect(rosFilename('Palm Tree Music Festival', 2)).toBe('[ROS] Palm Tree Music Festival v2 — DRAFT.docx')
    expect(rosFilename('Smith / Wedding: "Big" Day', 1)).toBe('[ROS] Smith - Wedding- Big Day v1 — DRAFT.docx')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/versions.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write versions.ts**

```ts
// lib/ros/versions.ts
import type { ClickUpAttachment } from './types'

export const ROS_PREFIX = '[ROS]'

export const isRosAttachment = (a: ClickUpAttachment) => (a.title ?? '').startsWith(ROS_PREFIX)

/** Newest `[ROS]` attachment by ClickUp date (ms string), or null. */
export function latestRosAttachment(attachments: ClickUpAttachment[]): ClickUpAttachment | null {
  const ros = attachments.filter(isRosAttachment)
  if (ros.length === 0) return null
  return ros.reduce((best, a) => (Number(a.date ?? 0) > Number(best.date ?? 0) ? a : best))
}

/** One more than the highest "vN" among `[ROS]` titles; 1 when there are none; 2 when there are `[ROS]` files without a parsable version. */
export function nextRosVersion(attachments: ClickUpAttachment[]): number {
  const ros = attachments.filter(isRosAttachment)
  if (ros.length === 0) return 1
  let max = 1
  for (const a of ros) {
    const m = /\bv(\d+)\b/.exec(a.title)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

/** `[ROS] <task name> vN — DRAFT.docx`, with filesystem-hostile characters removed. */
export function rosFilename(taskName: string, version: number): string {
  const safe = taskName.replace(/[\\/:]/g, '-').replace(/["*?<>|]/g, '').replace(/\s+/g, ' ').trim()
  return `${ROS_PREFIX} ${safe} v${version} — DRAFT.docx`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/versions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ros/versions.ts __tests__/lib/ros/versions.test.ts
git commit -m "feat(ros): find latest ROS attachment, next version, filename

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Fingerprint

**Files:**
- Create: `lib/ros/fingerprint.ts`
- Test: `__tests__/lib/ros/fingerprint.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeFingerprint, ROS_SCHEMA_VERSION } from '@/lib/ros/fingerprint'
import type { ClickUpTask, ClickUpComment } from '@/lib/ros/types'

const FP_FIELD = 'fp-field-id'
const base: ClickUpTask = {
  id: 't1', name: 'Palm Tree', status: { status: 'brand stamp ordered' }, start_date: '1', due_date: '2',
  custom_fields: [
    { id: 'a', name: 'Coconut Quantity', type: 'number', value: '750' },
    { id: 'b', name: 'Garnish', type: 'drop_down', value: 3 },
    { id: FP_FIELD, name: 'ROS Fingerprint', type: 'text', value: 'old-hash' },
  ],
  attachments: [{ id: 'att1', title: '[STAMP LOGO] x.png', url: 'u', date: '1' }],
}
const comments: ClickUpComment[] = [{ id: 'c1', comment_text: 'Client wants 800 now', date: '1' }]
const args = (over: Partial<{ task: ClickUpTask; comments: ClickUpComment[]; messageIds: string[] }> = {}) => ({
  task: over.task ?? base, comments: over.comments ?? comments, messageIds: over.messageIds ?? ['m1'], fingerprintFieldId: FP_FIELD,
})

describe('computeFingerprint', () => {
  it('is a 64-char hex string and stable across key order', () => {
    const fp = computeFingerprint(args())
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    const reordered: ClickUpTask = { ...base, custom_fields: [...base.custom_fields].reverse() }
    expect(computeFingerprint(args({ task: reordered }))).toBe(fp)
  })
  it('changes when a field, attachment, comment, message id, or schema version changes', () => {
    const fp = computeFingerprint(args())
    expect(computeFingerprint(args({ task: { ...base, custom_fields: [{ id: 'a', name: 'Coconut Quantity', type: 'number', value: '800' }, ...base.custom_fields.slice(1)] } }))).not.toBe(fp)
    expect(computeFingerprint(args({ task: { ...base, attachments: [...(base.attachments ?? []), { id: 'att2', title: '[DELIVERY MAP] m.pdf', url: 'u', date: '2' }] } }))).not.toBe(fp)
    expect(computeFingerprint(args({ comments: [...comments, { id: 'c2', comment_text: 'Trent: parking is lot C', date: '2' }] }))).not.toBe(fp)
    expect(computeFingerprint(args({ messageIds: ['m1', 'm2'] }))).not.toBe(fp)
    expect(computeFingerprint({ ...args(), schemaVersion: ROS_SCHEMA_VERSION + 1 })).not.toBe(fp)
  })
  it('is UNCHANGED by the bot\'s own writes: [ROS] attachments, [ROS] comments, the fingerprint field', () => {
    const fp = computeFingerprint(args())
    const withRosAtt: ClickUpTask = { ...base, attachments: [...(base.attachments ?? []), { id: 'r1', title: '[ROS] Palm Tree v1 — DRAFT.docx', url: 'u', date: '9' }] }
    expect(computeFingerprint(args({ task: withRosAtt }))).toBe(fp)
    expect(computeFingerprint(args({ comments: [...comments, { id: 'c9', comment_text: '[ROS] v1 drafted', date: '9' }] }))).toBe(fp)
    const newHash: ClickUpTask = { ...base, custom_fields: base.custom_fields.map((f) => (f.id === FP_FIELD ? { ...f, value: 'new-hash' } : f)) }
    expect(computeFingerprint(args({ task: newHash }))).toBe(fp)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/fingerprint.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write fingerprint.ts**

```ts
// lib/ros/fingerprint.ts
import { createHash } from 'node:crypto'
import type { ClickUpTask, ClickUpComment } from './types'
import { ROS_PREFIX } from './versions'

/** Bump when the generator's output changes materially; forces every managed task to refresh once. */
export const ROS_SCHEMA_VERSION = 1

export interface FingerprintInputs {
  task: ClickUpTask
  comments: ClickUpComment[]
  messageIds: string[]
  fingerprintFieldId: string
  schemaVersion?: number
}

/** JSON with object keys sorted recursively, so hashing is order-independent. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export const isRosComment = (c: ClickUpComment) => (c.comment_text ?? '').trimStart().startsWith(ROS_PREFIX)

/**
 * SHA-256 over everything that feeds the ROS, EXCLUDING the bot's own writes
 * (the `[ROS]` file, the `[ROS]` comment, the ROS Fingerprint field). Without
 * those exclusions SKIP could never happen.
 */
export function computeFingerprint(inputs: FingerprintInputs): string {
  const { task, comments, messageIds, fingerprintFieldId } = inputs
  const fields: Record<string, unknown> = {}
  for (const f of task.custom_fields ?? []) {
    if (f.id === fingerprintFieldId) continue
    fields[f.id] = f.value ?? null
  }
  const payload = {
    schemaVersion: inputs.schemaVersion ?? ROS_SCHEMA_VERSION,
    name: task.name,
    status: task.status?.status ?? null,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    fields,
    attachmentIds: (task.attachments ?? []).filter((a) => !(a.title ?? '').startsWith(ROS_PREFIX)).map((a) => a.id).sort(),
    commentIds: comments.filter((c) => !isRosComment(c)).map((c) => c.id).sort(),
    messageIds: [...messageIds].sort(),
  }
  return createHash('sha256').update(canonicalJson(payload)).digest('hex')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/fingerprint.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ros/fingerprint.ts __tests__/lib/ros/fingerprint.test.ts
git commit -m "feat(ros): input fingerprint with [ROS] self-write exclusions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Candidate selection

**Files:**
- Create: `lib/ros/select.ts`
- Test: `__tests__/lib/ros/select.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { eventDateMs, isIntakeComplete, selectCandidates, pacificDate } from '@/lib/ros/select'
import type { ClickUpTask } from '@/lib/ros/types'

const INTAKE = 'dbeda913-50e7-4988-9f1d-d28ec26a9a6d'
const SERVICE_START = 'f6483054-1434-4c04-ac53-06af6042a96f'
const intakeField = (value: number | string) => ({
  id: INTAKE, name: 'Intake Form Complete', type: 'drop_down', value,
  type_config: { options: [{ id: 'yes-id', name: 'Yes', orderindex: 0 }, { id: 'no-id', name: 'No', orderindex: 1 }] },
})
const DAY = 86_400_000
// Fixed "now": Thu Oct 8 2026 14:00 UTC (7 AM Pacific)
const NOW = new Date('2026-10-08T14:00:00Z')
const task = (id: string, over: Partial<ClickUpTask> = {}, intake: number | string = 0): ClickUpTask => ({
  id, name: id, status: { status: 'to do' }, custom_fields: [intakeField(intake)], ...over,
})

describe('eventDateMs', () => {
  it('prefers service start, then start_date, then due_date', () => {
    expect(eventDateMs(task('a', { start_date: '5', due_date: '6', custom_fields: [{ id: SERVICE_START, name: 'Service Start', type: 'date', value: '4' }] }))).toBe(4)
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
    const t = (id: string, offsetDays: number, intake = 0) => task(id, { start_date: String(NOW.getTime() + offsetDays * DAY) }, intake)
    const { candidates, skippedNoDate } = selectCandidates([t('d14', 14), t('d0', 0), t('d15', 15), t('past', -1), t('noIntake', 3, 1), t('d7', 7)], NOW)
    expect(candidates.map((c) => c.id)).toEqual(['d0', 'd7', 'd14'])
    expect(skippedNoDate).toEqual([])
  })
  it('reports intake-complete tasks that have no date at all', () => {
    const { candidates, skippedNoDate } = selectCandidates([task('nodate')], NOW)
    expect(candidates).toEqual([])
    expect(skippedNoDate).toEqual(['nodate'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/select.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write select.ts**

```ts
// lib/ros/select.ts
import { INTAKE_COMPLETE_FIELD_ID } from '@/lib/intake-fields'
import type { ClickUpTask } from './types'

export const SERVICE_START_FIELD_ID = 'f6483054-1434-4c04-ac53-06af6042a96f'
export const WINDOW_DAYS = 14
const PACIFIC = 'America/Los_Angeles'

/** YYYY-MM-DD for an instant, on the Pacific calendar. */
export function pacificDate(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms))
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

export interface Selection { candidates: ClickUpTask[]; skippedNoDate: string[] }

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
    if (ms === null) { skippedNoDate.push(task.id); continue }
    const day = pacificDate(ms)
    if (day >= from && day <= to) dated.push({ task, ms })
  }
  dated.sort((a, b) => a.ms - b.ms)
  return { candidates: dated.map((d) => d.task), skippedNoDate }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/select.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ros/select.ts __tests__/lib/ros/select.test.ts
git commit -m "feat(ros): candidate selection by intake status and 14-day Pacific window

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: ClickUp helpers

**Files:**
- Modify: `lib/clickup.ts` (append at end)
- Modify: `app/api/intake/[taskId]/route.ts:7-23` (delete local `uploadAttachment`, import the new one)
- Test: `__tests__/lib/clickup-ros.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listOpenTasks, fetchRawTask, fetchTaskComments, findListFieldByName, uploadAttachment, postComment, setTextField, downloadAttachment } from '@/lib/clickup'

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })

describe('clickup ROS helpers', () => {
  const fetchMock = vi.fn()
  beforeEach(() => { process.env.CLICKUP_API_KEY = 'key'; vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
  afterEach(() => vi.unstubAllGlobals())

  it('listOpenTasks follows pagination until last_page', async () => {
    fetchMock.mockResolvedValueOnce(json({ tasks: [{ id: 'a', custom_fields: [] }], last_page: false }))
    fetchMock.mockResolvedValueOnce(json({ tasks: [{ id: 'b', custom_fields: [] }], last_page: true }))
    const tasks = await listOpenTasks('list1')
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(fetchMock.mock.calls[0][0]).toContain('/list/list1/task?')
    expect(fetchMock.mock.calls[0][0]).toContain('page=0')
    expect(fetchMock.mock.calls[0][0]).toContain('include_closed=false')
    expect(fetchMock.mock.calls[0][0]).toContain('subtasks=false')
    expect(fetchMock.mock.calls[1][0]).toContain('page=1')
  })

  it('fetchRawTask and fetchTaskComments hit the task endpoints', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 't', name: 'T', custom_fields: [], attachments: [] }))
    expect((await fetchRawTask('t')).name).toBe('T')
    fetchMock.mockResolvedValueOnce(json({ comments: [{ id: 'c', comment_text: 'hi', date: '1' }] }))
    expect((await fetchTaskComments('t'))[0].id).toBe('c')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.clickup.com/api/v2/task/t/comment')
  })

  it('findListFieldByName matches exactly and returns null when absent', async () => {
    fetchMock.mockResolvedValue(json({ fields: [{ id: 'f1', name: 'ROS Fingerprint', type: 'text' }, { id: 'f2', name: 'Other', type: 'text' }] }))
    expect(await findListFieldByName('list1', 'ROS Fingerprint')).toEqual({ id: 'f1', name: 'ROS Fingerprint', type: 'text' })
    expect(await findListFieldByName('list1', 'ros fingerprint')).toBeNull()
  })

  it('uploadAttachment posts multipart with the filename', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'att' }))
    await uploadAttachment('t', Buffer.from('abc'), 'file.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.clickup.com/api/v2/task/t/attachment')
    expect(init.method).toBe('POST')
    const fd = init.body as FormData
    expect((fd.get('attachment') as File).name).toBe('file.docx')
  })

  it('postComment sends comment_text and optional assignee; setTextField posts the value', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'c' }))
    await postComment('t', '[ROS] v1 drafted', 42)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ comment_text: '[ROS] v1 drafted', notify_all: false, assignee: 42 })
    fetchMock.mockResolvedValueOnce(json({}))
    await setTextField('t', 'f1', 'abc')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.clickup.com/api/v2/task/t/field/f1')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ value: 'abc' })
  })

  it('downloadAttachment returns a Buffer and throws on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(json({}))
    expect((await downloadAttachment('https://x/y')).length).toBe(3)
    fetchMock.mockResolvedValueOnce(json({}, false, 404))
    await expect(downloadAttachment('https://x/z')).rejects.toThrow(/404/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/clickup-ros.test.ts`
Expected: FAIL, exports missing.

- [ ] **Step 3: Append helpers to lib/clickup.ts**

Add this import at the **top** of `lib/clickup.ts`, next to the existing imports:

```ts
import type { ClickUpTask, ClickUpComment } from './ros/types'
```

Then append at the end of the file:

```ts
// ---- Run of Show automation helpers ----

const CLICKUP = 'https://api.clickup.com/api/v2'

function apiKey(): string {
  const key = process.env.CLICKUP_API_KEY
  if (!key) throw new Error('CLICKUP_API_KEY not set')
  return key
}

async function clickupJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: apiKey(), ...(init.headers ?? {}) }, next: { revalidate: 0 } } as RequestInit)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ClickUp ${init.method ?? 'GET'} ${url} failed: ${res.status} ${body.slice(0, 200)}`.trim())
  }
  return res.json() as Promise<T>
}

/** Every open task in a list (subtasks excluded), following pagination. */
export async function listOpenTasks(listId: string): Promise<ClickUpTask[]> {
  const all: ClickUpTask[] = []
  for (let page = 0; page < 50; page++) {
    const data = await clickupJson<{ tasks?: ClickUpTask[]; last_page?: boolean }>(
      `${CLICKUP}/list/${listId}/task?page=${page}&include_closed=false&subtasks=false&order_by=due_date`
    )
    all.push(...(data.tasks ?? []))
    if (data.last_page || !data.tasks?.length) break
  }
  return all
}

export function fetchRawTask(taskId: string): Promise<ClickUpTask> {
  return clickupJson<ClickUpTask>(`${CLICKUP}/task/${taskId}?custom_task_ids=false&include_subtasks=false`)
}

export async function fetchTaskComments(taskId: string): Promise<ClickUpComment[]> {
  const data = await clickupJson<{ comments?: ClickUpComment[] }>(`${CLICKUP}/task/${taskId}/comment`)
  return data.comments ?? []
}

/** A list's custom field by exact name, or null. */
export async function findListFieldByName(listId: string, name: string): Promise<{ id: string; name: string; type: string } | null> {
  const data = await clickupJson<{ fields?: Array<{ id: string; name: string; type: string }> }>(`${CLICKUP}/list/${listId}/field`)
  const f = (data.fields ?? []).find((x) => x.name === name)
  return f ? { id: f.id, name: f.name, type: f.type } : null
}

export async function uploadAttachment(taskId: string, content: Buffer | Uint8Array | File, filename?: string, mimetype?: string): Promise<void> {
  const formData = new FormData()
  const file = content instanceof File ? content : new File([Uint8Array.from(content)], filename ?? 'attachment', { type: mimetype ?? 'application/octet-stream' })
  formData.append('attachment', file, file.name)
  const res = await fetch(`${CLICKUP}/task/${taskId}/attachment`, { method: 'POST', headers: { Authorization: apiKey() }, body: formData })
  if (!res.ok) throw new Error(`ClickUp attachment upload failed: ${res.status}`)
}

/** Post a comment. `assignee` (ClickUp user id) assigns the comment to that person, which notifies them. */
export async function postComment(taskId: string, text: string, assignee?: number): Promise<void> {
  const body: Record<string, unknown> = { comment_text: text, notify_all: false }
  if (assignee) body.assignee = assignee
  await clickupJson(`${CLICKUP}/task/${taskId}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

export async function setTextField(taskId: string, fieldId: string, value: string): Promise<void> {
  await clickupJson(`${CLICKUP}/task/${taskId}/field/${fieldId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) })
}

/** Download an attachment by URL (ClickUp attachment URLs accept the API key header). */
export async function downloadAttachment(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { Authorization: apiKey() } })
  if (!res.ok) throw new Error(`Attachment download failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
```

- [ ] **Step 4: Point the intake route at the shared helper**

In `app/api/intake/[taskId]/route.ts`, delete the local `uploadAttachment` function (lines 7–23) and change the import line to:

```ts
import { updateTaskFields, fetchDropdownOptionIds, uploadAttachment } from '@/lib/clickup'
```

The intake route calls `uploadAttachment(taskId, file)` with a `File`; the new signature accepts a `File` as `content`, so no call sites change.

- [ ] **Step 5: Run all tests and lint**

Run: `npx vitest run && npm run lint`
Expected: PASS, no lint errors. If the `File` global type is missing in the test environment, add `// @vitest-environment node` (already present) and ensure Node ≥ 20 (`node -v`).

- [ ] **Step 6: Commit**

```bash
git add lib/clickup.ts "app/api/intake/[taskId]/route.ts" __tests__/lib/clickup-ros.test.ts
git commit -m "feat(clickup): list/fetch/comment/field/attachment helpers for ROS automation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Mailbox search

**Files:**
- Create: `lib/ros/mail.ts`
- Test: `__tests__/lib/ros/mail.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { buildSearchQuery, toExcerpt, searchMailbox, configuredMailboxes, type ImapLike } from '@/lib/ros/mail'

describe('buildSearchQuery', () => {
  it('ORs the client email across from/to/cc and the titles across subject/body, since the given date', () => {
    const since = new Date('2026-09-28T00:00:00Z')
    const q = buildSearchQuery({ clientEmail: 'rj@olukai.com', titles: ['Palm Tree Music Festival', 'Olukai'], since })
    expect(q.since).toBe(since)
    expect(q.or).toEqual(expect.arrayContaining([
      { from: 'rj@olukai.com' }, { to: 'rj@olukai.com' }, { cc: 'rj@olukai.com' },
      { subject: 'Palm Tree Music Festival' }, { body: 'Palm Tree Music Festival' }, { subject: 'Olukai' }, { body: 'Olukai' },
    ]))
  })
  it('drops blank titles and tiny ones that would match everything', () => {
    const q = buildSearchQuery({ clientEmail: 'a@b.com', titles: ['', 'ab', 'Real Title'], since: new Date() })
    expect(q.or).toHaveLength(3 + 2)
  })
})

describe('toExcerpt', () => {
  it('strips quoted replies and signatures and caps at 3000 chars', () => {
    const body = 'Load in is at the main gate.\n\nThanks,\nRJ\n\nOn Tue, Oct 6, 2026 at 9:00 AM Harrison wrote:\n> old stuff\n> more old stuff'
    expect(toExcerpt(body)).toBe('Load in is at the main gate.\n\nThanks,\nRJ')
    expect(toExcerpt('x'.repeat(5000)).length).toBe(3000)
  })
})

describe('searchMailbox', () => {
  it('returns excerpts newest-first, capped at 30, using an injected client', async () => {
    const uids = Array.from({ length: 40 }, (_, i) => i + 1)
    const fake: ImapLike = {
      connect: vi.fn(async () => {}),
      getMailboxLock: vi.fn(async () => ({ release: vi.fn() })),
      search: vi.fn(async () => uids),
      fetch: async function* (range: number[]) {
        for (const uid of range) yield { uid, envelope: { messageId: `<m${uid}@x>`, date: new Date(Date.UTC(2026, 0, 1) + uid * 86_400_000), subject: `S${uid}`, from: [{ address: 'rj@olukai.com' }], to: [{ address: 'harrison@windanseacoconuts.com' }] }, source: Buffer.from(`Subject: S${uid}\r\n\r\nBody ${uid}\r\n`) }
      },
      logout: vi.fn(async () => {}),
    }
    const out = await searchMailbox({ user: 'harrison@windanseacoconuts.com', pass: 'p', clientEmail: 'rj@olukai.com', titles: ['Palm Tree'], since: new Date() }, () => fake)
    expect(out).toHaveLength(30)
    expect(out[0].messageId).toBe('<m40@x>')
    expect(out[0].body).toContain('Body 40')
    expect(out[0].mailbox).toBe('harrison@windanseacoconuts.com')
    expect(fake.logout).toHaveBeenCalled()
  })
})

describe('configuredMailboxes', () => {
  it('includes Harrison with SMTP_PASS and Trent only when IMAP_PASS_TRENT is set', () => {
    expect(configuredMailboxes({ SMTP_PASS: 'h' })).toEqual([{ user: 'harrison@windanseacoconuts.com', pass: 'h' }])
    expect(configuredMailboxes({ SMTP_PASS: 'h', IMAP_PASS_TRENT: 't' })).toHaveLength(2)
    expect(configuredMailboxes({})).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/mail.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write mail.ts**

```ts
// lib/ros/mail.ts
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { MailExcerpt } from './types'

export const MAX_MESSAGES_PER_MAILBOX = 30
export const EXCERPT_CHARS = 3000
const ALL_MAIL = '[Gmail]/All Mail'

export interface MailboxCreds { user: string; pass: string }
export interface SearchOpts extends MailboxCreds { clientEmail: string; titles: string[]; since: Date }

/** The subset of ImapFlow this module uses, so tests can inject a fake. */
export interface ImapLike {
  connect(): Promise<void>
  getMailboxLock(path: string): Promise<{ release(): void }>
  search(query: Record<string, unknown>, opts?: { uid?: boolean }): Promise<number[] | false>
  fetch(range: number[] | string, query: Record<string, unknown>, opts?: { uid?: boolean }): AsyncIterable<{ uid: number; envelope?: { messageId?: string; date?: Date; subject?: string; from?: Array<{ address?: string }>; to?: Array<{ address?: string }> }; source?: Buffer }>
  logout(): Promise<void>
}

export type ImapFactory = (creds: MailboxCreds) => ImapLike

const defaultFactory: ImapFactory = ({ user, pass }) =>
  new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false }) as unknown as ImapLike

/** IMAP search: the client address in From/To/Cc, OR any title in Subject/Body, since the task was created. */
export function buildSearchQuery(opts: { clientEmail: string; titles: string[]; since: Date }): { since: Date; or: Array<Record<string, string>> } {
  const or: Array<Record<string, string>> = []
  const email = opts.clientEmail.trim()
  if (email) or.push({ from: email }, { to: email }, { cc: email })
  for (const t of opts.titles) {
    const title = t.trim()
    if (title.length < 4) continue
    or.push({ subject: title }, { body: title })
  }
  return { since: opts.since, or }
}

/** Plain text with quoted replies and the "On … wrote:" line removed, capped at EXCERPT_CHARS. */
export function toExcerpt(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if (/^On .{0,120} wrote:\s*$/.test(line.trim())) break
    if (line.trimStart().startsWith('>')) continue
    out.push(line)
  }
  return out.join('\n').trim().slice(0, EXCERPT_CHARS)
}

/** Search one mailbox. Throws on connection failure so the caller can decide to continue without it. */
export async function searchMailbox(opts: SearchOpts, factory: ImapFactory = defaultFactory): Promise<MailExcerpt[]> {
  const client = factory(opts)
  await client.connect()
  try {
    const lock = await client.getMailboxLock(ALL_MAIL)
    try {
      const query = buildSearchQuery(opts)
      if (query.or.length === 0) return []
      const uids = (await client.search(query, { uid: true })) || []
      const recent = [...uids].sort((a, b) => b - a).slice(0, MAX_MESSAGES_PER_MAILBOX)
      if (recent.length === 0) return []
      const excerpts: MailExcerpt[] = []
      for await (const msg of client.fetch(recent, { envelope: true, source: true }, { uid: true })) {
        const parsed = msg.source ? await simpleParser(msg.source) : null
        const env = msg.envelope ?? {}
        excerpts.push({
          mailbox: opts.user,
          messageId: env.messageId ?? parsed?.messageId ?? `uid:${msg.uid}`,
          date: (env.date ?? parsed?.date ?? new Date(0)).toISOString(),
          from: (env.from ?? []).map((a) => a.address ?? '').join(', '),
          to: (env.to ?? []).map((a) => a.address ?? '').join(', '),
          subject: env.subject ?? parsed?.subject ?? '',
          body: toExcerpt(parsed?.text ?? ''),
        })
      }
      excerpts.sort((a, b) => (a.date < b.date ? 1 : -1))
      return excerpts
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Mailboxes we have passwords for. Harrison reuses the SMTP app password. */
export function configuredMailboxes(env: Record<string, string | undefined> = process.env): MailboxCreds[] {
  const out: MailboxCreds[] = []
  if (env.SMTP_PASS) out.push({ user: 'harrison@windanseacoconuts.com', pass: env.SMTP_PASS })
  if (env.IMAP_PASS_TRENT) out.push({ user: 'trent@windanseacoconuts.com', pass: env.IMAP_PASS_TRENT })
  return out
}

export interface MailSearchResult { excerpts: MailExcerpt[]; failedMailboxes: string[] }

/** Search every configured mailbox; a failing mailbox is reported, not fatal. */
export async function searchAllMailboxes(
  opts: { clientEmail: string; titles: string[]; since: Date },
  mailboxes: MailboxCreds[] = configuredMailboxes(),
  factory: ImapFactory = defaultFactory
): Promise<MailSearchResult> {
  const excerpts: MailExcerpt[] = []
  const failedMailboxes: string[] = []
  for (const mb of mailboxes) {
    try {
      excerpts.push(...(await searchMailbox({ ...mb, ...opts }, factory)))
    } catch (err) {
      console.warn(`Mailbox ${mb.user} failed:`, err)
      failedMailboxes.push(mb.user)
    }
  }
  return { excerpts, failedMailboxes }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/mail.test.ts`
Expected: PASS. If `mailparser` complains about the fake source, it is valid RFC 822 (`Subject:` header, blank line, body).

- [ ] **Step 5: Commit**

```bash
git add lib/ros/mail.ts __tests__/lib/ros/mail.test.ts
git commit -m "feat(ros): IMAP mailbox search with excerpt trimming and injectable client

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Compose with Claude

**Files:**
- Create: `lib/ros/compose.ts`
- Test: `__tests__/lib/ros/compose.test.ts`

Uses structured outputs (`client.messages.parse` + `zodOutputFormat`) on `claude-opus-5-5`. Forced tool calls are not supported on this model. Thinking is always on; effort is set to `high`. No refusal fallback is configured: a refusal fails the task and lands in the alert email, which is the right behavior for an internal logistics document.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, composeRos, type ComposeInputs, type ParseClient } from '@/lib/ros/compose'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'

const inputs: ComposeInputs = {
  mode: 'create',
  task: { id: 't', name: 'Palm Tree Music Festival', status: { status: 'to do' }, custom_fields: [{ id: 'x', name: 'Coconut Quantity', type: 'number', value: '750' }], attachments: [{ id: 'a', title: '[DELIVERY MAP] site.pdf', url: 'u' }] },
  fieldSummary: { 'Coconut Quantity': '750', Package: 'Villa' },
  comments: [{ id: 'c', comment_text: 'Client confirmed 750', date: '1' }],
  emails: [{ mailbox: 'harrison@windanseacoconuts.com', messageId: '<m1>', date: '2026-10-01T00:00:00Z', from: 'rj@olukai.com', to: 'harrison@…', subject: 'Load in', body: 'Use the Field 3 entrance' }],
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
    const client: ParseClient = { messages: { parse: vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: LJBTC_EXEMPLAR })) } }
    const doc = await composeRos(inputs, client)
    expect(doc.header.subtitle).toBe('LJBTC | End of Summer Luau Drop-Off')
    const call = (client.messages.parse as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.model).toBe('claude-opus-5-5')
    expect(call.output_config.effort).toBe('high')
  })
  it('throws on refusal or null parsed_output', async () => {
    const refused: ParseClient = { messages: { parse: vi.fn(async () => ({ stop_reason: 'refusal', parsed_output: null })) } }
    await expect(composeRos(inputs, refused)).rejects.toThrow(/refus/i)
    const empty: ParseClient = { messages: { parse: vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: null })) } }
    await expect(composeRos(inputs, empty)).rejects.toThrow(/parse/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/compose.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write compose.ts**

```ts
// lib/ros/compose.ts
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { RosDocumentSchema, type RosDocument, type ClickUpTask, type ClickUpComment, type MailExcerpt } from './types'
import { HOUSE_STYLE } from './house-style'
import { LJBTC_EXEMPLAR } from './exemplar'

export const ROS_MODEL = 'claude-opus-5-5'

export interface ComposeInputs {
  mode: 'create' | 'update'
  task: ClickUpTask
  /** Human-readable field name → display value (dropdowns resolved, dates formatted Pacific). */
  fieldSummary: Record<string, string>
  comments: ClickUpComment[]
  emails: MailExcerpt[]
  existingRosText: string | null
  previousVersion: number | null
}

/** The slice of the Anthropic client we use, so tests can inject a fake. */
export interface ParseClient {
  messages: { parse(params: Record<string, unknown>): Promise<{ stop_reason: string | null; parsed_output: unknown }> }
}

export function buildSystemPrompt(): string {
  return [
    `You write the Run of Show (ROS) for ${HOUSE_STYLE.companyName}, a branded fresh-coconut event service. The ROS is the crew's single page for the day: where to go, when, what to bring, who to call.`,
    '',
    'HOUSE STYLE (facts you may use without them being in the inputs):',
    `- Warehouse: ${HOUSE_STYLE.warehouseAddress}`,
    `- Windansea contact line: ${HOUSE_STYLE.windanseaContact}`,
    `- Post-event steps: ${HOUSE_STYLE.postEventSteps.join('; ')}`,
    '- Packages: ' + Object.entries(HOUSE_STYLE.packages).map(([k, v]) => `${k} = ${v}`).join(' | '),
    '- Standard packing list by category: ' + JSON.stringify(HOUSE_STYLE.packingList),
    '',
    'RULES:',
    ...HOUSE_STYLE.rules.map((r) => `- ${r}`),
    '',
    'EXEMPLAR (a real drop-off ROS; match its structure, density and tone):',
    JSON.stringify(LJBTC_EXEMPLAR, null, 2),
  ].join('\n')
}

export function buildUserPrompt(inputs: ComposeInputs): string {
  const { task, fieldSummary, comments, emails } = inputs
  const lines: string[] = [`MODE: ${inputs.mode.toUpperCase()}`, '', `TASK: ${task.name} (ClickUp ${task.id}, status "${task.status?.status ?? ''}")`, '', 'FIELDS:']
  for (const [k, v] of Object.entries(fieldSummary)) if (v) lines.push(`${k}: ${v}`)
  lines.push('', 'ATTACHMENTS ON THE TASK:', ...(task.attachments ?? []).map((a) => `- ${a.title}`))
  lines.push('', 'COMMENTS (newest last; ignore any starting with [ROS]):')
  for (const c of comments) if (!c.comment_text.trimStart().startsWith('[ROS]')) lines.push(`- ${c.user?.username ?? 'unknown'} (${new Date(Number(c.date)).toISOString()}): ${c.comment_text}`)
  lines.push('', `EMAILS (${emails.length} matching messages, newest first):`)
  for (const e of emails) lines.push(`--- ${e.date} | from ${e.from} | to ${e.to} | ${e.subject}`, e.body)
  if (inputs.mode === 'update') {
    lines.push('', `EXISTING ROS (version ${inputs.previousVersion ?? '?'}), as plain text. Preserve its wording and any human edits unless an input above contradicts them. Put every change you make in "changes" (what changed since v${inputs.previousVersion ?? '?'}):`, inputs.existingRosText ?? '(missing)')
  } else {
    lines.push('', 'No ROS exists yet. Write version 1. Set "changes" to null.')
  }
  lines.push('', 'Return the complete RosDocument. Everything you could not confirm goes in openItems.')
  return lines.join('\n')
}

/** One structured-output call. Throws on refusal or unparseable output; the SDK retries 429/5xx twice. */
export async function composeRos(inputs: ComposeInputs, client: ParseClient = new Anthropic() as unknown as ParseClient): Promise<RosDocument> {
  const response = await client.messages.parse({
    model: ROS_MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: buildSystemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserPrompt(inputs) }],
    output_config: { effort: 'high', format: zodOutputFormat(RosDocumentSchema) },
  })
  if (response.stop_reason === 'refusal') throw new Error('Claude refused to compose the ROS')
  const parsed = RosDocumentSchema.safeParse(response.parsed_output)
  if (!parsed.success) throw new Error(`Claude output failed to parse: ${parsed.error.message.slice(0, 300)}`)
  return parsed.data
}
```

If `zodOutputFormat` rejects a Zod 4 schema construct (e.g. the `.extend().omit()` in Task 1), simplify the breakdown schema to `z.object({ item: z.string(), detail: z.string() })`. If the SDK's `parse` typing fights the injected `ParseClient`, keep the cast as written; the test exercises the fake, and the real client is exercised in the manual acceptance step.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/compose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ros/compose.ts __tests__/lib/ros/compose.test.ts
git commit -m "feat(ros): compose RosDocument with Claude structured outputs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Dry-run email

**Files:**
- Modify: `lib/email.ts` (append)

- [ ] **Step 1: Add the sender (no new test; it mirrors `sendDecalOrderEmail`, which is covered by convention, and is exercised in the route test via mock)**

```ts
/**
 * Dry-run delivery for the ROS cron: the generated file goes to Jordan instead
 * of ClickUp, with the comment that would have been posted.
 */
export async function sendRosDraftEmail(params: {
  taskName: string
  taskUrl: string
  filename: string
  content: Buffer
  comment: string
}) {
  const transporter = getTransporter()
  await transporter.sendMail({
    from: `WSC ROS Bot <${SMTP_USER}>`,
    to: ALERT_EMAIL,
    subject: `[ROS dry run] ${params.taskName}`,
    text: `${params.comment}\n\nTask: ${params.taskUrl}\n\nThis is a dry run. Nothing was written to ClickUp.`,
    attachments: [{ filename: params.filename, content: params.content, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat(email): ROS dry-run draft email

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Orchestration (`run.ts`)

**Files:**
- Create: `lib/ros/run.ts`
- Test: `__tests__/lib/ros/run.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { runRos, type RosDeps } from '@/lib/ros/run'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'
import { computeFingerprint } from '@/lib/ros/fingerprint'
import type { ClickUpTask } from '@/lib/ros/types'

const INTAKE = 'dbeda913-50e7-4988-9f1d-d28ec26a9a6d'
const FP = 'fp-field'
const NOW = new Date('2026-10-08T14:00:00Z')
const DAY = 86_400_000
const intakeYes = { id: INTAKE, name: 'Intake Form Complete', type: 'drop_down', value: 0, type_config: { options: [{ id: 'y', name: 'Yes', orderindex: 0 }, { id: 'n', name: 'No', orderindex: 1 }] } }

function mkTask(id: string, over: Partial<ClickUpTask> = {}): ClickUpTask {
  return { id, name: `Event ${id}`, status: { status: 'to do' }, date_created: String(NOW.getTime() - 10 * DAY), start_date: String(NOW.getTime() + 3 * DAY), custom_fields: [intakeYes, { id: FP, name: 'ROS Fingerprint', type: 'text', value: '' }], attachments: [], ...over }
}

function mkDeps(tasks: ClickUpTask[], over: Partial<RosDeps> = {}): RosDeps & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = { upload: [], comment: [], setField: [], compose: [], email: [] }
  const rec = (k: string) => (...a: unknown[]) => { calls[k].push(a); return Promise.resolve() }
  return {
    calls,
    listId: 'list1',
    now: () => NOW,
    dryRun: false,
    timeBudgetMs: 240_000,
    trentUserId: 7,
    clickup: {
      listOpenTasks: async () => tasks,
      fetchRawTask: async (id) => tasks.find((t) => t.id === id)!,
      fetchTaskComments: async () => [],
      findListFieldByName: async () => ({ id: FP, name: 'ROS Fingerprint', type: 'text' }),
      uploadAttachment: rec('upload') as RosDeps['clickup']['uploadAttachment'],
      postComment: rec('comment') as RosDeps['clickup']['postComment'],
      setTextField: rec('setField') as RosDeps['clickup']['setTextField'],
      downloadAttachment: async () => Buffer.from('PK'),
    },
    searchMail: async () => ({ excerpts: [], failedMailboxes: [] }),
    compose: async (inputs) => { calls.compose.push([inputs]); return { ...LJBTC_EXEMPLAR, changes: inputs.mode === 'update' ? ['Something changed'] : null } },
    render: async () => Buffer.from('DOCX'),
    extract: async () => 'EXISTING TEXT',
    sendDraftEmail: rec('email') as RosDeps['sendDraftEmail'],
    ...over,
  }
}

describe('runRos', () => {
  it('CREATE: no [ROS] attachment → compose v1, upload, comment, store fingerprint', async () => {
    const deps = mkDeps([mkTask('a')])
    const s = await runRos(deps)
    expect(s).toMatchObject({ considered: 1, created: 1, updated: 0, skipped: 0, failed: [] })
    expect(deps.calls.compose[0][0]).toMatchObject({ mode: 'create' })
    expect(deps.calls.upload[0][2]).toBe('[ROS] Event a v1 — DRAFT.docx')
    expect(String(deps.calls.comment[0][1])).toMatch(/^\[ROS\] v1 drafted/)
    expect(deps.calls.comment[0][2]).toBe(7)
    expect(deps.calls.setField[0][1]).toBe(FP)
  })

  it('SKIP: stored fingerprint matches → no compose, no writes', async () => {
    const t = mkTask('a', { attachments: [{ id: 'r', title: '[ROS] Event a v1 — DRAFT.docx', url: 'u', date: '1' }] })
    const fp = computeFingerprint({ task: t, comments: [], messageIds: [], fingerprintFieldId: FP })
    t.custom_fields = t.custom_fields.map((f) => (f.id === FP ? { ...f, value: fp } : f))
    const deps = mkDeps([t])
    const s = await runRos(deps)
    expect(s).toMatchObject({ skipped: 1, created: 0, updated: 0 })
    expect(deps.calls.compose).toHaveLength(0)
    expect(deps.calls.upload).toHaveLength(0)
  })

  it('UPDATE: [ROS] exists and fingerprint differs → extract existing, compose update, upload v2', async () => {
    const t = mkTask('a', { attachments: [{ id: 'r', title: '[ROS] Event a v1 — DRAFT.docx', url: 'u', date: '1' }] })
    const deps = mkDeps([t])
    const s = await runRos(deps)
    expect(s).toMatchObject({ updated: 1 })
    expect(deps.calls.compose[0][0]).toMatchObject({ mode: 'update', existingRosText: 'EXISTING TEXT', previousVersion: 1 })
    expect(deps.calls.upload[0][2]).toBe('[ROS] Event a v2 — DRAFT.docx')
    expect(String(deps.calls.comment[0][1])).toContain('Something changed')
  })

  it('taskId processes one task regardless of window', async () => {
    const far = mkTask('far', { start_date: String(NOW.getTime() + 60 * DAY) })
    const deps = mkDeps([far])
    expect((await runRos(deps)).considered).toBe(0)
    expect((await runRos(deps, { taskId: 'far' })).created).toBe(1)
  })

  it('force bypasses SKIP when the stored fingerprint matches', async () => {
    const t = mkTask('a', { attachments: [{ id: 'r', title: '[ROS] Event a v1 — DRAFT.docx', url: 'u', date: '1' }] })
    const fp = computeFingerprint({ task: t, comments: [], messageIds: [], fingerprintFieldId: FP })
    t.custom_fields = t.custom_fields.map((f) => (f.id === FP ? { ...f, value: fp } : f))
    const deps = mkDeps([t])
    expect((await runRos(deps)).skipped).toBe(1)
    expect((await runRos(deps, { taskId: 'a', force: true })).updated).toBe(1)
  })

  it('dry run emails the file and writes nothing to ClickUp', async () => {
    const deps = mkDeps([mkTask('a')], { dryRun: true })
    const s = await runRos(deps)
    expect(s.dryRun).toBe(true)
    expect(deps.calls.email).toHaveLength(1)
    expect(deps.calls.upload).toHaveLength(0)
    expect(deps.calls.comment).toHaveLength(0)
    expect(deps.calls.setField).toHaveLength(0)
  })

  it('one failing task does not stop the others', async () => {
    const deps = mkDeps([mkTask('bad'), mkTask('good')], { compose: async (inputs) => { if (inputs.task.id === 'bad') throw new Error('boom'); return LJBTC_EXEMPLAR } })
    const s = await runRos(deps)
    expect(s.created).toBe(1)
    expect(s.failed).toEqual([{ taskId: 'bad', error: 'boom' }])
  })

  it('defers tasks once the time budget is spent', async () => {
    let t = NOW.getTime()
    const deps = mkDeps([mkTask('a'), mkTask('b')], { timeBudgetMs: 1, now: () => new Date((t += 1000)) })
    const s = await runRos(deps)
    expect(s.created + s.deferred).toBe(2)
    expect(s.deferred).toBeGreaterThanOrEqual(1)
  })

  it('fails fast when the fingerprint field is missing', async () => {
    const deps = mkDeps([mkTask('a')], { clickup: { ...mkDeps([]).clickup, findListFieldByName: async () => null } })
    await expect(runRos(deps)).rejects.toThrow(/ROS Fingerprint/)
  })

  it('a failed mailbox is a warning and the fingerprint omits it', async () => {
    const deps = mkDeps([mkTask('a')], { searchMail: async () => ({ excerpts: [], failedMailboxes: ['trent@windanseacoconuts.com'] }) })
    const s = await runRos(deps)
    expect(s.warnings.join(' ')).toContain('trent@windanseacoconuts.com')
    expect(s.created).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/ros/run.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write run.ts**

```ts
// lib/ros/run.ts
import type { ClickUpTask, ClickUpComment, RosDocument, RunSummary, TaskOutcome } from './types'
import type { ComposeInputs } from './compose'
import type { MailSearchResult } from './mail'
import type { StampLogo } from './render'
import { selectCandidates } from './select'
import { computeFingerprint } from './fingerprint'
import { latestRosAttachment, nextRosVersion, rosFilename } from './versions'
import { formatForDisplay } from '@/lib/intake-fields'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const FINGERPRINT_FIELD_NAME = 'ROS Fingerprint'

export interface RosDeps {
  listId: string
  now: () => Date
  dryRun: boolean
  timeBudgetMs: number
  trentUserId?: number
  clickup: {
    listOpenTasks(listId: string): Promise<ClickUpTask[]>
    fetchRawTask(taskId: string): Promise<ClickUpTask>
    fetchTaskComments(taskId: string): Promise<ClickUpComment[]>
    findListFieldByName(listId: string, name: string): Promise<{ id: string } | null>
    uploadAttachment(taskId: string, content: Buffer, filename: string, mimetype: string): Promise<void>
    postComment(taskId: string, text: string, assignee?: number): Promise<void>
    setTextField(taskId: string, fieldId: string, value: string): Promise<void>
    downloadAttachment(url: string): Promise<Buffer>
  }
  searchMail(opts: { clientEmail: string; titles: string[]; since: Date }): Promise<MailSearchResult>
  compose(inputs: ComposeInputs): Promise<RosDocument>
  render(doc: RosDocument, logo?: StampLogo): Promise<Buffer>
  extract(docx: Buffer): Promise<string>
  sendDraftEmail(params: { taskName: string; taskUrl: string; filename: string; content: Buffer; comment: string }): Promise<void>
}

export interface RunOptions { taskId?: string; force?: boolean }

/** Field name → display string, with dropdowns resolved by option and dates formatted Pacific. */
export function summarizeFields(task: ClickUpTask): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of task.custom_fields ?? []) {
    if (f.value === null || f.value === undefined || f.value === '') continue
    if (f.type === 'drop_down') {
      const o = f.type_config?.options?.find((x) => x.orderindex === f.value || x.id === f.value)
      if (o) out[f.name] = o.name
    } else if (f.type === 'date') {
      const ms = Number(f.value)
      if (ms > 0) out[f.name] = formatForDisplay(ms, 'America/Los_Angeles')
    } else if (f.type === 'location' && typeof f.value === 'object') {
      const addr = (f.value as { formatted_address?: string }).formatted_address
      if (addr) out[f.name] = addr
    } else if (typeof f.value !== 'object') {
      out[f.name] = String(f.value)
    }
  }
  if (task.start_date) out['Setup / Start (task start date)'] = formatForDisplay(Number(task.start_date), 'America/Los_Angeles')
  if (task.due_date) out['Teardown / End (task due date)'] = formatForDisplay(Number(task.due_date), 'America/Los_Angeles')
  return out
}

const CLIENT_EMAIL_FIELD_ID = 'a4316b37-4646-4db8-93d7-c37561d17a77'
const DEAL_TITLE_FIELD_ID = '9d8e3b50-556e-4039-8062-7a2bb4ac4fee'

const fieldValue = (task: ClickUpTask, fieldId: string): string => {
  const f = task.custom_fields?.find((x) => x.id === fieldId)
  return typeof f?.value === 'string' ? f.value : ''
}

function commentFor(doc: RosDocument, version: number): string {
  const open = doc.openItems.length ? `Open items: ${doc.openItems.join('; ')}` : 'No open items.'
  if (version === 1) return `[ROS] v1 drafted — please review. ${open}`
  const changes = doc.changes?.length ? doc.changes.join('; ') : 'inputs changed'
  return `[ROS] v${version} — updated: ${changes}. ${open}`
}

async function stampLogo(task: ClickUpTask, deps: RosDeps): Promise<StampLogo | undefined> {
  const att = (task.attachments ?? []).find((a) => a.title.startsWith('[STAMP LOGO]') && /\.png$/i.test(a.title))
  if (!att) return undefined
  try {
    const data = await deps.downloadAttachment(att.url)
    // PNG IHDR: width at bytes 16..20, height at 20..24 (big-endian)
    const widthPx = data.length >= 24 ? data.readUInt32BE(16) : 0
    const heightPx = data.length >= 24 ? data.readUInt32BE(20) : 0
    return { data, widthPx, heightPx }
  } catch (err) {
    console.warn('Stamp logo download failed, rendering without it:', err)
    return undefined
  }
}

export async function processTask(
  taskId: string,
  deps: RosDeps,
  fingerprintFieldId: string,
  warnings: string[],
  force = false
): Promise<TaskOutcome> {
  const task = await deps.clickup.fetchRawTask(taskId)
  const comments = await deps.clickup.fetchTaskComments(taskId)
  const since = new Date(Number(task.date_created ?? deps.now().getTime() - 90 * 86_400_000))
  const mail = await deps.searchMail({ clientEmail: fieldValue(task, CLIENT_EMAIL_FIELD_ID), titles: [task.name, fieldValue(task, DEAL_TITLE_FIELD_ID)], since })
  for (const mb of mail.failedMailboxes) warnings.push(`${taskId}: mailbox ${mb} unavailable, used ClickUp data only`)

  const fingerprint = computeFingerprint({ task, comments, messageIds: mail.excerpts.map((e) => e.messageId), fingerprintFieldId })
  const stored = task.custom_fields.find((f) => f.id === fingerprintFieldId)?.value
  const latest = latestRosAttachment(task.attachments ?? [])

  if (latest && stored === fingerprint && !force) return 'skipped'

  const mode: ComposeInputs['mode'] = latest ? 'update' : 'create'
  const version = nextRosVersion(task.attachments ?? [])
  let existingRosText: string | null = null
  if (latest) existingRosText = await deps.extract(await deps.clickup.downloadAttachment(latest.url))

  const doc = await deps.compose({ mode, task, fieldSummary: summarizeFields(task), comments, emails: mail.excerpts, existingRosText, previousVersion: latest ? version - 1 : null })
  const content = await deps.render(doc, await stampLogo(task, deps))
  const filename = rosFilename(task.name, version)
  const comment = commentFor(doc, version)

  if (deps.dryRun) {
    await deps.sendDraftEmail({ taskName: task.name, taskUrl: `https://app.clickup.com/t/${task.id}`, filename, content, comment })
  } else {
    await deps.clickup.uploadAttachment(task.id, content, filename, DOCX_MIME)
    await deps.clickup.postComment(task.id, comment, deps.trentUserId)
    await deps.clickup.setTextField(task.id, fingerprintFieldId, fingerprint)
  }
  return mode === 'create' ? 'created' : 'updated'
}

export async function runRos(deps: RosDeps, opts: RunOptions = {}): Promise<RunSummary> {
  const started = deps.now().getTime()
  const summary: RunSummary = { dryRun: deps.dryRun, considered: 0, created: 0, updated: 0, skipped: 0, deferred: 0, failed: [], warnings: [] }

  const field = await deps.clickup.findListFieldByName(deps.listId, FINGERPRINT_FIELD_NAME)
  if (!field) throw new Error(`Custom field "${FINGERPRINT_FIELD_NAME}" not found on list ${deps.listId}. Create a Text field with that exact name.`)

  let ids: string[]
  if (opts.taskId) {
    ids = [opts.taskId]
  } else {
    const { candidates, skippedNoDate } = selectCandidates(await deps.clickup.listOpenTasks(deps.listId), deps.now())
    for (const id of skippedNoDate) summary.warnings.push(`${id}: intake complete but no event date`)
    ids = candidates.map((t) => t.id)
  }
  summary.considered = ids.length

  for (let i = 0; i < ids.length; i++) {
    if (deps.now().getTime() - started > deps.timeBudgetMs) { summary.deferred = ids.length - i; break }
    try {
      const outcome = await processTask(ids[i], deps, field.id, summary.warnings, opts.force)
      summary[outcome]++
    } catch (err) {
      summary.failed.push({ taskId: ids[i], error: err instanceof Error ? err.message : String(err) })
    }
  }
  return summary
}
```

Note the `summary[outcome]++` relies on `TaskOutcome` values matching `RunSummary` keys (`created`, `updated`, `skipped`); they do.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/ros/run.test.ts`
Expected: PASS (10 tests). In the deferral test `now()` advances 1 s per call against a 1 ms budget, so the very first budget check already sees elapsed time and both tasks are deferred (`deferred: 2, created: 0`). The assertion `created + deferred === 2` holds either way; it is not a flake.

- [ ] **Step 5: Commit**

```bash
git add lib/ros/run.ts __tests__/lib/ros/run.test.ts
git commit -m "feat(ros): orchestration with create/update/skip, dry run, time budget, failure isolation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Cron route and schedule

**Files:**
- Create: `app/api/cron/ros/route.ts`
- Create: `vercel.json`
- Test: `__tests__/api/cron-ros.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ros/run', () => ({ runRos: vi.fn(async () => ({ dryRun: true, considered: 0, created: 0, updated: 0, skipped: 0, deferred: 0, failed: [], warnings: [] })) }))
vi.mock('@/lib/email', () => ({ sendErrorAlert: vi.fn(async () => {}), sendRosDraftEmail: vi.fn(async () => {}) }))

import { GET } from '@/app/api/cron/ros/route'
import { runRos } from '@/lib/ros/run'
import { NextRequest } from 'next/server'

describe('GET /api/cron/ros', () => {
  beforeEach(() => { process.env.CRON_SECRET = 'shh'; process.env.CLICKUP_LIST_ID = 'list1'; process.env.CLICKUP_API_KEY = 'k'; vi.mocked(runRos).mockClear() })

  it('rejects a missing or wrong bearer token', async () => {
    const res = await GET(new NextRequest('http://x/api/cron/ros'))
    expect(res.status).toBe(401)
    const bad = await GET(new NextRequest('http://x/api/cron/ros', { headers: { authorization: 'Bearer nope' } }))
    expect(bad.status).toBe(401)
    expect(runRos).not.toHaveBeenCalled()
  })

  it('runs and returns the summary, passing taskId and force through', async () => {
    const res = await GET(new NextRequest('http://x/api/cron/ros?taskId=abc&force=1', { headers: { authorization: 'Bearer shh' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ dryRun: true, considered: 0 })
    expect(vi.mocked(runRos).mock.calls[0][1]).toEqual({ taskId: 'abc', force: true })
  })

  it('defaults to dry run unless ROS_DRY_RUN=false', async () => {
    delete process.env.ROS_DRY_RUN
    await GET(new NextRequest('http://x/api/cron/ros', { headers: { authorization: 'Bearer shh' } }))
    expect(vi.mocked(runRos).mock.calls[0][0].dryRun).toBe(true)
    process.env.ROS_DRY_RUN = 'false'
    await GET(new NextRequest('http://x/api/cron/ros', { headers: { authorization: 'Bearer shh' } }))
    expect(vi.mocked(runRos).mock.calls[1][0].dryRun).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/cron-ros.test.ts`
Expected: FAIL, route module not found.

- [ ] **Step 3: Write the route**

```ts
// app/api/cron/ros/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { runRos, type RosDeps } from '@/lib/ros/run'
import { listOpenTasks, fetchRawTask, fetchTaskComments, findListFieldByName, uploadAttachment, postComment, setTextField, downloadAttachment } from '@/lib/clickup'
import { searchAllMailboxes } from '@/lib/ros/mail'
import { composeRos } from '@/lib/ros/compose'
import { renderRos } from '@/lib/ros/render'
import { extractDocxText } from '@/lib/ros/extract'
import { sendErrorAlert, sendRosDraftEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TIME_BUDGET_MS = 240_000

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function buildDeps(): RosDeps {
  const listId = process.env.CLICKUP_LIST_ID
  if (!listId) throw new Error('CLICKUP_LIST_ID not set')
  const trent = Number(process.env.CLICKUP_USER_ID_TRENT)
  return {
    listId,
    now: () => new Date(),
    dryRun: process.env.ROS_DRY_RUN !== 'false',
    timeBudgetMs: TIME_BUDGET_MS,
    trentUserId: Number.isFinite(trent) && trent > 0 ? trent : undefined,
    clickup: { listOpenTasks, fetchRawTask, fetchTaskComments, findListFieldByName, uploadAttachment, postComment, setTextField, downloadAttachment },
    searchMail: (opts) => searchAllMailboxes(opts),
    compose: (inputs) => composeRos(inputs),
    render: renderRos,
    extract: extractDocxText,
    sendDraftEmail: sendRosDraftEmail,
  }
}

/** Daily ROS cron. Vercel calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const taskId = req.nextUrl.searchParams.get('taskId') ?? undefined
  const force = req.nextUrl.searchParams.get('force') === '1'

  try {
    const summary = await runRos(buildDeps(), { taskId, force })
    console.log('ROS cron summary', JSON.stringify(summary))
    if (summary.failed.length > 0) {
      await sendErrorAlert({ source: 'ROS Cron', error: `${summary.failed.length} task(s) failed`, context: { ...summary } })
    }
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('ROS cron fatal:', message)
    await sendErrorAlert({ source: 'ROS Cron', error: message, context: { taskId, force } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create vercel.json**

```json
{
  "crons": [
    { "path": "/api/cron/ros", "schedule": "0 14 * * *" }
  ]
}
```

- [ ] **Step 5: Run tests, lint, type-check, build**

Run: `npx vitest run && npm run lint && npx tsc --noEmit && npm run build`
Expected: all pass. If `next build` complains that `imapflow` or `mailparser` should be external, add to `next.config.mjs`:

```js
experimental: { serverComponentsExternalPackages: ['imapflow', 'mailparser'] },
```

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/ros/route.ts vercel.json __tests__/api/cron-ros.test.ts next.config.mjs
git commit -m "feat(ros): daily Vercel cron route with auth, dry run, and alerts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a functional section after "### 5. Error alerts" in Part 1**

```markdown
### 6. Daily Run of Show (ROS)

Every morning at 7 AM Pacific (14:00 UTC) a Vercel cron looks at every Events task whose intake form is complete and whose event is within the next 14 days.

- **No `[ROS]` file on the task** → Claude writes a Run of Show from the ClickUp fields, attachments, comments and matching emails in Harrison's (and, when configured, Trent's) inbox, renders it as a Word document in the LJBTC template layout, attaches it as `[ROS] <Event> v1 — DRAFT.docx`, and posts a `[ROS]` comment to Trent with the open items.
- **File exists and nothing changed** → skipped. Change detection is a fingerprint of the inputs stored in the task's **ROS Fingerprint** text field.
- **File exists and inputs changed** → Claude updates the existing document, keeping manual edits, adds a "What changed" section, attaches the next version and comments the changes.

Set `ROS_DRY_RUN=false` to write to ClickUp; otherwise drafts are emailed to jordan@. Manual run: `GET /api/cron/ros?taskId=<id>&force=1` with `Authorization: Bearer $CRON_SECRET`.
```

- [ ] **Step 2: Add the route and env vars to Part 2**

Routes table row:

```markdown
| `GET /api/cron/ros` | API | Daily ROS create/update for events in the next 14 days (cron, bearer secret) |
```

New subsection:

```markdown
### ROS cron environment

| Env var | Purpose |
|---|---|
| `CRON_SECRET` | Vercel sends it as a bearer token on scheduled runs |
| `ANTHROPIC_API_KEY` | Claude API (model `claude-opus-5-5`) |
| `IMAP_PASS_TRENT` | Trent's Gmail app password, optional; Harrison's inbox reuses `SMTP_PASS` |
| `CLICKUP_USER_ID_TRENT` | Assigns the `[ROS]` comment to Trent (ClickUp comment assignee, which notifies him), optional |
| `ROS_DRY_RUN` | `true` (default) emails drafts to jordan@; `false` writes to ClickUp |

One-time ClickUp setup: add a **Text** custom field named exactly `ROS Fingerprint` to the Events list. The route looks it up by name and fails fast if it is missing.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the daily ROS cron, env vars, and ClickUp setup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Manual acceptance (not automated)

- [ ] In ClickUp, confirm the `ROS Fingerprint` Text field exists on the Events list.
- [ ] Upload `docs/ros/reference/palm-tree-2026-10-10.docx` to the Palm Tree task renamed `[ROS] Palm Tree Music Festival v1 — DRAFT.docx`.
- [ ] In Vercel, set `CRON_SECRET`, `ANTHROPIC_API_KEY`, `ROS_DRY_RUN=true` (and optionally `CLICKUP_USER_ID_TRENT`, `IMAP_PASS_TRENT`). Deploy.
- [ ] Run: `curl -H "Authorization: Bearer $CRON_SECRET" "https://windansea.vercel.app/api/cron/ros?taskId=86bc8ujw9&force=1"` and confirm a `[ROS dry run]` email arrives with a v2 whose "What changed" lists only real differences and whose body keeps the hand-written content.
- [ ] Let the cron run in dry-run for a week. Then set `ROS_DRY_RUN=false`.
