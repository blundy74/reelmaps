/**
 * Email service — invokes a separate non-VPC Lambda to send emails.
 * This bypasses the VPC internet access limitation.
 *
 * The reelmaps-email-sender Lambda runs outside the VPC and can reach
 * the Resend API directly.
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-2' })
const EMAIL_FUNCTION = process.env.EMAIL_FUNCTION || 'reelmaps-email-sender'

async function sendEmail(to, subject, html) {
  console.log(`Invoking email Lambda for ${to}, subject: ${subject}`)

  const command = new InvokeCommand({
    FunctionName: EMAIL_FUNCTION,
    InvocationType: 'RequestResponse', // Wait for result
    Payload: JSON.stringify({ to, subject, html }),
  })

  const response = await lambda.send(command)
  const result = JSON.parse(Buffer.from(response.Payload).toString())

  if (result.statusCode !== 200) {
    console.error(`Email Lambda error for ${to}:`, JSON.stringify(result))
    throw new Error(result.error || 'Email send failed')
  }

  console.log(`Email sent to ${to}: id=${result.id}`)
  return result
}

module.exports = { sendEmail }
