import { Redis } from '@upstash/redis'

const CACHE_KEY = () => {
  const n = new Date()
  return `bg_${n.toISOString().slice(0, 10)}_${n.getUTCHours()}`
}

const QUERIES = [
  'mountain sunrise landscape',
  'ocean waves sunrise',
  'forest morning light',
  'lake reflection mountains',
  'dramatic sky landscape',
  'coastal cliffs sunrise',
  'misty valley morning',
]

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const redis = getRedis()
  const key   = CACHE_KEY()

  // Serve from cache if already fetched today
  const cached = await redis.get(key)
  if (cached) {
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.json(cached)
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return res.status(500).json({ error: 'UNSPLASH_ACCESS_KEY not set' })

  // Pick a query based on hour so it rotates every hour predictably
  const hour  = new Date().getUTCHours()
  const query = QUERIES[hour % QUERIES.length]

  try {
    const r = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    )
    if (!r.ok) throw new Error(`Unsplash ${r.status}`)
    const data = await r.json()

    const result = {
      url:         data.urls.full,
      urlRegular:  data.urls.regular,   // ~1080px wide, faster to load
      photographer: data.user.name,
      photographerUrl: data.user.links.html,
      query,
    }

    // Cache for the rest of the current hour
    const now      = new Date()
    const nextHour = new Date(now); nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0)
    const ttl      = Math.floor((nextHour - now) / 1000)
    await redis.set(key, result, { ex: ttl })

    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.json(result)
  } catch (err) {
    console.error('[background]', err)
    return res.status(502).json({ error: err.message })
  }
}
