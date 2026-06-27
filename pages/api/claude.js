import { getServerSession } from 'next-auth/next'
import Anthropic from '@anthropic-ai/sdk'
import { authOptions } from './auth/[...nextauth]'
import { validateClaudeRequest, extractClaudeText, parseClaudeJsonArray } from '../../src/lib/apiValidation'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPTS = {
  roast: `You are a brutally honest, slightly mean morning accountability coach. Think drill sergeant meets disappointed best friend.
Short, punchy, 1-2 sentences MAX. Be specific and cutting — mock their excuses before they make them.
No softening, no "you've got this", no affirmations. End with one blunt command. Make it sting just enough to actually get them moving.`,

  plan: `You analyse someone's Google Calendar and Gmail to proactively suggest one-off tasks for this week.

Rules:
- ONLY suggest tasks triggered by specific events or emails.
- NEVER suggest daily habits: water, stretching, walking, gym, breakfast, getting ready.
- CRITICAL — semantic deduplication: check the "Already in list" tasks carefully. If any existing task covers the same subject, event, or goal — even with different wording — do NOT add another. E.g. if "Prep for Nebius interview" exists, don't add "Research Nebius", "Interview preparation", or anything else about the same interview.
- Be specific: "Prepare 3 questions for Nebius interview" not "Prepare for interview".
- If a trip is within 3 days, add a packing task.
- If a trip may require a visa, add a visa-check task.
- Interview within 5 days → 1–2 concrete prep tasks (only if nothing interview-related already exists).
- Work deadline in email or calendar → suggest a task.
- Max 5 tasks. If nothing warrants a task, return [].
Return ONLY a JSON array: [{ "title": string (under 8 words), "note": string (one sentence why), "priority": "high"|"med"|"low", "triggerEvent": string, "dueDate": "YYYY-MM-DD or null" }]
Set dueDate to the date of the associated calendar event if one exists, otherwise null (the app will assign a 7-day default).`,

  rollover: `Extract ONLY genuine one-off tasks from an end-of-day summary.
Tasks must be: errands, appointments, work deadlines, or specific things the person said they still need to do.
NEVER include daily habits: water, stretching, walking, gym, breakfast, getting ready — those reset automatically every day.
CRITICAL — semantic deduplication: you will receive the existing task list. If any existing task already covers the same subject or goal — even with different wording — do NOT add it again. E.g. if "Call dentist" exists, don't add "Book dentist appointment".
Return ONLY a JSON array: [{ "title": string (under 6 words), "note": string (one sentence), "priority": "high"|"med"|"low", "dueDate": "YYYY-MM-DD or null" }].
Set dueDate if the person mentioned a specific deadline or date, otherwise null.
If there are no genuine one-off tasks, return [].`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const { valid, error: validationError } = validateClaudeRequest(req.body)
  if (!valid) return res.status(400).json({ error: validationError })

  const { mode, events = [], emails = [], streak = 0, existingOneOffs = [], summary } = req.body
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  try {
    if (mode === 'roast') {
      const eventSummary = events.length
        ? events.slice(0, 5)
            .map(e => `- ${e.title} on ${new Date(e.start).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}`)
            .join('\n')
        : 'No events this week'

      const message = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 80,
        system:     SYSTEM_PROMPTS.roast,
        messages:   [{
          role:    'user',
          content: `Today: ${today}. Streak: ${streak} days.\nCalendar:\n${eventSummary}\n\nGive me my morning check-in.`,
        }],
      })

      return res.json({ text: extractClaudeText(message) })
    }

    if (mode === 'plan') {
      const eventList   = events.map(e => `- "${e.title}" on ${new Date(e.start).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}`).join('\n') || 'No events'
      const emailList   = emails.slice(0, 10).map(e => `- "${e.subject}" from ${e.from}`).join('\n') || 'No emails'
      const existingStr = existingOneOffs.map(t => t.title).join(', ') || 'none'

      const message = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 600,
        system:     SYSTEM_PROMPTS.plan,
        messages:   [{
          role:    'user',
          content: `Today: ${today}\nCalendar:\n${eventList}\nEmails:\n${emailList}\nAlready in list: ${existingStr}`,
        }],
      })

      const raw = extractClaudeText(message)
      const result = parseClaudeJsonArray(raw)
      if (!result.ok) {
        console.error('[claude/plan] JSON parse error:', result.error, '\nRaw:', raw)
        return res.json({ tasks: [] })
      }
      return res.json({ tasks: result.data })
    }

    if (mode === 'rollover') {
      const existingStr = existingOneOffs.map(t => t.title).join(', ') || 'none'
      const message = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 600,
        system:     SYSTEM_PROMPTS.rollover,
        messages:   [{ role: 'user', content: `Already in list: ${existingStr}\n\nSummary:\n${summary}` }],
      })

      const raw = extractClaudeText(message)
      const result = parseClaudeJsonArray(raw)
      if (!result.ok) {
        console.error('[claude/rollover] JSON parse error:', result.error, '\nRaw:', raw)
        return res.json({ tasks: [] })
      }
      return res.json({ tasks: result.data })
    }
  } catch (err) {
    console.error(`[claude/${mode}] Unexpected error:`, err)
    return res.status(502).json({ error: 'AI service unavailable. Please try again.' })
  }
}
