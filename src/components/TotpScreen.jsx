import { useState, useRef, useCallback } from 'react'

const DECO = ['🍄','🌿','🌸','🌰','🕯️','🍃','🌼','☕']

/**
 * @param {{
 *   error: string,
 *   loading: boolean,
 *   onVerify: (code: string) => void,
 * }} props
 */
export default function TotpScreen({ error, loading, onVerify }) {
  const [digits, setDigits] = useState(['','','','','',''])
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]

  const handleChange = useCallback((i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = digit
    setDigits(next)

    if (digit && i < 5) {
      inputRefs[i + 1].current?.focus()
    }

    // Auto-submit when all 6 filled
    if (digit && next.every(d => d !== '')) {
      onVerify(next.join(''))
    }
  }, [digits, onVerify]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs[i - 1].current?.focus()
    }
  }, [digits]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setDigits(pasted.split(''))
      onVerify(pasted)
    }
  }, [onVerify])

  const shaking = !!error

  return (
    <div style={styles.root}>
      {DECO.map((d, i) => (
        <div key={i} aria-hidden="true" style={{
          ...styles.deco,
          top:       `${8 + i * 11}%`,
          left:      i % 2 === 0 ? `${5 + i * 3}%` : undefined,
          right:     i % 2 !== 0 ? `${5 + i * 3}%` : undefined,
          fontSize:  i % 2 === 0 ? 28 : 20,
          animation: `${i % 2 === 0 ? 'float' : 'floatR'} ${3 + i * 0.4}s ease-in-out infinite`,
          animationDelay: `${i * 0.35}s`,
        }}>{d}</div>
      ))}

      <div style={styles.content}>
        <div aria-hidden="true" style={{ fontSize: 56, marginBottom: 16, animation: 'float 3s ease-in-out infinite' }}>
          🏡
        </div>

        <h1 style={styles.title}>Welcome back 🌿</h1>
        <p style={styles.subtitle}>Enter your 6-digit authenticator code</p>

        {error && (
          <p role="alert" style={{ ...styles.error, animation: shaking ? 'wiggle .4s ease' : 'none' }}>
            {error}
          </p>
        )}

        {/* 6-digit input boxes */}
        <div
          style={{ display: 'flex', gap: 10, marginBottom: 32 }}
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
                width:        44,
                height:       52,
                textAlign:    'center',
                fontSize:     22,
                fontWeight:   900,
                fontFamily:   "'Nunito', sans-serif",
                background:   d ? 'rgba(184,132,90,0.12)' : 'rgba(255,253,245,0.85)',
                border:       `2px solid ${d ? 'var(--toffee)' : 'rgba(184,132,90,0.3)'}`,
                borderRadius: 14,
                color:        'var(--text)',
                outline:      'none',
                transition:   'all .15s',
                boxShadow:    d ? '0 2px 8px rgba(184,132,90,0.2)' : '0 2px 8px rgba(120,80,40,0.08)',
                caretColor:   'var(--toffee)',
                animation:    shaking ? 'wiggle .4s ease' : 'none',
              }}
            />
          ))}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)',
            fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
            <div style={{ width: 14, height: 14, border: '2px solid var(--sand)',
              borderTopColor: 'var(--toffee)', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/>
            Verifying...
          </div>
        )}

        <button
          onClick={() => digits.every(d => d) && onVerify(digits.join(''))}
          disabled={loading || digits.some(d => !d)}
          style={{
            width:        '100%',
            background:   'linear-gradient(135deg, var(--toffee), var(--caramel))',
            color:        'var(--white)',
            border:       'none',
            borderRadius: 18,
            padding:      '15px 0',
            fontFamily:   "'Nunito', sans-serif",
            fontSize:     16,
            fontWeight:   900,
            cursor:       digits.every(d => d) && !loading ? 'pointer' : 'not-allowed',
            opacity:      digits.every(d => d) && !loading ? 1 : 0.5,
            boxShadow:    '0 4px 18px rgba(140,98,46,.35)',
            WebkitTapHighlightColor: 'transparent',
            transition:   'opacity .2s',
          }}
        >
          Unlock the cottage ✨
        </button>

        <p style={{ marginTop: 20, fontSize: 11, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', lineHeight: 1.6 }}>
          Open Google Authenticator and enter the<br/>6-digit code for <strong>Morning Accountability</strong>
        </p>
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight:      '100vh',
    background:     'linear-gradient(160deg, #F0E8D5 0%, #E8D5B5 40%, #D5C49A 100%)',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        32,
    position:       'relative',
    overflow:       'hidden',
  },
  deco: {
    position:      'absolute',
    opacity:       0.25,
    userSelect:    'none',
    pointerEvents: 'none',
  },
  content: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    position:      'relative',
    zIndex:        10,
    width:         '100%',
    maxWidth:      320,
    textAlign:     'center',
  },
  title: {
    fontFamily:   "'Playfair Display', serif",
    fontStyle:    'italic',
    fontSize:     28,
    color:        '#3D2B1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize:     14,
    color:        '#8C6E56',
    fontWeight:   700,
    marginBottom: 24,
  },
  error: {
    fontSize:     13,
    color:        '#C4614A',
    fontWeight:   800,
    marginBottom: 12,
    minHeight:    20,
  },
}
