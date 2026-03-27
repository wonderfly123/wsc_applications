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
    subject: `Your Event with Windansea Coconuts`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; color: #1e1d1a; font-size: 15px; line-height: 1.7;">
        <p>Hi ${clientName},</p>
        <p>We're so excited to be part of your special day! To ensure everything is perfectly tailored to your vision, we've put together a quick event details form for you.</p>
        <p>When you have a moment, please <a href="${intakeUrl}" style="color: #8b6914;">fill out your event details here</a>.</p>
        <p>This helps our team prepare every detail so your experience is nothing short of exceptional.</p>
        <p style="margin-top: 28px;">
          Warmly,<br/>
          <span style="color: #878774;">Windansea Coconuts</span>
        </p>
      </div>
    `,
  })
}
