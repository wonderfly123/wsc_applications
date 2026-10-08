import type { ClickUpTask, ClickUpComment, RosDocument, RunSummary, TaskOutcome } from './types'
import type { ComposeInputs } from './compose'
import type { MailSearchResult } from './mail'
import type { StampLogo } from './render'
import { selectCandidates } from './select'
import { computeFingerprint } from './fingerprint'
import { latestRosAttachment, nextRosVersion, rosFilename, rosFieldFiles } from './versions'
import { formatForDisplay } from '@/lib/intake-fields'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PACIFIC = 'America/Los_Angeles'
const CLIENT_EMAIL_FIELD_ID = 'a4316b37-4646-4db8-93d7-c37561d17a77'
const DEAL_TITLE_FIELD_ID = '9d8e3b50-556e-4039-8062-7a2bb4ac4fee'

export const FINGERPRINT_FIELD_NAME = 'ROS Fingerprint'
export const ROS_FILES_FIELD_NAME = 'ROS'

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
    uploadToFilesField(workspaceId: string, fieldId: string, content: Buffer, filename: string, mimetype: string): Promise<string>
    setFilesFieldValue(taskId: string, fieldId: string, value: { add?: string[]; rem?: string[] }): Promise<void>
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

export interface RunOptions {
  taskId?: string
  force?: boolean
}

/** Ids of the two fields the bot writes; resolved once per run. */
export interface BotFields {
  fingerprintFieldId: string
  rosFieldId: string
}

/** Field name → display string, with dropdowns resolved by option and dates formatted Pacific. */
export function summarizeFields(task: ClickUpTask, exclude: string[] = []): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of task.custom_fields ?? []) {
    if (exclude.includes(f.id)) continue
    if (f.value === null || f.value === undefined || f.value === '') continue
    if (f.type === 'drop_down') {
      const o = f.type_config?.options?.find((x) => x.orderindex === f.value || x.id === f.value)
      if (o) out[f.name] = o.name
    } else if (f.type === 'date') {
      const ms = Number(f.value)
      if (ms > 0) out[f.name] = formatForDisplay(ms, PACIFIC)
    } else if (f.type === 'location' && typeof f.value === 'object') {
      const addr = (f.value as { formatted_address?: string }).formatted_address
      if (addr) out[f.name] = addr
    } else if (typeof f.value !== 'object') {
      out[f.name] = String(f.value)
    }
  }
  if (task.start_date) out['Setup / Start (task start date)'] = formatForDisplay(Number(task.start_date), PACIFIC)
  if (task.due_date) out['Teardown / End (task due date)'] = formatForDisplay(Number(task.due_date), PACIFIC)
  return out
}

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
    const data = await deps.clickup.downloadAttachment(att.url)
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
  fields: BotFields,
  warnings: string[],
  force = false
): Promise<TaskOutcome> {
  const task = await deps.clickup.fetchRawTask(taskId)
  const comments = await deps.clickup.fetchTaskComments(taskId)
  const createdMs = Number(task.date_created)
  const since = new Date(Number.isFinite(createdMs) && createdMs > 0 ? createdMs : deps.now().getTime() - 90 * 86_400_000)
  const mail = await deps.searchMail({
    clientEmail: fieldValue(task, CLIENT_EMAIL_FIELD_ID),
    titles: [task.name, fieldValue(task, DEAL_TITLE_FIELD_ID)],
    since,
  })
  for (const mb of mail.failedMailboxes) warnings.push(`${taskId}: mailbox ${mb} unavailable, used ClickUp data only`)

  const excludeFieldIds = [fields.fingerprintFieldId, fields.rosFieldId]
  const fingerprint = computeFingerprint({
    task,
    comments,
    messageIds: mail.excerpts.map((e) => e.messageId),
    excludeFieldIds,
  })
  const stored = task.custom_fields.find((f) => f.id === fields.fingerprintFieldId)?.value
  const currentFiles = rosFieldFiles(task, fields.rosFieldId)
  const latest = latestRosAttachment(currentFiles)

  if (latest && stored === fingerprint && !force) return 'skipped'

  const mode: ComposeInputs['mode'] = latest ? 'update' : 'create'
  const version = nextRosVersion(currentFiles)
  let existingRosText: string | null = null
  if (latest) existingRosText = await deps.extract(await deps.clickup.downloadAttachment(latest.url))

  const doc = await deps.compose({
    mode,
    task,
    fieldSummary: summarizeFields(task, excludeFieldIds),
    comments,
    emails: mail.excerpts,
    existingRosText,
    previousVersion: latest ? version - 1 : null,
  })
  const content = await deps.render(doc, await stampLogo(task, deps))
  const filename = rosFilename(task.name, version)
  const comment = commentFor(doc, version)

  if (deps.dryRun) {
    await deps.sendDraftEmail({ taskName: task.name, taskUrl: `https://app.clickup.com/t/${task.id}`, filename, content, comment })
  } else {
    if (!task.team_id) throw new Error(`Task ${task.id} has no team_id; cannot upload to the ROS files field`)
    const newId = await deps.clickup.uploadToFilesField(task.team_id, fields.rosFieldId, content, filename, DOCX_MIME)
    // One current file at a time: link the new version and unlink every previous one.
    await deps.clickup.setFilesFieldValue(task.id, fields.rosFieldId, {
      add: [newId],
      rem: currentFiles.map((f) => f.id),
    })
    await deps.clickup.postComment(task.id, comment, deps.trentUserId)
    await deps.clickup.setTextField(task.id, fields.fingerprintFieldId, fingerprint)
  }
  return mode === 'create' ? 'created' : 'updated'
}

export async function runRos(deps: RosDeps, opts: RunOptions = {}): Promise<RunSummary> {
  const started = deps.now().getTime()
  const summary: RunSummary = {
    dryRun: deps.dryRun,
    considered: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    deferred: 0,
    failed: [],
    warnings: [],
  }

  const fpField = await deps.clickup.findListFieldByName(deps.listId, FINGERPRINT_FIELD_NAME)
  if (!fpField) {
    throw new Error(
      `Custom field "${FINGERPRINT_FIELD_NAME}" not found on list ${deps.listId}. Create a Text field with that exact name.`
    )
  }
  const rosField = await deps.clickup.findListFieldByName(deps.listId, ROS_FILES_FIELD_NAME)
  if (!rosField) {
    throw new Error(
      `Custom field "${ROS_FILES_FIELD_NAME}" not found on list ${deps.listId}. Create a Files field with that exact name.`
    )
  }
  const fields: BotFields = { fingerprintFieldId: fpField.id, rosFieldId: rosField.id }

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
    if (deps.now().getTime() - started > deps.timeBudgetMs) {
      summary.deferred = ids.length - i
      break
    }
    try {
      const outcome = await processTask(ids[i], deps, fields, summary.warnings, opts.force)
      summary[outcome]++
    } catch (err) {
      summary.failed.push({ taskId: ids[i], error: err instanceof Error ? err.message : String(err) })
    }
  }
  return summary
}
