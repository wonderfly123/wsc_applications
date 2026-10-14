import type { RosDocument } from './types'

const bulletList = (items: string[]) => items.map((b) => `- ${b}`).join('\n')

/**
 * Render a RosDocument as markdown for a ClickUp Doc page. Same section order
 * as the Word layout; ClickUp's editor renders headings, bold, bullets and
 * pipe tables.
 */
export function renderRosMarkdown(doc: RosDocument, opts: { version?: number } = {}): string {
  const parts: string[] = []
  parts.push(`# ${doc.header.subtitle}`)
  parts.push(doc.info.map((i) => `**${i.label}:** ${i.value}`).join('  \n'))
  parts.push(`**Brand Stamp Logo:** ${doc.stampBox.slice(1).join(' · ') || doc.stampBox[0]}`)
  parts.push(`**Entrance & Check-In:** ${doc.entrance}`)
  if (doc.callout) parts.push(`**${doc.callout}**`)
  if (doc.discrepancies.length) {
    const rows = doc.discrepancies.map((d) => `> - **${d.item}:** ClickUp says ${d.clickup}; ${d.source} says ${d.other}`)
    parts.push(`> 🔴 **DISCREPANCIES — RESOLVE BEFORE EVENT**\n>\n${rows.join('\n')}`)
  }
  if (doc.changes && doc.changes.length) {
    parts.push(`## What changed${opts.version ? ` (v${opts.version})` : ''}\n\n${bulletList(doc.changes)}`)
  }
  for (const day of doc.days) {
    const blocks = day.blocks
      .map((b) => `### ${b.title ? `${b.time} — ${b.title}` : b.time}\n\n${bulletList(b.bullets)}`)
      .join('\n\n')
    parts.push(`## ${day.heading}\n\n${blocks}`)
  }
  if (doc.setTimes && doc.setTimes.length) {
    parts.push(`## Set Times\n\n${doc.setTimes.map((s) => `**${s.heading}**\n\n${bulletList(s.bullets)}`).join('\n\n')}`)
  }
  parts.push(
    `## Coconut Breakdown\n\n| Item | Detail |\n| --- | --- |\n${doc.breakdown.map((r) => `| ${r.item} | ${r.detail} |`).join('\n')}`
  )
  parts.push(`## Supplies\n\n${doc.supplies.map((s) => `**${s.heading}**\n\n${bulletList(s.bullets)}`).join('\n\n')}`)
  parts.push(`## Contacts\n\n${doc.contacts.map((c) => `**${c.label}:** ${c.value}`).join('  \n')}`)
  parts.push(`## Confirm Before Event\n\n${doc.openItems.length ? bulletList(doc.openItems) : '- Nothing outstanding'}`)
  return parts.join('\n\n') + '\n'
}
