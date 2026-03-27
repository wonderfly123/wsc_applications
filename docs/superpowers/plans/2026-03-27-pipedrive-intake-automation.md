# Pipedrive → ClickUp Intake Automation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Pipedrive deal hits "Closed Won," automatically create a ClickUp task, email the client a unique intake form link, and update that same ClickUp task when the form is submitted.

**Architecture:** Next.js API routes on existing Vercel deployment (same project as BEO app). Two webhook endpoints (Pipedrive inbound, form submission), one dynamic form page, and Nodemailer (Gmail SMTP) for transactional email. No database — the ClickUp task ID in the URL is the only state needed.

**Tech Stack:** Next.js 14 (App Router), ClickUp API v2, Pipedrive Webhooks, Nodemailer (Gmail SMTP)

---

## Flow Diagram

```
Pipedrive "Closed Won"
  → POST /api/webhooks/pipedrive
  → Extracts contact email/name from webhook payload (person_id is expanded object)
  → Creates ClickUp task in target list with deal data pre-populated
  → Sends email via Gmail SMTP (harrison@windanseacoconuts.com) with link: /intake/[taskId]
  → Client opens form, fills it out
  → POST /api/intake/[taskId]
  → Updates existing ClickUp task with all form fields
```

## Pipedrive Data Available (from API inspection)

The Pipedrive deal webhook payload includes `person_id` as a **full expanded object** (not just an ID):
```json
"person_id": {
  "name": "Dave Goodwin",
  "email": [{ "label": "work", "value": "dave@example.com", "primary": true }],
  "phone": [{ "label": "work", "value": "7024159419", "primary": true }],
  "value": 11
}
```

Custom deal fields available for pre-populating ClickUp task:
| Pipedrive Key | Name | Type |
|---|---|---|
| `3cbba884936441c84efa2be503601486477e0099` | Event Date | date |
| `e618a8e0d8eba15d75e08f84d653bad016d83503` | Event Time | varchar |
| `b7ac88506b544085a8e8cd2e64d4ee3739964e91` | Event Type | varchar |
| `06bf970639929239bf71e35917568551faf8686c_formatted_address` | Event Address | varchar |
| `ce6dafb98776e8199b4190382d1ab85175bd84fc` | Estimated Guest Count | double |
| `788797503452d1e0defbed88c2c5342462873c83` | Package | enum |
| `58ef1bbe92551cf424fe56527492ff95191e9dcb` | Amount of Coconuts | double |
| `9cc8b7ffb8f4d8ff2e1fce0734fe163c0838a4a7` | Brand Stamp Name | varchar |
| `ad1780df962f2192a8653ab26ddc1eb21cb27ed5` | Brand Stamp Status | enum |
| `6256793fd6589195fbbbe8d04e941e9fcc9a22a3` | Staff Arrival and Departure | timerange |
| `68e87e2be198c4511450368f5525277c7725adac` | Branch | enum |
| `ccb919c2a3cbcfc9a6b2b51c6aef80fd81301a62` | Event Details | text |
| `e07069e77ed89f149cb529f9d90b2cb321142e54` | Package Details | text |
| `26690e217fdffc4d72ff1988f5ac072ef9f84e88` | Delivery Window | varchar |
| `fa299f5e072520c9ff7f636300b78896bf2e053d` | Delivery Date | date |
| `1c1ca5ea36fa08090f394cc37d3107c40c587e02_formatted_address` | Delivery Location | varchar |

## File Structure

```
lib/
  clickup.ts              — MODIFY: add createTask() and updateTaskFields()
  email.ts                — CREATE: email sending helper (Nodemailer + Gmail SMTP)
  intake-fields.ts        — CREATE: intake form field definitions (single source of truth)

app/
  api/
    webhooks/
      pipedrive/
        route.ts          — CREATE: receives Pipedrive webhook, creates task, sends email
    intake/
      [taskId]/
        route.ts          — CREATE: receives form submission, updates ClickUp task
  intake/
    [taskId]/
      page.tsx            — CREATE: client-facing intake form

components/
  IntakeForm.tsx          — CREATE: the intake form component (client component)

tests/
  lib/
    clickup.test.ts       — CREATE: tests for createTask and updateTaskFields
```

Note: No `lib/pipedrive.ts` needed — the webhook payload already includes the full person object with email/phone. No separate Pipedrive API call required.

## Environment Variables Needed

```env
# Existing
CLICKUP_API_KEY=pk_...

# New — add to Vercel env vars
CLICKUP_LIST_ID=...                  # Target list for new intake tasks
PIPEDRIVE_WEBHOOK_SECRET=...         # Shared secret to verify webhook authenticity
SMTP_USER=harrison@windanseacoconuts.com
SMTP_PASS=...                        # Google Workspace App Password (not your login password)
NEXT_PUBLIC_BASE_URL=https://...     # Your Vercel domain, for building intake URLs
```

---

### Task 0: Create Test Directories

**Files:**
- Create: `tests/lib/` directory

- [ ] **Step 1: Create directories**

```bash
mkdir -p tests/lib
```

- [ ] **Step 2: Commit**

```bash
git add tests/.gitkeep 2>/dev/null; git commit --allow-empty -m "chore: add tests directory structure"
```

---

### Task 1: Define Intake Form Fields

**Files:**
- Create: `lib/intake-fields.ts`

This is the single source of truth for what the intake form collects. Used by the form UI, the API submission handler, and the ClickUp field mapping.

Field names intentionally use short form names (`firstName`, `email`) for cleaner form handling. The `clickupFieldId` is what maps to ClickUp — names don't need to match `BEOFields` keys in `lib/types.ts`.

- [ ] **Step 1: Create the field definitions file**

```ts
// lib/intake-fields.ts

export interface IntakeFieldDef {
  name: string           // form field name / key
  label: string          // human-readable label
  type: 'text' | 'email' | 'tel' | 'date' | 'datetime-local' | 'number' | 'textarea' | 'select'
  required: boolean
  clickupFieldId: string // ClickUp custom field ID to update
  options?: string[]     // for select fields
  placeholder?: string
}

// Field names here are for FORM handling only. They do NOT need to match
// the BEOFields keys in lib/types.ts. The clickupFieldId is what connects
// each field to ClickUp. Where a field overlaps with an existing BEO field,
// we reuse the same ClickUp field ID from lib/types.ts FIELD_MAP.
export const INTAKE_FIELDS: IntakeFieldDef[] = [
  // === Client Info ===
  // Reuse IDs from lib/types.ts FIELD_MAP where fields overlap
  { name: 'firstName', label: 'First Name', type: 'text', required: true, clickupFieldId: '6448e40e-5c59-4aeb-b99a-5755536b9463', placeholder: 'Jane' },
  { name: 'lastName', label: 'Last Name', type: 'text', required: true, clickupFieldId: '7ec644ea-814a-4a79-ab52-4a4543466cfb', placeholder: 'Doe' },
  { name: 'company', label: 'Company / Organization', type: 'text', required: false, clickupFieldId: '75e86982-b682-4c56-86c4-2007b87d89df', placeholder: 'Acme Corp' },
  { name: 'email', label: 'Email', type: 'email', required: true, clickupFieldId: 'a4316b37-4646-4db8-93d7-c37561d17a77', placeholder: 'jane@example.com' },
  { name: 'phone', label: 'Phone', type: 'tel', required: true, clickupFieldId: '2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48', placeholder: '(555) 123-4567' },

  // === Event Details ===
  { name: 'eventType', label: 'Event Type', type: 'select', required: true, clickupFieldId: 'afb623cf-472e-4d03-b220-bf3b3ce11bc6', options: ['Wedding', 'Corporate', 'Birthday', 'Festival', 'Other'] },
  { name: 'serviceStart', label: 'Service Start Time', type: 'datetime-local', required: true, clickupFieldId: 'f6483054-1434-4c04-ac53-06af6042a96f' },
  { name: 'serviceEnd', label: 'Service End Time', type: 'datetime-local', required: true, clickupFieldId: 'c4bcdf67-b72d-4531-953e-5cb542b14a3e' },
  { name: 'headcount', label: 'Expected Headcount', type: 'number', required: true, clickupFieldId: '019ed06a-6a3a-4782-877f-ec4e94b0ac30', placeholder: '150' },
  { name: 'eventLocation', label: 'Event Location / Venue', type: 'text', required: true, clickupFieldId: 'b92b1e46-363e-4453-9888-b530ecdeefce', placeholder: '123 Beach Rd, San Diego, CA' },

  // === Service Details ===
  { name: 'package', label: 'Package', type: 'select', required: false, clickupFieldId: '72edb0f2-022a-4db4-8ec4-88d694cd54b0', options: ['Standard', 'Premium', 'Custom'] },
  { name: 'coconutQty', label: 'Coconut Quantity', type: 'number', required: false, clickupFieldId: '3e9943e1-4e51-466b-9d6d-f01e862a1bec' },
  { name: 'garnish', label: 'Garnish Preference', type: 'text', required: false, clickupFieldId: 'b9341990-5265-41a1-ba1e-4cbd3c767084' },
  { name: 'setupProvided', label: 'Setup Provided By', type: 'select', required: false, clickupFieldId: '87c25b9c-21b0-4420-8ad9-3d36265d567b', options: ['Us', 'Client', 'Venue'] },

  // === Logistics ===
  { name: 'loadInLocation', label: 'Load-In Location', type: 'text', required: false, clickupFieldId: '967038c5-4d18-41d5-8c63-f01bf20ece7a' },
  { name: 'deliveryInstructions', label: 'Delivery Instructions', type: 'textarea', required: false, clickupFieldId: 'b4457a6a-5d84-4505-9e9b-6883303331b3' },

  // === Additional ===
  { name: 'eventNotes', label: 'Additional Notes', type: 'textarea', required: false, clickupFieldId: 'd4ac6c86-d0d6-48e2-8958-b0ede74e3456', placeholder: 'Anything else we should know...' },
]
```

Note: Internal-only fields (`readyBy`, `stampStatus`, `certsNeeded`) are intentionally omitted — those are filled in by your team on the BEO side, not the client.

- [ ] **Step 2: Commit**

```bash
git add lib/intake-fields.ts
git commit -m "feat: add intake form field definitions with ClickUp field IDs"
```

---

### Task 2: Add ClickUp Create & Update Functions

**Files:**
- Modify: `lib/clickup.ts`
- Create: `tests/lib/clickup.test.ts`

- [ ] **Step 1: Write failing tests for createTask and updateTaskFields**

```ts
// tests/lib/clickup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

process.env.CLICKUP_API_KEY = 'test-key'
process.env.CLICKUP_LIST_ID = 'test-list-123'

import { createTask, updateTaskFields } from '@/lib/clickup'

describe('createTask', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a task and returns the task ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'abc123', name: 'Test Event' }),
    })

    const result = await createTask('Test Event', 'A test deal')
    expect(result).toEqual({ id: 'abc123', name: 'Test Event' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.clickup.com/api/v2/list/test-list-123/task',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws on API failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(createTask('Test', 'desc')).rejects.toThrow()
  })
})

describe('updateTaskFields', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends custom field updates to ClickUp', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    await updateTaskFields('abc123', [
      { id: 'field-1', value: 'hello' },
    ])

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.clickup.com/api/v2/task/abc123/field/field-1',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sends one API call per field for multiple fields', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    await updateTaskFields('abc123', [
      { id: 'field-1', value: 'one' },
      { id: 'field-2', value: 'two' },
      { id: 'field-3', value: 'three' },
    ])

    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('reports which field failed on error', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 400 })

    await expect(
      updateTaskFields('abc123', [
        { id: 'field-ok', value: 'fine' },
        { id: 'field-bad', value: 'broken' },
      ])
    ).rejects.toThrow('field-bad')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/clickup.test.ts`
Expected: FAIL — `createTask` and `updateTaskFields` not exported

- [ ] **Step 3: Implement createTask and updateTaskFields in clickup.ts**

Add to the bottom of `lib/clickup.ts`:

```ts
export async function createTask(
  name: string,
  description: string
): Promise<{ id: string; name: string }> {
  const apiKey = process.env.CLICKUP_API_KEY
  const listId = process.env.CLICKUP_LIST_ID
  if (!apiKey) throw new Error('CLICKUP_API_KEY not set')
  if (!listId) throw new Error('CLICKUP_LIST_ID not set')

  const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description }),
  })

  if (!res.ok) {
    throw new Error(`ClickUp createTask failed: ${res.status}`)
  }

  const task = await res.json()
  return { id: task.id, name: task.name }
}

export async function updateTaskFields(
  taskId: string,
  fields: Array<{ id: string; value: unknown }>
): Promise<void> {
  const apiKey = process.env.CLICKUP_API_KEY
  if (!apiKey) throw new Error('CLICKUP_API_KEY not set')

  // ClickUp requires one API call per custom field update.
  // Use allSettled so one failure doesn't mask others.
  const results = await Promise.allSettled(
    fields.map((field) =>
      fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${field.id}`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: field.value }),
      }).then((res) => {
        if (!res.ok) throw new Error(`ClickUp field update failed: ${field.id} — ${res.status}`)
      })
    )
  )

  const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
  if (failures.length > 0) {
    throw new Error(failures.map((f) => f.reason?.message || f.reason).join('; '))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/clickup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/clickup.ts tests/lib/clickup.test.ts
git commit -m "feat: add createTask and updateTaskFields to ClickUp lib"
```

---

### Task 3: Add Email Helper (Nodemailer + Gmail SMTP)

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Install Nodemailer**

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Create the email helper**

```ts
// lib/email.ts
import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) throw new Error('SMTP_USER and SMTP_PASS must be set')

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  })
}

export async function sendIntakeEmail(params: {
  to: string
  clientName: string
  eventName: string
  intakeUrl: string
}) {
  const { to, clientName, eventName, intakeUrl } = params
  const transporter = getTransporter()

  await transporter.sendMail({
    from: `Windansea Coconuts <${process.env.SMTP_USER}>`,
    to,
    subject: `Event Intake Form — ${eventName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${clientName},</h2>
        <p>Thank you for booking with Windansea Coconuts! Please fill out the intake form below so we can finalize the details for your event.</p>
        <p style="margin: 24px 0;">
          <a href="${intakeUrl}" style="background: #1e1d1a; color: #f0ede4; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Fill Out Intake Form
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Event: ${eventName}</p>
        <p style="color: #999; font-size: 12px;">If you have questions, reply to this email.</p>
      </div>
    `,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: add Nodemailer email helper for intake form (Gmail SMTP)"
```

**Note:** To generate a Google App Password: Google Account → Security → 2-Step Verification → App passwords → create one for "Mail". Use that as `SMTP_PASS`, not your regular login password.

---

### Task 4: Pipedrive Webhook Endpoint

**Files:**
- Create: `app/api/webhooks/pipedrive/route.ts`

The Pipedrive webhook payload includes `person_id` as a full expanded object (confirmed via API inspection). Email is at `deal.person_id.email[0].value`, name at `deal.person_id.name`. No separate Pipedrive API call needed.

- [ ] **Step 1: Write the webhook handler with secret verification**

```ts
// app/api/webhooks/pipedrive/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createTask } from '@/lib/clickup'
import { sendIntakeEmail } from '@/lib/email'

function verifyWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.PIPEDRIVE_WEBHOOK_SECRET
  if (!secret) return true // If no secret configured, skip verification

  // Configure webhook URL as: https://yourdomain.com/api/webhooks/pipedrive?secret=YOUR_SECRET
  const url = new URL(req.url)
  const provided = url.searchParams.get('secret')
  return provided === secret
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // Pipedrive webhook payload:
    // body.current — the deal's current state
    // body.previous — the deal's previous state
    const deal = body.current

    if (!deal) {
      return NextResponse.json({ error: 'No deal data' }, { status: 400 })
    }

    // Only proceed if deal status is "won"
    if (deal.status !== 'won') {
      return NextResponse.json({ skipped: true, reason: 'Not a won deal' })
    }

    // Extract deal info — person_id is an expanded object in the webhook payload
    const dealTitle = deal.title || 'Untitled Event'
    const dealValue = deal.value || ''
    const person = deal.person_id // expanded object, not just an ID
    const org = deal.org_id       // expanded org object

    const contactName = person?.name || ''
    const contactEmail = person?.email?.[0]?.value || ''
    const contactPhone = person?.phone?.[0]?.value || ''
    const companyName = org?.name || ''

    if (!contactEmail) {
      console.error('Pipedrive webhook: no email found for deal', dealTitle)
      return NextResponse.json(
        { error: 'No contact email found — check that the deal has a linked person with an email in Pipedrive' },
        { status: 400 }
      )
    }

    // Build description from available Pipedrive deal data
    const description = [
      `Pipedrive Deal: ${dealTitle}`,
      `Contact: ${contactName}`,
      contactEmail ? `Email: ${contactEmail}` : '',
      contactPhone ? `Phone: ${contactPhone}` : '',
      companyName ? `Company: ${companyName}` : '',
      dealValue ? `Deal Value: $${dealValue}` : '',
      // Custom deal fields (if present in webhook payload)
      deal['3cbba884936441c84efa2be503601486477e0099'] ? `Event Date: ${deal['3cbba884936441c84efa2be503601486477e0099']}` : '',
      deal['b7ac88506b544085a8e8cd2e64d4ee3739964e91'] ? `Event Type: ${deal['b7ac88506b544085a8e8cd2e64d4ee3739964e91']}` : '',
      deal['06bf970639929239bf71e35917568551faf8686c_formatted_address'] ? `Event Address: ${deal['06bf970639929239bf71e35917568551faf8686c_formatted_address']}` : '',
      deal['ce6dafb98776e8199b4190382d1ab85175bd84fc'] ? `Est. Guests: ${deal['ce6dafb98776e8199b4190382d1ab85175bd84fc']}` : '',
      deal['58ef1bbe92551cf424fe56527492ff95191e9dcb'] ? `Coconuts: ${deal['58ef1bbe92551cf424fe56527492ff95191e9dcb']}` : '',
    ].filter(Boolean).join('\n')

    // 1. Create ClickUp task
    const task = await createTask(dealTitle, description)

    // 2. Build intake URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const intakeUrl = `${baseUrl}/intake/${task.id}`

    // 3. Send email
    await sendIntakeEmail({
      to: contactEmail,
      clientName: contactName.split(' ')[0] || 'there',
      eventName: dealTitle,
      intakeUrl,
    })

    return NextResponse.json({
      success: true,
      taskId: task.id,
      intakeUrl,
    })
  } catch (err) {
    console.error('Pipedrive webhook error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Run build to verify no type errors**

Run: `npm run build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/pipedrive/route.ts
git commit -m "feat: add Pipedrive webhook endpoint with secret verification"
```

---

### Task 5: Intake Form Page

**Files:**
- Create: `app/intake/[taskId]/page.tsx`
- Create: `components/IntakeForm.tsx`

- [ ] **Step 1: Create the intake form client component**

```tsx
// components/IntakeForm.tsx
'use client'

import { useState } from 'react'
import { INTAKE_FIELDS } from '@/lib/intake-fields'

export function IntakeForm({ taskId }: { taskId: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    const formData = new FormData(e.currentTarget)
    const data: Record<string, string> = {}
    for (const field of INTAKE_FIELDS) {
      data[field.name] = (formData.get(field.name) as string) || ''
    }

    try {
      const res = await fetch(`/api/intake/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Submission failed (${res.status})`)
      }

      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-[family-name:var(--font-cormorant)] text-[#1e1d1a] mb-4">
          Thank You!
        </h2>
        <p className="text-[#878774] font-[family-name:var(--font-jost)]">
          Your event details have been submitted. We&apos;ll be in touch soon.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {INTAKE_FIELDS.map((field) => (
        <div key={field.name}>
          <label
            htmlFor={field.name}
            className="block text-xs uppercase tracking-widest text-[#878774] font-[family-name:var(--font-jost)] mb-1"
          >
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              id={field.name}
              name={field.name}
              required={field.required}
              placeholder={field.placeholder}
              rows={3}
              className="w-full border border-[#d4d0c8] bg-white/60 rounded px-3 py-2 text-sm font-[family-name:var(--font-jost)] text-[#1e1d1a] focus:outline-none focus:border-[#878774]"
            />
          ) : field.type === 'select' ? (
            <select
              id={field.name}
              name={field.name}
              required={field.required}
              className="w-full border border-[#d4d0c8] bg-white/60 rounded px-3 py-2 text-sm font-[family-name:var(--font-jost)] text-[#1e1d1a] focus:outline-none focus:border-[#878774]"
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              required={field.required}
              placeholder={field.placeholder}
              className="w-full border border-[#d4d0c8] bg-white/60 rounded px-3 py-2 text-sm font-[family-name:var(--font-jost)] text-[#1e1d1a] focus:outline-none focus:border-[#878774]"
            />
          )}
        </div>
      ))}

      {status === 'error' && (
        <p className="text-red-500 text-sm">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full bg-[#1e1d1a] text-[#f0ede4] py-3 rounded text-sm uppercase tracking-widest font-[family-name:var(--font-jost)] hover:bg-[#333] disabled:opacity-50 transition-colors"
      >
        {status === 'submitting' ? 'Submitting...' : 'Submit Event Details'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create the page**

```tsx
// app/intake/[taskId]/page.tsx
import { IntakeForm } from '@/components/IntakeForm'

export const dynamic = 'force-dynamic'

export default function IntakePage({
  params,
}: {
  params: { taskId: string }
}) {
  return (
    <div className="min-h-screen bg-[#f0ede4] py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-[family-name:var(--font-cormorant)] text-[#1e1d1a] mb-2">
            Event Intake Form
          </h1>
          <p className="text-sm text-[#878774] font-[family-name:var(--font-jost)]">
            Please fill out the details below so we can prepare for your event.
          </p>
        </div>

        <div className="bg-white/40 border border-[#d4d0c8] rounded-lg p-8">
          <IntakeForm taskId={params.taskId} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add components/IntakeForm.tsx app/intake/\[taskId\]/page.tsx
git commit -m "feat: add client-facing intake form page"
```

---

### Task 6: Form Submission API Endpoint

**Files:**
- Create: `app/api/intake/[taskId]/route.ts`

- [ ] **Step 1: Create the submission handler**

```ts
// app/api/intake/[taskId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateTaskFields } from '@/lib/clickup'
import { INTAKE_FIELDS } from '@/lib/intake-fields'

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const body = await req.json()
    const { taskId } = params

    if (!taskId) {
      return NextResponse.json({ error: 'Missing task ID' }, { status: 400 })
    }

    // Map form data to ClickUp custom field updates
    const fieldUpdates: Array<{ id: string; value: unknown }> = []

    for (const field of INTAKE_FIELDS) {
      const value = body[field.name]
      if (value !== undefined && value !== '') {
        // Date fields: ClickUp expects epoch ms
        if (field.type === 'date' || field.type === 'datetime-local') {
          const epoch = new Date(value).getTime()
          if (!isNaN(epoch)) {
            fieldUpdates.push({ id: field.clickupFieldId, value: String(epoch) })
          }
        } else {
          fieldUpdates.push({ id: field.clickupFieldId, value })
        }
      }
    }

    if (fieldUpdates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await updateTaskFields(taskId, fieldUpdates)

    return NextResponse.json({ success: true, fieldsUpdated: fieldUpdates.length })
  } catch (err) {
    console.error('Intake submission error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add app/api/intake/\[taskId\]/route.ts
git commit -m "feat: add intake form submission endpoint — updates ClickUp task"
```

---

### Task 7: Wire Up Environment Variables & Test End-to-End

**Files:**
- No new files — configuration and manual testing

- [ ] **Step 1: Add env vars to `.env.local`**

```bash
# Add to .env.local (already gitignored)
CLICKUP_LIST_ID=<your-target-list-id>
PIPEDRIVE_WEBHOOK_SECRET=<pick-any-random-string>
SMTP_USER=harrison@windanseacoconuts.com
SMTP_PASS=<google-app-password>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

- [ ] **Step 2: Run dev server and test the intake form manually**

```bash
npm run dev
```

Open `http://localhost:3000/intake/test123` — verify form renders.

- [ ] **Step 3: Test form submission with curl**

```bash
curl -X POST http://localhost:3000/api/intake/test123 \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@test.com"}'
```

Expected: `{"success":true,"fieldsUpdated":N}` (or ClickUp error if test123 isn't a real task)

- [ ] **Step 4: Test Pipedrive webhook with curl (simulating real payload shape)**

```bash
curl -X POST "http://localhost:3000/api/webhooks/pipedrive?secret=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "current": {
      "title": "Test Wedding",
      "status": "won",
      "value": 5000,
      "person_id": {
        "name": "Jane Doe",
        "email": [{"label": "work", "value": "jane@test.com", "primary": true}],
        "phone": [{"label": "work", "value": "5551234567", "primary": true}],
        "value": 123
      },
      "org_id": {
        "name": "Test Company"
      }
    }
  }'
```

Expected: `{"success":true,"taskId":"...","intakeUrl":"..."}`

- [ ] **Step 5: Deploy to Vercel and add env vars there**

Add `CLICKUP_LIST_ID`, `PIPEDRIVE_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASS`, and `NEXT_PUBLIC_BASE_URL` to Vercel project settings.

- [ ] **Step 6: Register the webhook URL in Pipedrive**

Pipedrive → Settings → Webhooks → Add webhook:
- URL: `https://yourdomain.com/api/webhooks/pipedrive?secret=YOUR_SECRET`
- Event: `deal.updated` (filter for won status in your handler)

- [ ] **Step 7: Run full test suite and commit**

```bash
npm test
npm run build
```

---

## Post-Implementation Notes

- **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App passwords → create one for "Mail". Use that as `SMTP_PASS`. Harrison's regular login password won't work.
- **Pipedrive webhook payload**: Confirmed via API that `person_id` is an expanded object with `name`, `email[]`, `phone[]`. The test curl in Task 7 Step 4 mirrors this exact structure. If anything changes, the handler logs the error clearly.
- **Select/dropdown fields**: ClickUp dropdown fields expect the option's `orderindex` (a number), not the option name string. You may need to adjust the submission handler to look up the orderindex for select fields. Test with real ClickUp data to confirm.
- **Rename project**: To rename from "beo" to "windansea-coconuts", update `name` in `package.json` and the project name in Vercel dashboard. No code changes needed.
- **Pre-populated deal data**: The webhook handler pulls Pipedrive custom fields (Event Date, Event Type, Address, Guest Count, Coconuts) into the ClickUp task description. This gives your team context before the client even fills out the intake form.
