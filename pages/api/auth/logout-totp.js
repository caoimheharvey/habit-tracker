export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'totp_session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Strict')
  return res.json({ ok: true })
}
