import { useState, useRef, useCallback } from 'react'

const DEFAULT_DURATION_MS = 2600

/**
 * @param {{ duration?: number }} options
 */
export function useToast({ duration = DEFAULT_DURATION_MS } = {}) {
  const [message, setMessage] = useState('')
  const timerRef = useRef(null)

  const show = useCallback((msg) => {
    clearTimeout(timerRef.current)
    setMessage(msg)
    timerRef.current = setTimeout(() => setMessage(''), duration)
  }, [duration])

  return { message, show }
}
