// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeFingerprint, ROS_SCHEMA_VERSION } from '@/lib/ros/fingerprint'
import type { ClickUpTask, ClickUpComment } from '@/lib/ros/types'

const FP_FIELD = 'fp-field-id'
const base: ClickUpTask = {
  id: 't1',
  name: 'Palm Tree',
  status: { status: 'brand stamp ordered' },
  start_date: '1',
  due_date: '2',
  custom_fields: [
    { id: 'a', name: 'Coconut Quantity', type: 'number', value: '750' },
    { id: 'b', name: 'Garnish', type: 'drop_down', value: 3 },
    { id: FP_FIELD, name: 'ROS Fingerprint', type: 'text', value: 'old-hash' },
  ],
  attachments: [{ id: 'att1', title: '[STAMP LOGO] x.png', url: 'u', date: '1' }],
}
const comments: ClickUpComment[] = [{ id: 'c1', comment_text: 'Client wants 800 now', date: '1' }]
const args = (over: Partial<{ task: ClickUpTask; comments: ClickUpComment[]; messageIds: string[] }> = {}) => ({
  task: over.task ?? base,
  comments: over.comments ?? comments,
  messageIds: over.messageIds ?? ['m1'],
  excludeFieldIds: [FP_FIELD],
})

describe('computeFingerprint', () => {
  it('is a 64-char hex string and stable across key order', () => {
    const fp = computeFingerprint(args())
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    const reordered: ClickUpTask = { ...base, custom_fields: [...base.custom_fields].reverse() }
    expect(computeFingerprint(args({ task: reordered }))).toBe(fp)
  })

  it('changes when a field, attachment, comment, message id, or schema version changes', () => {
    const fp = computeFingerprint(args())
    const changedField: ClickUpTask = {
      ...base,
      custom_fields: [{ id: 'a', name: 'Coconut Quantity', type: 'number', value: '800' }, ...base.custom_fields.slice(1)],
    }
    expect(computeFingerprint(args({ task: changedField }))).not.toBe(fp)
    const newAtt: ClickUpTask = {
      ...base,
      attachments: [...(base.attachments ?? []), { id: 'att2', title: '[DELIVERY MAP] m.pdf', url: 'u', date: '2' }],
    }
    expect(computeFingerprint(args({ task: newAtt }))).not.toBe(fp)
    expect(computeFingerprint(args({ comments: [...comments, { id: 'c2', comment_text: 'Trent: parking is lot C', date: '2' }] }))).not.toBe(fp)
    expect(computeFingerprint(args({ messageIds: ['m1', 'm2'] }))).not.toBe(fp)
    expect(computeFingerprint({ ...args(), schemaVersion: ROS_SCHEMA_VERSION + 1 })).not.toBe(fp)
  })

  it("is UNCHANGED by the bot's own writes: [ROS] attachments, [ROS] comments, the fingerprint field", () => {
    const fp = computeFingerprint(args())
    const withRosAtt: ClickUpTask = {
      ...base,
      attachments: [...(base.attachments ?? []), { id: 'r1', title: '[ROS] Palm Tree v1 — DRAFT.docx', url: 'u', date: '9' }],
    }
    expect(computeFingerprint(args({ task: withRosAtt }))).toBe(fp)
    expect(computeFingerprint(args({ comments: [...comments, { id: 'c9', comment_text: '[ROS] v1 drafted', date: '9' }] }))).toBe(fp)
    const newHash: ClickUpTask = {
      ...base,
      custom_fields: base.custom_fields.map((f) => (f.id === FP_FIELD ? { ...f, value: 'new-hash' } : f)),
    }
    expect(computeFingerprint(args({ task: newHash }))).toBe(fp)
  })
})
