import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { RosDocumentSchema, type RosDocument, type ClickUpTask, type ClickUpComment, type MailExcerpt } from './types'
import { HOUSE_STYLE } from './house-style'
import { LJBTC_EXEMPLAR } from './exemplar'

export const ROS_MODEL = 'claude-opus-5-5'

export interface ComposeInputs {
  mode: 'create' | 'update'
  task: ClickUpTask
  /** Human-readable field name → display value (dropdowns resolved, dates formatted Pacific). */
  fieldSummary: Record<string, string>
  comments: ClickUpComment[]
  emails: MailExcerpt[]
  existingRosText: string | null
  previousVersion: number | null
}

/** The slice of the Anthropic client we use, so tests can inject a fake. */
export interface ParseClient {
  messages: {
    parse(params: Record<string, unknown>): Promise<{ stop_reason: string | null; parsed_output: unknown }>
  }
}

export function buildSystemPrompt(): string {
  return [
    `You write the Run of Show (ROS) for ${HOUSE_STYLE.companyName}, a branded fresh-coconut event service. The ROS is the crew's single page for the day: where to go, when, what to bring, who to call.`,
    '',
    'HOUSE STYLE (facts you may use without them being in the inputs):',
    `- Warehouse: ${HOUSE_STYLE.warehouseAddress}`,
    `- Windansea contact line: ${HOUSE_STYLE.windanseaContact}`,
    `- Post-event steps: ${HOUSE_STYLE.postEventSteps.join('; ')}`,
    '- Packages: ' +
      Object.entries(HOUSE_STYLE.packages)
        .map(([k, v]) => `${k} = ${v}`)
        .join(' | '),
    '- Standard packing list by category: ' + JSON.stringify(HOUSE_STYLE.packingList),
    '',
    'RULES:',
    ...HOUSE_STYLE.rules.map((r) => `- ${r}`),
    '',
    'EXEMPLAR (a real drop-off ROS; match its structure, density and tone):',
    JSON.stringify(LJBTC_EXEMPLAR, null, 2),
  ].join('\n')
}

export function buildUserPrompt(inputs: ComposeInputs): string {
  const { task, fieldSummary, comments, emails } = inputs
  const lines: string[] = [
    `MODE: ${inputs.mode.toUpperCase()}`,
    '',
    `TASK: ${task.name} (ClickUp ${task.id}, status "${task.status?.status ?? ''}")`,
    '',
    'FIELDS:',
  ]
  for (const [k, v] of Object.entries(fieldSummary)) if (v) lines.push(`${k}: ${v}`)
  lines.push('', 'ATTACHMENTS ON THE TASK:', ...(task.attachments ?? []).map((a) => `- ${a.title}`))
  lines.push('', 'COMMENTS (newest last; ignore any starting with [ROS]):')
  for (const c of comments) {
    if (c.comment_text.trimStart().startsWith('[ROS]')) continue
    const when = Number.isFinite(Number(c.date)) ? new Date(Number(c.date)).toISOString() : c.date
    lines.push(`- ${c.user?.username ?? 'unknown'} (${when}): ${c.comment_text}`)
  }
  lines.push('', `EMAILS (${emails.length} matching messages, newest first):`)
  for (const e of emails) lines.push(`--- ${e.date} | from ${e.from} | to ${e.to} | ${e.subject}`, e.body)
  if (inputs.mode === 'update') {
    const v = inputs.previousVersion ?? '?'
    lines.push(
      '',
      `EXISTING ROS (version ${v}), as plain text. Preserve its wording and any human edits unless an input above contradicts them. Put every change you make in "changes" (what changed since v${v}):`,
      inputs.existingRosText ?? '(missing)'
    )
  } else {
    lines.push('', 'No ROS exists yet. Write version 1. Set "changes" to null.')
  }
  lines.push('', 'Return the complete RosDocument. Everything you could not confirm goes in openItems.')
  return lines.join('\n')
}

/** One structured-output call. Throws on refusal or unparseable output; the SDK retries 429/5xx twice. */
export async function composeRos(
  inputs: ComposeInputs,
  client: ParseClient = new Anthropic() as unknown as ParseClient
): Promise<RosDocument> {
  const response = await client.messages.parse({
    model: ROS_MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: buildSystemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserPrompt(inputs) }],
    output_config: { effort: 'high', format: zodOutputFormat(RosDocumentSchema) },
  })
  if (response.stop_reason === 'refusal') throw new Error('Claude refused to compose the ROS')
  const parsed = RosDocumentSchema.safeParse(response.parsed_output)
  if (!parsed.success) throw new Error(`Claude output failed to parse: ${parsed.error.message.slice(0, 300)}`)
  return parsed.data
}
