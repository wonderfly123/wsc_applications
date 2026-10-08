import { NextRequest, NextResponse } from 'next/server'
import { runRos, type RosDeps } from '@/lib/ros/run'
import {
  listOpenTasks,
  fetchRawTask,
  fetchTaskComments,
  findListFieldByName,
  uploadAttachment,
  postComment,
  setTextField,
  downloadAttachment,
} from '@/lib/clickup'
import { searchAllMailboxes } from '@/lib/ros/mail'
import { composeRos } from '@/lib/ros/compose'
import { renderRos } from '@/lib/ros/render'
import { extractDocxText } from '@/lib/ros/extract'
import { sendErrorAlert, sendRosDraftEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Stop starting new tasks after this much wall time so the batch never hits
// the 300 s function limit; whatever is left runs tomorrow.
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
    // Writes to ClickUp by default. ROS_DRY_RUN=true emails drafts to Jordan instead.
    dryRun: process.env.ROS_DRY_RUN === 'true',
    timeBudgetMs: TIME_BUDGET_MS,
    trentUserId: Number.isFinite(trent) && trent > 0 ? trent : undefined,
    clickup: {
      listOpenTasks,
      fetchRawTask,
      fetchTaskComments,
      findListFieldByName,
      uploadAttachment,
      postComment,
      setTextField,
      downloadAttachment,
    },
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
      await sendErrorAlert({
        source: 'ROS Cron',
        error: `${summary.failed.length} task(s) failed`,
        context: { ...summary },
      })
    }
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('ROS cron fatal:', message)
    await sendErrorAlert({ source: 'ROS Cron', error: message, context: { taskId, force } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
