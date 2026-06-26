import { useState, useEffect } from 'react'

export default function TaskRow({
  emoji, title, desc, done,
  onToggle, isOneOff, smart, onDelete,
  hasForm, onForm,
}) {
  const [justChecked, setJustChecked] = useState(false)

  useEffect(() => {
    if (done) {
      setJustChecked(true)
      const t = setTimeout(() => setJustChecked(false), 700)
      return () => clearTimeout(t)
    }
  }, [done])

  return (
    <div
      onClick={onToggle}
      role="checkbox"
      aria-checked={done}
      aria-label={title}
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      style={{
        margin:      '0 16px 10px',
        background:  done ? 'linear-gradient(135deg, #F0FFF6, #E8FFF1)' : 'var(--white)',
        borderRadius: 22,
        padding:     '16px 18px',
        display:     'flex',
        alignItems:  'center',
        gap:         14,
        boxShadow:   done
          ? '0 2px 12px rgba(0,200,83,0.12)'
          : '0 3px 14px var(--shadow)',
        cursor:      'pointer',
        borderLeft:  done
          ? '4px solid var(--neon)'
          : isOneOff
            ? '4px solid var(--blush-l)'
            : '4px solid transparent',
        position:    'relative',
        overflow:    'hidden',
        transition:  'all .3s cubic-bezier(.4,0,.2,1)',
        animation:   justChecked ? 'rowFlash 0.6s ease' : 'none',
        WebkitTapHighlightColor: 'transparent',
        transform:   'translateZ(0)',
      }}
    >
      {/* Shimmer on check */}
      {justChecked && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent, rgba(0,200,83,0.15), transparent)',
          backgroundSize: '200% auto',
          animation: 'shimmer 0.5s linear',
        }}/>
      )}

      {smart && !done && (
        <div aria-hidden="true" style={{ position: 'absolute', top: 6, right: 50, fontSize: 10, opacity: .45 }}>✨</div>
      )}

      <span aria-hidden="true" style={{
        fontSize: 26, flexShrink: 0,
        filter: done ? 'grayscale(0.4)' : 'none',
        transition: 'filter .3s',
      }}>
        {done ? '✅' : emoji}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 800,
          textDecoration: done ? 'line-through' : 'none',
          color: done ? 'var(--muted)' : 'var(--text)',
          marginBottom: desc || hasForm ? 3 : 0,
          transition: 'color .2s',
        }}>
          {title}
        </div>

        {desc && !done && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4 }}>
            {desc}
          </div>
        )}

        {hasForm && !done && (
          <a
            href="#"
            onClick={e => { e.stopPropagation(); onForm?.(e) }}
            aria-label="Open FORM app"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              marginTop: 6,
              background: 'linear-gradient(135deg, #4A8FAF, #3A7090)',
              borderRadius: 999, padding: '5px 14px',
              fontSize: 11, fontWeight: 800, color: 'white',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(58,112,144,0.3)',
            }}
          >
            🏊 Open FORM
          </a>
        )}
      </div>

      {/* Animated checkbox */}
      <div
        aria-hidden="true"
        style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          border: done ? 'none' : '2.5px solid var(--sand)',
          background: done
            ? 'linear-gradient(135deg, var(--neon), #00A846)'
            : 'var(--warm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: 'white', fontWeight: 900,
          transition: 'background .25s, border .25s',
          animation: justChecked ? 'checkBounce 0.6s cubic-bezier(.34,1.56,.64,1)' : 'none',
          boxShadow: done ? '0 2px 10px rgba(0,200,83,0.35)' : 'none',
        }}
      >
        {done ? '✓' : ''}
      </div>

      {isOneOff && onDelete && !done && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          aria-label={`Delete task: ${title}`}
          style={{
            background: 'none', border: 'none',
            color: 'var(--sand)', fontSize: 22,
            cursor: 'pointer', padding: '0 2px',
            flexShrink: 0, lineHeight: 1,
            WebkitTapHighlightColor: 'transparent',
          }}
        >×</button>
      )}
    </div>
  )
}
