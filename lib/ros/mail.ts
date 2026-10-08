import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { MailExcerpt } from './types'

export const MAX_MESSAGES_PER_MAILBOX = 30
export const EXCERPT_CHARS = 3000
const ALL_MAIL = '[Gmail]/All Mail'

export interface MailboxCreds {
  user: string
  pass: string
}
export interface SearchOpts extends MailboxCreds {
  clientEmail: string
  titles: string[]
  since: Date
}

interface FetchedMessage {
  uid: number
  envelope?: {
    messageId?: string
    date?: Date
    subject?: string
    from?: Array<{ address?: string }>
    to?: Array<{ address?: string }>
  }
  source?: Buffer
}

/** The subset of ImapFlow this module uses, so tests can inject a fake. */
export interface ImapLike {
  connect(): Promise<void>
  getMailboxLock(path: string): Promise<{ release(): void }>
  search(query: Record<string, unknown>, opts?: { uid?: boolean }): Promise<number[] | false>
  fetch(range: number[] | string, query: Record<string, unknown>, opts?: { uid?: boolean }): AsyncIterable<FetchedMessage>
  logout(): Promise<void>
}

export type ImapFactory = (creds: MailboxCreds) => ImapLike

const defaultFactory: ImapFactory = ({ user, pass }) =>
  new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false }) as unknown as ImapLike

/** IMAP search: the client address in From/To/Cc, OR any title in Subject/Body, since the task was created. */
export function buildSearchQuery(opts: { clientEmail: string; titles: string[]; since: Date }): {
  since: Date
  or: Array<Record<string, string>>
} {
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

export interface MailSearchResult {
  excerpts: MailExcerpt[]
  failedMailboxes: string[]
}

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
