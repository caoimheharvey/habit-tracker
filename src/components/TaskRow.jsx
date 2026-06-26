import { useState, useEffect, useRef } from 'react'

function getDeadlineState(by, done, now) {
  if (!by || done) return null
  const [h, m] = by.split(':').map(Number)
  const d = new Date(now); d.setHours(h, m, 0, 0)
  const diffMs = d - now
  if (diffMs < 0)                   return 'overdue'
  if (diffMs < 10 * 60 * 1000)     return 'urgent'
  if (diffMs < 25 * 60 * 1000)     return 'soon'
  return 'ok'
}

function formatBy(by) {
  if (!by) return null
  const [h, m] = by.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

function formatCountdown(by, now) {
  if (!by) return null
  const [h, m] = by.split(':').map(Number)
  const d = new Date(now); d.setHours(h, m, 0, 0)
  const diffMs  = d - now
  if (diffMs < 0) return 'late'
  const diffMin = Math.floor(diffMs / 60000)
  return diffMin < 60 ? `${diffMin}m` : `${Math.floor(diffMin/60)}h${diffMin%60?` ${diffMin%60}m`:''}`
}

export default function TaskRow({ emoji, title, desc, done, onToggle, isOneOff, smart, onDelete, by, color, now }) {
  const [justChecked, setJustChecked] = useState(false)
  const prevDone = useRef(done)

  useEffect(() => {
    if (done && !prevDone.current) {
      setJustChecked(true)
      const t = setTimeout(() => setJustChecked(false), 600)
      return () => clearTimeout(t)
    }
    prevDone.current = done
  }, [done])

  const deadlineState = now ? getDeadlineState(by, done, now) : null
  const isOverdue  = deadlineState === 'overdue'
  const isUrgent   = deadlineState === 'urgent'

  const rowBg = done
    ? 'rgba(48,209,88,0.06)'
    : isOverdue
      ? 'rgba(255,69,58,0.06)'
      : 'transparent'

  const borderColor = done
    ? '#30D158'
    : color ?? 'rgba(255,255,255,0.12)'

  const checkBg = done
    ? '#30D158'
    : isOverdue
      ? 'rgba(255,69,58,0.15)'
      : 'rgba(255,255,255,0.05)'

  const deadlineColor = isOverdue || isUrgent ? '#FF453A'
    : deadlineState === 'soon' ? '#FF9F0A'
    : 'rgba(255,255,255,0.28)'

  return (
    <div
      onClick={onToggle}
      role="checkbox" aria-checked={done} aria-label={title}
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      style={{
        padding: '13px 18px',
        display: 'flex', alignItems: 'center', gap: 13,
        background: rowBg,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        borderLeft: `2px solid ${borderColor}`,
        cursor: 'pointer',
        position: 'relative', overflow: 'hidden',
        transition: 'background .3s',
        animation: justChecked ? 'rowFlash .6s ease forwards' : 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* shimmer */}
      {justChecked && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent, rgba(48,209,88,0.15), transparent)',
          backgroundSize: '200% auto', animation: 'shimmer .5s linear',
        }}/>
      )}

      {/* emoji */}
      <span aria-hidden="true" style={{
        fontSize: 20, flexShrink: 0, opacity: done ? 0.35 : 0.9,
        animation: justChecked ? 'bounceIn .45s ease' : 'none',
        transition: 'opacity .3s',
        filter: done ? 'grayscale(1)' : 'none',
      }}>
        {emoji}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: done ? 'rgba(255,255,255,0.3)' : isOverdue ? 'rgba(255,69,58,0.85)' : 'rgba(255,255,255,0.88)',
            textDecoration: done ? 'line-through' : 'none',
            transition: 'all .25s',
          }}>
            {title}
          </span>
          {by && !done && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: deadlineColor,
              animation: isUrgent || isOverdue ? 'pulse 1s ease-in-out infinite' : 'none',
            }}>
              {isOverdue ? `⚡ ${formatBy(by)}` : `${formatCountdown(by, now)}`}
            </span>
          )}
        </div>
        {desc && !done && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500, marginTop: 2, lineHeight: 1.4 }}>
            {desc}
          </div>
        )}
      </div>

      {/* checkbox */}
      <div aria-hidden="true" style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        border: done ? 'none' : `1.5px solid ${isOverdue ? 'rgba(255,69,58,0.4)' : 'rgba(255,255,255,0.15)'}`,
        background: checkBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: '#000', fontWeight: 900,
        transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
        animation: justChecked ? 'checkBounce .5s ease' : 'none',
        boxShadow: done ? '0 0 12px rgba(48,209,88,0.5)' : 'none',
      }}>
        {done && '✓'}
      </div>

      {isOneOff && onDelete && !done && (
        <button onClick={e => { e.stopPropagation(); onDelete() }} aria-label={`Delete ${title}`}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.18)',
            fontSize:20, cursor:'pointer', padding:'0 2px', flexShrink:0, lineHeight:1,
            WebkitTapHighlightColor:'transparent' }}>×</button>
      )}
    </div>
  )
}
