// Builds the Palm Tree Music Festival Montecito Run of Show for Windansea Coconuts,
// matching the formatting of the LJBTC End of Summer Luau ROS template.
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  BorderStyle, WidthType, LevelFormat, AlignmentType,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType,
} = require('docx')

const BLUE = '3D72B8'
const BLACK = '000000'
const logoPath = path.join(__dirname, '..', 'inputs', 'clickup', 'olukai_logo.png')
const outDir = path.join(__dirname, 'out')
const outPath = path.join(outDir, 'Palm_Tree_Montecito_ROS_Oct10-11.docx')

// ---------- helpers that mirror the template's run/paragraph formatting ----------
const run = (text, opts = {}) => new TextRun({ text, color: BLACK, size: 22, ...opts })
const bold = (text, opts = {}) => run(text, { bold: true, ...opts })

// "Label: value" line, 11pt, bold label
const labelLine = (label, value, pOpts = {}) =>
  new Paragraph({ ...pOpts, children: [bold(`${label}: `), run(value)] })

// Blue 13pt section header (EVENT DAY, COCONUT BREAKDOWN, SUPPLIES, CONTACTS)
const section = (text) =>
  new Paragraph({
    keepNext: true,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: BLUE, size: 26 })],
  })

// Black 11.5pt time header ("12:45 PM — Warehouse Pickup")
const timeHead = (text) =>
  new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text, bold: true, color: BLACK, size: 23 })],
  })

// Bold 11pt sub-header (SUPPLIES > Delivery)
const subHead = (text) =>
  new Paragraph({
    keepNext: true,
    spacing: { before: 120, after: 40 },
    children: [bold(text)],
  })

// Bullet. Accepts a string or an array of TextRuns.
const bullet = (content) =>
  new Paragraph({
    style: 'ListParagraph',
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 20 },
    children: typeof content === 'string' ? [run(content)] : content,
  })

const bullets = (items) => items.map(bullet)

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }
const LINE = (size, color) => ({ style: BorderStyle.SINGLE, size, color })

// ---------- header ----------
const logoData = fs.readFileSync(logoPath)
// OluKai logo is 1215x251 px. Render 1.8" wide -> 173 x 36 px (96 dpi units),
// inline under the stamp box so it can never overlap the info text on the left.
const inlineLogo = new ImageRun({
  type: 'png',
  data: logoData,
  transformation: { width: 173, height: 36 },
  altText: { title: 'OluKai logo', description: 'OluKai horizontal navy logo', name: 'OluKai logo' },
})

const title = new Paragraph({
  children: [new TextRun({ text: 'WINDANSEA COCONUTS — RUN OF SHOW', bold: true, color: BLACK, size: 40 })],
})

const subtitle = new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, space: 6, color: BLUE } },
  spacing: { after: 160 },
  children: [
    new TextRun({ text: 'OluKai | Palm Tree Music Festival Montecito — Villa Activation', bold: true, color: BLUE, size: 26 }),
  ],
})

// ---------- info block (borderless 2-col table, nested stamp box on the right) ----------
const infoLeft = new TableCell({
  width: { size: 6660, type: WidthType.DXA },
  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  children: [
    labelLine('Dates', 'Saturday, October 10 & Sunday, October 11, 2026 (load-in Friday, October 9)'),
    labelLine('Service', '3:00 PM – 10:00 PM both days, ready by 2:30 PM (doors 3:00 PM)'),
    labelLine('Location', 'Santa Barbara Polo & Racquet Club, 3300 Via Real, Carpinteria, CA 93013'),
    labelLine('Service Spot', "OluKai sponsor footprint, 20' x 10', on the east fence line of the GA field next to the Crazy Mountain booth, between Staff Check-In and Club Check-In (site map on the ClickUp task)"),
    labelLine('Day-Of Contact', 'RJ Gonzalez, OluKai, 714-916-6782'),
    labelLine('Festival Ops', 'Oliver Fernandez 661-406-9162 · Jessica Tranter 646-509-4549'),
    labelLine('Total Coconuts', '750 across both days'),
    labelLine('Garnish', 'Sapphire blue orchids (custom, ordered)'),
    labelLine('Headcount', '2,500'),
  ],
})

const stampBox = new Table({
  width: { size: 2400, type: WidthType.DXA },
  columnWidths: [2400],
  margins: { left: 10, right: 10 },
  borders: { top: LINE(4, 'auto'), bottom: LINE(4, 'auto'), left: LINE(4, 'auto'), right: LINE(4, 'auto'), insideHorizontal: LINE(4, 'auto'), insideVertical: LINE(4, 'auto') },
  rows: [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 2400, type: WidthType.DXA },
          borders: { top: LINE(6, BLACK), bottom: LINE(6, BLACK), left: LINE(6, BLACK), right: LINE(6, BLACK) },
          margins: { top: 60, bottom: 60, left: 120, right: 60 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Brand Stamp Logo', bold: true, color: BLACK })] }),
            new Paragraph({ children: [new TextRun({ text: 'OluKai horizontal navy', color: BLACK })] }),
            new Paragraph({ children: [new TextRun({ text: 'Logo on file in ClickUp', color: BLACK })] }),
            new Paragraph({ children: [new TextRun({ text: 'Stamp status: ordered', color: BLACK })] }),
          ],
        }),
      ],
    }),
  ],
})

const infoRight = new TableCell({
  width: { size: 2700, type: WidthType.DXA },
  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
  margins: { left: 200 },
  children: [stampBox, new Paragraph({ spacing: { before: 160 }, children: [inlineLogo] })],
})

const infoTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [6660, 2700],
  margins: { left: 10, right: 10 },
  borders: noBorders,
  rows: [new TableRow({ children: [infoLeft, infoRight] })],
})

// ---------- entrance & callout ----------
const entrance = new Paragraph({
  spacing: { before: 240 },
  children: [
    bold('Entrance & Check-In: '),
    run(
      'Load-in (Friday) goes through the Main Entrance on Via Real only. Check in with Marshalling staff at the main entrance for a load-in parking pass, then you will be sent to Field 3. ' +
      'On show days (Sat & Sun) every staff vehicle, 12-passenger van or smaller, must use the Field 3 entrance at 3355 Via Real, the turn-off just before the main entrance. The main entrance is trucks and large vehicles only on show days. ' +
      'Walk the perimeter walkways to the footprint. Do not cut across the polo fields. Drive slowly, there are horses on the grounds. Call RJ with your ETA.'
    ),
  ],
})

const callout = new Paragraph({
  spacing: { before: 240 },
  children: [
    bold('**DAY-OF-SHOW (DOS) STAFF CREDENTIALS AND PARKING PASSES MUST BE PICKED UP AT THE BOX OFFICE BEFORE SATURDAY. LOAD-IN CREDS DO NOT GET YOU IN ON OCT 10 OR 11. WEAR CREDS AT ALL TIMES AND BRING A GOVERNMENT PHOTO ID.**'),
  ],
})

// ---------- timeline ----------
const timeline = [
  section('PRE-EVENT — FRIDAY, OCTOBER 9 (LOAD-IN DAY)'),

  timeHead('Time TBD — Warehouse Load'),
  ...bullets([
    'Load 750 stamped coconuts, orchids, straws, napkins, cart, coolers and the supplies listed below',
    'Warehouse: 9040 Kenamar Dr, Unit 403, San Diego',
    'San Diego to Carpinteria is roughly 3.5 to 4 hours without traffic. Plan the departure and Friday night lodging around that',
  ]),

  timeHead('10:00 AM – 3:00 PM — Credentials & Parking Passes'),
  ...bullets([
    'Box Office at the main festival patron entrance, 3300 Via Real. Primary point of contact picks up DOS staff credentials and DOS parking passes for the whole team',
    'Missed Friday? Saturday pickup is 7:00 AM – 4:00 PM at the Box Office. Contact Sponsorship Ops in advance if your first arrival is a show day',
    'Credential name changes closed in Lennd on Wed, Oct 7. Placeholder names were not printed. Any credential issue goes to Oliver directly',
  ]),

  timeHead('Friday — Walk the Footprint'),
  ...bullets([
    'Check in with Marshalling at the Main Entrance for a load-in parking pass, park in Field 3 (staff parking 7:00 AM – 6:00 PM)',
    "Find the OluKai 20' x 10' footprint on the site map and meet RJ. He is on site Friday and will give final load-in direction",
    'Drop heavy items (cart, coolers, signage) Friday if our Lennd advance has a load-in slot. Load-in vehicles follow the Lennd advance, which is closed',
  ]),

  section('EVENT DAY 1 — SATURDAY, OCTOBER 10'),

  timeHead('11:30 AM — Arrive & Load In'),
  ...bullets([
    'Field 3 entrance, 3355 Via Real. DOS credentials on, parking pass visible on the dash',
    'Call RJ on arrival, then move everything to the footprint along the perimeter walkways',
  ]),

  timeHead('12:00 PM — Set Up the Villa Footprint'),
  ...bullets([
    "Cart, signage, decor and coolers inside the 20' x 10'. Anchor anything freestanding, the site is a natural grass field",
    'OluKai is capturing email sign-ups by QR code. Set the QR signage at the front of the line so guests scan before they get a coconut',
    'Ice the coolers and stage the first 50 coconuts',
  ]),

  timeHead('2:30 PM — Service Ready'),
  ...bullets([
    '50 coconuts opened and garnished with orchids before doors, the rest open on demand',
    'Team briefed on the scan-first flow. No alcohol on duty, no cannabis, no drones, stay within festival-designated areas',
  ]),

  timeHead('3:00 PM — Doors / Service Begins'),
  ...bullets([
    'Serve through 10:00 PM. Pace to roughly 375 coconuts for the day',
    'Expect a rush before each set change. Biggest crowds ahead of The Chainsmokers (6:50 PM) and Zedd (8:35 PM)',
    'Grab photos and video for socials, golden hour is the best window',
  ]),

  timeHead('10:00 PM — Service Ends'),
  ...bullets([
    'Break down service items, count remaining coconuts and orchids for Sunday',
    'Bag all trash from the footprint. Secure the cart and coolers overnight',
  ]),

  section('EVENT DAY 2 — SUNDAY, OCTOBER 11'),

  timeHead('12:00 PM — Arrive & Reset'),
  ...bullets([
    'Field 3 entrance again, DOS credentials and parking pass. Re-ice, restage, restock orchids, straws and napkins',
  ]),

  timeHead('2:30 PM — Service Ready'),
  ...bullets(['50 coconuts opened and garnished before doors']),

  timeHead('3:00 PM — Doors / Service Begins'),
  ...bullets([
    'Serve through 10:00 PM with the remaining coconuts. Biggest crowds ahead of Kygo (7:00 PM) and T-Pain (8:50 PM)',
  ]),

  timeHead('10:00 PM — Service Ends'),
  ...bullets([
    'Full breakdown of service items. Pack everything that can leave Sunday night',
    'Remove all trash and debris from the footprint. Nothing may be left on site',
  ]),

  section('LOAD OUT — MONDAY, OCTOBER 12'),

  timeHead('8:00 AM — Strike'),
  ...bullets([
    'Load out anytime after 8:00 AM, no scheduling needed. Final sweep of the footprint, then return to the warehouse',
  ]),

  timeHead('Post Event'),
  ...bullets([
    'Add hours to the 2026 Timesheet',
    'Confirm final payment received, follow up on invoice if not',
    'Send RJ event photos and the email sign-up count if we have it',
  ]),
]

// ---------- set times ----------
const setTimes = [
  section('SET TIMES (DOORS 3:00 PM BOTH DAYS, SUBJECT TO CHANGE)'),
  subHead('Saturday, October 10'),
  ...bullets([
    'Gagevuu 3:00–3:40 · Toon 3:40–4:15 · Natalie Jinju 4:20–5:00',
    'All American Rejects 5:30–6:30 · The Chainsmokers 6:50–8:20 · Zedd 8:35–9:50',
  ]),
  subHead('Sunday, October 11'),
  ...bullets([
    'Razi Mars 3:00–3:30 · Izy 3:30–4:05 · Myles O’Neal 4:05–4:50 · Frank Walker 4:50–5:35',
    'Loud Luxury 5:40–6:40 · Kygo 7:00–8:30 · T-Pain 8:50–9:50',
  ]),
]

// ---------- coconut breakdown ----------
const cell = (text, isBold = false) =>
  new TableCell({
    width: { size: 4680, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100 },
    children: [new Paragraph({ children: [isBold ? bold(text) : run(text)] })],
  })

const breakdownRows = [
  ['Item', 'Detail'],
  ['Total coconuts', '750 (about 375 per day, split to be confirmed)'],
  ['Opened by start of service', '50 opened on site before doors each day, remainder opened on demand'],
  ['Opened before transport', '0'],
  ['Garnish', 'Sapphire blue orchids (custom, ordered)'],
  ['Package', 'Villa: delivery, live service, premium brand activation'],
  ['Headcount', '2,500 across both days'],
  ['Brand stamp', 'OluKai horizontal navy. Stamp ordered, confirm it is en route or ready before Friday'],
  ['Setup provided', 'No. Windansea brings the full footprint'],
  ['Certifications', 'COI and TMM sent by Harrison'],
]

const breakdownTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [4680, 4680],
  margins: { left: 10, right: 10 },
  borders: {
    top: LINE(6, BLACK), bottom: LINE(6, BLACK),
    left: NONE, right: NONE, insideVertical: NONE,
    insideHorizontal: LINE(2, 'BFBFBF'),
  },
  rows: breakdownRows.map((r, i) => new TableRow({ children: [cell(r[0], i === 0), cell(r[1], i === 0)] })),
})

// ---------- supplies ----------
const supplies = [
  section('SUPPLIES'),
  subHead('Coconuts & Service'),
  ...bullets([
    '750 coconuts, stamped OluKai before transport',
    'Sapphire blue orchids, 750+ (ordered)',
    'Straws, 750+',
    'Napkins, 750+',
  ]),
  subHead('Tools'),
  ...bullets([
    'Coconut openers and mallets, knives and wooden cutting board, opening station, scraper',
    'Coolers for roughly 375 coconuts per day, plus ice (source to be confirmed)',
    'Drain buckets and strainers',
  ]),
  subHead('Display & Setup'),
  ...bullets([
    'Villa cart with Windansea decal, umbrella, Windansea signage',
    'OluKai signage and QR sign-up sign (confirm whether client supplies or we print)',
    "Stakes, sandbags or weights to anchor the tent, umbrella and signage on grass",
    "Tent or shade for the 20' x 10' footprint, if we are providing it",
  ]),
  subHead('Cleaning & Safety'),
  ...bullets([
    'Food-safe sanitizer spray, bar towels and paper towels, nitrile gloves',
    'Floor mat or splash guard, heavy-duty trash bags, hand sanitizer pump, first aid kit',
  ]),
  subHead('Team'),
  ...bullets([
    'Aprons, sunscreen, reusable water bottles, light rain jacket, closed-toe outdoor footwear',
    'Government photo ID and DOS credential for every staffer, worn at all times on site',
  ]),
]

// ---------- contacts ----------
const contacts = [
  section('CONTACTS'),
  labelLine('Client', 'RJ Gonzalez, OluKai, 714-916-6782, rgonzalez@olukai.com'),
  labelLine('Festival Sponsorship Ops', 'Oliver Fernandez, Palm Tree Crew, 661-406-9162, oliver@palmtreecrew.com (credential and load-in changes)'),
  labelLine('Festival Sponsorship Ops', 'Jessica Tranter, Palm Tree Crew, 646-509-4549, jessica@palmtreecrew.com'),
  labelLine('Windansea', 'Trent LiVolsi, 732-575-5774'),
  labelLine('Live BEO', 'https://windansea.vercel.app/beo/86bc8ujw9'),
]

// ---------- open items ----------
const openItems = [
  section('CONFIRM BEFORE FRIDAY'),
  ...bullets([
    'Staff count and call times for both days',
    'Lodging Friday and Saturday nights',
    'Whether our Lennd advance includes a Friday load-in slot and vehicle arrival time',
    'Ice source each day (warehouse vs. on site) and power needs at the footprint',
    'Tent or shade for the footprint and overnight storage or security for the cart',
    'Whether Sunday-night strike is allowed, otherwise Monday after 8:00 AM',
    'Brand stamp arrival, coconuts stamped before Friday load',
    'Who is primary point of contact for credential pickup, and that every name is on the credential list',
    'Coconut split per day (750 total)',
  ]),
]

// ---------- document ----------
const doc = new Document({
  creator: 'Windansea Coconuts',
  title: 'Windansea Coconuts — Run of Show — OluKai | Palm Tree Music Festival Montecito',
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
      children: [
        title,
        subtitle,
        infoTable,
        entrance,
        callout,
        ...timeline,
        ...setTimes,
        section('COCONUT BREAKDOWN'),
        breakdownTable,
        ...supplies,
        ...contacts,
        ...openItems,
      ],
    },
  ],
})

fs.mkdirSync(outDir, { recursive: true })
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf)
  console.log('wrote', outPath, buf.length, 'bytes')
})
