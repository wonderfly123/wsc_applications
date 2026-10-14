// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { docIdFromUrl, docUrl } from '@/lib/clickup-docs'

describe('clickup-docs', () => {
  it('reads the doc id from a doc or page link', () => {
    expect(docIdFromUrl('https://app.clickup.com/90141034454/v/dc/2kyd61yp-1394')).toBe('2kyd61yp-1394')
    expect(docIdFromUrl('https://app.clickup.com/90141034454/v/dc/2kyd61yp-1394/2kyd61yp-474')).toBe('2kyd61yp-1394')
    expect(docIdFromUrl('https://example.com/nope')).toBeNull()
  })

  it('builds the doc link', () => {
    expect(docUrl('ws', 'd1')).toBe('https://app.clickup.com/ws/v/dc/d1')
  })
})
