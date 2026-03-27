import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    // Log the full payload so we can see what Pipedrive sends
    console.log('=== PIPEDRIVE WEBHOOK RECEIVED ===')
    console.log(JSON.stringify(payload, null, 2))
    console.log('=== END PIPEDRIVE WEBHOOK ===')

    // TODO: Once we know the payload shape, add:
    // 1. Create ClickUp task
    // 2. Send intake email to client

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Pipedrive webhook error:', err)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}
