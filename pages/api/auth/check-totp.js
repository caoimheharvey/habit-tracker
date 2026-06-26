import { isTotpAuthenticated } from '../../../src/lib/serverAuth'

export default function handler(req, res) {
  return res.json({ authenticated: isTotpAuthenticated(req) })
}
