// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ros/run', () => ({
  runRos: vi.fn(async () => ({
    dryRun: true,
    considered: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    deferred: 0,
    failed: [],
    warnings: [],
  })),
}))
vi.mock('@/lib/email', () => ({ sendErrorAlert: vi.fn(async () => {}), sendRosDraftEmail: vi.fn(async () => {}) }))

import { GET } from '@/app/api/cron/ros/route'
import { runRos } from '@/lib/ros/run'
import { NextRequest } from 'next/server'

describe('GET /api/cron/ros', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'shh'
    process.env.CLICKUP_LIST_ID = 'list1'
    process.env.CLICKUP_API_KEY = 'k'
    vi.mocked(runRos).mockClear()
  })

  it('rejects a missing or wrong bearer token', async () => {
    const res = await GET(new NextRequest('http://x/api/cron/ros'))
    expect(res.status).toBe(401)
    const bad = await GET(new NextRequest('http://x/api/cron/ros', { headers: { authorization: 'Bearer nope' } }))
    expect(bad.status).toBe(401)
    expect(runRos).not.toHaveBeenCalled()
  })

  it('runs and returns the summary, passing taskId and force through', async () => {
    const res = await GET(
      new NextRequest('http://x/api/cron/ros?taskId=abc&force=1', { headers: { authorization: 'Bearer shh' } })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ dryRun: true, considered: 0 })
    expect(vi.mocked(runRos).mock.calls[0][1]).toEqual({ taskId: 'abc', force: true })
  })

  it('writes to ClickUp by default; ROS_DRY_RUN=true switches to dry run', async () => {
    delete process.env.ROS_DRY_RUN
    await GET(new NextRequest('http://x/api/cron/ros', { headers: { authorization: 'Bearer shh' } }))
    expect(vi.mocked(runRos).mock.calls[0][0].dryRun).toBe(false)
    process.env.ROS_DRY_RUN = 'true'
    await GET(new NextRequest('http://x/api/cron/ros', { headers: { authorization: 'Bearer shh' } }))
    expect(vi.mocked(runRos).mock.calls[1][0].dryRun).toBe(true)
  })
})
