import { z } from 'zod'

/** One timed block in a day: "12:45 PM — Warehouse Pickup" plus its bullets. */
const BlockSchema = z.object({
  time: z.string().describe('Time label, e.g. "12:45 PM" or "Time TBD"'),
  title: z.string().describe('Short title, e.g. "Warehouse Pickup"; empty string allowed for "Post Event"'),
  bullets: z.array(z.string()).min(1),
})

const HeadedBulletsSchema = z.object({ heading: z.string(), bullets: z.array(z.string()).min(1) })
const LabelValueSchema = z.object({ label: z.string(), value: z.string() })
const BreakdownRowSchema = z.object({ item: z.string(), detail: z.string() })

/**
 * The whole Run of Show. Claude fills this; render.ts turns it into a .docx.
 * Nullable (not optional) fields keep the structured-output schema strict.
 */
export const RosDocumentSchema = z.object({
  header: z.object({
    clientName: z.string(),
    eventName: z.string(),
    subtitle: z.string().describe('"<Client> | <Event> — <Package or type>"'),
  }),
  info: z
    .array(LabelValueSchema)
    .min(1)
    .describe('Dates, Service, Location, Service Spot, Day-Of Contact, Total Coconuts, Garnish, Headcount…'),
  stampBox: z.array(z.string()).min(1).describe('Lines for the brand stamp box; first line is "Brand Stamp Logo"'),
  entrance: z.string().describe('Entrance & Check-In paragraph, without the label'),
  callout: z.string().nullable().describe('Bold all-caps warning, or null'),
  changes: z.array(z.string()).nullable().describe('UPDATE mode only: what changed since the previous version'),
  days: z.array(z.object({ heading: z.string(), blocks: z.array(BlockSchema).min(1) })).min(1),
  setTimes: z.array(HeadedBulletsSchema).nullable(),
  breakdown: z.array(BreakdownRowSchema).min(1),
  supplies: z.array(HeadedBulletsSchema).min(1),
  contacts: z.array(LabelValueSchema).min(1),
  openItems: z.array(z.string()).describe('"Confirm before" list; every missing fact goes here'),
})

export type RosDocument = z.infer<typeof RosDocumentSchema>

// ---- Raw ClickUp shapes (only the fields this feature reads) ----

export interface ClickUpOption {
  id: string
  name: string
  orderindex: number
}

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
  /** Workspace id, needed for the v3 attachments endpoint. */
  team_id?: string
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
