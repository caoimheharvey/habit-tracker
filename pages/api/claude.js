import { getServerSession } from 'next-auth/next'
import Anthropic from '@anthropic-ai/sdk'
import { authOptions } from './auth/[...nextauth]'
import { validateClaudeRequest, extractClaudeText, parseClaudeJsonArray } from '../../src/lib/apiValidation'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPTS = {
  roast: `You are a warm but completely no-nonsense morning accountability buddy.
The person has AuDHD and responds well to blunt, direct reality checks — not cruel, but specific and grounding.
3–4 sentences max. Reference their actual week if relevant. End with ONE specific action to do in the next 60 seconds.
Vary the angle each time so it never feels stale. No motivational poster energy.`,

  plan: `You analyse someone's Google Calendar and Gmail to proactively suggest one-off tasks for this week.

Rules:
- ONLY suggest tasks triggered by specific events or emails.
- NEVER suggest daily habits: water, stretching, walking, gym, breakfast, getting ready.
- No duplicates from the existing task list.
- Be specific: "Prepare 3 questions for Nebius interview" not "Prepare for interview".
- If a trip is within 3 days, add a packing task.
- If a trip may require a visa, add a visa-check task.
- Interview within 5 days → 1–2 concrete prep tasks.
- Work deadline in email or calendar → suggest a task.
- Max 5 tasks. If nothing warrants a task, return [].
Return ONLY a JSON array: [{ "title": string (under 8 words), "note": string (one sentence why), "priority": "high"|"med"|"low", "triggerEvent": string }]`,

  rollover: `Extract ONLY genuine one-off tasks from an end-of-day summary.
Tasks must be: errands, appointments, work deadlines, or specific things the person said they still need to do.
NEVER include daily habits: water, stretching, walking, gym, breakfast, getting ready — those reset automatically every day.
Return ONLY a JSON array: [{ "title": string (under 6 words), "note": string (one sentence), "priority": "high"|"med"|"low" }].
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
        max_tokens: 300,
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
      const message = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 600,
        system:     SYSTEM_PROMPTS.rollover,
        messages:   [{ role: 'user', content: summary }],
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
