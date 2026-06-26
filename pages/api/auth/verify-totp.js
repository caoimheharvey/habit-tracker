import { createHmac }  from 'crypto'
import { totpVerify }  from '../../../src/lib/totp'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

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

  try {
    const secret    = process.env.TOTP_SECRET
    const authSecret = process.env.NEXTAUTH_SECRET

    if (!secret)     return res.status(500).json({ error: 'TOTP_SECRET is not configured' })
    if (!authSecret) return res.status(500).json({ error: 'NEXTAUTH_SECRET is not configured' })

    const { code } = req.body ?? {}
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid code format' })
    }

    if (!totpVerify(secret, code)) {
      return res.status(401).json({ error: 'Invalid code — check the time on your device and try again' })
    }

    const expiresAt = Date.now() + SESSION_DURATION_MS
    const expires   = new Date(expiresAt)
    res.setHeader('Set-Cookie', setCookieHeader(signedCookie(expiresAt), expires))
    return res.json({ ok: true })
  } catch (err) {
    console.error('[verify-totp]', err)
    return res.status(500).json({ error: `Server error: ${err.message}` })
  }
}
