import { useState, useEffect, useRef } from 'react'

const SPARK_COLORS = ['#FF2D78','#6C63FF','#00C853','#FF9500','#00C8FF','#FFD166']

function SparkBurst({ active }) {
  if (!active) return null
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 20 }}>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360
        const color = SPARK_COLORS[i % SPARK_COLORS.length]
        return (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 6, height: 6, borderRadius: '50%',
            background: color,
            transformOrigin: '0 0',
            animation: `spark${i} 0.5s ease-out forwards`,
          }}>
            <style>{`
              @keyframes spark${i} {
                0%   { transform: translate(0,0) scale(1); opacity: 1; }
                100% { transform: translate(${Math.cos(angle * Math.PI/180) * 28}px, ${Math.sin(angle * Math.PI/180) * 28}px) scale(0); opacity: 0; }
              }
            `}</style>
          </div>
        )
      })}
    </div>
  )
}

export default function TaskRow({
  emoji, title, desc, done,
  onToggle, isOneOff, smart, onDelete,
}) {
  const [justChecked, setJustChecked] = useState(false)
  const prevDone = useRef(done)

  useEffect(() => {
    if (done && !prevDone.current) {
      setJustChecked(true)
      const t = setTimeout(() => setJustChecked(false), 700)
      return () => clearTimeout(t)
    }
    prevDone.current = done
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
        background:  done
          ? 'linear-gradient(135deg, #EDFFF5 0%, #E0FFF0 100%)'
          : 'white',
        borderRadius: 20,
        padding:     '15px 16px',
        display:     'flex',
        alignItems:  'center',
        gap:         14,
        boxShadow:   done
          ? '0 3px 16px rgba(0,200,83,0.15), inset 0 1px 0 rgba(255,255,255,0.8)'
          : '0 3px 16px rgba(26,10,61,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
        cursor:      'pointer',
        borderLeft:  done
          ? '4px solid #00C853'
          : isOneOff
            ? '4px solid #FF5F3D'
            : '4px solid #6C63FF',
        position:    'relative',
        overflow:    'hidden',
        transition:  'all 0.3s cubic-bezier(.4,0,.2,1)',
        animation:   justChecked ? 'rowFlash 0.7s ease forwards' : 'none',
        WebkitTapHighlightColor: 'transparent',
        transform:   'translateZ(0)',
      }}
    >
      {justChecked && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,200,83,0.2) 50%, transparent 100%)',
          backgroundSize: '200% auto',
          animation: 'shimmer 0.5s linear',
        }}/>
      )}

      <SparkBurst active={justChecked}/>

      {smart && !done && (
        <div aria-hidden="true" style={{ position: 'absolute', top: 5, right: 54, fontSize: 10, opacity: .45 }}>✨</div>
      )}

      <span aria-hidden="true" style={{
        fontSize: 26, flexShrink: 0, transition: 'all 0.3s',
        animation: justChecked ? 'bounceIn 0.5s cubic-bezier(.34,1.56,.64,1)' : 'none',
      }}>
        {done ? '✅' : emoji}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 800,
          textDecoration: done ? 'line-through' : 'none',
          color: done ? '#7A9E8A' : '#1A0A3D',
          marginBottom: desc ? 3 : 0,
          transition: 'all .25s',
        }}>
          {title}
        </div>
        {desc && !done && (
          <div style={{ fontSize: 12, color: '#9B8FB0', fontWeight: 600, lineHeight: 1.4 }}>
            {desc}
          </div>
        )}
      </div>

      <div aria-hidden="true" style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        border: done ? 'none' : '2.5px solid #D8D0E8',
        background: done
          ? 'linear-gradient(135deg, #00C853, #00A846)'
          : 'linear-gradient(135deg, #F8F5FF, #EDE8FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color: 'white', fontWeight: 900,
        transition: 'all .3s cubic-bezier(.34,1.56,.64,1)',
        animation: justChecked ? 'checkBounce 0.6s cubic-bezier(.34,1.56,.64,1)' : 'none',
        boxShadow: done ? '0 4px 14px rgba(0,200,83,0.45)' : '0 2px 8px rgba(108,99,255,0.1)',
      }}>
        {done ? '✓' : ''}
      </div>

      {isOneOff && onDelete && !done && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          aria-label={`Delete task: ${title}`}
          style={{
            background: 'none', border: 'none', color: '#D8D0E8',
            fontSize: 22, cursor: 'pointer', padding: '0 2px',
            flexShrink: 0, lineHeight: 1, WebkitTapHighlightColor: 'transparent',
          }}
        >×</button>
      )}
    </div>
  )
}
