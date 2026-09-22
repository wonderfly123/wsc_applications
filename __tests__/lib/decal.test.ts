import { describe, it, expect } from 'vitest'
import {
  validateDecalOrder,
  validateLogoFile,
  buildDecalEmail,
  safeFilename,
  MAX_LOGO_BYTES,
} from '@/lib/decal'

const valid = {
  name: 'Jordan Millhausen',
  email: 'jordan@windanseacoconuts.com',
  job: 'Miramar activation',
  size: '40',
  quantity: '3',
  neededBy: '2026-10-03',
  notes: 'Center on cooler lid',
  rush: 'on',
}

describe('validateDecalOrder', () => {
  it('accepts a complete order and normalizes types', () => {
    const r = validateDecalOrder(valid)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.order.quantity).toBe(3)
      expect(r.order.size).toBe('40')
      expect(r.order.rush).toBe(true)
    }
  })

  it('treats missing rush as false', () => {
    const r = validateDecalOrder({ ...valid, rush: undefined })
    expect(r.ok && r.order.rush).toBe(false)
  })

  it.each([
    ['name', { name: '' }, /name/i],
    ['email', { email: 'not-an-email' }, /email/i],
    ['job', { job: '  ' }, /job/i],
    ['size', { size: '30' }, /size/i],
    ['quantity zero', { quantity: '0' }, /quantity/i],
    ['quantity fraction', { quantity: '1.5' }, /quantity/i],
    ['quantity huge', { quantity: '9999' }, /quantity/i],
    ['date format', { neededBy: '10/03/2026' }, /date/i],
    ['date invalid', { neededBy: '2026-13-45' }, /date/i],
  ])('rejects bad %s', (_label, patch, msg) => {
    const r = validateDecalOrder({ ...valid, ...patch })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(msg)
  })
})

describe('validateLogoFile', () => {
  it('allows no file', () => {
    expect(validateLogoFile(null)).toBeNull()
  })
  it('allows vector and png files', () => {
    for (const n of ['logo.png', 'logo.SVG', 'logo.ai', 'logo.eps', 'logo.pdf']) {
      expect(validateLogoFile({ name: n, size: 1000 })).toBeNull()
    }
  })
  it('rejects other extensions', () => {
    expect(validateLogoFile({ name: 'logo.jpg', size: 1000 })).toMatch(/PNG, SVG/)
    expect(validateLogoFile({ name: 'logo.exe', size: 1000 })).toMatch(/PNG, SVG/)
  })
  it('rejects oversized files', () => {
    expect(validateLogoFile({ name: 'logo.png', size: MAX_LOGO_BYTES + 1 })).toMatch(/under 4 MB/)
  })
})

describe('safeFilename', () => {
  it('strips directories and unsafe characters', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd')
    expect(safeFilename('C:\\Users\\x\\my logo<1>.png')).toBe('my logo_1_.png')
  })
})

describe('buildDecalEmail', () => {
  const order = validateDecalOrder(valid)
  if (!order.ok) throw new Error('fixture invalid')

  it('flags rush in the subject and body', () => {
    const { subject, html } = buildDecalEmail(order.order, 'logo.png')
    expect(subject).toMatch(/^RUSH — Decal order: Miramar activation — 3 × 40"/)
    expect(html).toContain('this one is a rush')
    expect(html).toContain('logo.png (attached)')
    expect(html).toContain('Oct 3, 2026')
  })

  it('omits rush when not set and notes missing logo', () => {
    const { subject, html, text } = buildDecalEmail({ ...order.order, rush: false }, null)
    expect(subject).not.toMatch(/RUSH/)
    expect(html).toContain('Not provided')
    expect(text).toContain('Rush order: No')
  })

  it('escapes user input in html', () => {
    const { html } = buildDecalEmail({ ...order.order, job: '<script>alert(1)</script>' }, null)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
