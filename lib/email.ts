import nodemailer from 'nodemailer'
import { DECAL_RECIPIENT, DECAL_CC, DECAL_REPLY_TO } from './decal'

const SMTP_USER = 'harrison@windanseacoconuts.com'

// Event Lead, CC'd on client intake emails
const EVENT_LEAD_EMAIL = 'trent@windanseacoconuts.com'

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

const ALERT_EMAIL = 'jordan@windanseacoconuts.com'

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
    cc: EVENT_LEAD_EMAIL,
    subject: `Welcome to Windansea Coconuts, let's plan your event`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; font-size: 14px; line-height: 1.6;">
        <p>Hi ${clientName},</p>
        <p>I'm Harrison, owner of Windansea Coconuts, and I'm so glad you've chosen us for your event. Thank you for the opportunity.</p>
        <p>I'd love to introduce you to Trent, copied here, who will be your dedicated Event Lead. Trent will look after every detail of your event from today through service, so you'll always have one familiar point of contact who knows your celebration inside and out.</p>
        <p>To get started, please fill out the event details form below. We need this information to plan and confirm your event, so please complete it as soon as you can.</p>
        <p><a href="${intakeUrl}" style="color: #1a73e8;">Share your event details here</a></p>
        <p>This link is unique to your event, so please return anytime. Your details are saved and ready to refine whenever you'd like.</p>
        <p>We can't wait to create something memorable for you.</p>
        <p>Warmly,<br/>Harrison<br/>Owner, Windansea Coconuts 🥥</p>
      </div>
    `,
  })
}

export async function sendDecalOrderEmail(params: {
  subject: string
  html: string
  text: string
  attachment?: { filename: string; content: Buffer; contentType?: string }
}) {
  const transporter = getTransporter()
  await transporter.sendMail({
    from: `Windansea Coconuts <${SMTP_USER}>`,
    to: DECAL_RECIPIENT,
    cc: DECAL_CC,
    replyTo: DECAL_REPLY_TO,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachment ? [params.attachment] : undefined,
  })
}
