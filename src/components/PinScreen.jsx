import { signIn } from 'next-auth/react'

const KEYPAD = [1,2,3,4,5,6,7,8,9,'',0,'⌫']

const DECO = ['🍄','🌿','🌸','🌰','🕯️','🍃','🌼','☕']

/**
 * @param {{
 *   mode: 'setup'|'confirm'|'locked',
 *   input: string,
 *   error: string,
 *   shaking: boolean,
 *   onDigit: (d: string) => void,
 *   onDelete: () => void,
 * }} props
 */
export default function PinScreen({ mode, input, error, shaking, onDigit, onDelete }) {
  const title = mode === 'locked'
    ? 'Welcome back 🌿'
    : mode === 'confirm'
    ? 'Confirm your PIN'
    : 'Choose your PIN'

  const subtitle = mode === 'locked'
    ? 'Enter your PIN to enter the cottage'
    : mode === 'confirm'
    ? 'Enter it once more to confirm'
    : 'Pick 4 digits only you know'

  return (
    <div style={styles.root}>
      {/* Floating botanical deco */}
      {DECO.map((d, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            ...styles.deco,
            top:       `${8 + i * 11}%`,
            left:      i % 2 === 0 ? `${5 + i * 3}%` : undefined,
            right:     i % 2 !== 0 ? `${5 + i * 3}%` : undefined,
            fontSize:  i % 2 === 0 ? 28 : 20,
            animation: `${i % 2 === 0 ? 'float' : 'floatR'} ${3 + i * 0.4}s ease-in-out infinite`,
            animationDelay: `${i * 0.35}s`,
          }}
        >
          {d}
        </div>
      ))}

      <div style={styles.content}>
        <div
          aria-hidden="true"
          style={{ fontSize: 56, marginBottom: 16, animation: 'float 3s ease-in-out infinite' }}
        >
          🏡
        </div>

        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{subtitle}</p>

        {error && (
          <p
            role="alert"
            style={{
              ...styles.error,
              animation: shaking ? 'wiggle .4s ease' : 'none',
            }}
          >
            {error}
          </p>
        )}

        {/* PIN dot indicators */}
        <div
          role="status"
          aria-label={`${input.length} of 4 digits entered`}
          style={{
            ...styles.dots,
            animation: shaking ? 'wiggle .4s ease' : 'none',
          }}
        >
          {[0,1,2,3].map(i => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i < input.length ? 'var(--toffee)' : 'rgba(184,132,90,0.25)',
              }}
            />
          ))}
        </div>

        {/* Keypad */}
        <div style={styles.keypad} role="group" aria-label="PIN keypad">
          {KEYPAD.map((key, i) => {
            if (key === '') return <div key={i} />
            const isDelete = key === '⌫'
            return (
              <button
                key={i}
                aria-label={isDelete ? 'Delete' : String(key)}
                onClick={() => isDelete ? onDelete() : onDigit(String(key))}
                style={styles.key}
              >
                {key}
              </button>
            )
          })}
        </div>

        {mode === 'locked' && (
          <button
            onClick={() => signIn('google')}
            style={styles.forgotBtn}
          >
            Forgot PIN? Sign in with Google
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight:       '100vh',
    background:      'linear-gradient(160deg, #F0E8D5 0%, #E8D5B5 40%, #D5C49A 100%)',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         32,
    position:        'relative',
    overflow:        'hidden',
  },
  deco: {
    position:       'absolute',
    opacity:        0.25,
    userSelect:     'none',
    pointerEvents:  'none',
  },
  content: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    position:       'relative',
    zIndex:         10,
    width:          '100%',
    maxWidth:       320,
    textAlign:      'center',
  },
  title: {
    fontFamily:  "'Playfair Display', serif",
    fontStyle:   'italic',
    fontSize:    28,
    color:       '#3D2B1A',
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
  dots: {
    display:       'flex',
    gap:           16,
    marginBottom:  40,
  },
  dot: {
    width:        18,
    height:       18,
    borderRadius: '50%',
    border:       '2px solid #B8845A',
    transition:   'all .15s',
  },
  keypad: {
    display:             'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap:                 14,
    width:               '100%',
  },
  key: {
    padding:      '18px 0',
    fontSize:     24,
    fontWeight:   800,
    fontFamily:   "'Nunito', sans-serif",
    background:   'rgba(255,253,245,0.85)',
    border:       '2px solid rgba(184,132,90,0.3)',
    borderRadius: 16,
    color:        '#3D2B1A',
    cursor:       'pointer',
    boxShadow:    '0 2px 8px rgba(120,80,40,0.10)',
    backdropFilter: 'blur(4px)',
    WebkitTapHighlightColor: 'transparent',
  },
  forgotBtn: {
    marginTop:      32,
    background:     'none',
    border:         'none',
    color:          '#8C6E56',
    fontSize:       13,
    fontWeight:     700,
    cursor:         'pointer',
    textDecoration: 'underline',
  },
}
