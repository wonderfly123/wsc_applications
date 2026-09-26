import { describe, it, expect } from 'vitest'
import { MAX_UPLOAD_BYTES, validateUploadSize, validateUploadTotal } from '@/lib/intake-fields'

const MB = 1024 * 1024

describe('validateUploadSize', () => {
  it('allows no file and files at or under the limit', () => {
    expect(validateUploadSize(null)).toBeNull()
    expect(validateUploadSize({ name: 'map.pdf', size: 1 * MB })).toBeNull()
    expect(validateUploadSize({ name: 'map.pdf', size: MAX_UPLOAD_BYTES })).toBeNull()
  })

  it('rejects a file over the limit with its size in the message', () => {
    const msg = validateUploadSize({ name: 'map.jpg', size: 7.5 * MB })
    expect(msg).toContain('7.5 MB')
    expect(msg).toContain('under 4 MB')
  })
})

describe('validateUploadTotal', () => {
  it('allows files that fit together', () => {
    expect(validateUploadTotal([{ size: 1.5 * MB }, { size: 2 * MB }, null])).toBeNull()
    expect(validateUploadTotal([])).toBeNull()
  })

  it('rejects files that individually fit but together exceed the limit', () => {
    const msg = validateUploadTotal([{ size: 3 * MB }, { size: 3 * MB }])
    expect(msg).toContain('6.0 MB')
    expect(msg).toContain('Together')
  })
})
