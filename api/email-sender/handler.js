/**
 * Email Sender Lambda — runs OUTSIDE the VPC so it can reach the internet.
 * Invoked asynchronously by the main API Lambda to send emails via Resend.
 *
 * Event payload: { to, subject, html }
 */

const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL || 'ReelMaps <noreply@contact.reelmaps.ai>'

exports.handler = async (event) => {
  const { to, subject, html } = event

  if (!to || !subject || !html) {
    console.error('Missing required fields:', { to: !!to, subject: !!subject, html: !!html })
    return { statusCode: 400, error: 'Missing to, subject, or html' }
  }

  console.log(`Sending email to ${to}, subject: ${subject}`)

  const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html })

  if (result.error) {
    console.error('Resend error:', JSON.stringify(result.error))
    return { statusCode: 500, error: result.error.message }
  }

  console.log(`Email delivered to Resend: id=${result.data?.id}`)
  return { statusCode: 200, id: result.data?.id }
}
