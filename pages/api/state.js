import { kv }                  from '@vercel/kv'
import { isTotpAuthenticated } from '../../src/lib/serverAuth'

const STATE_KEY = 'app_state'

export default async function handler(req, res) {
  if (!isTotpAuthenticated(req)) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (req.method === 'GET') {
    try {
      const state = await kv.get(STATE_KEY)
      return res.json({ state: state ?? null })
    } catch (err) {
      console.error('[state/get]', err)
      return res.status(502).json({ error: 'Storage unavailable' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { state } = req.body ?? {}
      if (!state) return res.status(400).json({ error: 'Missing state' })
      await kv.set(STATE_KEY, state)
      return res.json({ ok: true })
    } catch (err) {
      console.error('[state/set]', err)
      return res.status(502).json({ error: 'Storage unavailable' })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
