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
        return
      }

      // Try to parse JSON error; fall back to raw text so we see the real problem
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const { error: msg } = await res.json()
        setError(msg ?? 'Invalid code')
      } else {
        const text = await res.text()
        console.error('[verify-totp] unexpected response:', res.status, text.slice(0, 300))
        setError(`Error ${res.status} — check Vercel logs`)
      }
    } catch (err) {
      console.error('[verify-totp] fetch failed:', err)
      setError('Could not reach server — check your connection')
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
