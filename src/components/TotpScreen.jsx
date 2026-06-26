import { useState, useRef, useCallback } from 'react'

export default function TotpScreen({ error, loading, onVerify }) {
  const [digits, setDigits] = useState(['','','','','',''])
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]

  const handleChange = useCallback((i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    if (digit && i < 5) inputRefs[i + 1].current?.focus()
    if (digit && next.every(d => d !== '')) onVerify(next.join(''))
  }, [digits, onVerify]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs[i - 1].current?.focus()
  }, [digits]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) { setDigits(pasted.split('')); onVerify(pasted) }
  }, [onVerify])

  const allFilled = digits.every(d => d)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0B0F',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '20%', left: '50%',
        transform: 'translateX(-50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: 'rgba(0,212,184,0.06)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }}/>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 320, textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'rgba(0,212,184,0.1)',
          border: '1px solid rgba(0,212,184,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, marginBottom: 28,
          boxShadow: '0 0 32px rgba(0,212,184,0.15)',
        }}>
          ☀️
        </div>

        <div style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(0,212,184,0.7)',
          textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 10,
        }}>
          Morning Accountability
        </div>

        <h1 style={{
          fontSize: 26, fontWeight: 800, color: '#FFFFFF',
          letterSpacing: '-0.5px', marginBottom: 6,
        }}>
          Welcome back
        </h1>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginBottom: 32 }}>
          Enter your 6-digit authenticator code
        </p>

        {/* Error */}
        {error && (
          <p role="alert" style={{
            fontSize: 13, color: '#FF453A', fontWeight: 600,
            marginBottom: 16, animation: 'pulse .4s ease',
          }}>
            {error}
          </p>
        )}

        {/* Digit inputs */}
        <div
          style={{ display: 'flex', gap: 8, marginBottom: 28 }}
          onPaste={handlePaste}
          role="group"
          aria-label="6-digit authenticator code"
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1}`}
              style={{
                width: 42, height: 52, textAlign: 'center',
                fontSize: 22, fontWeight: 800,
                fontFamily: 'Inter, -apple-system, sans-serif',
                background: d ? 'rgba(0,212,184,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${d ? 'rgba(0,212,184,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 14, color: '#FFFFFF', outline: 'none',
                transition: 'all .15s',
                boxShadow: d ? '0 0 12px rgba(0,212,184,0.2)' : 'none',
                caretColor: '#00D4B8',
              }}
            />
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
            <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.15)',
              borderTopColor: '#00D4B8', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/>
            Verifying…
          </div>
        )}

        {/* Submit */}
        <button
          onClick={() => allFilled && onVerify(digits.join(''))}
          disabled={loading || !allFilled}
          style={{
            width: '100%',
            background: allFilled && !loading ? '#00D4B8' : 'rgba(255,255,255,0.06)',
            color: allFilled && !loading ? '#000' : 'rgba(255,255,255,0.25)',
            border: 'none', borderRadius: 16, padding: '15px 0',
            fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 700,
            cursor: allFilled && !loading ? 'pointer' : 'not-allowed',
            transition: 'all .2s',
            boxShadow: allFilled && !loading ? '0 4px 20px rgba(0,212,184,0.35)' : 'none',
            letterSpacing: '0.2px',
          }}
        >
          Unlock
        </button>

        <p style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)',
          fontWeight: 500, lineHeight: 1.7 }}>
          Open Google Authenticator and enter the<br/>code for <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Morning Accountability</strong>
        </p>
      </div>
    </div>
  )
}
