/**
 * Decal order form: constants, validation, and email content.
 * Pure module — safe to import from both client and server code.
 */

export const DECAL_RECIPIENT = 'marcusbhoskins@gmail.com'
export const DECAL_CC = 'trent@windanseacoconuts.com'
// Replies from Marcus go to Trent, not the person who submitted the form
export const DECAL_REPLY_TO = DECAL_CC

export const DECAL_SIZES = ['40', '20'] as const
export type DecalSize = (typeof DECAL_SIZES)[number]

export const DECAL_SIZE_LABELS: Record<DecalSize, string> = {
  '40': '40" wide · full cart panel',
  '20': '20" wide · cooler / half panel',
}

// Vercel serverless functions reject request bodies over 4.5 MB
export const MAX_LOGO_BYTES = 4 * 1024 * 1024
export const ALLOWED_LOGO_EXTENSIONS = ['png', 'svg', 'ai', 'eps', 'pdf'] as const
export const MAX_QUANTITY = 500

export interface DecalOrder {
  name: string
  email: string
  job: string
  size: DecalSize
  quantity: number
  neededBy: string // YYYY-MM-DD
  notes: string
  rush: boolean
}

export type DecalValidation = { ok: true; order: DecalOrder } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function validateDecalOrder(input: Record<string, unknown>): DecalValidation {
  const name = str(input.name)
  const email = str(input.email)
  const job = str(input.job)
  const size = str(input.size)
  const quantityRaw = str(input.quantity)
  const neededBy = str(input.neededBy)
  const notes = str(input.notes)
  const rush = input.rush === true || input.rush === 'true' || input.rush === 'on'

  if (!name) return { ok: false, error: 'Please enter your name' }
  if (name.length > 100) return { ok: false, error: 'Name is too long' }
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address' }
  if (!job) return { ok: false, error: 'Please enter the job or event name' }
  if (job.length > 200) return { ok: false, error: 'Job name is too long' }
  if (!DECAL_SIZES.includes(size as DecalSize)) return { ok: false, error: 'Please pick a decal size' }

  const quantity = Number(quantityRaw)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return { ok: false, error: `Quantity must be a whole number between 1 and ${MAX_QUANTITY}` }
  }

  if (!DATE_RE.test(neededBy) || isNaN(new Date(`${neededBy}T12:00:00Z`).getTime())) {
    return { ok: false, error: 'Please enter the date this is needed by' }
  }
  if (notes.length > 2000) return { ok: false, error: 'Notes are too long' }

  return {
    ok: true,
    order: { name, email, job, size: size as DecalSize, quantity, neededBy, notes, rush },
  }
}

/** Returns an error message, or null when the file is acceptable. */
export function validateLogoFile(file: { name: string; size: number } | null): string | null {
  if (!file) return null
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!(ALLOWED_LOGO_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Logo must be one of: ${ALLOWED_LOGO_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')}`
  }
  if (file.size > MAX_LOGO_BYTES) {
    return `Logo file must be under ${Math.round(MAX_LOGO_BYTES / 1024 / 1024)} MB`
  }
  return null
}

/** Strip directories and anything that isn't a safe filename character. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'logo'
  return base.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120) || 'logo'
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatNeededBy(neededBy: string): string {
  return new Date(`${neededBy}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function buildDecalEmail(
  order: DecalOrder,
  logoFilename: string | null
): { subject: string; html: string; text: string } {
  const sizeLabel = DECAL_SIZE_LABELS[order.size]
  const needed = formatNeededBy(order.neededBy)
  const subject = `${order.rush ? 'RUSH — ' : ''}Decal order: ${order.job} — ${order.quantity} × ${order.size}"`

  const rows: Array<[string, string]> = [
    ['Ordered by', `${order.name} (${order.email})`],
    ['Job / event', order.job],
    ['Decal size', sizeLabel],
    ['Quantity', String(order.quantity)],
    ['Needed by', needed],
    ['Rush order', order.rush ? 'YES' : 'No'],
    ['Logo file', logoFilename ? `${logoFilename} (attached)` : 'Not provided — will follow separately'],
    ['Placement / notes', order.notes || '—'],
  ]

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; font-size: 14px; line-height: 1.6;">
      <p>Hi Marcus,</p>
      <p>New decal order from Windansea Coconuts${order.rush ? ' — <strong>this one is a rush</strong>' : ''}. Details below, and the order sheet is attached as a PDF${logoFilename ? ' along with the logo file' : ''}.</p>
      <table style="border-collapse: collapse; width: 100%;">
        ${rows
          .map(
            ([k, v]) => `<tr>
          <td style="padding: 8px 12px 8px 0; color: #777; vertical-align: top; white-space: nowrap;">${escapeHtml(k)}</td>
          <td style="padding: 8px 0; vertical-align: top;">${escapeHtml(v).replace(/\n/g, '<br/>')}</td>
        </tr>`
          )
          .join('')}
      </table>
      <p style="margin-top: 20px;">Reply to this email to reach Trent directly.</p>
      <p>Thanks,<br/>Windansea Coconuts 🥥</p>
    </div>
  `

  const text = [
    `New decal order from Windansea Coconuts${order.rush ? ' (RUSH)' : ''}`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
  ].join('\n')

  return { subject, html, text }
}
