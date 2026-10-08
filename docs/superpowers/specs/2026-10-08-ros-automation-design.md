# Run of Show (ROS) Automation — Design

**Date:** 2026-10-08
**Status:** Approved 2026-10-08 (spec review passed, second pass)
**Owner:** Jordan

## Goal

Every morning, for every confirmed event within the next 14 days, make sure the ClickUp Events task carries an up-to-date Run of Show document. Create one when none exists. Update the existing one when the inputs have changed. Leave it alone otherwise. Humans (Trent) review the result in ClickUp; nothing is sent to clients or vendors automatically.

## Decisions already made

- Runs as a **Vercel cron** inside this Next.js app (Pro plan, 300 s function limit). Not a Claude Code routine.
- Daily at **14:00 UTC** (7 AM Pacific in summer, 6 AM in winter).
- **Rolling 14-day window**, inclusive of today.
- Updates **edit the existing ROS** rather than regenerate from scratch, so manual edits survive.
- Email sources: Harrison's inbox now (existing app password), Trent's when he provides one.
- **Dry-run mode** for the first week: files are emailed to Jordan instead of attached to ClickUp.
- Old ROS versions are kept on the task. Nothing is deleted.

## Scope

In scope: candidate selection, change detection, email search, ROS composition via the Claude API, Word rendering, ClickUp attachment and comment, dry-run, alerts, tests.

Out of scope: sending the ROS to anyone, editing other ClickUp fields, Pipedrive, wholesale tasks, events more than 14 days out, events without a completed intake form, a UI.

## Candidate selection

A task is a candidate when all of the following hold:

1. It is in the **Events** list (`CLICKUP_LIST_ID`).
2. Custom field **Intake Form Complete** (`dbeda913-50e7-4988-9f1d-d28ec26a9a6d`) is **Yes**. The option is resolved by **name** from the field's `type_config.options` on the live task (never by array position, matching the rest of the codebase), and the comparison is done in code after fetching.
3. Its **event date** is between today and today + 14 days, Pacific time. Event date is the **Service Start Date and Time** field (`f6483054-…`), falling back to the task **start date**, then the task **due date**. Tasks with none of these are skipped and reported in the run summary.
4. The task is not closed.

Selection uses the ClickUp "get tasks in list" endpoint (closed tasks and subtasks excluded; custom fields come back in the response), follows pagination until exhausted, then applies the Intake Form Complete and date-window checks in code. Candidates are processed in **event date ascending** order so the time budget never starves the soonest events.

## Per-task flow

```
load task (fields, attachments, comments)
search mailboxes → matching messages
fingerprint = hash(inputs)
latest ROS = newest attachment whose title starts with "[ROS]"

if no latest ROS            → CREATE  (v1)
elif fingerprint == stored  → SKIP
else                        → UPDATE  (vN+1, from latest ROS text + new inputs)

on CREATE/UPDATE:
  compose ROS (Claude API, JSON schema)
  render .docx
  dry-run ? email file to Jordan : attach to task + comment to Trent
  store fingerprint on task
```

Each task is processed independently. A failure on one task is logged, alerted, and does not stop the batch. The route checks elapsed time before starting each task and stops at 240 s, leaving the rest for the next day; the summary says how many were deferred.

## Change detection: the fingerprint

The fingerprint is a SHA-256 over a canonical JSON of:

- every custom field id → value on the task **except** the `ROS Fingerprint` field itself (the full set otherwise, so any intake edit counts),
- task name, start date, due date, status,
- sorted ids of attachments whose title does **not** start with `[ROS]`,
- sorted ids of comments whose text does **not** start with `[ROS]` (the bot's own comments use that prefix; human comments, including Trent's review notes, **do** count as input because they often carry logistics changes),
- sorted email message ids of the matching messages,
- a `ROS_SCHEMA_VERSION` constant, so a generator change forces a refresh.

These exclusions matter: the route's own writes (the `[ROS]` file, the `[ROS]` comment, the fingerprint value) must not change the hash, or SKIP could never happen and every managed task would be regenerated daily.

It is stored in a new **text custom field on the Events list named `ROS Fingerprint`**. This field must be created by hand in ClickUp once; the ClickUp API cannot create custom fields. The route resolves the field id at the start of each run by listing the Events list's custom fields and matching the name exactly (`GET /list/{id}/field`). If no field with that name exists, the route fails fast with a clear error and alert on every run until it is fixed, rather than regenerating everything daily.

A manually uploaded `[ROS]` file (for example the Palm Tree ROS produced on 2026-10-08) counts as the latest ROS. Because its fingerprint was never stored, the first run will treat it as changed and produce an UPDATE from its text. That is the intended way to bring a hand-made ROS under management.

## Email search

- Protocol: IMAP over TLS to `imap.gmail.com` using Google app passwords. Library: `imapflow`.
- Mailboxes: `harrison@windanseacoconuts.com` with `SMTP_PASS` (already set); `trent@windanseacoconuts.com` with `IMAP_PASS_TRENT` when set. A mailbox with no password is skipped, not an error.
- Query per task, on `[Gmail]/All Mail`: messages **since the task's creation date** where the **client email** appears in From/To/Cc, **or** the subject/body contains the **deal title** or **task name**. Results capped at 30 messages per mailbox, newest first.
- What is passed to Claude: for each message, date, from, to, subject, and the plain-text body trimmed to 3,000 characters with quoted replies stripped. Attachments are not fetched.
- Nothing from the mailbox is persisted. Only the message ids feed the fingerprint; only the composed ROS text leaves the function.

## ROS composition (Claude API)

Model: `claude-sonnet-5-5`, set in one constant. One call per CREATE or UPDATE. Output is constrained to a JSON schema (`RosDocument`) via a single forced tool call, so rendering never depends on free text. The tool's `input_schema` is hand-written JSON Schema in `lib/ros/types.ts`, and the response is checked by a hand-rolled type guard (`isRosDocument`) before rendering; no schema library is added.

```ts
interface RosDocument {
  header: { clientName: string; eventName: string; subtitle: string }
  info: Array<{ label: string; value: string }>        // Dates, Service, Location, Service Spot, contacts, counts, garnish…
  stampBox: string[]                                    // lines for the brand stamp box
  entrance: string                                      // Entrance & Check-In paragraph
  callout: string | null                                // bold all-caps warning, optional
  changes: string[] | null                              // UPDATE only: "What changed since vN"
  days: Array<{ heading: string; blocks: Array<{ time: string; title: string; bullets: string[] }> }>
  setTimes: Array<{ heading: string; bullets: string[] }> | null
  breakdown: Array<{ item: string; detail: string }>
  supplies: Array<{ heading: string; bullets: string[] }>
  contacts: Array<{ label: string; value: string }>
  openItems: string[]                                   // "Confirm before …" list; never empty when facts are missing
}
```

Prompt inputs: the task fields (resolved dropdown names, Pacific-formatted dates), attachment titles, comments, email excerpts, the house style and exemplar described below, and in UPDATE mode the plain text of the latest ROS.

**Exemplar and house style, checked into the repo as a prerequisite task:**

- `lib/ros/exemplar.ts` exports the LJBTC End of Summer Luau ROS (2026-10-09) as a `RosDocument` constant. It is the few-shot example in the prompt, the render snapshot baseline in tests, and the structural template. Its content comes from `docs/ros/reference/template-ljbtc-2026-10-09.docx`, transcribed during implementation.
- `lib/ros/house-style.ts` exports the fixed Windansea facts the model may use without them appearing in the inputs: warehouse address (9040 Kenamar Dr, Unit 403, San Diego), the standard post-event steps (add hours to the 2026 Timesheet; confirm final payment, follow up on invoice), the Windansea contact line (Trent LiVolsi, 732-575-5774), the standard packing list by category (coconuts and service items, tools, display and setup, cleaning and safety, team), and the package definitions (Sandcastle delivery only; Cabana delivery plus live service; Villa full service and brand activation). Anything not in this file or the inputs is an open item.
- `docs/ros/reference/` holds the durable sources: `template-ljbtc-2026-10-09.docx` (the template), `palm-tree-2026-10-10.docx` (the ROS produced by hand on 2026-10-08, also the file Rollout step 1 uploads), `palm-tree-generator.js` (the docx-js generator that produced it; `lib/ros/render.ts` is a port of this file), and `olukai-logo.png`. Reference only; none of it is sent to the model.

Rules given to the model:

- Never invent a fact. Anything not present in the inputs goes in `openItems`, not in the body.
- UPDATE mode preserves existing wording and manually added content unless an input contradicts it. Every change is listed in `changes`.
- Times are Pacific. Phone numbers as `###-###-####`.
- Tone and structure match the LJBTC ROS of 2026-10-09 (the template).

## Rendering

`lib/ros/render.ts` turns a `RosDocument` into a `.docx` using the `docx` npm package, reproducing the template: US Letter, Times New Roman, 20 pt title, blue (`3D72B8`) 13 pt subtitle with bottom rule, borderless info table with a bordered stamp box and the client stamp logo (the `[STAMP LOGO]` attachment, downloaded and placed inline under the box; omitted if absent), 11 pt body, blue section headers, 11.5 pt time headers, bullet lists, a two-column breakdown table with grey rules. This is a port of `docs/ros/reference/palm-tree-generator.js`.

Filename: `[ROS] <task name> v<N> — DRAFT.docx`, where N is one more than the highest `v<N>` found among existing `[ROS]` attachments (1 when none parse).

Reading an existing ROS for UPDATE mode: unzip the `.docx` (`jszip`), extract paragraph and table text from `word/document.xml` in document order, join with newlines.

## ClickUp writes

- Attachment: `POST /task/{id}/attachment` multipart, same as the intake route's existing helper, moved into `lib/clickup.ts`.
- Comment: `POST /task/{id}/comment`, always starting with `[ROS]` so the fingerprint can exclude it. CREATE: "[ROS] v1 drafted — @Trent please review. Open items: …". UPDATE: "[ROS] v<N> — updated: <changes>. Open items: …". Trent is mentioned by ClickUp user id from env `CLICKUP_USER_ID_TRENT`; if unset, the comment is posted without a mention.
- Fingerprint: `POST /task/{id}/field/{fieldId}` with the new hash, written **after** the attachment and comment succeed.

## Dry-run mode

`ROS_DRY_RUN=true` (default when unset) makes CREATE/UPDATE email the `.docx` to `jordan@windanseacoconuts.com` via the existing Nodemailer transport, with the would-be comment text in the body, and **does not** attach, comment, or store the fingerprint. The run summary says "dry run". Setting `ROS_DRY_RUN=false` turns on real writes.

## Route and schedule

- `GET /api/cron/ros`, `export const maxDuration = 300`, Node runtime.
- Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel sets this header for scheduled invocations). Missing or wrong secret → 401.
- `vercel.json`: `{ "crons": [{ "path": "/api/cron/ros", "schedule": "0 14 * * *" }] }`.
- Response: JSON summary `{ considered, created, updated, skipped, deferred, failed: [{taskId, error}], dryRun }`. Also logged.
- Manual trigger for testing: same route with the secret. `?taskId=<id>` processes one task regardless of the window. `?force=1` additionally bypasses the SKIP branch (treats the fingerprint as changed) so a re-test does not require editing a field.

## Errors and alerts

- Per-task failures: caught, appended to `failed`, one alert email per run listing all failures via the existing `sendErrorAlert`.
- Fatal setup failures (missing fingerprint field, missing API key): 500, alert email, no tasks processed.
- Claude call: one retry on 5xx or rate limit, then fail that task.
- IMAP: a mailbox that fails to connect is skipped for that run with a warning in the summary; the task still proceeds with ClickUp data only, and the fingerprint omits that mailbox so it is retried tomorrow. Known consequence: when the mailbox comes back, the hash changes and the task gets one UPDATE even if the emails held nothing new. Accepted.

## Configuration

| Env var | Purpose |
|---|---|
| `CRON_SECRET` | Authenticates cron invocations |
| `ANTHROPIC_API_KEY` | Claude API |
| `CLICKUP_API_KEY`, `CLICKUP_LIST_ID` | Existing |
| `CLICKUP_USER_ID_TRENT` | For @mention in comments, optional |
| `SMTP_PASS` | Existing; doubles as Harrison's IMAP password |
| `IMAP_PASS_TRENT` | Trent's app password, optional |
| `ROS_DRY_RUN` | `true` (default) or `false` |

New dependencies: `@anthropic-ai/sdk`, `docx`, `imapflow`, `jszip`.

## Module layout

```
app/api/cron/ros/route.ts      auth, selection, loop, summary
lib/ros/select.ts              candidate filter and date window
lib/ros/fingerprint.ts         canonical JSON + hash
lib/ros/mail.ts                IMAP search and excerpting
lib/ros/compose.ts             Claude call, RosDocument schema, prompts
lib/ros/render.ts              RosDocument → .docx buffer
lib/ros/extract.ts             .docx → plain text
lib/ros/versions.ts            find latest [ROS] attachment, next version number
lib/ros/types.ts               RosDocument, its JSON Schema, isRosDocument guard, run summary types
lib/ros/exemplar.ts            LJBTC ROS as a RosDocument (few-shot + snapshot baseline)
lib/ros/house-style.ts         fixed Windansea facts the model may use
docs/ros/reference/            template .docx, Palm Tree .docx, original generator, logo (reference only)
lib/clickup.ts                 + uploadAttachment, postComment, setTextField, listOpenTasks, findListFieldByName
```

Each file stays under 500 lines. Public functions are typed. All external input (ClickUp payloads, email bodies, Claude output) is validated at the boundary; Claude output is validated against the schema before rendering.

## Testing

Vitest, matching the existing suite.

- `select`: window edges (today, day 14, day 15), fallback order of date fields, closed tasks excluded, missing dates reported.
- `fingerprint`: stable across key order; changes when any field, attachment, comment, or message id changes; changes when `ROS_SCHEMA_VERSION` changes; **unchanged** when a `[ROS]`-prefixed attachment or comment is added or when the `ROS Fingerprint` field value changes (the regression test for the self-invalidation bug).
- `versions`: parses `v3` from titles, ignores non-`[ROS]` files, returns 1 when none.
- `extract`: round-trips a document produced by `render`.
- `render`: produces a valid zip with the expected headings and the stamp image when provided; snapshot of extracted text.
- `compose`: prompt builder includes email excerpts and existing ROS text in UPDATE mode; schema validation rejects malformed output. The Claude client is mocked.
- `route`: 401 without secret; dry-run emails and does not write; CREATE/UPDATE/SKIP branches with mocked ClickUp, IMAP, and Claude; one failing task does not stop others; deferral at the time budget.
- `mail`: query construction and excerpt trimming with a mocked IMAP client.

Manual acceptance before leaving dry-run: run against the Palm Tree task with `?taskId=`, confirm the emailed v2 keeps the hand-written content and lists only real changes.

## Rollout

1. Jordan creates a Text custom field named exactly `ROS Fingerprint` on the Events list and sets the env vars in Vercel, `ROS_DRY_RUN=true`. The hand-made Palm Tree ROS is attached to its task as `[ROS] Palm Tree Music Festival v1 — DRAFT.docx` so the acceptance test below exercises UPDATE, not CREATE.
2. Deploy. Trigger manually with `?taskId=86bc8ujw9`. Review the emailed v2 draft: it must keep the hand-written content and list only real changes.
3. Let the cron run in dry-run for a week; Jordan reviews each email.
4. Set `ROS_DRY_RUN=false`.
5. Add `IMAP_PASS_TRENT` when available; no code change.

## Open questions

None blocking. Trent's ClickUp user id and app password can be added after launch.
