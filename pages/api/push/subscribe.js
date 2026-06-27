import { Redis } from '@upstash/redis'
import { isTotpAuthenticated } from '../../../src/lib/serverAuth'

const PUSH_KEY = 'push_subscriptions'

function getRedis() {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
}

export default async function handler(req, res) {
  if (!isTotpAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'POST') {
    const { subscription } = req.body
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' })

    const redis = getRedis()
    const existing = await redis.get(PUSH_KEY) ?? []
    // Deduplicate by endpoint
    const filtered = existing.filter(s => s.endpoint !== subscription.endpoint)
    await redis.set(PUSH_KEY, [...filtered, subscription])
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' })
    const redis = getRedis()
    const existing = await redis.get(PUSH_KEY) ?? []
    await redis.set(PUSH_KEY, existing.filter(s => s.endpoint !== endpoint))
    return res.json({ ok: true })
  }

  res.setHeader('Allow', 'POST, DELETE')
  return res.status(405).end()
}
