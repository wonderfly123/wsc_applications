// @vitest-environment node
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { renderRos } from '@/lib/ros/render'
import { extractDocxText } from '@/lib/ros/extract'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'

describe('renderRos', () => {
  it('produces a docx zip with document.xml', async () => {
    const buf = await renderRos(LJBTC_EXEMPLAR)
    const zip = await JSZip.loadAsync(buf)
    expect(zip.file('word/document.xml')).toBeTruthy()
  })

  it('round-trips the main content through extractDocxText', async () => {
    const buf = await renderRos(LJBTC_EXEMPLAR)
    const text = await extractDocxText(buf)
    expect(text).toContain('WINDANSEA COCONUTS — RUN OF SHOW')
    expect(text).toContain('LJBTC | End of Summer Luau Drop-Off')
    expect(text).toContain('Entrance & Check-In:')
    expect(text).toContain('EVENT DAY — FRIDAY, OCTOBER 9')
    expect(text).toContain('12:45 PM — Warehouse Pickup')
    expect(text).toContain('Total coconuts | 100')
    expect(text).toContain('Windansea: Trent LiVolsi, 732-575-5774')
    expect(text).toContain('CONFIRM BEFORE EVENT')
  })

  it('keeps the info table as one row with the stamp box flattened into the right cell', async () => {
    const text = await extractDocxText(await renderRos(LJBTC_EXEMPLAR))
    const infoLine = text.split('\n').find((l) => l.startsWith('Date: Friday, October 9, 2026'))
    expect(infoLine).toBeDefined()
    expect(infoLine).toContain('Garnish: Umbrellas')
    expect(infoLine).toContain('| Brand Stamp Logo')
  })

  it('renders a "What changed" block and set times when present', async () => {
    const doc = {
      ...LJBTC_EXEMPLAR,
      changes: ['Delivery moved to 2:30 PM'],
      setTimes: [{ heading: 'Friday', bullets: ['DJ 3:00–5:00'] }],
    }
    const text = await extractDocxText(await renderRos(doc))
    expect(text).toContain('WHAT CHANGED')
    expect(text).toContain('Delivery moved to 2:30 PM')
    expect(text).toContain('SET TIMES')
  })

  it('embeds a stamp logo when given one', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    )
    const buf = await renderRos(LJBTC_EXEMPLAR, { data: png, widthPx: 1, heightPx: 1 })
    const zip = await JSZip.loadAsync(buf)
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true)
  })
})
