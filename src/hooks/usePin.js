import { useState, useCallback, useRef } from 'react'
import { verifyPin, storePin, pinIsSet, validatePin } from '../lib/pin'

const SHAKE_DURATION_MS = 900

/**
 * @typedef {'setup'|'confirm'|'locked'|'unlocked'} PinMode
 *
 * usePin avoids stale-closure bugs by keeping mutable transient state
 * in refs (input, draft, mode, shaking) and only using useState for the
 * values that need to trigger a re-render. A single `tick` counter is
 * incremented to force React to re-render after a ref mutation.
 *
 * @returns {{
 *   mode: PinMode,
 *   input: string,
 *   error: string,
 *   shaking: boolean,
 *   onDigit: (d: string) => void,
 *   onDelete: () => void,
 *   lock: () => void,
 * }}
 */
export function usePin() {
  // Render-triggering state
  const [, forceUpdate]   = useState(0)
  const [error, setError] = useState('')

  // Mutable refs — no stale closure risk
  const modeRef    = useRef(pinIsSet() ? 'locked' : 'setup')
  const inputRef   = useRef('')
  const draftRef   = useRef('')
  const shakingRef = useRef(false)
  const shakeTimer = useRef(null)

  const render = useCallback(() => forceUpdate(n => n + 1), [])

  const shake = useCallback((msg) => {
    shakingRef.current = true
    setError(msg)
    render()

    clearTimeout(shakeTimer.current)
    shakeTimer.current = setTimeout(() => {
      inputRef.current   = ''
      draftRef.current   = ''
      shakingRef.current = false
      if (modeRef.current === 'confirm') modeRef.current = 'setup'
      setError('')   // also triggers re-render via useState
      render()
    }, SHAKE_DURATION_MS)
  }, [render])

  const onDigit = useCallback((d) => {
    if (shakingRef.current) return

    const next = inputRef.current + d
    inputRef.current = next
    render()

    if (next.length < 4) return

    const mode = modeRef.current

    if (mode === 'locked') {
      if (verifyPin(next)) {
        modeRef.current  = 'unlocked'
        inputRef.current = ''
        setError('')
        render()
      } else {
        shake('Wrong PIN. Try again.')
      }
      return
    }

    if (mode === 'setup') {
      const { valid, error: err } = validatePin(next)
      if (!valid) { shake(err); return }
      draftRef.current  = next
      inputRef.current  = ''
      modeRef.current   = 'confirm'
      render()
      return
    }

    if (mode === 'confirm') {
      if (next === draftRef.current) {
        storePin(next)
        modeRef.current  = 'unlocked'
        inputRef.current = ''
        draftRef.current = ''
        setError('')
        render()
      } else {
        shake("PINs don't match. Start over.")
      }
    }
  }, [shake, render])

  const onDelete = useCallback(() => {
    inputRef.current = inputRef.current.slice(0, -1)
    render()
  }, [render])

  const lock = useCallback(() => {
    modeRef.current  = 'locked'
    inputRef.current = ''
    setError('')
    render()
  }, [render])

  return {
    mode:    modeRef.current,
    input:   inputRef.current,
    shaking: shakingRef.current,
    error,
    onDigit,
    onDelete,
    lock,
  }
}
