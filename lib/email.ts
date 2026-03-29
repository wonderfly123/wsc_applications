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
  intakeUrl: string
}) {
  const { to, clientName, intakeUrl } = params
  const transporter = getTransporter()

  await transporter.sendMail({
    from: `Windansea Coconuts <${SMTP_USER}>`,
    to,
    subject: `🔥 Action Needed - We Need Your Event Details`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; font-size: 14px; line-height: 1.6;">
        <p>Hi ${clientName},</p>
        <p>Thank you so much for choosing Windansea Coconuts! We can't wait to make your event special.</p>
        <p>To get started, please fill out our quick event details form so we can make sure everything is perfect for your big day.</p>
        <p><a href="${intakeUrl}" style="color: #1a73e8;">Fill out your event details here</a></p>
        <p>This link is unique to your event. If you ever need to update any details, just come back to this form. It will have your information ready to edit anytime.</p>
        <p>Warmly,<br/>🥥 Windansea Coconuts</p>
      </div>
    `,
  })
}
