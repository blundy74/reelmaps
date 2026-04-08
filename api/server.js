const fs = require('fs')
const path = require('path')

// Load .env file if present (local dev only — Lambda uses env vars directly)
try {
  const envPath = path.join(__dirname, '.env')
  const envFile = fs.readFileSync(envPath, 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx)
      const val = trimmed.slice(eqIdx + 1)
      if (!process.env[key]) process.env[key] = val
    }
  }
} catch { /* .env file optional */ }

const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuid } = require('uuid')
const { query, execute } = require('./db.js')
const { sendEmail } = require('./email.js')
const { getVerificationEmailHtml, getWelcomeEmailHtml, getGoodbyeEmailHtml, getPremiumWelcomeEmailHtml } = require('./emailTemplates.js')

const Stripe = require('stripe')

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'reelmaps-dev-secret-change-in-prod'
const JWT_EXPIRY = '7d'
const APP_URL = process.env.APP_URL || 'https://reelmaps.ai'

// Stripe configuration
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-12-18.acacia' })
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '' // Monthly subscription price ID

app.use(cors())

// Stripe webhook needs raw body — must be BEFORE express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature']
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)
    } else {
      event = JSON.parse(req.body.toString())
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  console.log(`Stripe webhook: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.userId || session.client_reference_id
        const customerId = session.customer
        const subscriptionId = session.subscription

        if (userId) {
          await execute(
            `UPDATE users SET is_premium = true, stripe_customer_id = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE id = $3`,
            [customerId, subscriptionId, userId]
          )

          // Fetch subscription to get renewal date
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            const renewDate = new Date(sub.current_period_end * 1000).toISOString()
            await execute('UPDATE users SET subscription_renew_date = $1 WHERE id = $2', [renewDate, userId])
          }

          console.log(`User ${userId} upgraded to premium (customer: ${customerId}, subscription: ${subscriptionId})`)

          // Send Welcome to Premium email
          try {
            const userRow = await query('SELECT email, display_name FROM users WHERE id = $1', [userId])
            if (userRow.rows.length > 0) {
              const { email, display_name } = userRow.rows[0]
              await sendEmail(email, 'Welcome to ReelMaps Premium! ⭐', getPremiumWelcomeEmailHtml(display_name))
              console.log(`Premium welcome email sent to ${email}`)
            }
          } catch (emailErr) {
            console.error('Failed to send premium welcome email:', emailErr.message)
          }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const customerId = invoice.customer
        const subscriptionId = invoice.subscription

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const renewDate = new Date(sub.current_period_end * 1000).toISOString()
          await execute(
            `UPDATE users SET is_premium = true, subscription_renew_date = $1, updated_at = NOW() WHERE stripe_customer_id = $2`,
            [renewDate, customerId]
          )
          console.log(`Subscription renewed for customer ${customerId}, next renewal: ${renewDate}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const customerId = sub.customer

        if (sub.cancel_at_period_end) {
          // User cancelled — keep premium until period ends, set expiration date
          const expiresAt = new Date(sub.current_period_end * 1000).toISOString()
          await execute(
            `UPDATE users SET subscription_renew_date = NULL, subscription_expires_at = $1, updated_at = NOW() WHERE stripe_customer_id = $2`,
            [expiresAt, customerId]
          )
          console.log(`Subscription cancellation scheduled for customer ${customerId}, expires: ${expiresAt}`)
        } else {
          // Subscription reactivated or updated — clear expiration
          const renewDate = new Date(sub.current_period_end * 1000).toISOString()
          await execute(
            `UPDATE users SET subscription_renew_date = $1, subscription_expires_at = NULL, updated_at = NOW() WHERE stripe_customer_id = $2`,
            [renewDate, customerId]
          )
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const customerId = sub.customer
        await execute(
          `UPDATE users SET is_premium = false, stripe_subscription_id = NULL, subscription_renew_date = NULL, subscription_expires_at = NULL, updated_at = NOW() WHERE stripe_customer_id = $1`,
          [customerId]
        )
        console.log(`Subscription ended for customer ${customerId} — premium revoked`)
        break
      }
    }
  } catch (err) {
    console.error('Stripe webhook processing error:', err)
  }

  res.json({ received: true })
})

app.use(express.json())

// ── Helpers ─────────────────────────────────────────────────────────────────

function getClientIp(req) {
  // Behind API Gateway / CloudFront / ALB the real IP is in x-forwarded-for
  const xff = req.headers['x-forwarded-for']
  if (xff) return xff.split(',')[0].trim()
  return req.socket?.remoteAddress || req.ip || '0.0.0.0'
}

function getUserAgent(req) {
  return (req.headers['user-agent'] || '').slice(0, 512)
}

// ── Auth Middleware ──────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── Activity logger (runs async, never blocks the response) ─────────────────

function logActivity(req, sessionId) {
  const ip = getClientIp(req)
  const ua = getUserAgent(req)
  execute(
    `INSERT INTO activity_log (user_id, session_id, ip_address, endpoint, method, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.user.userId, sessionId || null, ip, req.path, req.method, ua]
  ).catch(() => {}) // fire-and-forget
}

// ── Verification code helper ────────────────────────────────────────────────

async function sendVerificationCode(userId, email, displayName) {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  await execute(
    `INSERT INTO email_verification_codes (user_id, code, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [userId, code]
  )
  // Must await on Lambda — runtime freezes after response, killing pending async ops
  try {
    await sendEmail(email, 'Verify your ReelMaps email', getVerificationEmailHtml(displayName, code, userId))
  } catch (err) {
    console.error('Verification email failed:', err.message)
  }
}

/** Log a user lifecycle event (permanent audit trail). */
function logAudit(userId, email, event, req, metadata) {
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null
  const ua = req?.headers?.['user-agent'] || null
  execute(
    `INSERT INTO user_audit_log (user_id, email, event, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, email, event, ip, ua, metadata ? JSON.stringify(metadata) : null]
  ).catch(err => console.error('Audit log failed:', err.message))
}

// ── Session creation (called on login/register) ─────────────────────────────

async function createSession(userId, req) {
  const id = uuid()
  const ip = getClientIp(req)
  const ua = getUserAgent(req)
  await execute(
    `INSERT INTO sessions (id, user_id, ip_address, user_agent, created_at, last_active_at, is_active)
     VALUES ($1, $2, $3, $4, NOW(), NOW(), true)`,
    [id, userId, ip, ua]
  )
  return id
}

// ── Health check ────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({ status: 'ok', database: 'connected' })
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message })
  }
})

// ── Auth Routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    // Check email uniqueness — but allow re-registration if previous account was deactivated
    const existingEmail = await query('SELECT id, password_hash FROM users WHERE email = $1', [email.toLowerCase()])
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Check if there's a deactivated account with this email — reactivate it
    const deactivated = await query(
      `SELECT id, display_name FROM users WHERE email LIKE $1 AND password_hash = 'DEACTIVATED' ORDER BY updated_at DESC LIMIT 1`,
      [`deactivated_%_${email.toLowerCase()}`]
    )
    if (deactivated.rows.length > 0) {
      // Reactivate: restore email, set new password, keep all data
      const reactivateId = deactivated.rows[0].id
      const newHash = await bcrypt.hash(password, 8)
      const reName = displayName || deactivated.rows[0].display_name || email.split('@')[0]
      await execute(
        `UPDATE users SET email = $1, password_hash = $2, display_name = $3, email_verified = false, updated_at = NOW() WHERE id = $4`,
        [email.toLowerCase(), newHash, reName, reactivateId]
      )

      const [sessionId] = await Promise.all([
        createSession(reactivateId, req),
        sendVerificationCode(reactivateId, email.toLowerCase(), reName).catch(err => {
          console.error('Verification email failed:', err.message)
        }),
      ])

      const token = jwt.sign({ userId: reactivateId, email: email.toLowerCase(), sessionId }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
      logAudit(reactivateId, email.toLowerCase(), 'reactivated', req, { displayName: reName })
      return res.status(201).json({
        token,
        user: { id: reactivateId, email: email.toLowerCase(), displayName: reName, emailVerified: false },
      })
    }

    // Check display name uniqueness
    const chosenName = displayName || email.split('@')[0]
    const existingName = await query(
      'SELECT display_name FROM users WHERE LOWER(display_name) = $1',
      [chosenName.toLowerCase()]
    )
    if (existingName.rows.length > 0) {
      // Suggest alternatives
      const base = chosenName.replace(/\d+$/, '')
      const suggestions = []
      for (let i = 1; suggestions.length < 3; i++) {
        const candidate = `${base}${Math.floor(Math.random() * 9000) + 1000}`
        const check = await query(
          'SELECT id FROM users WHERE LOWER(display_name) = $1',
          [candidate.toLowerCase()]
        )
        if (check.rows.length === 0) suggestions.push(candidate)
        if (i > 10) break
      }
      return res.status(409).json({
        error: `Username "${chosenName}" is already taken`,
        suggestions,
      })
    }

    const id = uuid()
    const passwordHash = await bcrypt.hash(password, 8)  // 8 rounds: ~100ms vs 10 rounds: ~500ms
    const now = new Date().toISOString()

    // DB insert + session in parallel
    await execute(
      `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [id, email.toLowerCase(), passwordHash, chosenName, now, now]
    )

    // Run session + email in parallel, then respond
    // Email MUST complete before res.json() — Lambda freezes after response
    const [sessionId] = await Promise.all([
      createSession(id, req),
      sendVerificationCode(id, email.toLowerCase(), chosenName).catch(err => {
        console.error('Verification email failed:', err.message)
      }),
    ])

    const token = jwt.sign({ userId: id, email: email.toLowerCase(), sessionId }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
    logAudit(id, email.toLowerCase(), 'registered', req, { displayName: chosenName })

    res.status(201).json({
      token,
      user: { id, email: email.toLowerCase(), displayName: chosenName, emailVerified: false, isPremium: false },
    })
  } catch (err) {
    console.error('Register error:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Registration failed' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const result = await query(
      'SELECT id, email, password_hash, display_name, avatar_url, email_verified, is_premium FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' })

    const row = result.rows[0]
    const valid = await bcrypt.compare(password, row.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const sessionId = await createSession(row.id, req)
    const token = jwt.sign({ userId: row.id, email: row.email, sessionId }, JWT_SECRET, { expiresIn: JWT_EXPIRY })

    // Update last login timestamp on user
    execute('UPDATE users SET updated_at = NOW() WHERE id = $1', [row.id]).catch(() => {})

    res.json({
      token,
      user: { id: row.id, email: row.email, displayName: row.display_name, avatarUrl: row.avatar_url, emailVerified: row.email_verified, isPremium: row.is_premium ?? false },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, display_name, avatar_url, email_verified, is_premium, subscription_renew_date, subscription_expires_at, eula_accepted, eula_version, created_at FROM users WHERE id = $1',
      [req.user.userId]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' })

    // Update session last_active and log activity (fire-and-forget)
    if (req.user.sessionId) {
      execute('UPDATE sessions SET last_active_at = NOW(), ip_address = $1 WHERE id = $2',
        [getClientIp(req), req.user.sessionId]).catch(() => {})
    }
    logActivity(req, req.user.sessionId)

    const row = result.rows[0]
    res.json({ id: row.id, email: row.email, displayName: row.display_name, avatarUrl: row.avatar_url, emailVerified: row.email_verified, isPremium: row.is_premium ?? false, subscriptionRenewDate: row.subscription_renew_date || null, subscriptionExpiresAt: row.subscription_expires_at || null, eulaAccepted: row.eula_accepted ?? false, eulaVersion: row.eula_version || null, createdAt: row.created_at })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// ── Subscription Management ─────────────────────────────────────────────────

// Create a Stripe Checkout session for subscription
app.post('/api/subscription/checkout', authenticateToken, async (req, res) => {
  try {
    const userResult = await query('SELECT id, email, display_name, stripe_customer_id FROM users WHERE id = $1', [req.user.userId])
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' })

    const user = userResult.rows[0]

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.display_name || undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await execute('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id])
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}/app?upgraded=true`,
      cancel_url: `${APP_URL}/app`,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('Checkout session error:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// Create a Stripe Customer Portal session (manage billing, update payment, cancel)
app.post('/api/subscription/portal', authenticateToken, async (req, res) => {
  try {
    const userResult = await query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user.userId])
    const customerId = userResult.rows[0]?.stripe_customer_id
    if (!customerId) return res.status(400).json({ error: 'No subscription found' })

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/app`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('Portal session error:', err)
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

// Cancel subscription (sets cancel_at_period_end on Stripe)
app.post('/api/subscription/cancel', authenticateToken, async (req, res) => {
  try {
    const userResult = await query('SELECT stripe_subscription_id FROM users WHERE id = $1', [req.user.userId])
    const subId = userResult.rows[0]?.stripe_subscription_id
    if (!subId) return res.status(400).json({ error: 'No active subscription' })

    // Tell Stripe to cancel at end of current period (user keeps access until then)
    const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: true })

    // Set expiration date (when premium access ends) and clear renew date
    const expiresAt = new Date(sub.current_period_end * 1000).toISOString()
    await execute(
      'UPDATE users SET subscription_renew_date = NULL, subscription_expires_at = $1 WHERE id = $2',
      [expiresAt, req.user.userId]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Cancel subscription error:', err)
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

// ── Contact Form ────────────────────────────────────────────────────────────

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    // Rate limit: max 3 messages per email per hour
    // (simple in-memory, resets on Lambda cold start)
    const now = Date.now()
    if (!global._contactRateLimit) global._contactRateLimit = {}
    const key = email.toLowerCase()
    const history = global._contactRateLimit[key] || []
    const recent = history.filter(t => now - t < 3600000)
    if (recent.length >= 3) {
      return res.status(429).json({ error: 'Too many messages. Please try again later.' })
    }
    global._contactRateLimit[key] = [...recent, now]

    // Send to admin email
    const adminEmail = 'blundywhat@gmail.com'
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0c1e30;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#06b6d4;margin-bottom:16px;">New Contact Form Message</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#94a3b8;width:80px;">From:</td><td style="padding:8px 0;color:#e2e8f0;"><strong>${name}</strong> &lt;${email}&gt;</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Subject:</td><td style="padding:8px 0;color:#e2e8f0;"><strong>${subject}</strong></td></tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#122540;border-radius:8px;border:1px solid #183050;">
          <p style="color:#e2e8f0;line-height:1.6;white-space:pre-wrap;margin:0;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
        <p style="margin-top:16px;font-size:12px;color:#64748b;">Reply directly to this email to respond to ${name}.</p>
      </div>
    `

    await sendEmail(adminEmail, `[ReelMaps Contact] ${subject}`, html)
    console.log(`Contact form: ${name} <${email}> — ${subject}`)
    res.json({ sent: true })
  } catch (err) {
    console.error('Contact form error:', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// ── Password Reset ──────────────────────────────────────────────────────────

app.post('/api/auth/request-reset', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    const user = await query('SELECT id, email, display_name FROM users WHERE email = $1', [email.toLowerCase()])
    if (user.rows.length === 0) {
      // Don't reveal if email exists — always return success
      return res.json({ sent: true })
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
    await execute(
      `INSERT INTO email_verification_codes (user_id, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
      [user.rows[0].id, resetCode]
    )

    const appUrl = process.env.APP_URL || 'https://reelmaps.ai'
    const resetHtml = `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#0c1e30;padding:32px;border-radius:16px;border:1px solid #183050">
        <h2 style="color:#e2e8f0;margin-top:0">Password Reset</h2>
        <p style="color:#94a3b8">Use this code to reset your ReelMaps password:</p>
        <div style="background:#0c4a6e;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
          <span style="font-size:32px;font-weight:bold;color:#06b6d4;font-family:monospace;letter-spacing:8px">${resetCode}</span>
        </div>
        <p style="color:#64748b;font-size:12px">This code expires in 30 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `
    await sendEmail(user.rows[0].email, 'ReelMaps Password Reset', resetHtml)
      .catch(err => console.error('Reset email failed:', err.message))

    res.json({ sent: true })
  } catch (err) {
    console.error('Request reset error:', err)
    res.status(500).json({ error: 'Failed to send reset email' })
  }
})

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code, and new password required' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const user = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (user.rows.length === 0) return res.status(400).json({ error: 'Invalid code' })

    const codeResult = await query(
      `SELECT id FROM email_verification_codes
       WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.rows[0].id, code]
    )
    if (codeResult.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' })

    const passwordHash = await bcrypt.hash(newPassword, 8)
    await execute('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, user.rows[0].id])
    await execute('UPDATE email_verification_codes SET used = true WHERE id = $1', [codeResult.rows[0].id])

    res.json({ reset: true })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ error: 'Password reset failed' })
  }
})

// ── Email Verification ──────────────────────────────────────────────────────

// One-click verify via email link (no auth needed — code is the secret)
app.get('/api/auth/verify-email/:userId/:code', async (req, res) => {
  try {
    const { userId, code } = req.params
    const result = await query(
      `SELECT id FROM email_verification_codes
       WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    )
    if (result.rows.length === 0) {
      return res.status(400).send('<html><body style="background:#040c18;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:60px"><h2>Link expired or invalid</h2><p>Please request a new verification code from the app.</p></body></html>')
    }

    await execute('UPDATE email_verification_codes SET used = true WHERE id = $1', [result.rows[0].id])
    await execute('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [userId])

    // Send welcome email
    const user = await query('SELECT email, display_name FROM users WHERE id = $1', [userId])
    if (user.rows.length > 0) {
      logAudit(userId, user.rows[0].email, 'verified', req)
      await sendEmail(user.rows[0].email, 'Welcome to ReelMaps! 🎣', getWelcomeEmailHtml(user.rows[0].display_name))
        .catch(err => console.error('Welcome email failed:', err.message))
    }

    const appUrl = process.env.APP_URL || 'https://reelmaps.ai'
    res.send(`<html><body style="background:#040c18;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:60px"><h2 style="color:#06b6d4">Email Verified! ✅</h2><p>Your ReelMaps account is now active.</p><a href="${appUrl}" style="display:inline-block;margin-top:20px;padding:12px 32px;background:#06b6d4;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Open ReelMaps</a></body></html>`)
  } catch (err) {
    console.error('One-click verify error:', err)
    res.status(500).send('<html><body style="background:#040c18;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:60px"><h2>Verification failed</h2><p>Please try again.</p></body></html>')
  }
})

app.post('/api/auth/verify-email', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Verification code required' })

    // Check for valid, unused, unexpired code
    const result = await query(
      `SELECT id FROM email_verification_codes
       WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.userId, code]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' })
    }

    // Mark code as used
    await execute('UPDATE email_verification_codes SET used = true WHERE id = $1', [result.rows[0].id])

    // Mark user as verified
    await execute('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [req.user.userId])

    // Send welcome email BEFORE responding (Lambda freezes after response)
    try {
      const user = await query('SELECT email, display_name FROM users WHERE id = $1', [req.user.userId])
      if (user.rows.length > 0) {
        logAudit(req.user.userId, user.rows[0].email, 'verified', req)
        await sendEmail(user.rows[0].email, 'Welcome to ReelMaps! 🎣', getWelcomeEmailHtml(user.rows[0].display_name))
      }
    } catch (err) {
      console.error('Welcome email failed:', err.message)
    }

    res.json({ verified: true })
  } catch (err) {
    console.error('Verify email error:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

app.post('/api/auth/resend-verification', authenticateToken, async (req, res) => {
  try {
    // Check if already verified
    const user = await query('SELECT email, display_name, email_verified FROM users WHERE id = $1', [req.user.userId])
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    if (user.rows[0].email_verified) return res.status(400).json({ error: 'Email already verified' })

    // Rate limit: no code sent in the last 60 seconds
    const recent = await query(
      `SELECT id FROM email_verification_codes
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
      [req.user.userId]
    )
    if (recent.rows.length > 0) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code' })
    }

    // Invalidate old codes
    await execute(
      'UPDATE email_verification_codes SET used = true WHERE user_id = $1 AND used = false',
      [req.user.userId]
    )

    // Send new code
    await sendVerificationCode(req.user.userId, user.rows[0].email, user.rows[0].display_name)

    res.json({ sent: true })
  } catch (err) {
    console.error('Resend verification error:', err)
    res.status(500).json({ error: 'Failed to resend code' })
  }
})

// ── Account Deactivation ────────────────────────────────────────────────────

app.post('/api/auth/deactivate', authenticateToken, async (req, res) => {
  try {
    const user = await query(
      'SELECT email, display_name FROM users WHERE id = $1',
      [req.user.userId]
    )
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' })

    const { email, display_name } = user.rows[0]

    // Soft-delete: mark email as deactivated (frees the email for re-registration)
    // Store original email in display format so we can reactivate later
    const deactivatedEmail = `deactivated_${Date.now()}_${email}`
    await execute(
      `UPDATE users SET email = $1, password_hash = 'DEACTIVATED', email_verified = false, updated_at = NOW() WHERE id = $2`,
      [deactivatedEmail, req.user.userId]
    )

    // Expire all sessions
    await execute(
      'UPDATE sessions SET is_active = false, expired_at = NOW() WHERE user_id = $1',
      [req.user.userId]
    )

    // Send goodbye email to the ORIGINAL email
    try {
      await sendEmail(email, "We'll miss you, Captain! 🎣", getGoodbyeEmailHtml(display_name))
    } catch (emailErr) {
      console.error('Failed to send goodbye email:', emailErr)
    }

    logAudit(req.user.userId, email, 'deactivated', req)
    res.json({ deactivated: true })
  } catch (err) {
    console.error('Account deactivation error:', err)
    res.status(500).json({ error: 'Failed to deactivate account' })
  }
})

// ── Saved Spots ─────────────────────────────────────────────────────────────

app.get('/api/spots', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, lat, lng, depth_ft, spot_type, species, notes, icon, is_private, created_at
       FROM saved_spots WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    )
    const spots = result.rows.map(r => ({
      id: r.id, name: r.name, lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      depthFt: r.depth_ft ? parseFloat(r.depth_ft) : null, spotType: r.spot_type,
      species: r.species, notes: r.notes, icon: r.icon || null, isPrivate: r.is_private, createdAt: r.created_at,
    }))
    res.json(spots)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spots' })
  }
})

app.post('/api/spots', authenticateToken, async (req, res) => {
  try {
    let { name, lat, lng, depthFt, spotType, species, notes, icon, isPrivate } = req.body
    if (!name || lat == null || lng == null) return res.status(400).json({ error: 'Name, lat, lng required' })

    // Auto-correct coordinates: Western Hemisphere = negative lng, Northern Hemisphere = positive lat
    if (lng > 0) lng = -lng
    if (lat < 0) lat = -lat

    const id = uuid()
    const now = new Date().toISOString()

    await execute(
      `INSERT INTO saved_spots
       (id, user_id, name, lat, lng, depth_ft, spot_type, species, notes, icon, is_private, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, req.user.userId, name, lat, lng, depthFt || null, spotType || null,
       species || null, notes || null, icon || null, isPrivate ?? false, now, now]
    )

    res.status(201).json({ id, name, lat, lng, icon })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save spot' })
  }
})

app.patch('/api/spots/:id', authenticateToken, async (req, res) => {
  try {
    const allowed = ['name', 'icon', 'notes', 'spot_type']
    const fieldMap = { name: 'name', icon: 'icon', notes: 'notes', spotType: 'spot_type' }
    const sets = []
    const params = []
    let idx = 1

    for (const [clientKey, dbCol] of Object.entries(fieldMap)) {
      if (req.body[clientKey] !== undefined) {
        sets.push(`${dbCol} = $${idx++}`)
        params.push(req.body[clientKey])
      }
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' })

    sets.push(`updated_at = $${idx++}`)
    params.push(new Date().toISOString())
    params.push(req.params.id, req.user.userId)

    const result = await query(
      `UPDATE saved_spots SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx++} RETURNING id, name, icon`,
      params
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'Spot not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error('Update spot error:', err)
    res.status(500).json({ error: 'Failed to update spot' })
  }
})

app.delete('/api/spots/:id', authenticateToken, async (req, res) => {
  try {
    await execute(
      'DELETE FROM saved_spots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    )
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete spot' })
  }
})

// ── Spot Bulk Import ────────────────────────────────────────────────────────

app.post('/api/spots/import', authenticateToken, async (req, res) => {
  try {
    const { filename, fileType, spots, icon } = req.body
    if (!filename || !fileType || !Array.isArray(spots) || spots.length === 0) {
      return res.status(400).json({ error: 'filename, fileType, and spots array required' })
    }
    if (spots.length > 5000) {
      return res.status(400).json({ error: 'Maximum 5,000 spots per import' })
    }

    // Validate and auto-correct each spot's lat/lng
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i]
      if (s.lat == null || s.lng == null || isNaN(s.lat) || isNaN(s.lng)) {
        return res.status(400).json({ error: `Spot at index ${i} has invalid lat/lng` })
      }
      if (s.lat < -90 || s.lat > 90 || s.lng < -180 || s.lng > 180) {
        return res.status(400).json({ error: `Spot at index ${i} has out-of-range coordinates` })
      }
      // Auto-correct: Western Hemisphere = negative lng, Northern Hemisphere = positive lat
      if (s.lng > 0) s.lng = -s.lng
      if (s.lat < 0) s.lat = -s.lat
    }

    const batchId = uuid()
    const now = new Date().toISOString()

    // Create import batch record
    await execute(
      'INSERT INTO import_batches (id, user_id, filename, file_type, spot_count, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [batchId, req.user.userId, filename, fileType, spots.length, now]
    )

    // Batch insert spots in chunks of 500
    const CHUNK = 500
    let imported = 0
    for (let i = 0; i < spots.length; i += CHUNK) {
      const chunk = spots.slice(i, i + CHUNK)
      const values = []
      const params = []
      let paramIdx = 1

      for (const s of chunk) {
        const id = uuid()
        values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`)
        params.push(
          id, req.user.userId,
          s.name || `Spot ${i + imported + 1}`,
          s.lat, s.lng,
          s.depthFt || null, s.spotType || null,
          s.species || null, s.notes || null,
          s.icon || icon || null,
          now, now, fileType, batchId
        )
        imported++
      }

      await execute(
        `INSERT INTO saved_spots (id, user_id, name, lat, lng, depth_ft, spot_type, species, notes, icon, created_at, updated_at, source, import_batch_id)
         VALUES ${values.join(', ')}`,
        params
      )
    }

    res.status(201).json({ batchId, importedCount: imported, filename })
  } catch (err) {
    console.error('Import spots error:', err)
    res.status(500).json({ error: 'Failed to import spots' })
  }
})

app.get('/api/spots/imports', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, filename, file_type, spot_count, created_at FROM import_batches WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    )
    res.json(result.rows.map(r => ({
      id: r.id, filename: r.filename, fileType: r.file_type,
      spotCount: r.spot_count, createdAt: r.created_at,
    })))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch imports' })
  }
})

app.delete('/api/spots/import/:batchId', authenticateToken, async (req, res) => {
  try {
    await execute('DELETE FROM saved_spots WHERE import_batch_id = $1 AND user_id = $2', [req.params.batchId, req.user.userId])
    await execute('DELETE FROM import_batches WHERE id = $1 AND user_id = $2', [req.params.batchId, req.user.userId])
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete import batch' })
  }
})

// ── Trip Logs ───────────────────────────────────────────────────────────────

app.get('/api/trips', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, trip_date, title, departure_port, lat, lng, weather_conditions,
              wind_speed, wind_direction, wave_height, water_temp,
              species_caught, catch_count, notes, rating, created_at
       FROM trip_logs WHERE user_id = $1 ORDER BY trip_date DESC`,
      [req.user.userId]
    )
    const trips = result.rows.map(r => ({
      id: r.id, tripDate: r.trip_date, title: r.title, departurePort: r.departure_port,
      lat: r.lat ? parseFloat(r.lat) : null, lng: r.lng ? parseFloat(r.lng) : null,
      weatherConditions: r.weather_conditions, windSpeed: r.wind_speed ? parseFloat(r.wind_speed) : null,
      windDirection: r.wind_direction ? parseFloat(r.wind_direction) : null,
      waveHeight: r.wave_height ? parseFloat(r.wave_height) : null,
      waterTemp: r.water_temp ? parseFloat(r.water_temp) : null,
      speciesCaught: r.species_caught, catchCount: r.catch_count ? parseInt(r.catch_count) : null,
      notes: r.notes, rating: r.rating ? parseInt(r.rating) : null, createdAt: r.created_at,
    }))
    res.json(trips)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trips' })
  }
})

app.post('/api/trips', authenticateToken, async (req, res) => {
  try {
    const { tripDate, title, departurePort, lat, lng, weatherConditions,
            windSpeed, windDirection, waveHeight, waterTemp,
            speciesCaught, catchCount, notes, rating } = req.body
    if (!tripDate || !title) return res.status(400).json({ error: 'Trip date and title required' })

    const id = uuid()
    const now = new Date().toISOString()

    await execute(
      `INSERT INTO trip_logs
       (id, user_id, trip_date, title, departure_port, lat, lng, weather_conditions,
        wind_speed, wind_direction, wave_height, water_temp,
        species_caught, catch_count, notes, rating, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [id, req.user.userId, tripDate, title, departurePort || null,
       lat || null, lng || null, weatherConditions || null,
       windSpeed || null, windDirection || null, waveHeight || null, waterTemp || null,
       speciesCaught || null, catchCount || null, notes || null, rating || null, now]
    )

    res.status(201).json({ id, tripDate, title })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save trip' })
  }
})

// ── User Preferences ────────────────────────────────────────────────────────

app.get('/api/preferences', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT units, default_basemap, default_layers, default_center_lat, default_center_lng, default_zoom, theme
       FROM user_preferences WHERE user_id = $1`,
      [req.user.userId]
    )
    if (result.rows.length === 0) return res.json({})

    const r = result.rows[0]
    res.json({
      units: r.units, defaultBasemap: r.default_basemap, defaultLayers: r.default_layers,
      defaultCenterLat: r.default_center_lat ? parseFloat(r.default_center_lat) : null,
      defaultCenterLng: r.default_center_lng ? parseFloat(r.default_center_lng) : null,
      defaultZoom: r.default_zoom ? parseFloat(r.default_zoom) : null, theme: r.theme,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})

app.put('/api/preferences', authenticateToken, async (req, res) => {
  try {
    const { units, defaultBasemap, defaultLayers, defaultCenterLat, defaultCenterLng, defaultZoom, theme } = req.body
    const now = new Date().toISOString()

    // Upsert: try update first, insert if no rows affected
    const updateResult = await execute(
      `UPDATE user_preferences SET units = $1, default_basemap = $2, default_layers = $3,
       default_center_lat = $4, default_center_lng = $5, default_zoom = $6, theme = $7, updated_at = $8
       WHERE user_id = $9`,
      [units || 'imperial', defaultBasemap || 'satellite', defaultLayers || null,
       defaultCenterLat || null, defaultCenterLng || null, defaultZoom || null,
       theme || 'dark', now, req.user.userId]
    )

    if (updateResult.rowCount === 0) {
      await execute(
        `INSERT INTO user_preferences
         (user_id, units, default_basemap, default_layers, default_center_lat, default_center_lng, default_zoom, theme, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [req.user.userId, units || 'imperial', defaultBasemap || 'satellite',
         defaultLayers || null, defaultCenterLat || null, defaultCenterLng || null,
         defaultZoom || null, theme || 'dark', now]
      )
    }

    res.json({ updated: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// ── Admin: Session & Credential Sharing Detection ──────────────────────────

app.get('/api/admin/sessions', authenticateToken, async (req, res) => {
  try {
    // Only allow admin users (for now, check by email — add a proper role later)
    // To make yourself admin: UPDATE users SET email = 'your@email.com' WHERE ...
    const adminCheck = await query('SELECT id FROM users WHERE id = $1', [req.user.userId])
    if (adminCheck.rows.length === 0) return res.status(403).json({ error: 'Forbidden' })

    // Users with multiple distinct IPs in the last 24 hours (credential sharing indicator)
    const suspicious = await query(`
      SELECT u.id, u.email, u.display_name,
             COUNT(DISTINCT s.ip_address) AS unique_ips,
             ARRAY_AGG(DISTINCT s.ip_address::TEXT) AS ip_addresses,
             COUNT(s.id) AS session_count,
             MAX(s.last_active_at) AS last_seen
      FROM users u
      JOIN sessions s ON s.user_id = u.id
      WHERE s.created_at > NOW() - INTERVAL '7 days'
        AND s.is_active = true
      GROUP BY u.id, u.email, u.display_name
      HAVING COUNT(DISTINCT s.ip_address) > 1
      ORDER BY unique_ips DESC
    `)

    // All active sessions
    const activeSessions = await query(`
      SELECT s.id, s.user_id, u.email, u.display_name,
             s.ip_address, s.user_agent, s.created_at, s.last_active_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.is_active = true
      ORDER BY s.last_active_at DESC
      LIMIT 100
    `)

    // Recent activity summary per user (last 24h)
    const recentActivity = await query(`
      SELECT user_id, COUNT(*) AS request_count,
             COUNT(DISTINCT ip_address) AS unique_ips,
             ARRAY_AGG(DISTINCT ip_address::TEXT) AS ips,
             MIN(created_at) AS first_seen,
             MAX(created_at) AS last_seen
      FROM activity_log
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY user_id
      ORDER BY unique_ips DESC, request_count DESC
    `)

    res.json({
      suspiciousUsers: suspicious.rows,
      activeSessions: activeSessions.rows,
      recentActivity: recentActivity.rows,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Admin sessions error:', err)
    res.status(500).json({ error: 'Failed to fetch session data' })
  }
})

// Revoke a session (force logout)
app.delete('/api/admin/sessions/:id', authenticateToken, async (req, res) => {
  try {
    await execute(
      'UPDATE sessions SET is_active = false, expired_at = NOW() WHERE id = $1',
      [req.params.id]
    )
    res.json({ revoked: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' })
  }
})

// User's own sessions (for the account settings page)
app.get('/api/auth/sessions', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, ip_address, user_agent, created_at, last_active_at
       FROM sessions WHERE user_id = $1 AND is_active = true
       ORDER BY last_active_at DESC`,
      [req.user.userId]
    )
    res.json({
      sessions: result.rows,
      currentSessionId: req.user.sessionId || null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// ── Auto-create audit log table on startup ─────────────────────────────────
execute(`
  CREATE TABLE IF NOT EXISTS user_audit_log (
    id         BIGSERIAL      PRIMARY KEY,
    user_id    VARCHAR(36)    NOT NULL,
    email      VARCHAR(255)   NOT NULL,
    event      VARCHAR(50)    NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata   JSONB,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
  )
`).catch(err => console.error('Audit table creation failed:', err.message))

// ── Auto-create EULA table on startup ────────────────────────────────────────
execute(`
  CREATE TABLE IF NOT EXISTS eula_versions (
    id          SERIAL       PRIMARY KEY,
    version     VARCHAR(20)  NOT NULL UNIQUE,
    title       VARCHAR(255) NOT NULL DEFAULT 'End User License Agreement',
    content     TEXT         NOT NULL,
    published   BOOLEAN      DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`).catch(err => console.error('EULA table creation failed:', err.message))

execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_accepted BOOLEAN DEFAULT FALSE').catch(() => {})
execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_version VARCHAR(20)').catch(() => {})
execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_accepted_at TIMESTAMPTZ').catch(() => {})
execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)').catch(() => {})
execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)').catch(() => {})
execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ').catch(() => {})

// ── EULA ────────────────────────────────────────────────────────────────────

// Get the current published EULA
app.get('/api/eula/current', async (req, res) => {
  try {
    const result = await query(
      'SELECT version, title, content, created_at FROM eula_versions WHERE published = true ORDER BY created_at DESC LIMIT 1'
    )
    if (result.rows.length === 0) return res.json({ version: null })
    const row = result.rows[0]
    res.json({ version: row.version, title: row.title, content: row.content, createdAt: row.created_at })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch EULA' })
  }
})

// Check if user has accepted the current EULA
app.get('/api/eula/status', authenticateToken, async (req, res) => {
  try {
    const [userResult, eulaResult] = await Promise.all([
      query('SELECT eula_accepted, eula_version, eula_accepted_at FROM users WHERE id = $1', [req.user.userId]),
      query('SELECT version FROM eula_versions WHERE published = true ORDER BY created_at DESC LIMIT 1'),
    ])
    const user = userResult.rows[0]
    const currentVersion = eulaResult.rows[0]?.version || null

    res.json({
      accepted: user?.eula_accepted ?? false,
      acceptedVersion: user?.eula_version || null,
      acceptedAt: user?.eula_accepted_at || null,
      currentVersion,
      needsAcceptance: currentVersion && (!user?.eula_accepted || user?.eula_version !== currentVersion),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to check EULA status' })
  }
})

// Accept the current EULA
app.post('/api/eula/accept', authenticateToken, async (req, res) => {
  try {
    const eulaResult = await query(
      'SELECT version FROM eula_versions WHERE published = true ORDER BY created_at DESC LIMIT 1'
    )
    if (eulaResult.rows.length === 0) return res.status(400).json({ error: 'No EULA published' })

    const version = eulaResult.rows[0].version
    await execute(
      'UPDATE users SET eula_accepted = true, eula_version = $1, eula_accepted_at = NOW(), updated_at = NOW() WHERE id = $2',
      [version, req.user.userId]
    )
    res.json({ accepted: true, version })
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept EULA' })
  }
})

// ── Admin Dashboard ─────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'blundywhat@gmail.com'

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.email !== ADMIN_EMAIL || !payload.isAdmin) return res.status(403).json({ error: 'Forbidden' })
    req.admin = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (email.toLowerCase() !== ADMIN_EMAIL) return res.status(401).json({ error: 'Invalid credentials' })

    const result = await query('SELECT id, password_hash FROM users WHERE email = $1', [ADMIN_EMAIL])
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, result.rows[0].password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ userId: result.rows[0].id, email: ADMIN_EMAIL, isAdmin: true }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token })
  } catch (err) {
    console.error('Admin login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const [
      userCount,
      verifiedCount,
      spotCount,
      tripCount,
      batchCount,
      activeSessions,
      recentSignups,
      userGrowth,
      spotsPerUser,
      topEndpoints,
      recentActivity,
      auditLog,
      multiIpSessions,
      dailyActiveUsers,
      hourlyRequests,
    ] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM users WHERE password_hash != $1', ['DEACTIVATED']),
      query('SELECT COUNT(*) AS count FROM users WHERE email_verified = true AND password_hash != $1', ['DEACTIVATED']),
      query('SELECT COUNT(*) AS count FROM saved_spots'),
      query('SELECT COUNT(*) AS count FROM trip_logs'),
      query('SELECT COUNT(*) AS count FROM import_batches'),
      query('SELECT COUNT(*) AS count FROM sessions WHERE is_active = true'),
      // Recent signups (last 30 days)
      query(`SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
             FROM users WHERE created_at > NOW() - INTERVAL '30 days' AND password_hash != 'DEACTIVATED'
             GROUP BY day ORDER BY day`),
      // Cumulative user growth
      query(`SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
             FROM users WHERE password_hash != 'DEACTIVATED'
             GROUP BY day ORDER BY day`),
      // Spots per user (top 10)
      query(`SELECT u.display_name, u.email, COUNT(s.id) AS spot_count
             FROM users u LEFT JOIN saved_spots s ON s.user_id = u.id
             WHERE u.password_hash != 'DEACTIVATED'
             GROUP BY u.id, u.display_name, u.email
             ORDER BY spot_count DESC LIMIT 10`),
      // Top endpoints (last 24h)
      query(`SELECT method, endpoint, COUNT(*) AS count
             FROM activity_log WHERE created_at > NOW() - INTERVAL '24 hours'
             GROUP BY method, endpoint ORDER BY count DESC LIMIT 20`),
      // Recent activity (last 50)
      query(`SELECT a.method, a.endpoint, a.ip_address, a.created_at, u.email, u.display_name
             FROM activity_log a JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at DESC LIMIT 50`),
      // Audit log (last 50 events)
      query(`SELECT user_id, email, event, ip_address, user_agent, metadata, created_at
             FROM user_audit_log ORDER BY created_at DESC LIMIT 50`),
      // Multi-IP concurrent sessions (credential sharing detection)
      query(`SELECT u.id, u.email, u.display_name,
                    COUNT(DISTINCT s.ip_address) AS unique_ips,
                    ARRAY_AGG(DISTINCT s.ip_address::TEXT) AS ips,
                    ARRAY_AGG(DISTINCT COALESCE(s.city, 'Unknown')) AS cities,
                    MIN(s.last_active_at) AS first_active,
                    MAX(s.last_active_at) AS last_active
             FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.is_active = true AND s.last_active_at > NOW() - INTERVAL '24 hours'
             GROUP BY u.id, u.email, u.display_name
             HAVING COUNT(DISTINCT s.ip_address) > 1
             ORDER BY unique_ips DESC`),
      // Daily active users (last 14 days)
      query(`SELECT date_trunc('day', created_at) AS day, COUNT(DISTINCT user_id) AS count
             FROM activity_log WHERE created_at > NOW() - INTERVAL '14 days'
             GROUP BY day ORDER BY day`),
      // Hourly request volume (last 24h)
      query(`SELECT date_trunc('hour', created_at) AS hour, COUNT(*) AS count
             FROM activity_log WHERE created_at > NOW() - INTERVAL '24 hours'
             GROUP BY hour ORDER BY hour`),
    ])

    res.json({
      stats: {
        totalUsers: parseInt(userCount.rows[0].count),
        verifiedUsers: parseInt(verifiedCount.rows[0].count),
        totalSpots: parseInt(spotCount.rows[0].count),
        totalTrips: parseInt(tripCount.rows[0].count),
        totalImports: parseInt(batchCount.rows[0].count),
        activeSessions: parseInt(activeSessions.rows[0].count),
      },
      recentSignups: recentSignups.rows,
      userGrowth: userGrowth.rows,
      spotsPerUser: spotsPerUser.rows,
      topEndpoints: topEndpoints.rows,
      recentActivity: recentActivity.rows,
      auditLog: auditLog.rows,
      multiIpSessions: multiIpSessions.rows,
      dailyActiveUsers: dailyActiveUsers.rows,
      hourlyRequests: hourlyRequests.rows,
    })
  } catch (err) {
    console.error('Admin dashboard error:', err)
    res.status(500).json({ error: 'Failed to load dashboard' })
  }
})

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.display_name, u.email_verified, u.is_premium, u.eula_accepted, u.eula_version, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM saved_spots WHERE user_id = u.id) AS spot_count,
             (SELECT COUNT(*) FROM trip_logs WHERE user_id = u.id) AS trip_count,
             (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND is_active = true) AS active_sessions,
             (SELECT MAX(last_active_at) FROM sessions WHERE user_id = u.id) AS last_active
      FROM users u
      WHERE u.password_hash != 'DEACTIVATED'
      ORDER BY u.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.get('/api/admin/errors', authenticateAdmin, async (req, res) => {
  try {
    // Return recent failed requests (4xx/5xx patterns) and audit events
    const [failedVerifications, deactivations, recentAudit] = await Promise.all([
      query(`SELECT e.user_id, u.email, e.code, e.used, e.expires_at, e.created_at
             FROM email_verification_codes e
             LEFT JOIN users u ON u.id = e.user_id
             ORDER BY e.created_at DESC LIMIT 30`),
      query(`SELECT email, event, ip_address, created_at, metadata
             FROM user_audit_log WHERE event IN ('deactivated', 'reactivated')
             ORDER BY created_at DESC LIMIT 20`),
      query(`SELECT event, COUNT(*) AS count, MAX(created_at) AS latest
             FROM user_audit_log GROUP BY event ORDER BY latest DESC`),
    ])
    res.json({
      verificationCodes: failedVerifications.rows,
      accountChanges: deactivations.rows,
      eventSummary: recentAudit.rows,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch errors' })
  }
})

// Admin: Create or update EULA version
app.post('/api/admin/eula', authenticateAdmin, async (req, res) => {
  try {
    const { version, title, content, published } = req.body
    if (!version || !content) return res.status(400).json({ error: 'version and content required' })

    // Unpublish all existing versions if publishing this one
    if (published) {
      await execute('UPDATE eula_versions SET published = false WHERE published = true')
    }

    // Upsert
    const existing = await query('SELECT id FROM eula_versions WHERE version = $1', [version])
    if (existing.rows.length > 0) {
      await execute(
        'UPDATE eula_versions SET title = $1, content = $2, published = $3 WHERE version = $4',
        [title || 'End User License Agreement', content, published ?? false, version]
      )
    } else {
      await execute(
        'INSERT INTO eula_versions (version, title, content, published) VALUES ($1, $2, $3, $4)',
        [version, title || 'End User License Agreement', content, published ?? false]
      )
    }

    // If publishing a new version, reset all users' acceptance so they must re-accept
    if (published) {
      await execute('UPDATE users SET eula_accepted = false, eula_version = NULL, eula_accepted_at = NULL')
    }

    res.json({ ok: true, version, published: published ?? false })
  } catch (err) {
    console.error('EULA create error:', err)
    res.status(500).json({ error: 'Failed to save EULA' })
  }
})

// Admin: List all EULA versions
app.get('/api/admin/eula', authenticateAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id, version, title, published, created_at, LENGTH(content) AS content_length FROM eula_versions ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch EULA versions' })
  }
})

// ── Export for Lambda ────────────────────────────────────────────────────────
module.exports = { app }

// ── Start (only when run directly, not imported by Lambda) ──────────────────
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(`ReelMaps API running on http://localhost:${PORT}`)
  })
}
