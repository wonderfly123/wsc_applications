// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderRosMarkdown } from '@/lib/ros/render-md'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'

describe('renderRosMarkdown', () => {
  it('renders every section in order', () => {
    const md = renderRosMarkdown(LJBTC_EXEMPLAR)
    const order = ['# ', '**Entrance & Check-In:**', '## EVENT DAY', '## Coconut Breakdown', '## Supplies', '## Contacts', '## Confirm Before Event']
    const idx = order.map((h) => md.indexOf(h))
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(md).not.toContain('DISCREPANCIES')
  })

  it('flags discrepancies above the schedule', () => {
    const md = renderRosMarkdown({
      ...LJBTC_EXEMPLAR,
      discrepancies: [{ item: 'Headcount', clickup: '150', other: '200', source: 'Harrison email, Oct 12' }],
    })
    expect(md).toContain('> 🔴 **DISCREPANCIES — RESOLVE BEFORE EVENT**')
    expect(md).toContain('> - **Headcount:** ClickUp says 150; Harrison email, Oct 12 says 200')
    expect(md.indexOf('DISCREPANCIES')).toBeLessThan(md.indexOf('## EVENT DAY'))
  })
})
