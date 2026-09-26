import { NextRequest, NextResponse } from 'next/server'
import { updateTaskFields, fetchDropdownOptionIds } from '@/lib/clickup'
import { INTAKE_FIELDS, UPLOAD_FIELDS, INTAKE_COMPLETE_FIELD_ID, toUtcEpoch, validateUploadSize, validateUploadTotal } from '@/lib/intake-fields'
import { sendErrorAlert } from '@/lib/email'
import { normalizePhone } from '@/lib/phone'

async function uploadAttachment(taskId: string, file: File) {
  const apiKey = process.env.CLICKUP_API_KEY
  if (!apiKey) throw new Error('CLICKUP_API_KEY not set')

  const formData = new FormData()
  formData.append('attachment', file, file.name)

  const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
    method: 'POST',
    headers: { Authorization: apiKey },
    body: formData,
  })

  if (!res.ok) {
    throw new Error(`ClickUp attachment upload failed: ${res.status}`)
  }
}

// Replace raw ClickUp field IDs in an error message with the field's label
// so alert emails read "Phone (2d0cc4d7…)" instead of a bare UUID.
const FIELD_LABELS: Array<[string, string]> = [
  ...INTAKE_FIELDS.filter((f) => f.clickupFieldId).map((f) => [f.clickupFieldId, f.label] as [string, string]),
  [INTAKE_COMPLETE_FIELD_ID, 'Intake Form Complete'],
]
function describeFieldIds(message: string): string {
  return FIELD_LABELS.reduce((msg, [id, label]) => msg.split(id).join(`"${label}" (${id.slice(0, 8)}…)`), message)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const formData = await req.formData()
    const { taskId } = params

    // Same upload limits the form enforces, in case a request bypasses it
    const uploads = UPLOAD_FIELDS.map((u) => {
      const f = formData.get(u.name)
      return f instanceof File && f.size > 0 ? f : null
    })
    const uploadError = uploads.map(validateUploadSize).find(Boolean) || validateUploadTotal(uploads)
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 })
    }

    // All events are Pacific Time
    const tz = 'America/Los_Angeles'

    // Build custom field updates from form data
    const fieldUpdates: Array<{ id: string; value: unknown; value_options?: Record<string, unknown> }> = []

    // Live name -> option UUID maps for every dropdown on the task, so we write
    // dropdown values by ClickUp's canonical id instead of by local array index.
    const dropdownMaps = await fetchDropdownOptionIds(taskId)

    for (const field of INTAKE_FIELDS) {
      const rawValue = formData.get(field.name) as string | null
      if (!rawValue) continue
      if (!field.clickupFieldId) continue

      let value: unknown = rawValue

      switch (field.clickupFieldType) {
        case 'number':
          value = Number(rawValue)
          break
        case 'date':
          value = toUtcEpoch(rawValue, tz)
          fieldUpdates.push({ id: field.clickupFieldId, value, value_options: { time: true } })
          continue
        case 'drop_down': {
          // Resolve the selected label to ClickUp's stable option UUID. Falling
          // back to a positional index is what caused values to land on the
          // wrong option, so if we can't resolve the id we skip the field
          // rather than write a guess.
          const optionId = dropdownMaps[field.clickupFieldId]?.[rawValue]
          if (!optionId) {
            console.error(
              `Dropdown option not found in ClickUp: field=${field.name} value="${rawValue}" — skipping`
            )
            continue
          }
          value = optionId
          break
        }
        case 'location': {
          const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          if (!key) { continue }
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(rawValue)}&key=${key}`
          )
          const geoData = await geoRes.json()
          const loc = geoData.results?.[0]?.geometry?.location
          if (loc) {
            value = { formatted_address: rawValue, location: { lat: loc.lat, lng: loc.lng } }
          } else {
            continue
          }
          break
        }
        case 'phone': {
          // ClickUp only accepts E.164. Skip rather than fail the whole
          // submission on a number we can't normalise.
          const normalized = normalizePhone(rawValue)
          if (!normalized) {
            console.error(`Phone could not be normalised: "${rawValue}" — skipping`)
            continue
          }
          value = normalized
          break
        }
        default:
          value = rawValue
      }

      fieldUpdates.push({ id: field.clickupFieldId, value })
    }

    // Sandcastle: copy delivery location to event location field
    const selectedPackage = formData.get('package') as string || ''
    if (selectedPackage === 'Sandcastle') {
      const deliveryLocation = fieldUpdates.find((f) => f.id === '967038c5-4d18-41d5-8c63-f01bf20ece7a')
      if (deliveryLocation) {
        fieldUpdates.push({ id: 'b92b1e46-363e-4453-9888-b530ecdeefce', value: deliveryLocation.value })
      }
    }

    // Update task-level fields (name, start date, due date)
    const apiKey = process.env.CLICKUP_API_KEY
    if (apiKey) {
      const taskUpdate: Record<string, unknown> = {}

      const eventName = formData.get('eventName') as string | null
      if (eventName) taskUpdate.name = eventName

      const setupTime = formData.get('setupTime') as string | null
      const teardownTime = formData.get('teardownTime') as string | null
      if (setupTime) {
        taskUpdate.start_date = toUtcEpoch(setupTime, tz)
        taskUpdate.start_date_time = true
      }

      if (teardownTime) {
        taskUpdate.due_date = toUtcEpoch(teardownTime, tz)
        taskUpdate.due_date_time = true
      }

      if (Object.keys(taskUpdate).length > 0) {
        await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
          method: 'PUT',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(taskUpdate),
        })
      }
    }

    // Update all custom fields
    await updateTaskFields(taskId, fieldUpdates)

    // Upload file attachments with prefixed filenames
    for (const upload of UPLOAD_FIELDS) {
      const file = formData.get(upload.name) as File | null
      if (file && file.size > 0) {
        const prefixedName = `${upload.prefix} ${file.name}`
        const renamedFile = new File([file], prefixedName, { type: file.type })
        await uploadAttachment(taskId, renamedFile)
        console.log(`Uploaded ${upload.name}: ${prefixedName}`)
      }
    }

    // Only now, with every field and upload saved, mark the intake complete.
    // Resolve "Yes" to its option UUID, falling back to orderindex 0.
    const completeYesId = dropdownMaps[INTAKE_COMPLETE_FIELD_ID]?.['Yes']
    await updateTaskFields(taskId, [{ id: INTAKE_COMPLETE_FIELD_ID, value: completeYesId ?? 0 }])

    console.log(`Intake form submitted for task ${taskId} — ${fieldUpdates.length} fields updated`)

    return NextResponse.json({ success: true })
  } catch (err) {
    const errorMsg = describeFieldIds(err instanceof Error ? err.message : 'Unknown error')
    console.error('Intake submission error:', err)
    await sendErrorAlert({
      source: 'Intake Form Submission',
      error: errorMsg,
      context: { taskId: params.taskId },
    })
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
