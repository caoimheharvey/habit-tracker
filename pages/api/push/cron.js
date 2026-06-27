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

  let notification = null

  // 07:30 — morning routine starts
  if (hourAMS === 7 && minAMS < 5) {
    notification = {
      title: '☀️ Morning routine',
      body:  streak > 0
        ? `🔥 ${streak}-day streak. Don't break it now. Start your routine.`
        : 'Time to start. Open the app.',
      tag: 'morning',
    }
  }

  // 08:15 — urgent nudge if gym task not done
  if (hourAMS === 8 && minAMS >= 10 && minAMS < 20 && !dailyChecked['gym'] && !allMorningDone) {
    const remaining = DAILY_TASKS.filter(t => !dailyChecked[t.id])
    const names = remaining.slice(0, 2).map(t => t.title).join(', ')
    notification = {
      title: '⏰ Gym deadline in 15 min',
      body:  `Still pending: ${names}${remaining.length > 2 ? ` +${remaining.length - 2} more` : ''}.`,
      tag: 'urgent',
      renotify: true,
    }
  }

  // 09:00 — streak at risk if morning not done
  if (hourAMS === 9 && minAMS < 5 && !allMorningDone) {
    notification = {
      title: streak > 0 ? '🔥 Streak at risk' : '📋 Morning tasks unfinished',
      body:  streak > 0
        ? `${streak} days. Still ${totalCount - doneCount} tasks left. Finish it.`
        : `${doneCount}/${totalCount} done. You're not finished yet.`,
      tag: 'streak',
      renotify: true,
    }
  }

  // 20:30 — evening routine starts
  if (hourAMS === 20 && minAMS >= 25 && minAMS < 35 && !allEveningDone) {
    notification = {
      title: '🌙 Evening routine',
      body:  'Makeup off, teeth, tidy up. Takes 10 minutes.',
      tag: 'evening',
    }
  }

  // 21:15 — reminder if evening not done
  if (hourAMS === 21 && minAMS >= 10 && minAMS < 20 && !allEveningDone) {
    const remaining = EVENING_TASKS.filter(t => !eveningChecked[t.id])
    notification = {
      title: '🌙 Still pending',
      body:  `${remaining.map(t => t.title).slice(0, 2).join(', ')}${remaining.length > 2 ? '…' : ''}. Do it now.`,
      tag: 'evening-remind',
      renotify: true,
    }
  }

  if (!notification) return res.json({ skipped: true, hourAMS, minAMS })

  const result = await sendToAll({ ...notification, url: '/' })
  return res.json({ sent: result, notification, hourAMS })
}
