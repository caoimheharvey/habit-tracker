import { getServerSession } from 'next-auth/next'
import { google } from 'googleapis'
import { authOptions } from './auth/[...nextauth]'

const WEEK_MS        = 7 * 24 * 60 * 60 * 1000
const MAX_EMAILS     = 15
const MAX_CAL_EVENTS = 50

/**
 * Builds an authenticated Google OAuth2 client from the session.
 * @param {string} accessToken
 */
function buildGoogleAuth(accessToken) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ access_token: accessToken })
  return auth
}

/**
 * Fetches calendar events for the next 7 days.
 */
async function fetchCalendarEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth })
  const now  = new Date()
  const week = new Date(now.getTime() + WEEK_MS)

  const res = await calendar.events.list({
    calendarId:   'primary',
    timeMin:      now.toISOString(),
    timeMax:      week.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    maxResults:   MAX_CAL_EVENTS,
  })

  return (res.data.items ?? []).map(e => ({
    title:    e.summary ?? '(no title)',
    start:    e.start?.dateTime ?? e.start?.date,
    location: e.location ?? null,
  }))
}

/**
 * Fetches unread email subjects in parallel (not sequentially).
 */
async function fetchEmailSummaries(auth) {
  const gmail = google.gmail({ version: 'v1', auth })

  const listRes = await gmail.users.messages.list({
    userId:     'me',
    q:          'is:unread',
    maxResults: MAX_EMAILS,
  })

  const messageIds = (listRes.data.messages ?? []).slice(0, MAX_EMAILS).map(m => m.id)

  // Fetch all message metadata in parallel
  const messages = await Promise.allSettled(
    messageIds.map(id =>
      gmail.users.messages.get({
        userId:          'me',
        id,
        format:          'metadata',
        metadataHeaders: ['Subject', 'From'],
      })
    )
  )

  return messages
    .filter(r => r.status === 'fulfilled')
    .map(r => {
      const headers = r.value.data.payload?.headers ?? []
      return {
        subject: headers.find(h => h.name === 'Subject')?.value ?? '',
        from:    headers.find(h => h.name === 'From')?.value    ?? '',
      }
    })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const auth = buildGoogleAuth(session.accessToken)

  try {
    // Fetch calendar and email in parallel
    const [events, emails] = await Promise.all([
      fetchCalendarEvents(auth),
      fetchEmailSummaries(auth),
    ])

    res.json({ events, emails })
  } catch (err) {
    console.error('[context] Google API error:', err)

    // Distinguish auth errors from other failures
    const status = err?.code === 401 ? 401 : 502
    res.status(status).json({ error: 'Failed to fetch Google data. Please reconnect your account.' })
  }
}
