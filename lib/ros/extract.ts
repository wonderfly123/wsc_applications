import JSZip from 'jszip'

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

const paraText = (p: string) =>
  decode((p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))

/**
 * Split the document body into top-level chunks (tables and paragraphs) in
 * order. Tables can nest (the stamp box sits inside the info table), so a
 * table's end is found by depth, not by the first closing tag.
 */
function topLevelChunks(body: string): string[] {
  const chunks: string[] = []
  const tokenRe = /<w:tbl>|<\/w:tbl>|<w:p\b|<\/w:p>/g
  let depth = 0
  let start = -1
  let kind: 'tbl' | 'p' | null = null
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(body))) {
    const tok = m[0]
    if (tok === '<w:tbl>') {
      if (kind === null) {
        kind = 'tbl'
        start = m.index
      }
      if (kind === 'tbl') depth++
    } else if (tok === '</w:tbl>') {
      if (kind === 'tbl') {
        depth--
        if (depth === 0) {
          chunks.push(body.slice(start, m.index + tok.length))
          kind = null
        }
      }
    } else if (tok === '<w:p') {
      if (kind === null) {
        kind = 'p'
        start = m.index
      }
    } else if (tok === '</w:p>') {
      if (kind === 'p') {
        chunks.push(body.slice(start, m.index + tok.length))
        kind = null
      }
    }
  }
  return chunks
}

/**
 * Plain text of a .docx in document order. Paragraphs become lines; table rows
 * become "cell | cell" lines (paragraphs within a cell joined by " / ").
 * Good enough for the model to read an existing ROS.
 */
export async function extractDocxText(docx: Buffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(docx)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('document.xml missing from docx')

  const body = xml.match(/<w:body>([\s\S]*?)<\/w:body>/)?.[1] ?? xml
  const lines: string[] = []
  for (const chunk of topLevelChunks(body)) {
    if (chunk.startsWith('<w:tbl>')) {
      for (const tr of chunk.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []) {
        const cells = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) =>
          (tc.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(paraText).filter(Boolean).join(' / ')
        )
        if (cells.some(Boolean)) lines.push(cells.join(' | '))
      }
    } else {
      const t = paraText(chunk)
      if (t.trim()) lines.push(t)
    }
  }
  return lines.join('\n')
}
