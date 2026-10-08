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

// Everyone who should know when a Closed Won deal arrives with blank fields
const MISSING_FIELDS_RECIPIENTS = [SMTP_USER, ALERT_EMAIL, EVENT_LEAD_EMAIL]

/**
 * Tell Harrison, Jordan, and Trent that a deal came through the Pipedrive
 * webhook with required fields blank. Never throws; a failed alert is logged
 * so it cannot block task creation.
 */
export async function sendMissingFieldsAlert(params: {
  dealTitle: string
  dealId: string
  missing: string[]
  taskUrl?: string
}) {
  try {
    const transporter = getTransporter()
    const dealLink = params.dealId
      ? `<a href="https://app.pipedrive.com/deal/${params.dealId}">Open deal ${params.dealId} in Pipedrive</a>`
      : 'Deal ID was not included in the payload.'
    const taskLink = params.taskUrl
      ? `<p><a href="${params.taskUrl}">Open the ClickUp task</a></p>`
      : '<p>No ClickUp task was created for this deal.</p>'

    await transporter.sendMail({
      from: `WSC Alerts <${SMTP_USER}>`,
      to: MISSING_FIELDS_RECIPIENTS,
      subject: `[WSC] Missing deal info: ${params.dealTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h3 style="color: #c44b2b;">A Closed Won deal is missing required fields</h3>
          <p><strong>${params.dealTitle}</strong></p>
          <p>These fields were blank when the deal was marked won:</p>
          <ul>${params.missing.map((m) => `<li>${m}</li>`).join('')}</ul>
          <p>Please fill them in on the Pipedrive deal and the ClickUp task.</p>
          <p>${dealLink}</p>
          ${taskLink}
          <p style="color: #999; font-size: 12px; margin-top: 16px;">Sent from windansea.vercel.app at ${new Date().toISOString()}</p>
        </div>
      `,
    })
  } catch (emailErr) {
    console.error('Failed to send missing-fields alert email:', emailErr)
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
        <p>Thank you for booking with Windansea Coconuts. We're looking forward to your event.</p>
        <p>I've copied Trent, your Event Lead, who'll be your main point of contact from here through service. Either of us is happy to help with anything along the way.</p>
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
  attachments: Array<{ filename: string; content: Buffer; contentType?: string }>
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
    attachments: params.attachments,
  })
}

/**
 * Dry-run delivery for the ROS cron: the generated file goes to Jordan instead
 * of ClickUp, with the comment that would have been posted.
 */
export async function sendRosDraftEmail(params: {
  taskName: string
  taskUrl: string
  filename: string
  content: Buffer
  comment: string
}) {
  const transporter = getTransporter()
  await transporter.sendMail({
    from: `WSC ROS Bot <${SMTP_USER}>`,
    to: ALERT_EMAIL,
    subject: `[ROS dry run] ${params.taskName}`,
    text: `${params.comment}\n\nTask: ${params.taskUrl}\n\nThis is a dry run. Nothing was written to ClickUp.`,
    attachments: [
      {
        filename: params.filename,
        content: params.content,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  })
}
