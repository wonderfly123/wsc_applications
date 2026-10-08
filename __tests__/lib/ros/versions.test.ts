// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { latestRosAttachment, nextRosVersion, rosFilename, isRosAttachment, rosFieldFiles } from '@/lib/ros/versions'
import type { ClickUpAttachment, ClickUpTask } from '@/lib/ros/types'

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
  it('without the prefix rule, any file counts (the dedicated ROS field)', () => {
    const edited = [att('m', 'Palm Tree ROS edited by Trent.docx', '9')]
    expect(latestRosAttachment(edited)).toBeNull()
    expect(latestRosAttachment(edited, false)?.id).toBe('m')
    expect(nextRosVersion(edited, false)).toBe(2)
    expect(nextRosVersion([att('m', 'Palm Tree v4 final.docx', '9')], false)).toBe(5)
  })
  it('builds the filename', () => {
    expect(rosFilename('Palm Tree Music Festival', 2)).toBe('[ROS] Palm Tree Music Festival v2.docx')
    expect(rosFilename('Smith / Wedding: "Big" Day', 1)).toBe('[ROS] Smith - Wedding- Big Day v1.docx')
  })
  it('keeps filenames ASCII for the v3 upload endpoint', () => {
    expect(rosFilename('TEST — ROS Demo Offsite (delete me)', 3)).toBe('[ROS] TEST - ROS Demo Offsite (delete me) v3.docx')
    expect(rosFilename('Café Núñez Fiesta – Año Nuevo', 1)).toBe('[ROS] Cafe Nunez Fiesta - Ano Nuevo v1.docx')
  })
  it('reads the files linked in the ROS custom field', () => {
    const task: ClickUpTask = {
      id: 't',
      name: 'T',
      custom_fields: [
        { id: 'ros', name: 'ROS', type: 'attachment', value: [{ id: 'f1.docx', title: '[ROS] T v2.docx', url: 'u', date: '5' }] },
        { id: 'other', name: 'Other', type: 'text', value: 'x' },
      ],
    }
    expect(rosFieldFiles(task, 'ros')).toEqual([{ id: 'f1.docx', title: '[ROS] T v2.docx', url: 'u', mimetype: undefined, date: '5' }])
    expect(rosFieldFiles(task, 'other')).toEqual([])
    expect(rosFieldFiles(task, 'missing')).toEqual([])
  })
})
