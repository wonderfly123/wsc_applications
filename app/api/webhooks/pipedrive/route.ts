import { NextRequest, NextResponse } from 'next/server'
import { createTask } from '@/lib/clickup'
import { sendIntakeEmail, sendErrorAlert } from '@/lib/email'

// ClickUp custom field IDs
const CLICKUP_FIELDS = {
  pipedriveDealId: '658579ec-2913-478e-9613-cade4ba6cf68',
  pipedriveDealTitle: '9d8e3b50-556e-4039-8062-7a2bb4ac4fee',
  intakeFormComplete: 'dbeda913-50e7-4988-9f1d-d28ec26a9a6d', // Options: Yes=0, No=1
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('=== PIPEDRIVE WEBHOOK RECEIVED ===')
    console.log(JSON.stringify(body, null, 2))

    // Payload from Pipedrive automation (flat key-value pairs)
    const dealTitle = body.deal_title || 'Untitled Event'
    const contactName = body.contact_name || ''
    const contactEmail = body.contact_email || ''
    const contactPhone = body.contact_phone || ''
    const pipedriveDealId = body.pipedrive_deal_id || ''
    const eventDate = body.event_date || ''
    const coconutQty = body.coconut_qty || ''

    if (!contactEmail) {
      console.error('No contact email in webhook payload')
      return NextResponse.json(
        { error: 'No contact email found in webhook payload' },
        { status: 400 }
      )
    }

    // Build task description from deal data
    const description = [
      `Pipedrive Deal: ${dealTitle} (ID: ${pipedriveDealId})`,
      `Contact: ${contactName}`,
      `Email: ${contactEmail}`,
      contactPhone ? `Phone: ${contactPhone}` : '',
      eventDate ? `Event Date: ${eventDate}` : '',
      coconutQty ? `Coconuts: ${coconutQty}` : '',
    ].filter(Boolean).join('\n')

    // Custom fields to set on task creation
    const customFields = [
      { id: CLICKUP_FIELDS.pipedriveDealId, value: pipedriveDealId },
      { id: CLICKUP_FIELDS.pipedriveDealTitle, value: dealTitle },
      { id: CLICKUP_FIELDS.intakeFormComplete, value: 1 }, // "No" on creation
    ]

    // 1. Create ClickUp task with Pipedrive fields pre-populated
    const task = await createTask(dealTitle, description, customFields)
    console.log('ClickUp task created:', task.id)

    // 2. Build intake URL and send email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://windansea.vercel.app'
    const intakeUrl = `${baseUrl}/intake/${task.id}`

    await sendIntakeEmail({
      to: contactEmail,
      clientName: contactName.split(' ')[0] || 'there',
      eventName: dealTitle,
      intakeUrl,
    })
    console.log('Intake email sent to:', contactEmail)

    return NextResponse.json({
      success: true,
      taskId: task.id,
      intakeUrl,
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Pipedrive webhook error:', err)
    await sendErrorAlert({
      source: 'Pipedrive Webhook',
      error: errorMsg,
      context: { url: req.url },
    })
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
