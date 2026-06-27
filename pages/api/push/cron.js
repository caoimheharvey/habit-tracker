import { Redis } from '@upstash/redis'
import { sendToAll } from './send'
import { DAILY_TASKS } from '../../../src/lib/constants'

const STATE_KEY = 'app_state'

function getRedis() {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
}

// Called by Vercel cron — runs every hour 6am–10am (UTC+1 Ireland)
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const redis   = getRedis()
  const state   = await redis.get(STATE_KEY)
  const nowUTC  = new Date()
  // Ireland is UTC+1 (summer) / UTC+0 (winter) — use UTC+1 for simplicity (BST)
  const hourIE  = (nowUTC.getUTCHours() + 1) % 24
  const minIE   = nowUTC.getUTCMinutes()

  const dailyChecked = state?.dailyChecked ?? {}
  const doneCount    = Object.keys(dailyChecked).length
  const totalCount   = DAILY_TASKS.length
  const allDone      = doneCount === totalCount
  const streak       = state?.streak ?? 0

  let notification = null

  // 7:00 — morning kick-off
  if (hourIE === 7 && minIE < 5) {
    notification = {
      title: '☀️ Morning check-in',
      body:  doneCount === 0
        ? `${streak > 0 ? `🔥 ${streak}-day streak on the line. ` : ''}Open the app. Start now.`
        : `${doneCount}/${totalCount} done. Keep moving.`,
      tag: 'morning',
    }
  }

  // 7:50 — if gym task not done and deadline approaching
  if (hourIE === 7 && minIE >= 45 && !dailyChecked['gym'] && !allDone) {
    const remaining = DAILY_TASKS.filter(t => !dailyChecked[t.id])
    const names = remaining.slice(0, 2).map(t => t.title).join(', ')
    notification = {
      title: '⏰ Still pending',
      body:  `${names}${remaining.length > 2 ? ` +${remaining.length - 2} more` : ''}. Gym deadline in 15 min.`,
      tag: 'urgent',
      renotify: true,
    }
  }

  // 8:30 — if not all done, streak warning
  if (hourIE === 8 && minIE >= 25 && minIE < 35 && !allDone) {
    notification = {
      title: streak > 0 ? `🔥 Streak at risk` : '📋 Still not done',
      body:  streak > 0
        ? `${streak} days. Don't let today be the one that breaks it.`
        : `${doneCount}/${totalCount} tasks done. Finish what you started.`,
      tag: 'streak',
      renotify: true,
    }
  }

  if (!notification) return res.json({ skipped: true, hour: hourIE, min: minIE })

  const result = await sendToAll({ ...notification, url: '/' })
  return res.json({ sent: result, notification, hour: hourIE })
}
