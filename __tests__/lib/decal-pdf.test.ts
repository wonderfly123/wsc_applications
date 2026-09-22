import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildDecalOrderPdf, decalPdfFilename } from '@/lib/decal-pdf'
import { DecalOrder } from '@/lib/decal'

const order: DecalOrder = {
  name: 'Jordan Millhausen',
  email: 'jordan@windanseacoconuts.com',
  job: 'Day in the Stoke 🥥',
  size: '40',
  quantity: 4,
  neededBy: '2026-10-08',
  notes: 'Die cut, match Pantone 356C green.\nCenter on cooler lid.',
  rush: true,
}

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

describe('buildDecalOrderPdf', () => {
  it('produces a one-page PDF with the order text', async () => {
    const bytes = await buildDecalOrderPdf(order, null)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('Decal Order — Day in the Stoke')
  })

  it('embeds a PNG logo preview without failing', async () => {
    const bytes = await buildDecalOrderPdf(order, { name: 'logo.png', bytes: PNG, type: 'image/png' })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('tolerates a non-image logo file', async () => {
    const bytes = await buildDecalOrderPdf(order, { name: 'logo.ai', bytes: new Uint8Array([1, 2, 3]) })
    expect(bytes.length).toBeGreaterThan(500)
  })
})

describe('decalPdfFilename', () => {
  it('builds a safe filename from the job', () => {
    expect(decalPdfFilename(order)).toBe('Decal Order - Day in the Stoke.pdf')
    expect(decalPdfFilename({ ...order, job: '<<>>//' })).toBe('Decal Order - order.pdf')
  })
})
