// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { RosDocumentSchema } from '@/lib/ros/types'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'
import { HOUSE_STYLE } from '@/lib/ros/house-style'

describe('exemplar and house style', () => {
  it('exemplar validates against the schema', () => {
    const r = RosDocumentSchema.safeParse(LJBTC_EXEMPLAR)
    expect(r.success).toBe(true)
  })
  it('exemplar carries the template landmarks', () => {
    expect(LJBTC_EXEMPLAR.header.subtitle).toBe('LJBTC | End of Summer Luau Drop-Off')
    expect(LJBTC_EXEMPLAR.days[0].heading).toBe('EVENT DAY — FRIDAY, OCTOBER 9')
    expect(LJBTC_EXEMPLAR.breakdown.map((b) => b.item)).toContain('Package')
  })
  it('house style has the warehouse and post-event steps', () => {
    expect(HOUSE_STYLE.warehouseAddress).toContain('9040 Kenamar Dr')
    expect(HOUSE_STYLE.postEventSteps.length).toBeGreaterThanOrEqual(2)
  })
})
