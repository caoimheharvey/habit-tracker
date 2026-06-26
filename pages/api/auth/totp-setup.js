import QRCode        from 'qrcode'
import { totpUri }   from '../../../src/lib/totp'

export default async function handler(req, res) {
  const secret = process.env.TOTP_SECRET
  if (!secret) {
    return res.status(500).json({
      error: 'TOTP_SECRET is not set — run npm run generate-totp-secret and add it to your environment variables',
    })
  }

  const uri       = totpUri(secret, 'Morning Accountability', 'me')
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 280, margin: 2 })

  return res.json({ qrDataUrl })
}
