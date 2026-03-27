import { NextRequest, NextResponse } from 'next/server'
import { updateTaskFields } from '@/lib/clickup'
import { INTAKE_FIELDS, UPLOAD_FIELDS, INTAKE_COMPLETE_FIELD_ID } from '@/lib/intake-fields'
import { sendErrorAlert } from '@/lib/email'

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
    const fieldUpdates: Array<{ id: string; value: unknown }> = []

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
          value = new Date(rawValue).getTime()
          break
        case 'drop_down': {
          const optionIndex = field.options?.indexOf(rawValue)
          if (optionIndex !== undefined && optionIndex >= 0) {
            value = optionIndex
          }
          break
        }
        case 'location': {
          const lat = formData.get(`${field.name}_lat`) as string | null
          const lng = formData.get(`${field.name}_lng`) as string | null
          console.log(`Location ${field.name}: address="${rawValue}" lat="${lat}" lng="${lng}"`)
          if (lat && lng) {
            value = { formatted_address: rawValue, location: { lat: parseFloat(lat), lng: parseFloat(lng) } }
          } else {
            // No lat/lng from client — skip, ClickUp requires coordinates
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

    // Mark intake as complete (0 = "Yes", first option)
    fieldUpdates.push({ id: INTAKE_COMPLETE_FIELD_ID, value: 0 })

    // Update task name if eventName was provided
    const eventName = formData.get('eventName') as string | null
    if (eventName) {
      const apiKey = process.env.CLICKUP_API_KEY
      if (apiKey) {
        await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
          method: 'PUT',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: eventName }),
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
