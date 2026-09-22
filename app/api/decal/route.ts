import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendDecalOrderEmail, sendErrorAlert } from '@/lib/email'
import { validateDecalOrder, validateLogoFile, buildDecalEmail, safeFilename } from '@/lib/decal'

function passwordMatches(supplied: string): boolean {
  const expected = process.env.DECAL_FORM_PASSWORD
  if (!expected) throw new Error('DECAL_FORM_PASSWORD not set')
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const password = (formData.get('password') as string | null) ?? ''
    if (!passwordMatches(password)) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    // The form's password gate only needs to know the password is right
    if (formData.get('action') === 'unlock') {
      return NextResponse.json({ ok: true })
    }

    const validation = validateDecalOrder({
      name: formData.get('name'),
      email: formData.get('email'),
      job: formData.get('job'),
      size: formData.get('size'),
      quantity: formData.get('quantity'),
      neededBy: formData.get('neededBy'),
      notes: formData.get('notes'),
      rush: formData.get('rush'),
    })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { order } = validation

    const logo = formData.get('logo')
    const file = logo instanceof File && logo.size > 0 ? logo : null
    const fileError = validateLogoFile(file ? { name: file.name, size: file.size } : null)
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 })
    }

    const attachment = file
      ? {
          filename: safeFilename(file.name),
          content: Buffer.from(await file.arrayBuffer()),
          contentType: file.type || undefined,
        }
      : undefined

    const { subject, html, text } = buildDecalEmail(order, attachment?.filename ?? null)
    await sendDecalOrderEmail({ subject, html, text, attachment })

    console.log(`Decal order sent: ${order.job} — ${order.quantity} × ${order.size}" (${order.email})`)
    return NextResponse.json({ success: true })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Decal order error:', err)
    await sendErrorAlert({ source: 'Decal Order Form', error: errorMsg, context: { url: req.url } })
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
