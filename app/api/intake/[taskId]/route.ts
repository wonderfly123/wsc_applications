import { NextRequest, NextResponse } from 'next/server'
import { updateTaskFields } from '@/lib/clickup'
import { INTAKE_FIELDS, UPLOAD_FIELDS, INTAKE_COMPLETE_FIELD_ID } from '@/lib/intake-fields'
import { sendErrorAlert } from '@/lib/email'

// Parse a date + time string as Pacific Time and return epoch ms
function toPacificEpoch(date: string, time: string): number {
  // Build an ISO-ish string and use Intl to find the UTC offset for Pacific
  const dt = new Date(`${date}T${time}:00`)
  const utcStr = dt.toLocaleString('en-US', { timeZone: 'UTC' })
  const pacStr = dt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const utcDate = new Date(utcStr)
  const pacDate = new Date(pacStr)
  const offsetMs = utcDate.getTime() - pacDate.getTime()
  // The input time IS Pacific, so add offset to get UTC epoch
  return new Date(`${date}T${time}:00`).getTime() + offsetMs
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const formData = await req.formData()
    const { taskId } = params

    // Build custom field updates from form data
    const fieldUpdates: Array<{ id: string; value: unknown; value_options?: Record<string, unknown> }> = []

    const eventDate = formData.get('eventDate') as string || ''

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
          // Time fields combined with event date, interpreted as Pacific Time
          value = eventDate ? toPacificEpoch(eventDate, rawValue) : new Date(rawValue).getTime()
          fieldUpdates.push({ id: field.clickupFieldId, value, value_options: { time: true } })
          continue
        case 'drop_down': {
          const optionIndex = field.options?.indexOf(rawValue)
          if (optionIndex !== undefined && optionIndex >= 0) {
            value = optionIndex
          }
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
          // Normalize to E.164: strip non-digits, prepend +1 if needed
          const digits = rawValue.replace(/\D/g, '')
          value = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits[0] === '1' ? `+${digits}` : `+${digits}`
          break
        }
        default:
          value = rawValue
      }

      fieldUpdates.push({ id: field.clickupFieldId, value })
    }

    // Sandcastle: copy delivery location to event location field
    const selectedPkg = formData.get('package') as string || ''
    if (selectedPkg === 'Sandcastle') {
      const deliveryLocation = fieldUpdates.find((f) => f.id === '967038c5-4d18-41d5-8c63-f01bf20ece7a')
      if (deliveryLocation) {
        fieldUpdates.push({ id: 'b92b1e46-363e-4453-9888-b530ecdeefce', value: deliveryLocation.value })
      }
    }

    // Mark intake as complete (0 = "Yes", first option)
    fieldUpdates.push({ id: INTAKE_COMPLETE_FIELD_ID, value: 0 })

    // Update task-level fields (name, start date, due date)
    const apiKey = process.env.CLICKUP_API_KEY
    if (apiKey) {
      const taskUpdate: Record<string, unknown> = {}

      const eventName = formData.get('eventName') as string | null
      if (eventName) taskUpdate.name = eventName

      const selectedPackage = formData.get('package') as string || ''
      const setupTime = formData.get('setupTime') as string | null
      const teardownTime = formData.get('teardownTime') as string | null
      if (eventDate && setupTime) {
        const setupTimestamp = toPacificEpoch(eventDate, setupTime)
        taskUpdate.start_date = setupTimestamp
        taskUpdate.start_date_time = true

        // Sandcastle is a drop-off — same time for start and due date
        if (selectedPackage === 'Sandcastle') {
          taskUpdate.due_date = setupTimestamp
          taskUpdate.due_date_time = true
        }
      }

      if (teardownTime && eventDate && selectedPackage !== 'Sandcastle') {
        taskUpdate.due_date = toPacificEpoch(eventDate, teardownTime)
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

    console.log(`Intake form submitted for task ${taskId} — ${fieldUpdates.length} fields updated`)

    return NextResponse.json({ success: true })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
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
