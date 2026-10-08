// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { buildSearchQuery, toExcerpt, searchMailbox, configuredMailboxes, type ImapLike } from '@/lib/ros/mail'

describe('buildSearchQuery', () => {
  it('ORs the client email across from/to/cc and the titles across subject/body, since the given date', () => {
    const since = new Date('2026-09-28T00:00:00Z')
    const q = buildSearchQuery({ clientEmail: 'rj@olukai.com', titles: ['Palm Tree Music Festival', 'Olukai'], since })
    expect(q.since).toBe(since)
    expect(q.or).toEqual(
      expect.arrayContaining([
        { from: 'rj@olukai.com' },
        { to: 'rj@olukai.com' },
        { cc: 'rj@olukai.com' },
        { subject: 'Palm Tree Music Festival' },
        { body: 'Palm Tree Music Festival' },
        { subject: 'Olukai' },
        { body: 'Olukai' },
      ])
    )
  })
  it('drops blank titles and tiny ones that would match everything', () => {
    const q = buildSearchQuery({ clientEmail: 'a@b.com', titles: ['', 'ab', 'Real Title'], since: new Date() })
    expect(q.or).toHaveLength(3 + 2)
  })
})

describe('toExcerpt', () => {
  it('strips quoted replies and the "On … wrote:" line and caps at 3000 chars', () => {
    const body =
      'Load in is at the main gate.\n\nThanks,\nRJ\n\nOn Tue, Oct 6, 2026 at 9:00 AM Harrison wrote:\n> old stuff\n> more old stuff'
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
      fetch: async function* (range: number[] | string) {
        for (const uid of range as number[]) {
          yield {
            uid,
            envelope: {
              messageId: `<m${uid}@x>`,
              date: new Date(Date.UTC(2026, 0, 1) + uid * 86_400_000),
              subject: `S${uid}`,
              from: [{ address: 'rj@olukai.com' }],
              to: [{ address: 'harrison@windanseacoconuts.com' }],
            },
            source: Buffer.from(`Subject: S${uid}\r\n\r\nBody ${uid}\r\n`),
          }
        }
      },
      logout: vi.fn(async () => {}),
    }
    const out = await searchMailbox(
      { user: 'harrison@windanseacoconuts.com', pass: 'p', clientEmail: 'rj@olukai.com', titles: ['Palm Tree'], since: new Date() },
      () => fake
    )
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
