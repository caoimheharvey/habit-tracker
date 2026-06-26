import { authenticator } from 'otplib'
import QRCode            from 'qrcode'

export default async function handler(req, res) {
  const secret = process.env.TOTP_SECRET
  if (!secret) return res.status(500).json({ error: 'TOTP_SECRET is not set in environment variables' })

  const otpauth  = authenticator.keyuri('me', 'Morning Accountability', secret)
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 280, margin: 2 })

  return res.json({ qrDataUrl })
}
