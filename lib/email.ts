import nodemailer from 'nodemailer'

const SMTP_USER = 'harrison@windanseacoconuts.com'

function getTransporter() {
  const pass = process.env.SMTP_PASS
  if (!pass) throw new Error('SMTP_PASS must be set')

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass },
  })
}

const ALERT_EMAIL = 'jordan@wonderflyathletics.com'

export async function sendErrorAlert(params: {
  source: string
  error: string
  context?: Record<string, unknown>
}) {
  try {
    const transporter = getTransporter()
    const contextHtml = params.context
      ? `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${JSON.stringify(params.context, null, 2)}</pre>`
      : ''

    await transporter.sendMail({
      from: `WSC Alerts <${SMTP_USER}>`,
      to: ALERT_EMAIL,
      subject: `[WSC Error] ${params.source}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h3 style="color: #c44b2b;">Error in ${params.source}</h3>
          <p style="background: #fff0f0; padding: 12px; border-radius: 4px; border: 1px solid #fdd;">${params.error}</p>
          ${contextHtml}
          <p style="color: #999; font-size: 12px; margin-top: 16px;">Sent from windansea.vercel.app at ${new Date().toISOString()}</p>
        </div>
      `,
    })
  } catch (emailErr) {
    // Don't let alert failures cascade — just log
    console.error('Failed to send error alert email:', emailErr)
  }
}

export async function sendIntakeEmail(params: {
  to: string
  clientName: string
  eventName: string
  intakeUrl: string
}) {
  const { to, clientName, eventName, intakeUrl } = params
  const transporter = getTransporter()

  await transporter.sendMail({
    from: `Windansea Coconuts <${SMTP_USER}>`,
    to,
    subject: `Event Intake Form — ${eventName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${clientName},</h2>
        <p>Thank you for booking with Windansea Coconuts! Please fill out the intake form below so we can finalize the details for your event.</p>
        <p style="margin: 24px 0;">
          <a href="${intakeUrl}" style="background: #1e1d1a; color: #f0ede4; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Fill Out Intake Form
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Event: ${eventName}</p>
        <p style="color: #999; font-size: 12px;">If you have questions, reply to this email.</p>
      </div>
    `,
  })
}
