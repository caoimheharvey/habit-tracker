import { useState, useCallback } from 'react'
import { ROAST_PREFIX, getRandomFallbackRoast } from '../lib/constants'

/**
 * @param {{ today: string }} options
 */
export function useRoast({ today }) {
  const [roast, setRoast]     = useState('')
  const [loading, setLoading] = useState(false)

  const cacheKey = ROAST_PREFIX + today

  const loadCached = useCallback(() => {
    const cached = localStorage.getItem(cacheKey)
    if (cached) { setRoast(cached); return true }
    return false
  }, [cacheKey])

  /**
   * @param {{ streak: number, events: import('../types').CalendarEvent[] }} context
   */
  const generate = useCallback(async ({ streak = 0, events = [] } = {}) => {
    setLoading(true)
    try {
      const res = await fetch('/api/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: 'roast', streak, events }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const text = data.text || getRandomFallbackRoast()
      setRoast(text)
      localStorage.setItem(cacheKey, text)
    } catch (e) {
      console.warn('Roast generation failed, using fallback:', e)
      setRoast(getRandomFallbackRoast())
    } finally {
      setLoading(false)
    }
  }, [cacheKey])

  return { roast, loading, loadCached, generate }
}
