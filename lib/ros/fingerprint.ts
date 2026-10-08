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
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(',')}}`
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
    attachmentIds: (task.attachments ?? [])
      .filter((a) => !(a.title ?? '').startsWith(ROS_PREFIX))
      .map((a) => a.id)
      .sort(),
    commentIds: comments
      .filter((c) => !isRosComment(c))
      .map((c) => c.id)
      .sort(),
    messageIds: [...messageIds].sort(),
  }
  return createHash('sha256').update(canonicalJson(payload)).digest('hex')
}
