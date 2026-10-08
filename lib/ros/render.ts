import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  BorderStyle,
  WidthType,
  LevelFormat,
  AlignmentType,
} from 'docx'
import type { IRunOptions, IParagraphOptions } from 'docx'
import type { RosDocument } from './types'

const BLUE = '3D72B8'
const BLACK = '000000'
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const LINE = (size: number, color: string) => ({ style: BorderStyle.SINGLE, size, color })

const run = (text: string, opts: Partial<IRunOptions> = {}) => new TextRun({ text, color: BLACK, size: 22, ...opts })
const bold = (text: string, opts: Partial<IRunOptions> = {}) => run(text, { bold: true, ...opts })
const labelLine = (label: string, value: string, spacing?: IParagraphOptions['spacing']) =>
  new Paragraph({ spacing, children: [bold(`${label}: `), run(value)] })
const section = (text: string) =>
  new Paragraph({
    keepNext: true,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: BLUE, size: 26 })],
  })
const timeHead = (text: string) =>
  new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text, bold: true, color: BLACK, size: 23 })],
  })
const subHead = (text: string) =>
  new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [bold(text)] })
const bullet = (text: string) =>
  new Paragraph({
    style: 'ListParagraph',
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 20 },
    children: [run(text)],
  })

export interface StampLogo {
  data: Buffer | Uint8Array
  widthPx: number
  heightPx: number
}

/** Scale an image to at most 173px wide (1.8"), keeping aspect ratio. */
function fitLogo(logo: StampLogo): { width: number; height: number } {
  const maxW = 173
  const w = Math.min(maxW, logo.widthPx || maxW)
  const h = logo.heightPx && logo.widthPx ? Math.round((w * logo.heightPx) / logo.widthPx) : 36
  return { width: w, height: Math.max(1, h) }
}

function infoTable(doc: RosDocument, logo?: StampLogo): Table {
  const left = new TableCell({
    width: { size: 6660, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: doc.info.map((i) => labelLine(i.label, i.value)),
  })
  const stampBox = new Table({
    width: { size: 2400, type: WidthType.DXA },
    columnWidths: [2400],
    margins: { left: 10, right: 10 },
    borders: {
      top: LINE(4, 'auto'),
      bottom: LINE(4, 'auto'),
      left: LINE(4, 'auto'),
      right: LINE(4, 'auto'),
      insideHorizontal: LINE(4, 'auto'),
      insideVertical: LINE(4, 'auto'),
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            borders: { top: LINE(6, BLACK), bottom: LINE(6, BLACK), left: LINE(6, BLACK), right: LINE(6, BLACK) },
            margins: { top: 60, bottom: 60, left: 120, right: 60 },
            children: doc.stampBox.map(
              (line, i) => new Paragraph({ children: [new TextRun({ text: line, bold: i === 0, color: BLACK })] })
            ),
          }),
        ],
      }),
    ],
  })
  const rightChildren: (Table | Paragraph)[] = [stampBox]
  if (logo) {
    const { width, height } = fitLogo(logo)
    rightChildren.push(
      new Paragraph({
        spacing: { before: 160 },
        children: [
          new ImageRun({
            type: 'png',
            data: logo.data,
            transformation: { width, height },
            altText: { title: 'Brand logo', description: 'Client brand stamp logo', name: 'Brand logo' },
          }),
        ],
      })
    )
  } else {
    rightChildren.push(new Paragraph({ children: [] }))
  }
  const right = new TableCell({
    width: { size: 2700, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
    margins: { left: 200 },
    children: rightChildren,
  })
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [6660, 2700],
    margins: { left: 10, right: 10 },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({ children: [left, right] })],
  })
}

function breakdownTable(rows: RosDocument['breakdown']): Table {
  const cell = (text: string, isBold: boolean) =>
    new TableCell({
      width: { size: 4680, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100 },
      children: [new Paragraph({ children: [isBold ? bold(text) : run(text)] })],
    })
  const all = [{ item: 'Item', detail: 'Detail' }, ...rows]
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    margins: { left: 10, right: 10 },
    borders: {
      top: LINE(6, BLACK),
      bottom: LINE(6, BLACK),
      left: NONE,
      right: NONE,
      insideVertical: NONE,
      insideHorizontal: LINE(2, 'BFBFBF'),
    },
    rows: all.map((r, i) => new TableRow({ children: [cell(r.item, i === 0), cell(r.detail, i === 0)] })),
  })
}

/** Render a RosDocument to a .docx buffer matching the LJBTC template layout. */
export async function renderRos(doc: RosDocument, logo?: StampLogo): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: 'WINDANSEA COCONUTS — RUN OF SHOW', bold: true, color: BLACK, size: 40 })],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, space: 6, color: BLUE } },
      spacing: { after: 160 },
      children: [new TextRun({ text: doc.header.subtitle, bold: true, color: BLUE, size: 26 })],
    }),
    infoTable(doc, logo),
    new Paragraph({ spacing: { before: 240 }, children: [bold('Entrance & Check-In: '), run(doc.entrance)] }),
  ]
  if (doc.callout) children.push(new Paragraph({ spacing: { before: 240 }, children: [bold(`**${doc.callout}**`)] }))
  if (doc.changes && doc.changes.length) {
    children.push(section('WHAT CHANGED'), ...doc.changes.map(bullet))
  }
  for (const day of doc.days) {
    children.push(section(day.heading))
    for (const b of day.blocks) {
      children.push(timeHead(b.title ? `${b.time} — ${b.title}` : b.time), ...b.bullets.map(bullet))
    }
  }
  if (doc.setTimes && doc.setTimes.length) {
    children.push(section('SET TIMES'))
    for (const s of doc.setTimes) children.push(subHead(s.heading), ...s.bullets.map(bullet))
  }
  children.push(section('COCONUT BREAKDOWN'), breakdownTable(doc.breakdown), section('SUPPLIES'))
  for (const s of doc.supplies) children.push(subHead(s.heading), ...s.bullets.map(bullet))
  children.push(section('CONTACTS'), ...doc.contacts.map((c) => labelLine(c.label, c.value)))
  children.push(
    section('CONFIRM BEFORE EVENT'),
    ...(doc.openItems.length ? doc.openItems.map(bullet) : [bullet('Nothing outstanding')])
  )

  const document = new Document({
    creator: 'Windansea Coconuts',
    title: `Windansea Coconuts — Run of Show — ${doc.header.subtitle}`,
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 22 } } },
      paragraphStyles: [{ id: 'ListParagraph', name: 'List Paragraph', basedOn: 'Normal', quickFormat: true }],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, bottom: 1080, left: 1440, right: 1440, header: 708, footer: 708, gutter: 0 },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBuffer(document)
}
