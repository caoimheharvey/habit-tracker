/**
 * Allowed Claude modes.
 * @type {readonly string[]}
 */
export const VALID_MODES = Object.freeze(['roast', 'plan', 'rollover'])

/**
 * Validates the request body for /api/claude.
 *
 * @param {unknown} body
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateClaudeRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  const { mode } = body

  if (!mode || typeof mode !== 'string') {
    return { valid: false, error: 'mode is required and must be a string' }
  }

  if (!VALID_MODES.includes(mode)) {
    return { valid: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` }
  }

  if (mode === 'rollover') {
    const { summary } = body
    if (!summary || typeof summary !== 'string') {
      return { valid: false, error: 'summary is required for rollover mode' }
    }
    if (summary.length > 4000) {
      return { valid: false, error: 'summary must be under 4000 characters' }
    }
  }

  if (mode === 'roast') {
    const { streak } = body
    if (streak !== undefined && (typeof streak !== 'number' || !Number.isFinite(streak) || streak < 0)) {
      return { valid: false, error: 'streak must be a non-negative number' }
    }
  }

  return { valid: true }
}

/**
 * Extracts and sanitises text from a Claude API response.
 * Falls back to empty string rather than throwing.
 *
 * @param {import('@anthropic-ai/sdk').Message} message
 * @returns {string}
 */
export function extractClaudeText(message) {
  return message?.content?.[0]?.text ?? ''
}

/**
 * Safely parses a JSON array from Claude text output.
 * Handles code fences (```json ... ```) that Claude sometimes emits.
 *
 * @template T
 * @param {string} text
 * @returns {{ ok: true, data: T[] } | { ok: false, error: string }}
 */
export function parseClaudeJsonArray(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'Expected a JSON array' }
    }
    return { ok: true, data: parsed }
  } catch (err) {
    return { ok: false, error: `JSON parse error: ${err.message}` }
  }
}
