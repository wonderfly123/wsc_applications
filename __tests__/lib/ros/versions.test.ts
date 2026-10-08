// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { latestRosAttachment, nextRosVersion, rosFilename, isRosAttachment } from '@/lib/ros/versions'
import type { ClickUpAttachment } from '@/lib/ros/types'

const att = (id: string, title: string, date: string): ClickUpAttachment => ({ id, title, url: `https://x/${id}`, date })

describe('versions', () => {
  it('detects [ROS] attachments by prefix only', () => {
    expect(isRosAttachment(att('1', '[ROS] Foo v1 — DRAFT.docx', '1'))).toBe(true)
    expect(isRosAttachment(att('2', '[STAMP LOGO] foo.png', '1'))).toBe(false)
    expect(isRosAttachment(att('3', 'ros notes.docx', '1'))).toBe(false)
  })
  it('returns the newest [ROS] attachment by date', () => {
    const list = [
      att('a', '[ROS] Foo v1 — DRAFT.docx', '100'),
      att('b', '[DELIVERY MAP] m.pdf', '300'),
      att('c', '[ROS] Foo v2 — DRAFT.docx', '200'),
    ]
    expect(latestRosAttachment(list)?.id).toBe('c')
    expect(latestRosAttachment([att('b', 'x', '1')])).toBeNull()
  })
  it('computes the next version from the highest vN seen', () => {
    expect(nextRosVersion([])).toBe(1)
    expect(nextRosVersion([att('a', '[ROS] Foo v3 — DRAFT.docx', '1'), att('b', '[ROS] Foo v10 — DRAFT.docx', '2')])).toBe(11)
    expect(nextRosVersion([att('a', '[ROS] Palm Tree.docx', '1')])).toBe(2)
  })
  it('builds the filename', () => {
    expect(rosFilename('Palm Tree Music Festival', 2)).toBe('[ROS] Palm Tree Music Festival v2 — DRAFT.docx')
    expect(rosFilename('Smith / Wedding: "Big" Day', 1)).toBe('[ROS] Smith - Wedding- Big Day v1 — DRAFT.docx')
  })
})
