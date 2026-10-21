// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/clickup', () => ({ listOpenTasks: vi.fn(async () => []) }))
vi.mock('@/lib/email', () => ({ sendErrorAlert: vi.fn(async () => {}), sendGapsDigest: vi.fn(async () => {}) }))

import { GET } from '@/app/api/cron/gaps/route'
import { listOpenTasks } from '@/lib/clickup'
import { sendGapsDigest } from '@/lib/email'
import { NextRequest } from 'next/server'

const authed = () => new NextRequest('http://x/api/cron/gaps', { headers: { authorization: 'Bearer shh' } })

describe('GET /api/cron/gaps', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'shh'
    process.env.CLICKUP_LIST_ID = 'list1'
    delete process.env.GAPS_DRY_RUN
    vi.mocked(sendGapsDigest).mockClear()
    vi.mocked(listOpenTasks).mockClear()
  })

  it('rejects a missing or wrong bearer token', async () => {
    expect((await GET(new NextRequest('http://x/api/cron/gaps'))).status).toBe(401)
    const bad = await GET(new NextRequest('http://x/api/cron/gaps', { headers: { authorization: 'Bearer nope' } }))
    expect(bad.status).toBe(401)
    expect(listOpenTasks).not.toHaveBeenCalled()
  })

  it('sends nothing when no event has gaps', async () => {
    const res = await GET(authed())
    expect(await res.json()).toMatchObject({ sent: false, events: 0 })
    expect(sendGapsDigest).not.toHaveBeenCalled()
  })

  it('emails the digest, live by default and to Jordan only on dry run', async () => {
    const undated = { id: 'u', name: 'No dates', custom_fields: [] }
    vi.mocked(listOpenTasks).mockResolvedValue([undated])
    await GET(authed())
    expect(vi.mocked(sendGapsDigest).mock.calls[0][0].dryRun).toBe(false)
    process.env.GAPS_DRY_RUN = 'true'
    const res = await GET(authed())
    expect(vi.mocked(sendGapsDigest).mock.calls[1][0].dryRun).toBe(true)
    expect(await res.json()).toMatchObject({ dryRun: true, sent: true, undated: 1 })
  })
})
