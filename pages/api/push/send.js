import webpush from 'web-push'
import { Redis } from '@upstash/redis'

const PUSH_KEY = 'push_subscriptions'

webpush.setVapidDetails(
  'mailto:caoimhe.e.harvey@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
)

function getRedis() {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
}

export async function sendToAll(payload) {
  const redis = getRedis()
  const subscriptions = await redis.get(PUSH_KEY) ?? []
  const dead = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload))
      } catch (err) {
        // 410 Gone = subscription expired/unsubscribed — remove it
        if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint)
      }
    })
  )

  if (dead.length) {
    const remaining = subscriptions.filter(s => !dead.includes(s.endpoint))
    await redis.set(PUSH_KEY, remaining)
  }

  return { sent: subscriptions.length - dead.length, removed: dead.length }
}

// POST /api/push/send — manual test trigger
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Only allow from cron or with a secret
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })

  const { title, body, tag } = req.body
  const result = await sendToAll({ title, body, tag, url: '/' })
  return res.json(result)
}
