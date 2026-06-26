import { createHmac } from 'crypto'

export default function handler(req, res) {
  const raw = req.cookies?.totp_session
  if (!raw) return res.json({ authenticated: false })

  try {
    const decoded  = decodeURIComponent(raw)
    const dotIdx   = decoded.lastIndexOf('.')
    const payload  = decoded.slice(0, dotIdx)
    const sig      = decoded.slice(dotIdx + 1)
    const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET).update(payload).digest('hex')

    if (sig !== expected)         return res.json({ authenticated: false })
    if (Date.now() > Number(payload)) return res.json({ authenticated: false })

    return res.json({ authenticated: true })
  } catch {
    return res.json({ authenticated: false })
  }
}
