import { NextRequest, NextResponse } from 'next/server'
import { listOpenTasks } from '@/lib/clickup'
import { buildDigest, renderDigest } from '@/lib/gaps'
import { sendErrorAlert, sendGapsDigest } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Daily event-gaps digest. Vercel calls this with `Authorization: Bearer $CRON_SECRET`.
 * Emails Trent and Harrison by default; GAPS_DRY_RUN=true sends to Jordan only.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const listId = process.env.CLICKUP_LIST_ID
    if (!listId) throw new Error('CLICKUP_LIST_ID not set')
    const dryRun = process.env.GAPS_DRY_RUN === 'true'
    const now = new Date()
    const digest = buildDigest(await listOpenTasks(listId), now)
    const email = renderDigest(digest, now)
    if (email) await sendGapsDigest({ ...email, dryRun })

    const summary = {
      dryRun,
      sent: Boolean(email),
      events: digest.events.length,
      undated: digest.undated.length,
    }
    console.log('Gaps cron summary', JSON.stringify(summary))
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Gaps cron fatal:', message)
    await sendErrorAlert({ source: 'Gaps Cron', error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
