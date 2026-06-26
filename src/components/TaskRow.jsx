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
            width: 7, height: 7, borderRadius: '50%', background: color,
            transformOrigin: '0 0',
            animation: `spark${i} 0.55s ease-out forwards`,
          }}>
            <style>{`@keyframes spark${i}{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(${Math.cos(angle*Math.PI/180)*32}px,${Math.sin(angle*Math.PI/180)*32}px) scale(0);opacity:0}}`}</style>
          </div>
        )
      })}
    </div>
  )
}

function getUrgency(by, done) {
  if (done || !by) return 'done'
  const [h, m]   = by.split(':').map(Number)
  const now      = new Date()
  const deadline = new Date()
  deadline.setHours(h, m, 0, 0)
  const diffMs = deadline - now
  if (diffMs < 0)                   return 'overdue'
  if (diffMs < 10 * 60 * 1000)     return 'urgent'   // < 10 min
  if (diffMs < 25 * 60 * 1000)     return 'soon'     // < 25 min
  return 'ok'
}

function formatBy(by) {
  if (!by) return null
  const [h, m] = by.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2,'0')}${suffix}`
}

function UrgencyBadge({ by, done, now }) {
  if (!by || done) return null
  const urgency = getUrgency(by, done)
  if (urgency === 'done') return null

  const label    = formatBy(by)
  const isLate   = urgency === 'overdue'
  const isUrgent = urgency === 'urgent'
  const isSoon   = urgency === 'soon'

  const bg    = isLate   ? '#FF2D78'
              : isUrgent ? '#FF5F3D'
              : isSoon   ? '#FF9500'
              : 'rgba(108,99,255,0.12)'
  const color = isLate || isUrgent || isSoon ? 'white' : '#6C63FF'
  const text  = isLate ? `LATE · ${label}` : `by ${label}`

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color,
      fontSize: 10, fontWeight: 900, letterSpacing: '0.5px',
      padding: '3px 9px', borderRadius: 999,
      animation: isUrgent ? 'pulse 1s ease-in-out infinite' : 'none',
      flexShrink: 0,
    }}>
      {isLate ? '🚨' : isUrgent ? '⚡' : '⏰'} {text}
    </span>
  )
}

export default function TaskRow({ emoji, title, desc, done, onToggle, isOneOff, smart, onDelete, by, color, now }) {
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

  const urgency    = by ? getUrgency(by, done) : 'ok'
  const isOverdue  = urgency === 'overdue'
  const isUrgent   = urgency === 'urgent'
  const accentColor = done ? '#00C853' : color ?? '#6C63FF'

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
          ? 'linear-gradient(135deg, #EDFFF5, #E0FFF0)'
          : isOverdue
            ? 'linear-gradient(135deg, #FFF0F4, #FFE8EE)'
            : 'white',
        borderRadius: 20,
        padding:     '14px 16px',
        display:     'flex',
        alignItems:  'center',
        gap:         13,
        boxShadow:   done
          ? '0 3px 14px rgba(0,200,83,0.15)'
          : isOverdue
            ? '0 3px 14px rgba(255,45,120,0.15)'
            : '0 3px 14px rgba(26,10,61,0.07)',
        cursor:      'pointer',
        borderLeft:  `4px solid ${accentColor}`,
        position:    'relative',
        overflow:    'hidden',
        transition:  'all 0.3s cubic-bezier(.4,0,.2,1)',
        animation:   justChecked ? 'rowFlash 0.7s ease forwards' : 'none',
        WebkitTapHighlightColor: 'transparent',
        transform:   'translateZ(0)',
      }}
    >
      {/* Overdue pulse border */}
      {isOverdue && !done && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, borderRadius: 20,
          border: '2px solid rgba(255,45,120,0.3)',
          animation: 'pulse 1.5s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>
      )}

      {justChecked && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent, rgba(0,200,83,0.2), transparent)',
          backgroundSize: '200% auto', animation: 'shimmer 0.5s linear',
        }}/>
      )}

      <SparkBurst active={justChecked}/>

      {smart && !done && (
        <div aria-hidden="true" style={{ position: 'absolute', top: 5, right: 54, fontSize: 10, opacity: .4 }}>✨</div>
      )}

      <span aria-hidden="true" style={{
        fontSize: 24, flexShrink: 0, transition: 'all 0.3s',
        animation: justChecked ? 'bounceIn 0.5s cubic-bezier(.34,1.56,.64,1)' : 'none',
      }}>
        {done ? '✅' : emoji}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: desc && !done ? 3 : 0 }}>
          <span style={{
            fontSize: 15, fontWeight: 800,
            textDecoration: done ? 'line-through' : 'none',
            color: done ? '#7A9E8A' : isOverdue ? '#CC1A50' : '#1A0A3D',
            transition: 'all .25s',
          }}>
            {title}
          </span>
          <UrgencyBadge by={by} done={done} now={now}/>
        </div>
        {desc && !done && (
          <div style={{ fontSize: 12, color: '#9B8FB0', fontWeight: 600, lineHeight: 1.4 }}>
            {desc}
          </div>
        )}
      </div>

      <div aria-hidden="true" style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        border: done ? 'none' : `2.5px solid ${isOverdue ? 'rgba(255,45,120,0.3)' : '#D8D0E8'}`,
        background: done
          ? 'linear-gradient(135deg, #00C853, #00A846)'
          : isOverdue
            ? 'linear-gradient(135deg, #FFF0F4, #FFD0DC)'
            : 'linear-gradient(135deg, #F8F5FF, #EDE8FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, color: 'white', fontWeight: 900,
        transition: 'all .3s cubic-bezier(.34,1.56,.64,1)',
        animation: justChecked ? 'checkBounce 0.6s cubic-bezier(.34,1.56,.64,1)' : 'none',
        boxShadow: done ? '0 4px 14px rgba(0,200,83,0.45)' : 'none',
      }}>
        {done ? '✓' : ''}
      </div>

      {isOneOff && onDelete && !done && (
        <button onClick={e => { e.stopPropagation(); onDelete() }} aria-label={`Delete task: ${title}`}
          style={{ background: 'none', border: 'none', color: '#D8D0E8', fontSize: 22,
            cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1,
            WebkitTapHighlightColor: 'transparent' }}>×</button>
      )}
    </div>
  )
}
