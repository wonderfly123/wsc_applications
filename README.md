# Windansea Coconuts — Operations App

Next.js app that automates event and wholesale operations for Windansea Coconuts. Hosted on Vercel at `https://windansea.vercel.app`.

It connects Pipedrive, Square, ClickUp, and Gmail so that deals, invoices, and decal orders flow into the right place without anyone re-typing them.

---

## Part 1 — What it does (functional overview)

### 1. Client intake automation

Triggered when a Pipedrive deal is marked **Closed Won**.

1. A Pipedrive automation POSTs the deal to this app.
2. The app creates a task in the ClickUp **Events** list, pre-filled with the deal title, contact name, email, phone, coconut quantity, and event date (as the task due date). "Intake Form Complete" is set to **No**.
3. A unique intake link (`/intake/<taskId>`) is written onto the task.
4. The client gets a welcome email **from Harrison** (owner) with **Trent CC'd** and introduced as their Event Lead. The email asks them to complete the intake form.
5. The client fills out the intake form. It pre-loads anything already on the ClickUp task, and everything they enter is saved straight back to the task's custom fields. File uploads (stamp logo, delivery map) are attached to the task. "Intake Form Complete" flips to **Yes**.

Intake form sections: Client Information · Event Package Details (package, event type, headcount, garnish, coconut quantities, pre-opened options) · Event Location & Timing · Additional Information · File Uploads. Fields show or hide depending on the package chosen (for example, Sandcastle is delivery-only so service-related fields are hidden).

### 2. Banquet Event Order (BEO)

`/beo/<taskId>` renders a printable, confidential event document straight from the ClickUp task: client info, event details, package and service, logistics, notes, and attachments with inline PDF preview. Share the link with staff and vendors for event-day logistics.

### 3. Wholesale invoice tracking

Triggered when a **Square invoice is published**.

1. Square sends the `invoice.published` event to this app.
2. The app checks whether the invoice is wholesale. It looks for the word "wholesale" in the invoice title, message, or any line item, tolerating misspellings like "wholsale" and split words like "whole sale".
3. Wholesale invoices become a task in the ClickUp **Wholesale** list named `Wholesale — <Customer> — Inv #<number>`, with company, contact name, email, phone, number of cases, coconut quantity, and the invoice due date. The description lists every line item, the total, and a link to the invoice.
4. Non-wholesale invoices are ignored. Duplicate deliveries of the same invoice are skipped.

### 4. Decal order form

`/decal` is a team-only form (password required) for ordering cart and cooler decals from Marcus.

Fill in name, email, job or event name, decal size (40" full cart panel or 20" cooler / half panel), quantity, needed-by date, an optional logo file, placement notes, and a rush flag. Submitting emails Marcus **from Harrison** with **Trent CC'd**. Replies go to Trent. The email includes:

- A formatted one-page **PDF order sheet** with all the details, a RUSH badge when applicable, and a preview of the logo.
- The **original logo file** exactly as uploaded (PNG, SVG, AI, EPS, or PDF, up to 4 MB).

### 5. Error alerts

If any webhook or form submission fails, an alert email goes to **jordan@windanseacoconuts.com** with the error and the payload that caused it, so nothing fails silently.

---

## Part 2 — How it works (technical reference)

### Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14.2 (App Router, serverless on Vercel) |
| Language | TypeScript 5, strict mode |
| UI | React 18, Tailwind CSS 3.4, Cormorant Garamond + Jost via `next/font` |
| Email | Nodemailer over Gmail SMTP (Google Workspace app passwords) |
| PDF | pdf-lib (pure JS, no native deps or font files) |
| Testing | Vitest, React Testing Library, jsdom |
| Linting | ESLint 8, eslint-config-next |

### Routes

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Page | Placeholder home |
| `/intake` | Page | Landing for people who lost their intake link |
| `/intake/[taskId]` | Page | Client intake form, pre-filled from ClickUp |
| `/beo` | Page | Landing for the BEO |
| `/beo/[taskId]` | Page | Printable BEO rendered from ClickUp |
| `/decal` | Page | Password-gated decal order form |
| `POST /api/webhooks/pipedrive` | API | Creates Events task, sets intake link, emails client |
| `POST /api/webhooks/square` | API | Verifies signature, filters wholesale, creates Wholesale task |
| `POST /api/intake/[taskId]` | API | Writes intake form answers and uploads to ClickUp |
| `POST /api/decal` | API | Validates password and order, builds PDF, emails Marcus |

### Email senders

All mail goes out through Gmail SMTP as `harrison@windanseacoconuts.com` using `SMTP_PASS`.

| Email | To | CC | Reply-To |
|-------|----|----|----------|
| Client welcome / intake link | Client | trent@windanseacoconuts.com | (default) |
| Decal order | marcusbhoskins@gmail.com | trent@windanseacoconuts.com | trent@windanseacoconuts.com |
| Error alert | jordan@windanseacoconuts.com | — | — |

Copy for these lives in `lib/email.ts` and `lib/decal.ts`.

### ClickUp

- **Events list** ID comes from `CLICKUP_LIST_ID`. Custom field IDs for intake are defined in `lib/intake-fields.ts` and, for the Pipedrive webhook, at the top of its route file.
- **Wholesale list** ID `901414721789` is hardcoded in the Square webhook route along with its custom field IDs.
- Dropdown values are written by resolving the option's UUID from the live task, never by array position, because positions drift.
- Phone numbers are normalised to E.164 before writing.
- Dates from Pipedrive and Square arrive as date-only strings and are stored at noon UTC so they display on the right calendar day in any US timezone.

### Webhook behaviour

- **Square** signs each request with HMAC-SHA256 over `<notification URL> + <raw body>`. The route verifies it with `SQUARE_WEBHOOK_SIGNATURE_KEY` (skipped with a warning if unset). Square retries on any non-2xx response with backoff for about 24 hours, so the route checks the Wholesale list for an existing `Inv #<number>` task before creating one.
- **Pipedrive** automations do **not** retry. If a deal fails (for example, because a credential expired), the deal has to be re-sent by hand. The alert email contains the exact payload, which can be replayed:

  ```bash
  curl -X POST https://windansea.vercel.app/api/webhooks/pipedrive \
    -H 'Content-Type: application/json' \
    -d '{"deal_title":"...","contact_name":"...","contact_email":"...","contact_phone":"","pipedrive_deal_id":"...","event_date":"YYYY-MM-DD","coconut_qty":""}'
  ```

- **Decal** form: the password is checked server-side on every request with a constant-time compare. The browser remembers it for the session only. Vercel caps request bodies at 4.5 MB, which is why logo uploads are limited to 4 MB.

### Project structure

```
app/
  layout.tsx                      # Root layout, fonts
  page.tsx                        # Home
  beo/page.tsx                    # BEO landing
  beo/[taskId]/page.tsx           # BEO document
  intake/page.tsx                 # Intake landing
  intake/[taskId]/page.tsx        # Client intake form
  decal/page.tsx                  # Decal order form page
  api/
    webhooks/pipedrive/route.ts   # Pipedrive → ClickUp + welcome email
    webhooks/square/route.ts      # Square → ClickUp Wholesale
    intake/[taskId]/route.ts      # Intake form submission
    decal/route.ts                # Decal order submission
components/
  IntakeForm.tsx                  # Intake form UI and client-side validation
  BEODocument.tsx                 # BEO layout
  AttachmentViewer.tsx            # Inline attachment / PDF preview
  DecalOrderForm.tsx              # Password gate + decal order UI
lib/
  clickup.ts                      # ClickUp API client (tasks, fields, attachments)
  square.ts                       # Square API client, wholesale filter, line-item tallies
  email.ts                        # Gmail SMTP transports and all outgoing email
  decal.ts                        # Decal constants, validation, email content
  decal-pdf.ts                    # Decal order sheet PDF renderer
  intake-fields.ts                # Intake field definitions and ClickUp mapping
  types.ts                        # Shared types
__tests__/
  lib/clickup.test.ts
  lib/square.test.ts
  lib/decal.test.ts
  lib/decal-pdf.test.ts
  lib/types.test.ts
  components/BEODocument.test.tsx
```

### Environment variables

Set these in Vercel (Production) and in `.env.local` for development. `.env*.local` is gitignored.

| Variable | Used by | Description |
|----------|---------|-------------|
| `CLICKUP_API_KEY` | Everything | ClickUp personal API token for the Windansea Coconuts account |
| `CLICKUP_LIST_ID` | Pipedrive webhook | Events list ID |
| `SMTP_PASS` | All email | Google Workspace app password for harrison@windanseacoconuts.com |
| `SQUARE_TOKEN` | Square webhook | Square access token, used to fetch the invoice's order and line items |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square webhook | Signature key from the Square webhook subscription |
| `DECAL_FORM_PASSWORD` | Decal form | Shared password for `/decal` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Intake form | Places autocomplete and server-side geocoding |
| `NEXT_PUBLIC_BASE_URL` | Optional | Overrides `https://windansea.vercel.app` in generated links and the Square signature |

### Development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest, single run
npm run test:watch   # Vitest, watch mode
```

Pushing to `main` deploys to Vercel automatically. Vercel reports deployment status back to the commit on GitHub.

### Operational notes

- **"Token invalid (OAUTH_025)" alerts** mean the ClickUp personal token was regenerated or the account password changed. Everything that touches ClickUp fails at once: both webhooks, the intake form, and the BEO pages. Fix by pasting a fresh token into `CLICKUP_API_KEY` on Vercel and redeploying. Square will retry on its own; Pipedrive deals must be replayed (see above).
- **Regenerating the ClickUp token** does not affect the Zapier or ClickUp MCP connections, which use their own OAuth credentials.
- **Welcome emails thread together** in Harrison's Sent folder because they share a subject. Each client still receives a standalone email.
- **Wholesale detection** is keyword-based. If an invoice should have been tracked but wasn't, check that "wholesale" appears in the title, message, or an item name.

### External integrations

- **Pipedrive** — automation webhook on Closed Won deals
- **Square** — `invoice.published` webhook, Orders API
- **ClickUp** — task creation, custom fields, attachments (Events and Wholesale lists)
- **Gmail SMTP** — all outbound email
- **Google Maps** — Places autocomplete and geocoding for venue addresses
- **Google Docs Viewer** — inline PDF preview of ClickUp attachments in the BEO
- **Vercel** — hosting, serverless functions, deploy on push
