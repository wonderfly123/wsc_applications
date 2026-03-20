# BEO Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app that renders live Banquet Event Order pages from ClickUp task data, deployed on Vercel.

**Architecture:** Server-rendered dynamic pages fetch ClickUp task data at request time via REST API. Custom fields are parsed by ID into a typed BEOData object, then rendered by a styled BEODocument component. No database — ClickUp is the single source of truth.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, ClickUp REST API, Vitest + React Testing Library

**Spec:** `plan.md` (project root)

---

## File Structure

```
/beo
├── app/
│   ├── layout.tsx              ← Root layout: fonts, metadata, global styles
│   ├── globals.css             ← Tailwind directives + print styles + custom fonts
│   ├── page.tsx                ← Landing page (simple redirect or "not found")
│   └── beo/
│       └── [taskId]/
│           page.tsx            ← Server component: fetch ClickUp task, render BEO
├── components/
│   └── BEODocument.tsx         ← Presentational BEO layout component
├── lib/
│   ├── types.ts                ← BEOData interface + field mapping constants
│   └── clickup.ts              ← fetchTask() + parseCustomFields() helpers
├── __tests__/
│   ├── lib/
│   │   └── clickup.test.ts     ← Tests for API fetch + field parsing
│   └── components/
│       └── BEODocument.test.tsx ← Tests for component rendering
├── .env.local                  ← CLICKUP_API_KEY (gitignored)
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── plan.md                     ← Existing spec
```

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `.env.local`

- [ ] **Step 1: Scaffold Next.js with Tailwind**

```bash
cd /Users/jordan/beo
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias="@/*" --use-npm
```

Accept defaults. This creates the full scaffold in the current directory.

- [ ] **Step 2: Create .env.local**

```bash
echo "CLICKUP_API_KEY=your_clickup_api_key" > .env.local
```

Verify `.env.local` is in `.gitignore` (create-next-app includes it by default).

- [ ] **Step 3: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 5: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify setup**

```bash
npm run dev &
# Verify http://localhost:3000 loads the default Next.js page
kill %1
npm test
# Should run with 0 tests (no test files yet), exit clean
```

- [ ] **Step 7: Initialize git and commit**

```bash
cd /Users/jordan/beo
git init
git add -A
git commit -m "chore: scaffold Next.js 14 app with Tailwind and Vitest"
```

---

### Task 2: Types and Field Mapping Constants

**Files:**
- Create: `lib/types.ts`
- Test: `__tests__/lib/types.test.ts`

- [ ] **Step 1: Write the test for field mapping completeness**

Create `__tests__/lib/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { FIELD_MAP, BEOData } from '@/lib/types'

describe('FIELD_MAP', () => {
  it('maps every BEOData key to a ClickUp field ID', () => {
    const beoKeys: (keyof BEOData)[] = [
      'clientFirstName', 'clientLastName', 'companyName', 'clientEmail',
      'clientPhone', 'eventType', 'serviceStart', 'serviceEnd',
      'eventLocation', 'package', 'coconutQty', 'readyBy', 'garnish',
      'setupProvided', 'stampStatus', 'certsNeeded', 'loadInLocation',
      'deliveryInstructions', 'eventNotes',
    ]
    for (const key of beoKeys) {
      expect(FIELD_MAP[key]).toBeDefined()
      expect(FIELD_MAP[key]).toMatch(/^[0-9a-f-]{36}$/)
    }
  })

  it('has no duplicate field IDs', () => {
    const ids = Object.values(FIELD_MAP)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/types.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types and field mapping**

Create `lib/types.ts`:

```typescript
export interface BEOData {
  clientFirstName: string
  clientLastName: string
  companyName: string
  clientEmail: string
  clientPhone: string
  eventType: string
  serviceStart: string
  serviceEnd: string
  eventLocation: string
  package: string
  coconutQty: string
  readyBy: string
  garnish: string
  setupProvided: string
  stampStatus: string
  certsNeeded: string
  loadInLocation: string
  deliveryInstructions: string
  eventNotes: string
}

export const FIELD_MAP: Record<keyof BEOData, string> = {
  clientFirstName: '6448e40e-5c59-4aeb-b99a-5755536b9463',
  clientLastName: '7ec644ea-814a-4a79-ab52-4a4543466cfb',
  companyName: '75e86982-b682-4c56-86c4-2007b87d89df',
  clientEmail: 'a4316b37-4646-4db8-93d7-c37561d17a77',
  clientPhone: '2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48',
  eventType: 'afb623cf-472e-4d03-b220-bf3b3ce11bc6',
  serviceStart: 'f6483054-1434-4c04-ac53-06af6042a96f',
  serviceEnd: 'c4bcdf67-b72d-4531-953e-5cb542b14a3e',
  eventLocation: 'b92b1e46-363e-4453-9888-b530ecdeefce',
  package: '72edb0f2-022a-4db4-8ec4-88d694cd54b0',
  coconutQty: '3e9943e1-4e51-466b-9d6d-f01e862a1bec',
  readyBy: '54389f19-e059-4418-b842-1b1cd12539ca',
  garnish: 'b9341990-5265-41a1-ba1e-4cbd3c767084',
  setupProvided: '87c25b9c-21b0-4420-8ad9-3d36265d567b',
  stampStatus: '843a7dd5-b277-4429-8240-78515c297a05',
  certsNeeded: 'f459ee0d-aa89-4d9e-aeff-bf714b7728d6',
  loadInLocation: '967038c5-4d18-41d5-8c63-f01bf20ece7a',
  deliveryInstructions: 'b4457a6a-5d84-4505-9e9b-6883303331b3',
  eventNotes: 'd4ac6c86-d0d6-48e2-8958-b0ede74e3456',
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/lib/types.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts __tests__/lib/types.test.ts
git commit -m "feat: add BEOData interface and ClickUp field mapping"
```

---

### Task 3: ClickUp API Helper

**Files:**
- Create: `lib/clickup.ts`
- Test: `__tests__/lib/clickup.test.ts`

- [ ] **Step 1: Write failing tests for fetchTask and parseCustomFields**

Create `__tests__/lib/clickup.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTask, parseCustomFields } from '@/lib/clickup'
import { BEOData } from '@/lib/types'

// Mock ClickUp API response shape
const mockClickUpTask = {
  id: 'abc123',
  name: 'Smith Wedding',
  custom_fields: [
    { id: '6448e40e-5c59-4aeb-b99a-5755536b9463', value: 'Jane' },
    { id: '7ec644ea-814a-4a79-ab52-4a4543466cfb', value: 'Smith' },
    { id: '75e86982-b682-4c56-86c4-2007b87d89df', value: 'Smith Co' },
    { id: 'a4316b37-4646-4db8-93d7-c37561d17a77', value: 'jane@example.com' },
    { id: '2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48', value: '555-1234' },
    { id: 'afb623cf-472e-4d03-b220-bf3b3ce11bc6', type_config: { options: [{ id: '1', name: 'Wedding', orderindex: 1 }] }, value: 1 },
    { id: 'f6483054-1434-4c04-ac53-06af6042a96f', value: '1711900800000' },
    { id: 'c4bcdf67-b72d-4531-953e-5cb542b14a3e', value: '1711915200000' },
    { id: 'b92b1e46-363e-4453-9888-b530ecdeefce', value: 'The Grand Ballroom' },
    { id: '72edb0f2-022a-4db4-8ec4-88d694cd54b0', type_config: { options: [{ id: '2', name: 'Premium', orderindex: 2 }] }, value: 2 },
    { id: '3e9943e1-4e51-466b-9d6d-f01e862a1bec', value: '150' },
    { id: '54389f19-e059-4418-b842-1b1cd12539ca', value: '100' },
    { id: 'b9341990-5265-41a1-ba1e-4cbd3c767084', value: 'Orchid + Umbrella' },
    { id: '87c25b9c-21b0-4420-8ad9-3d36265d567b', value: true },
    { id: '843a7dd5-b277-4429-8240-78515c297a05', type_config: { options: [{ id: '3', name: 'Approved', orderindex: 3 }] }, value: 3 },
    { id: 'f459ee0d-aa89-4d9e-aeff-bf714b7728d6', value: 'Health Dept Permit' },
    { id: '967038c5-4d18-41d5-8c63-f01bf20ece7a', value: 'Loading Dock B' },
    { id: 'b4457a6a-5d84-4505-9e9b-6883303331b3', value: 'Use service entrance' },
    { id: 'd4ac6c86-d0d6-48e2-8958-b0ede74e3456', value: 'Bride is allergic to peanuts' },
  ],
}

describe('parseCustomFields', () => {
  it('extracts all BEO fields from ClickUp custom_fields array', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    expect(data.clientFirstName).toBe('Jane')
    expect(data.clientLastName).toBe('Smith')
    expect(data.companyName).toBe('Smith Co')
    expect(data.clientEmail).toBe('jane@example.com')
    expect(data.eventLocation).toBe('The Grand Ballroom')
    expect(data.deliveryInstructions).toBe('Use service entrance')
    expect(data.eventNotes).toBe('Bride is allergic to peanuts')
  })

  it('returns em dash for missing fields', () => {
    const data = parseCustomFields([])
    expect(data.clientFirstName).toBe('\u2014')
    expect(data.eventNotes).toBe('\u2014')
  })

  it('returns em dash for null/undefined values', () => {
    const fields = [
      { id: '6448e40e-5c59-4aeb-b99a-5755536b9463', value: null },
    ]
    const data = parseCustomFields(fields)
    expect(data.clientFirstName).toBe('\u2014')
  })

  it('resolves dropdown fields to their label name', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    expect(data.eventType).toBe('Wedding')
    expect(data.package).toBe('Premium')
    expect(data.stampStatus).toBe('Approved')
  })

  it('formats boolean fields as Yes/No', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    expect(data.setupProvided).toBe('Yes')
  })

  it('formats date fields as readable strings', () => {
    const data = parseCustomFields(mockClickUpTask.custom_fields)
    // Dates should be human-readable, not raw timestamps
    expect(data.serviceStart).not.toBe('1711900800000')
    expect(data.serviceStart).toContain('2024')
  })
})

describe('fetchTask', () => {
  beforeEach(() => {
    vi.stubEnv('CLICKUP_API_KEY', 'test-api-key')
  })

  it('fetches a task from ClickUp API and returns parsed BEO data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockClickUpTask),
    })

    const result = await fetchTask('abc123')
    expect(result).not.toBeNull()
    expect(result!.clientFirstName).toBe('Jane')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.clickup.com/api/v2/task/abc123?custom_task_ids=false&include_subtasks=false',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'test-api-key',
        }),
      })
    )
  })

  it('returns null when API returns non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await fetchTask('nonexistent')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/clickup.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement clickup.ts**

Create `lib/clickup.ts`:

```typescript
import { BEOData, FIELD_MAP } from './types'

interface ClickUpCustomField {
  id: string
  value: unknown
  type_config?: {
    options?: Array<{ id: string; name: string; orderindex: number }>
  }
}

function resolveFieldValue(field: ClickUpCustomField): string {
  const { value, type_config } = field

  if (value === null || value === undefined || value === '') return '\u2014'

  // Dropdown fields: value is the orderindex number, resolve to option name
  if (type_config?.options && typeof value === 'number') {
    const option = type_config.options.find((o) => o.orderindex === value)
    return option?.name ?? '\u2014'
  }

  // Boolean fields
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  // Date fields (ClickUp stores as epoch ms string or number)
  const numVal = Number(value)
  if (!isNaN(numVal) && numVal > 1_000_000_000_000) {
    return new Date(numVal).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return String(value)
}

export function parseCustomFields(customFields: ClickUpCustomField[]): BEOData {
  const fieldById = new Map(customFields.map((f) => [f.id, f]))

  const result = {} as BEOData
  for (const [key, fieldId] of Object.entries(FIELD_MAP)) {
    const field = fieldById.get(fieldId)
    result[key as keyof BEOData] = field ? resolveFieldValue(field) : '\u2014'
  }
  return result
}

export async function fetchTask(taskId: string): Promise<BEOData | null> {
  const apiKey = process.env.CLICKUP_API_KEY
  if (!apiKey) throw new Error('CLICKUP_API_KEY not set')

  const res = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}?custom_task_ids=false&include_subtasks=false`,
    {
      headers: { Authorization: apiKey },
      next: { revalidate: 0 },
    }
  )

  if (!res.ok) return null

  const task = await res.json()
  return parseCustomFields(task.custom_fields ?? [])
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/lib/clickup.test.ts
```
Expected: PASS. If dropdown resolution fails, check that the mock uses `orderindex` matching (ClickUp dropdowns use orderindex, not id, as the stored value).

- [ ] **Step 5: Commit**

```bash
git add lib/clickup.ts __tests__/lib/clickup.test.ts
git commit -m "feat: add ClickUp API fetch and custom field parser"
```

---

### Task 4: BEODocument Component

**Files:**
- Create: `components/BEODocument.tsx`
- Test: `__tests__/components/BEODocument.test.tsx`
- Reference: `beo_template.html` (the exact HTML template to replicate)

- [ ] **Step 1: Write failing test for BEODocument**

Create `__tests__/components/BEODocument.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BEODocument } from '@/components/BEODocument'
import { BEOData } from '@/lib/types'

const sampleData: BEOData = {
  clientFirstName: 'Jane',
  clientLastName: 'Smith',
  companyName: 'Smith Co',
  clientEmail: 'jane@example.com',
  clientPhone: '555-1234',
  eventType: 'Wedding',
  serviceStart: 'Mar 31, 2024, 12:00 PM',
  serviceEnd: 'Mar 31, 2024, 4:00 PM',
  eventLocation: 'The Grand Ballroom',
  package: 'Premium',
  coconutQty: '150',
  readyBy: '100',
  garnish: 'Orchid + Umbrella',
  setupProvided: 'Yes',
  stampStatus: 'Approved',
  certsNeeded: 'Health Dept Permit',
  loadInLocation: 'Loading Dock B',
  deliveryInstructions: 'Use service entrance',
  eventNotes: 'Bride is allergic to peanuts',
}

describe('BEODocument', () => {
  it('renders the header with brand name', () => {
    render(<BEODocument data={sampleData} />)
    expect(screen.getByText('Windansea Coconuts')).toBeDefined()
    expect(screen.getByText('Banquet Event Order')).toBeDefined()
  })

  it('renders client information section', () => {
    render(<BEODocument data={sampleData} />)
    expect(screen.getByText('Jane')).toBeDefined()
    expect(screen.getByText('Smith')).toBeDefined()
    expect(screen.getByText('Smith Co')).toBeDefined()
    expect(screen.getByText('555-1234')).toBeDefined()
    expect(screen.getByText('jane@example.com')).toBeDefined()
  })

  it('renders event details section', () => {
    render(<BEODocument data={sampleData} />)
    expect(screen.getByText('Wedding')).toBeDefined()
    expect(screen.getByText('The Grand Ballroom')).toBeDefined()
    expect(screen.getByText('Mar 31, 2024, 12:00 PM')).toBeDefined()
    expect(screen.getByText('Mar 31, 2024, 4:00 PM')).toBeDefined()
  })

  it('renders service and package section', () => {
    render(<BEODocument data={sampleData} />)
    expect(screen.getByText('Premium')).toBeDefined()
    expect(screen.getByText('Orchid + Umbrella')).toBeDefined()
    expect(screen.getByText('150')).toBeDefined()
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('Yes')).toBeDefined()
    expect(screen.getByText('Approved')).toBeDefined()
    expect(screen.getByText('Health Dept Permit')).toBeDefined()
  })

  it('renders logistics section', () => {
    render(<BEODocument data={sampleData} />)
    expect(screen.getByText('Loading Dock B')).toBeDefined()
    expect(screen.getByText('Use service entrance')).toBeDefined()
  })

  it('renders event notes', () => {
    render(<BEODocument data={sampleData} />)
    expect(screen.getByText('Bride is allergic to peanuts')).toBeDefined()
  })

  it('renders footer with three separate items', () => {
    render(<BEODocument data={sampleData} />)
    expect(screen.getByText('windanseacoconuts.com')).toBeDefined()
    expect(screen.getByText('hello@windanseacoconuts.com')).toBeDefined()
    expect(screen.getByText('Confidential')).toBeDefined()
  })

  it('renders em dashes for missing data', () => {
    const emptyData: BEOData = Object.fromEntries(
      Object.keys(sampleData).map((k) => [k, '\u2014'])
    ) as BEOData
    render(<BEODocument data={emptyData} />)
    const dashes = screen.getAllByText('\u2014')
    expect(dashes.length).toBeGreaterThanOrEqual(19)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/components/BEODocument.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement BEODocument component**

Create `components/BEODocument.tsx`. This matches the exact layout from `beo_template.html`:
- Header: left-aligned, `#878774` background, `padding: 40px 56px 34px`
- Fields: outer `border: 1px solid #d8d5cc`, vertical dividers between fields in a row
- Section titles: `::after` pseudo-element for the horizontal line (Tailwind `after:` variant)
- Footer: three separate spans with `justify-between`
- Padding: `56px` horizontal throughout (Tailwind `px-14` = 56px)
- Field padding: `16px 20px` (Tailwind `px-5 py-4`)

```tsx
import { BEOData } from '@/lib/types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-9">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#878774] font-[family-name:var(--font-jost)] whitespace-nowrap">
          {title}
        </span>
        <span className="flex-1 h-px bg-[#e0ddd4]" />
      </div>
      <div className="border border-[#d8d5cc]">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex${last ? '' : ' border-b border-[#d8d5cc]'}`}>
      {children}
    </div>
  )
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex-1 px-5 py-4 min-w-0${last ? '' : ' border-r border-[#d8d5cc]'}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9a9890] font-[family-name:var(--font-jost)] mb-[7px]">
        {label}
      </div>
      <div className="font-[family-name:var(--font-cormorant)] font-normal text-[17px] text-[#1e1d1a] leading-[1.35] min-h-[24px]">
        {value}
      </div>
    </div>
  )
}

function FullWidthField({ label, value, notes }: { label: string; value: string; notes?: boolean }) {
  return (
    <div className="flex">
      <div className="flex-1 px-5 py-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9a9890] font-[family-name:var(--font-jost)] mb-[7px]">
          {label}
        </div>
        <div className={`font-[family-name:var(--font-cormorant)] font-normal text-[17px] text-[#1e1d1a] leading-[1.35] whitespace-pre-wrap${notes ? ' min-h-[64px]' : ' min-h-[24px]'}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

export function BEODocument({ data }: { data: BEOData }) {
  return (
    <div className="w-[820px] min-h-[1060px] mx-auto bg-white shadow-[0_6px_48px_rgba(0,0,0,0.10)] my-10 print:w-full print:my-0 print:shadow-none">
      {/* Header */}
      <div className="bg-[#878774] pt-10 pb-[34px] px-14">
        <h1 className="font-[family-name:var(--font-cormorant)] font-light text-[34px] text-white tracking-[0.03em] leading-none">
          Windansea Coconuts
        </h1>
        <p className="text-[10px] font-normal tracking-[0.2em] text-white/55 mt-[7px] uppercase font-[family-name:var(--font-jost)]">
          Banquet Event Order
        </p>
      </div>

      <div className="px-14 pb-12">
        {/* Client Information */}
        <Section title="Client Information">
          <FieldRow>
            <Field label="First Name" value={data.clientFirstName} />
            <Field label="Last Name" value={data.clientLastName} last />
          </FieldRow>
          <FieldRow>
            <Field label="Company" value={data.companyName} />
            <Field label="Phone" value={data.clientPhone} last />
          </FieldRow>
          <FieldRow last>
            <FullWidthField label="Email" value={data.clientEmail} />
          </FieldRow>
        </Section>

        {/* Event Details */}
        <Section title="Event Details">
          <FieldRow>
            <Field label="Event Type" value={data.eventType} />
            <Field label="Headcount" value={'\u2014'} last />
          </FieldRow>
          <FieldRow>
            <Field label="Service Start" value={data.serviceStart} />
            <Field label="Service End" value={data.serviceEnd} last />
          </FieldRow>
          <FieldRow last>
            <FullWidthField label="Event Location" value={data.eventLocation} />
          </FieldRow>
        </Section>

        {/* Service & Package */}
        <Section title="Service &amp; Package">
          <FieldRow>
            <Field label="Package" value={data.package} />
            <Field label="Garnish" value={data.garnish} last />
          </FieldRow>
          <FieldRow>
            <Field label="Coconut Qty" value={data.coconutQty} />
            <Field label="Ready By Time of Service" value={data.readyBy} last />
          </FieldRow>
          <FieldRow>
            <Field label="Setup Provided by Client" value={data.setupProvided} />
            <Field label="Stamp Status" value={data.stampStatus} last />
          </FieldRow>
          <FieldRow last>
            <FullWidthField label="Certifications Needed" value={data.certsNeeded} />
          </FieldRow>
        </Section>

        {/* Logistics */}
        <Section title="Logistics">
          <FieldRow last>
            <Field label="Load-in Location" value={data.loadInLocation} />
            <Field label="Delivery Instructions" value={data.deliveryInstructions} last />
          </FieldRow>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <FieldRow last>
            <FullWidthField label="Event Notes" value={data.eventNotes} notes />
          </FieldRow>
        </Section>
      </div>

      {/* Footer */}
      <div className="mx-14 py-[18px] border-t border-[#e0ddd4] flex justify-between items-center">
        <span className="text-[10px] tracking-[0.1em] text-[#aaa9a4] font-[family-name:var(--font-jost)]">windanseacoconuts.com</span>
        <span className="text-[10px] tracking-[0.1em] text-[#aaa9a4] font-[family-name:var(--font-jost)]">hello@windanseacoconuts.com</span>
        <span className="text-[10px] tracking-[0.1em] text-[#aaa9a4] font-[family-name:var(--font-jost)]">Confidential</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/components/BEODocument.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/BEODocument.tsx __tests__/components/BEODocument.test.tsx
git commit -m "feat: add BEODocument presentational component"
```

---

### Task 5: Layout with Google Fonts

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update layout.tsx with Google Fonts and metadata**

Replace the contents of `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-jost',
})

export const metadata: Metadata = {
  title: 'Windansea Coconuts — BEO',
  description: 'Banquet Event Order',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`}>
      <body className="bg-[#f0ede4] font-light text-[#1e1d1a] antialiased print:bg-white">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Update globals.css**

Replace `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

- [ ] **Step 3: Verify fonts load**

```bash
npm run dev &
# Open http://localhost:3000 — page should load without console errors
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: configure layout with Cormorant Garamond and Jost fonts"
```

---

### Task 6: Dynamic BEO Page Route

**Files:**
- Create: `app/beo/[taskId]/page.tsx`

- [ ] **Step 1: Create the server-rendered BEO page**

Create `app/beo/[taskId]/page.tsx`:

```tsx
import { fetchTask } from '@/lib/clickup'
import { BEODocument } from '@/components/BEODocument'

export const dynamic = 'force-dynamic'

export default async function BEOPage({
  params,
}: {
  params: { taskId: string }
}) {
  const data = await fetchTask(params.taskId)

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#878774] font-[family-name:var(--font-jost)]">
        <div className="text-center">
          <h1 className="text-2xl mb-2">BEO Not Found</h1>
          <p className="text-sm text-[#9a9890]">
            This event order could not be located.
          </p>
        </div>
      </div>
    )
  }

  return <BEODocument data={data} />
}
```

- [ ] **Step 2: Create landing page**

Replace `app/page.tsx`:

```tsx
export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center text-[#878774] font-[family-name:var(--font-jost)]">
      <p className="text-sm">Windansea Coconuts</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual smoke test (if ClickUp API key is set)**

```bash
# Set your real API key in .env.local, then:
npm run dev
# Open http://localhost:3000/beo/<real-task-id>
# Verify BEO renders with real data
```

- [ ] **Step 5: Commit**

```bash
git add app/beo app/page.tsx
git commit -m "feat: add dynamic BEO page route and landing page"
```

---

### Task 7: Final Verification and Deploy Prep

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 2: Run production build**

```bash
npm run build
```
Expected: Build succeeds, no TypeScript errors, no warnings.

- [ ] **Step 3: Final commit**

```bash
git add -A
git status
# Only commit if there are uncommitted changes
git commit -m "chore: final cleanup for deployment"
```

- [ ] **Step 4: Push to GitHub**

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

Then in Vercel: Import repo → Add `CLICKUP_API_KEY` env var → Deploy.
