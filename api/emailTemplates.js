/**
 * HTML email templates for ReelMaps.
 * All CSS is inline for email client compatibility.
 */

const APP_URL = process.env.APP_URL || 'https://reelmaps.ai'

// ── Shared styles ───────────────────────────────────────────────────────────

const COLORS = {
  bg: '#040c18',
  card: '#0c1e30',
  border: '#183050',
  cyan: '#06b6d4',
  cyanDark: '#0891b2',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textDim: '#64748b',
}

const fishSvg = `
<svg width="48" height="48" viewBox="0 0 24 24" fill="${COLORS.cyan}" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="10" cy="12" rx="5" ry="3"/>
  <path d="M15 12 l4-3 l0 6 z"/>
  <circle cx="8" cy="11.5" r="0.8" fill="${COLORS.bg}"/>
</svg>`

const waveSvg = `
<svg width="100%" height="24" viewBox="0 0 600 24" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 12 Q75 0 150 12 Q225 24 300 12 Q375 0 450 12 Q525 24 600 12 V24 H0 Z" fill="${COLORS.border}" opacity="0.4"/>
</svg>`

function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

<!-- Header -->
<tr><td style="padding:24px 32px;text-align:center;background:linear-gradient(135deg,#0c4a6e,#164e63);border-radius:16px 16px 0 0;">
  ${fishSvg}
  <div style="margin-top:8px;font-size:22px;font-weight:700;color:${COLORS.textPrimary};letter-spacing:0.5px;">ReelMaps</div>
  <div style="font-size:12px;color:${COLORS.textSecondary};margin-top:4px;">Your Offshore Fishing Companion</div>
</td></tr>

<!-- Body -->
<tr><td style="background:${COLORS.card};padding:32px;border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};">
  ${content}
</td></tr>

<!-- Wave divider -->
<tr><td style="background:${COLORS.card};padding:0;border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};">
  ${waveSvg}
</td></tr>

<!-- Footer -->
<tr><td style="background:${COLORS.card};padding:16px 32px 24px;border-radius:0 0 16px 16px;border:1px solid ${COLORS.border};border-top:none;text-align:center;">
  <div style="font-size:11px;color:${COLORS.textDim};">
    &copy; ${new Date().getFullYear()} ReelMaps &middot; Satellite data &middot; Marine forecasts &middot; Fishing spots
  </div>
  <div style="font-size:11px;color:${COLORS.textDim};margin-top:4px;">
    You're receiving this because you signed up at <a href="${APP_URL}" style="color:${COLORS.cyan};text-decoration:none;">ReelMaps</a>
  </div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Verification Code Email ─────────────────────────────────────────────────

function getVerificationEmailHtml(displayName, code, userId) {
  const API_BASE = process.env.API_URL || 'https://vdfjbl2ku2.execute-api.us-east-2.amazonaws.com'
  const verifyUrl = `${API_BASE}/api/auth/verify-email/${userId}/${code}`

  return layout(`
    <div style="font-size:18px;font-weight:600;color:${COLORS.textPrimary};margin-bottom:8px;">
      Welcome aboard${displayName ? `, ${displayName}` : ''}! 🎣
    </div>
    <div style="font-size:14px;color:${COLORS.textSecondary};margin-bottom:24px;line-height:1.6;">
      You're almost ready to start charting your offshore adventures. Click the button below or enter the code to verify your email:
    </div>

    <!-- One-click verify button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="text-align:center;">
        <a href="${verifyUrl}" style="display:inline-block;background:${COLORS.cyan};color:#ffffff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:10px;text-decoration:none;">
          Verify My Email
        </a>
      </td></tr>
    </table>

    <div style="text-align:center;font-size:12px;color:${COLORS.textDim};margin-bottom:16px;">
      Or enter this code in the app:
    </div>

    <!-- Copyable code block -->
    <div style="background:#0c4a6e;border:1px solid ${COLORS.border};border-radius:10px;padding:16px;text-align:center;margin:0 auto 20px;max-width:280px;">
      <span style="font-size:32px;font-weight:700;color:${COLORS.cyan};font-family:'Courier New',monospace;letter-spacing:10px;">${code}</span>
    </div>

    <div style="text-align:center;font-size:12px;color:${COLORS.textDim};margin-bottom:24px;">
      This code expires in <strong style="color:${COLORS.textSecondary};">15 minutes</strong>
    </div>

    <div style="font-size:13px;color:${COLORS.textDim};line-height:1.5;">
      If you didn't create a ReelMaps account, you can safely ignore this email.
    </div>
  `)
}

// ── Welcome Email (sent after verification) ─────────────────────────────────

function getWelcomeEmailHtml(displayName) {
  function featureCard(icon, title, desc) {
    return `
    <tr><td style="padding:12px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:44px;vertical-align:top;padding-right:12px;">
            <div style="width:40px;height:40px;background:linear-gradient(135deg,#0c4a6e,#164e63);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">${icon}</div>
          </td>
          <td style="vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:${COLORS.textPrimary};margin-bottom:2px;">${title}</div>
            <div style="font-size:13px;color:${COLORS.textSecondary};line-height:1.5;">${desc}</div>
          </td>
        </tr>
      </table>
    </td></tr>`
  }

  return layout(`
    <div style="font-size:20px;font-weight:700;color:${COLORS.textPrimary};margin-bottom:4px;">
      You're verified! ✅
    </div>
    <div style="font-size:15px;color:${COLORS.cyan};font-weight:500;margin-bottom:20px;">
      Welcome to ReelMaps${displayName ? `, ${displayName}` : ''}.
    </div>
    <div style="font-size:14px;color:${COLORS.textSecondary};line-height:1.6;margin-bottom:24px;">
      Your email is confirmed and your account is fully activated. Here's what you can do:
    </div>

    <!-- Feature cards -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${featureCard('📍', 'Save Your Spots', 'Pin secret fishing spots with GPS coordinates, depth, species, and private notes. Access them from any device.')}
      ${featureCard('📋', 'Log Your Trips', 'Record weather, catches, and sea conditions for every outing. Build your personal fishing history.')}
      ${featureCard('🌊', 'Real-Time Marine Data', 'SST, currents, chlorophyll, wave height, radar, and lightning — all on one professional chart.')}
      ${featureCard('🛰️', 'Satellite Imagery', 'NOAA and NASA satellite data updated daily. Find temperature breaks, weed lines, and color changes.')}
    </table>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="text-align:center;padding:8px 0 16px;">
        <a href="${APP_URL}" style="display:inline-block;background:${COLORS.cyan};color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;">
          Open ReelMaps →
        </a>
      </td></tr>
    </table>

    <div style="font-size:13px;color:${COLORS.textDim};line-height:1.5;text-align:center;">
      Tight lines and fair seas. 🐟
    </div>
  `)
}

// ── Account deactivation goodbye email ─────────────────────────────────────

function getGoodbyeEmailHtml(displayName) {
  const name = displayName || 'Captain'
  return layout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:8px;">🎣</div>
      <h1 style="font-size:22px;font-weight:700;color:${COLORS.textPrimary};margin:0;">
        We'll Miss You, ${name}!
      </h1>
    </div>

    <div style="font-size:14px;color:${COLORS.textSecondary};line-height:1.7;margin-bottom:24px;">
      <p style="margin:0 0 12px;">
        Your ReelMaps account has been deactivated. We're sad to see you go &mdash;
        the ocean is a little quieter without you. 🌊
      </p>
      <p style="margin:0 0 12px;">
        But here's the thing about fishing: <strong style="color:${COLORS.textPrimary};">the big one is always out there waiting.</strong>
        The sun will still rise over calm water, the SST breaks will still glow on the charts,
        and somewhere offshore, a yellowfin is swimming circles around a weedline with your name on it.
      </p>
      <p style="margin:0 0 12px;">
        Your data isn't going anywhere. If you ever feel the pull of the open water again,
        just sign back in and everything will be right where you left it &mdash; your spots,
        your settings, all of it. We'll keep the lights on. 💡
      </p>
      <p style="margin:0;">
        Until then: may your lines stay tight, your cooler stay full,
        and your sunburns be worth every story. ☀️🐟
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td align="center">
      <a href="${APP_URL}" style="display:inline-block;background:${COLORS.cyan};color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;">
        Come Back Anytime →
      </a>
    </td></tr></table>

    <div style="font-size:13px;color:${COLORS.textDim};line-height:1.5;text-align:center;">
      Fair winds and following seas, ${name}. 🚤
    </div>
  `)
}

module.exports = { getVerificationEmailHtml, getWelcomeEmailHtml, getGoodbyeEmailHtml }
