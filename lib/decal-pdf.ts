/**
 * Renders a one-page decal order sheet as a PDF.
 * Uses pdf-lib (pure JS, no font files on disk) so it runs on Vercel.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { DecalOrder, DECAL_SIZE_LABELS, DECAL_REPLY_TO, formatNeededBy } from './decal'

export interface LogoInput {
  name: string
  bytes: Uint8Array
  type?: string
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 54

const INK = rgb(0.118, 0.114, 0.102) // #1e1d1a
const MUTED = rgb(0.529, 0.529, 0.455) // #878774
const RULE = rgb(0.878, 0.867, 0.831) // #e0ddd4
const CREAM = rgb(0.941, 0.929, 0.894) // #f0ede4
const WHITE = rgb(1, 1, 1)
const RUSH = rgb(0.769, 0.294, 0.169) // #c44b2b

// Standard fonts only encode WinAnsi; drop anything else (emoji etc.)
function clean(s: string): string {
  return s.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, '').trim()
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of clean(text).split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate
      } else {
        lines.push(line)
        line = w
      }
    }
    lines.push(line)
  }
  return lines
}

async function embedLogo(doc: PDFDocument, logo: LogoInput | null) {
  if (!logo) return null
  const ext = logo.name.split('.').pop()?.toLowerCase()
  try {
    if (ext === 'png' || logo.type === 'image/png') return await doc.embedPng(logo.bytes)
    if (ext === 'jpg' || ext === 'jpeg' || logo.type === 'image/jpeg') return await doc.embedJpg(logo.bytes)
  } catch {
    // Unreadable image — the file is still attached to the email separately
  }
  return null
}

export async function buildDecalOrderPdf(order: DecalOrder, logo: LogoInput | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Decal Order — ${clean(order.job)}`)
  doc.setAuthor('Windansea Coconuts')

  const page = doc.addPage([PAGE_W, PAGE_H])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Header band
  const bandH = 96
  page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: MUTED })
  page.drawText('WINDANSEA COCONUTS', { x: MARGIN, y: PAGE_H - 38, size: 10, font: bold, color: WHITE })
  page.drawText('Decal Order', { x: MARGIN, y: PAGE_H - 72, size: 28, font: bold, color: WHITE })

  const generated = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
  const genText = `Submitted ${generated}`
  page.drawText(genText, {
    x: PAGE_W - MARGIN - regular.widthOfTextAtSize(genText, 10),
    y: PAGE_H - 38,
    size: 10,
    font: regular,
    color: WHITE,
  })

  let y = PAGE_H - bandH - 36

  if (order.rush) {
    const label = 'RUSH ORDER'
    const w = bold.widthOfTextAtSize(label, 10) + 20
    page.drawRectangle({ x: MARGIN, y: y - 6, width: w, height: 22, color: RUSH })
    page.drawText(label, { x: MARGIN + 10, y, size: 10, font: bold, color: WHITE })
    y -= 40
  }

  // Details table
  const rows: Array<[string, string]> = [
    ['Job / event', order.job],
    ['Decal size', DECAL_SIZE_LABELS[order.size]],
    ['Quantity', String(order.quantity)],
    ['Needed by', formatNeededBy(order.neededBy)],
    ['Rush order', order.rush ? 'Yes' : 'No'],
    ['Ordered by', order.name],
    ['Email', order.email],
    ['Logo file', logo ? logo.name : 'Not provided'],
  ]

  const labelX = MARGIN
  const valueX = MARGIN + 130
  const valueW = PAGE_W - MARGIN - valueX

  page.drawText('ORDER DETAILS', { x: MARGIN, y, size: 9, font: bold, color: MUTED })
  y -= 18

  for (const [label, value] of rows) {
    const lines = wrap(value, regular, 12, valueW)
    const rowH = Math.max(1, lines.length) * 16 + 10
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_W - MARGIN, y: y + 6 }, thickness: 0.5, color: RULE })
    page.drawText(label, { x: labelX, y: y - 12, size: 10, font: regular, color: MUTED })
    lines.forEach((ln, i) => {
      page.drawText(ln, { x: valueX, y: y - 12 - i * 16, size: 12, font: i === 0 && label === 'Job / event' ? bold : regular, color: INK })
    })
    y -= rowH
  }
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_W - MARGIN, y: y + 6 }, thickness: 0.5, color: RULE })
  y -= 28

  // Notes
  page.drawText('PLACEMENT / NOTES', { x: MARGIN, y, size: 9, font: bold, color: MUTED })
  y -= 20
  const noteLines = order.notes ? wrap(order.notes, regular, 11, PAGE_W - MARGIN * 2) : ['—']
  for (const ln of noteLines.slice(0, 18)) {
    page.drawText(ln, { x: MARGIN, y, size: 11, font: regular, color: INK })
    y -= 15
  }
  y -= 20

  // Logo preview on a sage panel so white logos are visible
  const image = await embedLogo(doc, logo)
  if (image && y > 200) {
    page.drawText('LOGO PREVIEW', { x: MARGIN, y, size: 9, font: bold, color: MUTED })
    y -= 12
    const panelW = PAGE_W - MARGIN * 2
    const panelH = Math.min(150, y - 90)
    if (panelH > 60) {
      page.drawRectangle({ x: MARGIN, y: y - panelH, width: panelW, height: panelH, color: MUTED })
      const fit = image.scaleToFit(panelW - 40, panelH - 30)
      page.drawImage(image, {
        x: MARGIN + (panelW - fit.width) / 2,
        y: y - panelH + (panelH - fit.height) / 2,
        width: fit.width,
        height: fit.height,
      })
      y -= panelH + 12
    }
  }

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 44, color: CREAM })
  page.drawText(`Questions? Reply to ${DECAL_REPLY_TO}`, { x: MARGIN, y: 17, size: 9, font: regular, color: MUTED })
  const brand = 'Windansea Coconuts'
  page.drawText(brand, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(brand, 9), y: 17, size: 9, font: regular, color: MUTED })

  return doc.save()
}

export function decalPdfFilename(order: DecalOrder): string {
  const slug = clean(order.job).replace(/[^A-Za-z0-9 -]/g, '').trim().replace(/\s+/g, ' ').slice(0, 60) || 'order'
  return `Decal Order - ${slug}.pdf`
}

// Re-exported so callers only need one import when drawing pages elsewhere
export type { PDFPage }
