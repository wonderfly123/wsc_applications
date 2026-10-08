import type { ClickUpAttachment, ClickUpTask } from './types'

export const ROS_PREFIX = '[ROS]'

export const isRosAttachment = (a: ClickUpAttachment) => (a.title ?? '').startsWith(ROS_PREFIX)

/** Newest `[ROS]` attachment by ClickUp date (ms string), or null. */
export function latestRosAttachment(attachments: ClickUpAttachment[]): ClickUpAttachment | null {
  const ros = attachments.filter(isRosAttachment)
  if (ros.length === 0) return null
  return ros.reduce((best, a) => (Number(a.date ?? 0) > Number(best.date ?? 0) ? a : best))
}

/**
 * One more than the highest "vN" among `[ROS]` titles; 1 when there are none;
 * 2 when there are `[ROS]` files without a parsable version.
 */
export function nextRosVersion(attachments: ClickUpAttachment[]): number {
  const ros = attachments.filter(isRosAttachment)
  if (ros.length === 0) return 1
  let max = 1
  for (const a of ros) {
    const m = /\bv(\d+)\b/.exec(a.title)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

/** `[ROS] <task name> vN.docx`, with filesystem-hostile characters removed. */
export function rosFilename(taskName: string, version: number): string {
  const safe = taskName
    .replace(/[\\/:]/g, '-')
    .replace(/["*?<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${ROS_PREFIX} ${safe} v${version}.docx`
}

/** The files currently linked in the task's ROS Files custom field (the value is an attachment array). */
export function rosFieldFiles(task: ClickUpTask, rosFieldId: string): ClickUpAttachment[] {
  const f = task.custom_fields?.find((x) => x.id === rosFieldId)
  if (!Array.isArray(f?.value)) return []
  return (f.value as Array<Partial<ClickUpAttachment>>)
    .filter((a) => typeof a.id === 'string')
    .map((a) => ({ id: a.id as string, title: a.title ?? '', url: a.url ?? '', mimetype: a.mimetype, date: a.date }))
}
