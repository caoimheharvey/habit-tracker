export function WhimsyCard({ children, accent = 'var(--warm)' }) {
  return (
    <div style={{
      background:    'var(--white)',
      borderRadius:  24,
      padding:       '18px 20px',
      boxShadow:     '0 3px 20px var(--shadow)',
      position:      'relative',
      overflow:      'hidden',
      borderTop:     `4px solid ${accent}`,
    }}>
      {children}
    </div>
  )
}

export function Label({ children }) {
  return (
    <div style={{
      fontSize:      10,
      fontWeight:    800,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color:         'var(--muted)',
      marginBottom:  10,
    }}>
      {children}
    </div>
  )
}

export function SectionHead({ label, badge, badgeColor, badgeBg }) {
  return (
    <div style={{
      padding:         '16px 20px 8px',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
    }}>
      <span style={{
        fontFamily:    "'Caveat', cursive",
        fontSize:      16,
        fontWeight:    700,
        color:         'var(--text)',
      }}>
        {label}
      </span>
      {badge && (
        <span style={{
          background:    badgeBg,
          color:         badgeColor,
          fontSize:      9,
          fontWeight:    800,
          padding:       '3px 9px',
          borderRadius:  999,
        }}>
          {badge}
        </span>
      )}
    </div>
  )
}

export function Toast({ message }) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:     'fixed',
        bottom:       90,
        left:         '50%',
        transform:    'translateX(-50%)',
        background:   'var(--text)',
        color:        'var(--white)',
        padding:      '11px 22px',
        borderRadius: 999,
        fontSize:     13,
        fontWeight:   800,
        zIndex:       999,
        pointerEvents: 'none',
        whiteSpace:   'nowrap',
        animation:    'fadeUp .25s ease',
        fontFamily:   "'Nunito', sans-serif",
        boxShadow:    '0 4px 16px rgba(0,0,0,.2)',
      }}
    >
      {message}
    </div>
  )
}

export function Spinner() {
  return (
    <div
      aria-label="Loading"
      role="status"
      style={{
        display:     'inline-block',
        width:       14,
        height:      14,
        border:      '2px solid var(--sand)',
        borderTopColor: 'var(--toffee)',
        borderRadius: '50%',
        animation:   'spin .7s linear infinite',
        verticalAlign: 'middle',
        marginRight: 6,
      }}
    />
  )
}
