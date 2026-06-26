import { useState, useEffect, useCallback } from 'react'

/**
 * @typedef {'checking'|'locked'|'unlocked'} TotpMode
 * @returns {{ mode: TotpMode, error: string, loading: boolean, verify: (code: string) => Promise<void>, lock: () => Promise<void> }}
 */
export function useTotp() {
  const [mode,    setMode]    = useState('checking')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // Check session cookie on mount
  useEffect(() => {
    fetch('/api/auth/check-totp')
      .then(r => r.json())
      .then(({ authenticated }) => setMode(authenticated ? 'unlocked' : 'locked'))
      .catch(() => setMode('locked'))
  }, [])

  const verify = useCallback(async (code) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-totp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code }),
      })
      if (res.ok) {
        setMode('unlocked')
      } else {
        const { error: msg } = await res.json()
        setError(msg ?? 'Invalid code')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }, [])

  const lock = useCallback(async () => {
    await fetch('/api/auth/logout-totp', { method: 'POST' }).catch(() => {})
    setMode('locked')
    setError('')
  }, [])

  return { mode, error, loading, verify, lock }
}
