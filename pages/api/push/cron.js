import { Redis } from '@upstash/redis'
import { sendToAll } from './send'
import { DAILY_TASKS, EVENING_TASKS } from '../../../src/lib/constants'

const STATE_KEY = 'app_state'

function getRedis() {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
}

// Amsterdam: UTC+2 in summer (CEST), UTC+1 in winter (CET)
// Cron runs at fixed UTC times — offset by 2 for summer, 1 for winter
function getAmsterdamHour(utcDate) {
  const month = utcDate.getUTCMonth() // 0-indexed
  // Rough CEST: last Sunday March → last Sunday October
  const isSummer = month >= 2 && month <= 9
  return (utcDate.getUTCHours() + (isSummer ? 2 : 1)) % 24
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const redis  = getRedis()
  const state  = await redis.get(STATE_KEY)
  const nowUTC = new Date()
  const hourAMS = getAmsterdamHour(nowUTC)
  const minAMS  = nowUTC.getUTCMinutes()

  const dailyChecked  = state?.dailyChecked ?? {}
  const eveningChecked = state?.eveningChecked ?? {}
  const doneCount     = Object.keys(dailyChecked).length
  const totalCount    = DAILY_TASKS.length
  const allMorningDone = doneCount === totalCount
  const eveningDone   = Object.keys(eveningChecked).length
  const allEveningDone = eveningDone === EVENING_TASKS.length
  const streak        = state?.streak ?? 0

  // Single daily notification at 7:30am Amsterdam time
  const notification = {
    title: '☀️ Morning routine',
    body: streak > 0
      ? `🔥 ${streak}-day streak on the line. Start your routine.`
      : 'Time to start. Open the app.',
    tag: 'morning',
  }

  const result = await sendToAll({ ...notification, url: '/' })
  return res.json({ sent: result, notification })
}
