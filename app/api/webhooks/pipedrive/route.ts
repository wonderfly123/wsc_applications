import { NextRequest, NextResponse } from 'next/server'
import { createTask, updateTaskFields } from '@/lib/clickup'
import { sendIntakeEmail, sendErrorAlert } from '@/lib/email'

// ClickUp custom field IDs
const CLICKUP_FIELDS = {
  pipedriveDealId: '658579ec-2913-478e-9613-cade4ba6cf68',
  pipedriveDealTitle: '9d8e3b50-556e-4039-8062-7a2bb4ac4fee',
  intakeFormComplete: 'dbeda913-50e7-4988-9f1d-d28ec26a9a6d', // Options: Yes=0, No=1
  clientEmail: 'a4316b37-4646-4db8-93d7-c37561d17a77',
  clientPhone: '2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48',
  clientFirstName: '6448e40e-5c59-4aeb-b99a-5755536b9463',
  clientLastName: '7ec644ea-814a-4a79-ab52-4a4543466cfb',
  coconutQty: '3e9943e1-4e51-466b-9d6d-f01e862a1bec',
  uniqueIntakeForm: '4f498bf1-9f98-4c8d-a2ce-b4499c8fec6c',
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()

    console.log('=== PIPEDRIVE WEBHOOK RECEIVED ===')
    console.log(JSON.stringify(body, null, 2))

    // Payload from Pipedrive automation (flat key-value pairs)
    const dealTitle = (body.deal_title as string) || 'Untitled Event'
    const contactName = (body.contact_name as string) || ''
    const contactEmail = ((body.contact_email as string) || '').replace(/^mailto:/i, '')
    const rawPhone = ((body.contact_phone as string) || '').replace(/\D/g, '')
    // ClickUp phone fields require E.164 format — prepend +1 for US numbers
    const contactPhone = rawPhone ? (rawPhone.length === 10 ? `+1${rawPhone}` : `+${rawPhone}`) : ''
    const pipedriveDealId = (body.pipedrive_deal_id as string) || ''
    const eventDate = (body.event_date as string) || ''
    const coconutQty = (body.coconut_qty as string) || ''

    if (!contactEmail) {
      const msg = 'No contact email found in webhook payload'
      console.error(msg)
      await sendErrorAlert({
        source: 'Pipedrive Webhook',
        error: msg,
        context: { dealId: pipedriveDealId, dealTitle, contactName, payload: body },
      })
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const description = ''

    // Split contact name into first/last
    const nameParts = contactName.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Custom fields to set on task creation
    const customFields: Array<{ id: string; value: unknown }> = [
      { id: CLICKUP_FIELDS.pipedriveDealId, value: pipedriveDealId },
      { id: CLICKUP_FIELDS.pipedriveDealTitle, value: dealTitle },
      { id: CLICKUP_FIELDS.intakeFormComplete, value: 1 }, // "No" on creation
      { id: CLICKUP_FIELDS.clientEmail, value: contactEmail },
    ]
    if (contactPhone) customFields.push({ id: CLICKUP_FIELDS.clientPhone, value: contactPhone })
    if (firstName) customFields.push({ id: CLICKUP_FIELDS.clientFirstName, value: firstName })
    if (lastName) customFields.push({ id: CLICKUP_FIELDS.clientLastName, value: lastName })
    if (coconutQty && !isNaN(Number(coconutQty))) customFields.push({ id: CLICKUP_FIELDS.coconutQty, value: Number(coconutQty) })

    // Parse event date for task due date
    // Pipedrive sends date-only ("2026-03-28"). Use noon UTC so the date
    // displays on the correct calendar day in any US timezone.
    const dueDate = eventDate ? new Date(`${eventDate}T12:00:00Z`).getTime() : undefined

    // 1. Create ClickUp task with Pipedrive fields pre-populated
    const task = await createTask(dealTitle, description, customFields, { dueDate })
    console.log('ClickUp task created:', task.id)

    // 2. Build intake URL and set it on the task
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://windansea.vercel.app'
    const intakeUrl = `${baseUrl}/intake/${task.id}`

    await updateTaskFields(task.id, [
      { id: CLICKUP_FIELDS.uniqueIntakeForm, value: intakeUrl },
    ])

    // 3. Send email
    await sendIntakeEmail({
      to: contactEmail,
      clientName: contactName.split(' ')[0] || 'there',
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
      context: {
        url: req.url,
        dealId: body.pipedrive_deal_id,
        dealTitle: body.deal_title,
        contactName: body.contact_name,
        payload: body,
      },
    })
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
