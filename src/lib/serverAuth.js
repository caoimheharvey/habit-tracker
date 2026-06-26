import { createHmac } from 'crypto'

/**
 * Returns true if the request carries a valid, unexpired TOTP session cookie.
 * @param {import('next').NextApiRequest} req
 * @returns {boolean}
 */
export function isTotpAuthenticated(req) {
  const raw = req.cookies?.totp_session
  if (!raw) return false
  try {
    const decoded  = decodeURIComponent(raw)
    const dotIdx   = decoded.lastIndexOf('.')
    const payload  = decoded.slice(0, dotIdx)
    const sig      = decoded.slice(dotIdx + 1)
    const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET).update(payload).digest('hex')
    if (sig !== expected)         return false
    if (Date.now() > Number(payload)) return false
    return true
  } catch {
    return false
  }
}
