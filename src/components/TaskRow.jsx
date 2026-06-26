/**
 * @param {{
 *   emoji: string,
 *   title: string,
 *   desc?: string,
 *   done: boolean,
 *   onToggle: () => void,
 *   isOneOff?: boolean,
 *   smart?: boolean,
 *   onDelete?: () => void,
 *   hasForm?: boolean,
 *   onForm?: (e: React.MouseEvent) => void,
 * }} props
 */
export default function TaskRow({
  emoji, title, desc, done,
  onToggle, isOneOff, smart, onDelete,
  hasForm, onForm,
}) {
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
        background:  'var(--white)',
        borderRadius: 20,
        padding:     '14px 16px',
        display:     'flex',
        alignItems:  'center',
        gap:         14,
        boxShadow:   '0 2px 10px var(--shadow)',
        cursor:      'pointer',
        opacity:     done ? 0.45 : 1,
        borderLeft:  isOneOff ? '3px solid var(--blush-l)' : '3px solid transparent',
        position:    'relative',
        overflow:    'hidden',
        transition:  'opacity .2s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {smart && !done && (
        <div
          aria-hidden="true"
          style={{ position:'absolute', top:4, right:36, fontSize:10, opacity:.4 }}
        >
          ✨
        </div>
      )}

      <span aria-hidden="true" style={{ fontSize:24, flexShrink:0, filter:done?'grayscale(1)':'none' }}>
        {emoji}
      </span>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:800, textDecoration:done?'line-through':'none', marginBottom:desc||hasForm?2:0 }}>
          {title}
        </div>

        {desc && (
          <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, lineHeight:1.4 }}>
            {desc}
          </div>
        )}

        {hasForm && !done && (
          <a
            href="#"
            onClick={e => { e.stopPropagation(); onForm?.(e) }}
            aria-label="Open FORM app"
            style={{
              display:     'inline-flex',
              alignItems:  'center',
              gap:         5,
              marginTop:   6,
              background:  'var(--sky-l)',
              borderRadius: 999,
              padding:     '5px 13px',
              fontSize:    11,
              fontWeight:  800,
              color:       '#4A7A96',
              textDecoration: 'none',
            }}
          >
            🏊 Open FORM
          </a>
        )}
      </div>

      {/* Checkbox circle */}
      <div
        aria-hidden="true"
        style={{
          width:        34,
          height:       34,
          borderRadius: '50%',
          border:       `2.5px solid ${done ? 'var(--moss)' : 'var(--sand)'}`,
          background:   done ? 'var(--moss)' : 'var(--warm)',
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     16,
          color:        'white',
          transition:   'all .25s cubic-bezier(.34,1.56,.64,1)',
          transform:    done ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        {done ? '✓' : ''}
      </div>

      {isOneOff && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          aria-label={`Delete task: ${title}`}
          style={{
            background: 'none',
            border:     'none',
            color:      'var(--sand)',
            fontSize:   22,
            cursor:     'pointer',
            padding:    '0 2px',
            flexShrink: 0,
            lineHeight: 1,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
