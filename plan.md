# Windansea Coconuts — BEO Web App

## Overview

A Next.js app deployed on Vercel that generates a unique, always-live BEO page per event. Each page pulls directly from the ClickUp API so any field update in ClickUp is reflected instantly — no re-sending anything.

**Live URL pattern:** `https://beo.windanseacoconuts.com/beo/[taskId]`

---

## Stack

- **Next.js 14** (App Router)
- **Vercel** (free tier, deploy from GitHub)
- **ClickUp REST API** (no database needed — ClickUp is the source of truth)
- **Tailwind CSS** (styling)

---

## Environment Variables

```
CLICKUP_API_KEY=your_clickup_api_key
```

Get from: ClickUp → Settings → Apps → API Token

---

## Project Structure

```
/app
  /beo
    /[taskId]
      page.tsx        ← dynamic BEO page
  layout.tsx
  globals.css
/lib
  clickup.ts          ← ClickUp API fetch helpers
/components
  BEODocument.tsx     ← the BEO HTML template as a React component
```

---

## ClickUp API Details

**Base URL:** `https://api.clickup.com/api/v2`

**Fetch a task:**
```
GET /task/{taskId}?custom_fields=true
Authorization: {CLICKUP_API_KEY}
```

**Workspace ID:** `90141034454`
**List ID (Events):** `901414665785`

---

## Custom Field ID → BEO Field Mapping

| BEO Field | ClickUp Field Name | Field ID |
|---|---|---|
| CLIENT_FIRST_NAME | Client First Name | `6448e40e-5c59-4aeb-b99a-5755536b9463` |
| CLIENT_LAST_NAME | Client Last Name | `7ec644ea-814a-4a79-ab52-4a4543466cfb` |
| COMPANY_NAME | Company Name | `75e86982-b682-4c56-86c4-2007b87d89df` |
| CLIENT_EMAIL | Client Email | `a4316b37-4646-4db8-93d7-c37561d17a77` |
| CLIENT_PHONE | Client Phone Number | `2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48` |
| EVENT_TYPE | Event Type | `afb623cf-472e-4d03-b220-bf3b3ce11bc6` |
| SERVICE_START | Service Start Date and Time | `f6483054-1434-4c04-ac53-06af6042a96f` |
| SERVICE_END | Service End Date and Time | `c4bcdf67-b72d-4531-953e-5cb542b14a3e` |
| EVENT_LOCATION | Event Location | `b92b1e46-363e-4453-9888-b530ecdeefce` |
| PACKAGE | Package | `72edb0f2-022a-4db4-8ec4-88d694cd54b0` |
| COCONUT_QTY | Coconut Quantity | `3e9943e1-4e51-466b-9d6d-f01e862a1bec` |
| READY_BY | Number of Coconuts to Be Ready By Time | `54389f19-e059-4418-b842-1b1cd12539ca` |
| GARNISH | Garnish | `b9341990-5265-41a1-ba1e-4cbd3c767084` |
| SETUP_PROVIDED | Setup Provided? | `87c25b9c-21b0-4420-8ad9-3d36265d567b` |
| STAMP_STATUS | Stamp Status | `843a7dd5-b277-4429-8240-78515c297a05` |
| CERTS_NEEDED | Certifications Needed | `f459ee0d-aa89-4d9e-aeff-bf714b7728d6` |
| LOAD_IN_LOCATION | Vendor Load-in Location | `967038c5-4d18-41d5-8c63-f01bf20ece7a` |
| DELIVERY_INSTRUCTIONS | Delivery Instructions | `b4457a6a-5d84-4505-9e9b-6883303331b3` |
| EVENT_NOTES | Event Notes | `d4ac6c86-d0d6-48e2-8958-b0ede74e3456` |

**Note:** HEADCOUNT is not currently a ClickUp custom field — either add it to ClickUp or omit from the BEO for now.

---

## Pages

### `/beo/[taskId]` — BEO Page

- Server-side rendered (`async` page component, no `use client`)
- On load: fetch task from ClickUp API using `taskId` from URL
- Parse all custom fields by ID using the mapping above
- Render `<BEODocument>` component with populated data
- If task not found → show simple "BEO not found" message
- No auth required (public URL — anyone with the link can view)

### `/` — Simple landing (optional)

Just a redirect or a plain "Page not found" — no index needed.

---

## BEODocument Component

Render the BEO as a styled React component. Use the existing HTML template as reference (attached below). The design uses:

- **Brand color:** `#878774`
- **Font:** Cormorant Garamond (display) + Jost (labels) — load via Google Fonts in `layout.tsx`
- **Layout:** Full-width document, 820px max-width, white background
- Print-friendly — `@media print` hides nothing, no buttons

The component receives a single `data` prop:

```typescript
interface BEOData {
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
```

Empty/missing fields should render as an em dash `—`.

---

## BEO HTML Template Reference

The template has already been designed. Key structural details:

- Header: `#878774` background, white Cormorant Garamond title "Windansea Coconuts", subtitle "Banquet Event Order"
- Sections: Client Information, Event Details, Service & Package, Logistics, Notes
- Each section has a small uppercase label in `#878774` with a horizontal rule
- Fields: flexbox rows with `1px solid #d8d5cc` borders, 2 fields per row
- Field labels: 10px Jost 500 uppercase, color `#9a9890`
- Field values: 17px Cormorant Garamond, color `#1e1d1a`
- Footer: `windanseacoconuts.com · hello@windanseacoconuts.com · Confidential`

---

## Zapier Integration (after app is live)

Once deployed, the Zapier flow becomes:

1. **Trigger:** ClickUp — Task updated (Intake Form Complete = Yes)
2. **Action:** Gmail — Send email to Jordan with subject `BEO Ready: [Client Name]` and body containing the link: `https://beo.windanseacoconuts.com/beo/{{task_id}}`

That's it. No HTML generation in Zapier at all.

---

## Deployment

1. Push to GitHub
2. Import repo in Vercel
3. Add `CLICKUP_API_KEY` environment variable in Vercel project settings
4. Deploy — Vercel handles everything else

**Custom domain (optional):** Point `beo.windanseacoconuts.com` to Vercel via a CNAME record in your DNS.

---

## Out of Scope (keep it simple)

- No database
- No authentication
- No editing from the web UI — all edits happen in ClickUp
- No PDF generation — browser print handles it
- No admin dashboard