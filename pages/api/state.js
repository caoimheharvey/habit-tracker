import { Redis }           from '@upstash/redis'
import { isAuthenticated } from '../../src/lib/serverAuth'

const STATE_KEY = 'app_state'

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export default async function handler(req, res) {
  if (!await isAuthenticated(req, res)) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (req.method === 'GET') {
    try {
      const state = await getRedis().get(STATE_KEY)
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
      await getRedis().set(STATE_KEY, state)
      return res.json({ ok: true })
    } catch (err) {
      console.error('[state/set]', err)
      return res.status(502).json({ error: 'Storage unavailable' })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
