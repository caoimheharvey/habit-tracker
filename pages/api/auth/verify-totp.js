import { authenticator } from 'otplib'
import { createHmac }    from 'crypto'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

function signedCookie(expiresAt) {
  const payload = String(expiresAt)
  const sig     = createHmac('sha256', process.env.NEXTAUTH_SECRET).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function setCookieHeader(value, expires) {
  const parts = [
    `totp_session=${encodeURIComponent(value)}`,
    `Expires=${expires.toUTCString()}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const secret = process.env.TOTP_SECRET
  if (!secret) return res.status(500).json({ error: 'TOTP not configured' })

  const { code } = req.body ?? {}
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code format' })
  }

  const valid = authenticator.verify({ token: code, secret })
  if (!valid) return res.status(401).json({ error: 'Invalid code' })

  const expiresAt = Date.now() + SESSION_DURATION_MS
  const expires   = new Date(expiresAt)
  res.setHeader('Set-Cookie', setCookieHeader(signedCookie(expiresAt), expires))
  return res.json({ ok: true })
}
