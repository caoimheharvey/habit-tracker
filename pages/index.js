import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useCallback, useRef } from 'react'

import { useAppState }  from '../src/hooks/useAppState'
import { useTotp }      from '../src/hooks/useTotp'
import { useRoast }     from '../src/hooks/useRoast'
import { useToast }     from '../src/hooks/useToast'

import TotpScreen       from '../src/components/TotpScreen'
import TaskRow          from '../src/components/TaskRow'
import { WhimsyCard, Label, SectionHead, Toast, Spinner } from '../src/components/ui'

import { DAILY_TASKS, ALL_DECO }  from '../src/lib/constants'
import { countDailyDone, sanitiseTitle } from '../src/lib/state'

const TODAY       = new Date().toDateString()
const DAY_OF_YEAR = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)

// FORM → App Store (no public URL scheme)
const FORM_URL = 'https://apps.apple.com/app/form-swim-goggles/id1498219393'
function openFORM(e) { e.preventDefault(); window.open(FORM_URL, '_blank') }

// ── Floating background blobs ─────────────────────────────────────────────────
function BackgroundBlobs() {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {[
        { w: 380, h: 380, top: -100, left: -100, color: 'rgba(108,99,255,0.12)', delay: 0, dur: 8 },
        { w: 300, h: 300, top: '20%', right: -80,  color: 'rgba(255,45,120,0.10)',  delay: 2, dur: 10 },
        { w: 260, h: 260, bottom: '15%', left: '10%', color: 'rgba(0,200,83,0.08)',  delay: 4, dur: 7 },
        { w: 200, h: 200, bottom: -60, right: '20%',  color: 'rgba(255,149,0,0.09)', delay: 1, dur: 9 },
      ].map((b, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: b.w, height: b.h, borderRadius: '50%',
          top: b.top, left: b.left, right: b.right, bottom: b.bottom,
          background: b.color,
          filter: 'blur(60px)',
          animation: `blobFloat ${b.dur}s ease-in-out infinite`,
          animationDelay: `${b.delay}s`,
        }}/>
      ))}
    </div>
  )
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null
  const pieces = ['🎉','⭐','✨','🌟','💥','🎊','🔥','💜','💖','🎈']
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 3.3) % 100}%`,
          top:  `${-5 - (i % 8) * 4}%`,
          fontSize: 16 + (i % 4) * 6,
          animation: `confettiDrop ${0.7 + (i % 5) * 0.25}s cubic-bezier(.25,.46,.45,.94) forwards`,
          animationDelay: `${(i % 8) * 0.06}s`,
        }}>
          {pieces[i % pieces.length]}
        </div>
      ))}
    </div>
  )
}

// ── Rainbow progress ring ─────────────────────────────────────────────────────
function RainbowRing({ done, total }) {
  const pct  = total ? done / total : 0
  const r    = 72
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)

  const ringColor = pct === 1
    ? 'url(#greenGrad)'
    : pct >= 0.6
      ? 'url(#purpleGrad)'
      : pct >= 0.3
        ? 'url(#orangeGrad)'
        : 'url(#pinkGrad)'

  const msgs = ['Start! 💪', 'Rolling! 🌱', 'Halfway! ⚡', 'So close! 🔥', 'ALL DONE! 🎉']
  const msgIdx = done === 0 ? 0 : done < 2 ? 1 : done < 4 ? 2 : done < total ? 3 : 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 0' }}>
      <div style={{ position: 'relative', width: 176, height: 176 }}>
        <svg width="176" height="176" viewBox="0 0 176 176" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <defs>
            <linearGradient id="pinkGrad"   x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF2D78"/><stop offset="100%" stopColor="#FF9500"/>
            </linearGradient>
            <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9500"/><stop offset="100%" stopColor="#6C63FF"/>
            </linearGradient>
            <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6C63FF"/><stop offset="100%" stopColor="#00C8FF"/>
            </linearGradient>
            <linearGradient id="greenGrad"  x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00C853"/><stop offset="100%" stopColor="#00C8FF"/>
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="88" cy="88" r={r} fill="none" stroke="rgba(108,99,255,0.08)" strokeWidth="13"/>
          {/* Progress arc */}
          <circle cx="88" cy="88" r={r} fill="none"
            stroke={ringColor}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1), stroke 0.5s',
              filter: pct > 0 ? `drop-shadow(0 0 8px rgba(108,99,255,${0.3 + pct * 0.5}))` : 'none' }}
          />
        </svg>

        {/* Centre content */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 38, fontWeight: 900, lineHeight: 1,
            background: pct === 1
              ? 'linear-gradient(135deg, #00C853, #00C8FF)'
              : 'linear-gradient(135deg, #6C63FF, #FF2D78)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            transition: 'all 0.5s',
          }}>
            {Math.round(pct * 100)}%
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9B8FB0', marginTop: 2 }}>
            {done}/{total} habits
          </div>
        </div>
      </div>
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 800,
        background: 'linear-gradient(90deg, #6C63FF, #FF2D78)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {msgs[msgIdx]}
      </div>
    </div>
  )
}

// ── Streak display ────────────────────────────────────────────────────────────
function StreakBadge({ streak }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      background: 'linear-gradient(160deg, rgba(255,149,0,0.12), rgba(255,45,120,0.08))',
      border: '2px solid rgba(255,149,0,0.25)',
      borderRadius: 24, padding: '16px 28px',
      boxShadow: '0 4px 24px rgba(255,149,0,0.15)',
    }}>
      <div style={{
        fontSize: 44, lineHeight: 1,
        animation: streak > 0 ? 'streakPop 3s ease-in-out infinite' : 'none',
        filter: streak > 0 ? 'drop-shadow(0 0 16px rgba(255,149,0,0.8))' : 'none',
      }}>🔥</div>
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 52, fontWeight: 900, lineHeight: 1,
        background: 'linear-gradient(135deg, #FF9500, #FF2D78)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {streak}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#C8800A', letterSpacing: '2px', textTransform: 'uppercase' }}>
        day streak
      </div>
    </div>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────
function Hero({ photos, photoIdx, onPrev, onNext, greeting, dateStr, streak, done, total }) {
  const hasPhotos = photos.length > 0

  return (
    <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* Dark gradient background */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(160deg, #12002E 0%, #0A1040 45%, #1A0030 100%)',
        padding: hasPhotos ? '0 0 28px' : '52px 24px 36px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Animated background orbs */}
        {[
          { size: 200, top: -60, left: -50, color: 'rgba(108,99,255,0.3)' },
          { size: 160, top: 30, right: -60, color: 'rgba(255,45,120,0.2)' },
          { size: 140, bottom: -40, left: '35%', color: 'rgba(0,200,83,0.15)' },
        ].map((o, i) => (
          <div key={i} aria-hidden="true" style={{
            position: 'absolute', borderRadius: '50%',
            width: o.size, height: o.size,
            top: o.top, left: o.left, right: o.right, bottom: o.bottom,
            background: o.color, filter: 'blur(40px)',
            animation: `blobFloat ${6 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 1.8}s`,
            pointerEvents: 'none',
          }}/>
        ))}

        {/* Photo (if available) */}
        {hasPhotos && (
          <div style={{ position: 'relative', width: '100%', height: 200 }}>
            <img
              key={photoIdx}
              src={photos[photoIdx]}
              alt=""
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.35, animation: 'fadePhoto .5s ease' }}
            />
            {photos.length > 1 && <>
              <button onClick={onPrev} aria-label="Previous photo"
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%',
                  background: 'none', border: 'none', cursor: 'pointer', zIndex: 10,
                  WebkitTapHighlightColor: 'transparent' }}/>
              <button onClick={onNext} aria-label="Next photo"
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%',
                  background: 'none', border: 'none', cursor: 'pointer', zIndex: 10,
                  WebkitTapHighlightColor: 'transparent' }}/>
              <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', gap: 5 }}>
                {photos.map((_, i) => (
                  <div key={i} style={{ height: 4, borderRadius: 999, transition: 'all .3s',
                    width: i === photoIdx ? 16 : 4,
                    background: i === photoIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}/>
                ))}
              </div>
            </>}
          </div>
        )}

        {/* Date + greeting */}
        <div style={{ zIndex: 2, textAlign: 'center', marginBottom: hasPhotos ? 0 : 24 }}>
          <div style={{
            display: 'inline-block', background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 800,
            letterSpacing: '2.5px', textTransform: 'uppercase',
            padding: '5px 16px', borderRadius: 999, marginBottom: 10,
          }}>
            {dateStr}
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
            fontSize: 24, color: 'rgba(255,255,255,0.92)',
            textShadow: '0 2px 20px rgba(108,99,255,0.6)',
          }}>
            {greeting} ✨
          </div>
        </div>

        {/* Stats row */}
        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 20, width: '100%', marginTop: 20, padding: '0 16px' }}>
          <RainbowRing done={done} total={total}/>
          <StreakBadge streak={streak}/>
        </div>
      </div>
    </div>
  )
}

// ── FORM button ───────────────────────────────────────────────────────────────
function FormButton() {
  const [pressed, setPressed] = useState(false)
  return (
    <a href="#" onClick={e => { setPressed(true); setTimeout(() => setPressed(false), 250); openFORM(e) }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        textDecoration: 'none',
        background: 'linear-gradient(135deg, #1A7FC1 0%, #0D5A8E 100%)',
        color: 'white', borderRadius: 22, padding: '18px 22px',
        fontFamily: "'Nunito', sans-serif", fontWeight: 900,
        boxShadow: pressed
          ? '0 2px 10px rgba(26,127,193,0.3)'
          : '0 8px 28px rgba(26,127,193,0.45)',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'all .2s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <span style={{ fontSize: 28, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}>🏊</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, letterSpacing: '0.3px' }}>Open FORM App</span>
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>Opens App Store → tap Open</span>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 20, opacity: 0.6 }}>→</span>
    </a>
  )
}

// ── Vivid section card ────────────────────────────────────────────────────────
function SectionCard({ accentGrad, headerGrad, icon, label, badge, badgeStyle, children, animDelay = 0 }) {
  return (
    <div style={{
      borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 6px 28px rgba(26,10,61,0.10)',
      animation: `cardEntrance 0.5s ease ${animDelay}s both`,
      border: '1.5px solid rgba(255,255,255,0.6)',
    }}>
      {/* Header */}
      <div style={{
        background: headerGrad,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 800,
          color: 'white', letterSpacing: '0.2px',
          textShadow: '0 1px 8px rgba(0,0,0,0.2)',
        }}>
          {icon} {label}
        </span>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: 'white',
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)',
            padding: '4px 10px', borderRadius: 999, letterSpacing: '0.5px',
            ...badgeStyle,
          }}>
            {badge}
          </span>
        )}
      </div>
      {/* Body */}
      <div style={{ background: 'white', paddingTop: 6, paddingBottom: 4 }}>
        {children}
      </div>
    </div>
  )
}

// ── Reality check card ────────────────────────────────────────────────────────
function RealityCard({ roast, loading, onRefresh }) {
  return (
    <div style={{
      borderRadius: 22,
      background: 'linear-gradient(135deg, #F8F4FF 0%, #EDE6FF 100%)',
      border: '2px solid rgba(108,99,255,0.18)',
      padding: '18px 20px',
      boxShadow: '0 6px 24px rgba(108,99,255,0.10)',
      animation: 'cardEntrance 0.4s ease both',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase',
        marginBottom: 10,
        background: 'linear-gradient(90deg, #6C63FF, #FF2D78)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        display: 'inline-block',
      }}>
        🌱 today's reality check
      </div>
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9B8FB0',
            fontSize: 14, fontWeight: 600, fontStyle: 'italic' }}>
            <Spinner/> Brewing your check-in...
          </div>
        : <p style={{ fontSize: 14, lineHeight: 1.85, fontWeight: 700, color: '#1A0A3D' }}>{roast}</p>
      }
      <button onClick={onRefresh} style={{
        marginTop: 12, background: 'rgba(108,99,255,0.1)', border: '1.5px solid rgba(108,99,255,0.25)',
        color: '#6C63FF', fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
        padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>↻ try again</button>
    </div>
  )
}

// ── Add task input ────────────────────────────────────────────────────────────
function AddTaskInput({ value, onChange, onAdd }) {
  return (
    <div style={{
      background: 'white', borderRadius: 22, padding: '16px 18px',
      boxShadow: '0 6px 24px rgba(26,10,61,0.08)',
      border: '1.5px solid rgba(108,99,255,0.12)',
      animation: 'cardEntrance 0.6s ease both',
    }}>
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 800,
        marginBottom: 12,
        background: 'linear-gradient(90deg, #6C63FF, #FF2D78)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        display: 'inline-block',
      }}>Add a task ✏️</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder="e.g. do laundry, call dentist..."
          maxLength={120}
          aria-label="New task title"
          style={{
            flex: 1, background: '#F8F5FF', border: '2px solid #E8E0FF',
            borderRadius: 14, padding: '13px 15px',
            fontFamily: "'Nunito',sans-serif", fontSize: 14, fontWeight: 700,
            color: '#1A0A3D', outline: 'none',
            transition: 'border-color .2s',
          }}
          onFocus={e  => e.target.style.borderColor = '#6C63FF'}
          onBlur={e   => e.target.style.borderColor = '#E8E0FF'}
        />
        <button onClick={onAdd} aria-label="Add task" style={{
          background: 'linear-gradient(135deg, #6C63FF, #4A42E0)',
          color: 'white', border: 'none', borderRadius: 14,
          padding: '13px 22px', fontSize: 24, fontWeight: 900, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(108,99,255,0.45)',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
        }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
          onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
        >+</button>
      </div>
    </div>
  )
}

// ── Photo manager ─────────────────────────────────────────────────────────────
function PhotoManager({ photos, onRemove, fileRef }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'rgba(108,99,255,0.08)', border: '1.5px solid rgba(108,99,255,0.2)',
        color: '#6C63FF', fontFamily: "'Nunito', sans-serif",
        fontSize: 12, fontWeight: 800, padding: '8px 14px',
        borderRadius: 999, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>
        📷 Photos ({photos.length}/10) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 10, animation: 'slideUp .2s ease' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 68, height: 68, borderRadius: 14,
                overflow: 'hidden', boxShadow: '0 3px 12px rgba(26,10,61,0.15)', flexShrink: 0 }}>
                <img src={src} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                <button onClick={() => onRemove(i)} aria-label={`Remove photo ${i + 1}`}
                  style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(26,10,61,0.75)', border: 'none', color: 'white', fontSize: 12,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
            {photos.length < 10 && (
              <button onClick={() => fileRef.current?.click()} aria-label="Add photo"
                style={{ width: 68, height: 68, borderRadius: 14,
                  border: '2px dashed rgba(108,99,255,0.3)',
                  background: 'rgba(108,99,255,0.05)', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', color: '#9B8FB0', fontSize: 22, fontWeight: 800,
                  WebkitTapHighlightColor: 'transparent' }}>+</button>
            )}
          </div>
          {photos.length === 0 && (
            <p style={{ fontSize: 12, color: '#9B8FB0', fontWeight: 600, marginTop: 8, fontStyle: 'italic' }}>
              Add up to 10 photos — they rotate daily in the hero.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { data: session, status } = useSession()
  const { message: toast, show: showToast } = useToast()

  const [showDone, setShowDone]   = useState(false)
  const [confetti, setConfetti]   = useState(false)
  const [tab, setTab]             = useState('home')
  const [newTask, setNewTask]     = useState('')
  const [eodText, setEodText]     = useState('')
  const [rollover, setRollover]   = useState([])
  const [roLoading, setRoLoad]    = useState(false)
  const [photoIdx, setPhotoIdx]   = useState(0)

  const fileRef = useRef()

  const { mode: pinMode, error: pinError, loading: pinLoading, verify: verifyTotp, lock } = useTotp()

  const {
    state,
    handleToggleDaily,
    handleToggleOneOff,
    handleDeleteOneOff,
    handleAddOneOff,
    handleMergeSmartTasks,
    handleAddPhoto,
    handleRemovePhoto,
    handleSetSmartTasksDate,
  } = useAppState({
    today:          TODAY,
    onAllDailyDone: useCallback(() => {
      setTimeout(() => {
        setConfetti(true)
        setTimeout(() => { setConfetti(false); setShowDone(true) }, 2200)
      }, 400)
    }, []),
  })

  const { roast, loading: roastLoading, loadCached, generate: generateRoast } = useRoast({ today: TODAY })

  useEffect(() => {
    if (!state?.photos?.length) return
    setPhotoIdx(DAY_OF_YEAR % state.photos.length)
  }, [state?.photos?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pinMode !== 'unlocked' || !state) return
    if (!loadCached()) generateRoast({ streak: state.streak, events: [] })
  }, [pinMode, state?.streak]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || !state || pinMode !== 'unlocked') return
    if (state.smartTasksDate === TODAY) return
    runSmartTaskFetch()
  }, [session, state?.smartTasksDate, pinMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const runSmartTaskFetch = useCallback(async () => {
    showToast('🔍 Checking your calendar...')
    try {
      const ctxRes = await fetch('/api/context')
      if (!ctxRes.ok) {
        const { error } = await ctxRes.json().catch(() => ({}))
        showToast(`📅 Calendar fetch failed: ${error ?? `HTTP ${ctxRes.status}`}`)
        return
      }
      const ctx = await ctxRes.json()
      const taskRes = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'plan', events: ctx.events, emails: ctx.emails, existingOneOffs: state.oneOffTasks }),
      })
      if (!taskRes.ok) { showToast('✨ AI task generation failed — try again later'); return }
      const { tasks = [] } = await taskRes.json()
      const added = handleMergeSmartTasks(tasks, TODAY)
      if (added > 0) setTimeout(() => showToast(`✨ ${added} smart task${added > 1 ? 's' : ''} added from your calendar`), 300)
      else { showToast('📅 No new tasks found in your calendar'); handleSetSmartTasksDate(TODAY) }
    } catch (e) {
      console.error(e)
      showToast('Could not reach server — check your connection')
    }
  }, [session, state, handleMergeSmartTasks, handleSetSmartTasksDate, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTask = useCallback(() => {
    const ok = handleAddOneOff(newTask)
    if (ok) { setNewTask(''); showToast('Task added 📌') }
    else showToast('Task is empty or already exists')
  }, [newTask, handleAddOneOff, showToast])

  const handlePhotoFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { handleAddPhoto(ev.target.result); showToast('Photo added 📷') }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [handleAddPhoto, showToast])

  const prevPhoto = useCallback(() => setPhotoIdx(i => (i - 1 + Math.max(state?.photos?.length ?? 1, 1)) % Math.max(state?.photos?.length ?? 1, 1)), [state?.photos?.length])
  const nextPhoto = useCallback(() => setPhotoIdx(i => (i + 1) % Math.max(state?.photos?.length ?? 1, 1)), [state?.photos?.length])

  const handleRollover = useCallback(async () => {
    if (!eodText.trim()) { showToast('Write something first 🌿'); return }
    setRoLoad(true)
    try {
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'rollover', summary: eodText }),
      })
      if (!res.ok) throw new Error()
      const { tasks = [] } = await res.json()
      setRollover(tasks)
      if (!tasks.length) showToast('No one-off tasks found 🌿')
    } catch { showToast('Something went wrong, try again') }
    finally   { setRoLoad(false) }
  }, [eodText, showToast])

  const saveRollover = useCallback(() => {
    const added = handleMergeSmartTasks(rollover, TODAY)
    showToast(`${added} task${added !== 1 ? 's' : ''} added 📌`)
    setRollover([]); setEodText(''); setTab('home')
  }, [rollover, handleMergeSmartTasks, showToast])

  if (!state) return null

  const photos     = state.photos ?? []
  const dailyDone  = countDailyDone(state)
  const dailyTotal = DAILY_TASKS.length
  const now        = new Date()
  const greeting   = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr    = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  if (pinMode === 'checking') return null
  if (pinMode === 'locked') return <TotpScreen error={pinError} loading={pinLoading} onVerify={verifyTotp}/>

  // ── All-done celebration ──────────────────────────────────────────────────
  if (showDone) {
    return (
      <div style={{ minHeight: '100vh',
        background: 'linear-gradient(160deg, #12002E 0%, #0A1040 50%, #1A0030 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {['🎉','⭐','✨','💥','🌟','🎊','💜','💖'].map((d, i) => (
          <div key={i} aria-hidden="true" style={{ position: 'absolute', fontSize: 28, opacity: .25,
            top: `${8 + i * 12}%`, left: i % 2 === 0 ? '5%' : '83%',
            animation: `float ${2.5 + i * .3}s ease-in-out infinite`, animationDelay: `${i * .35}s`,
            userSelect: 'none', pointerEvents: 'none' }}>{d}</div>
        ))}
        <div style={{ fontSize: 96, marginBottom: 16,
          animation: 'bounceIn .7s cubic-bezier(.34,1.56,.64,1)',
          filter: 'drop-shadow(0 0 40px rgba(255,149,0,0.8))',
          position: 'relative', zIndex: 1 }}>🔥</div>
        <h2 style={{
          fontFamily: "'Poppins',sans-serif", fontSize: 38, fontWeight: 900, marginBottom: 12,
          position: 'relative', zIndex: 1,
          background: 'linear-gradient(90deg, #FF9500, #FF2D78, #6C63FF)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Absolute legend.</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 600, lineHeight: 1.7,
          marginBottom: 28, maxWidth: 280, position: 'relative', zIndex: 1 }}>
          Not because you felt like it. Because you showed up anyway. Every. Single. Day.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40, position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 48, filter: 'drop-shadow(0 0 20px rgba(255,149,0,0.8))' }}>🔥</span>
          <div>
            <div style={{
              fontFamily: "'Poppins',sans-serif", fontSize: 56, fontWeight: 900, lineHeight: 1,
              background: 'linear-gradient(135deg, #FF9500, #FF2D78)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{state.streak}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '2px' }}>day streak</div>
          </div>
        </div>
        <button onClick={() => setShowDone(false)} style={{
          background: 'linear-gradient(135deg, #6C63FF, #FF2D78)',
          color: 'white', border: 'none', borderRadius: 20, padding: '16px 40px',
          fontFamily: "'Poppins',sans-serif", fontSize: 16, fontWeight: 800,
          cursor: 'pointer', boxShadow: '0 8px 32px rgba(108,99,255,0.5)',
          WebkitTapHighlightColor: 'transparent',
        }}>Back home 🏡</button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F5F0FF', fontFamily: "'Nunito',sans-serif", color: '#1A0A3D', position: 'relative' }}>
      <BackgroundBlobs/>
      <Confetti active={confetti}/>

      <input type="file" accept="image/*" ref={fileRef} onChange={handlePhotoFile}
        style={{ display: 'none' }} aria-label="Upload photo"/>

      {/* ── HOME ── */}
      {tab === 'home' && (
        <div style={{ paddingBottom: 110, position: 'relative', zIndex: 1 }}>

          <Hero
            photos={photos} photoIdx={photoIdx} onPrev={prevPhoto} onNext={nextPhoto}
            greeting={greeting} dateStr={dateStr}
            streak={state.streak} done={dailyDone} total={dailyTotal}
          />

          <div style={{ padding: '18px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Google connect banner */}
            {(status === 'unauthenticated' || session?.error === 'RefreshAccessTokenError') && (
              <div style={{
                background: 'white', borderRadius: 18,
                border: '2px solid rgba(108,99,255,0.25)',
                padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                boxShadow: '0 4px 16px rgba(108,99,255,0.08)',
                animation: 'cardEntrance 0.3s ease both',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#6C63FF' }}>
                    {session?.error ? 'Reconnect Google 🔄' : 'Connect Google 🔗'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9B8FB0', fontWeight: 600 }}>
                    {session?.error ? 'Session expired — tap to refresh' : 'Smart calendar-aware tasks'}
                  </div>
                </div>
                <button onClick={() => signIn('google')} style={{
                  background: 'linear-gradient(135deg, #6C63FF, #4A42E0)', color: 'white',
                  border: 'none', borderRadius: 12, padding: '9px 16px',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  fontFamily: "'Nunito',sans-serif",
                  boxShadow: '0 3px 12px rgba(108,99,255,0.4)',
                }}>
                  {session?.error ? 'Reconnect' : 'Connect'}
                </button>
              </div>
            )}

            {/* FORM button */}
            <FormButton/>

            {/* Reality check */}
            <RealityCard
              roast={roast} loading={roastLoading}
              onRefresh={() => generateRoast({ streak: state.streak, events: [] })}
            />

            {/* Daily habits */}
            <SectionCard
              headerGrad="linear-gradient(135deg, #6C63FF 0%, #4A42E0 100%)"
              icon="💜" label="Daily Habits"
              badge="resets every morning"
              animDelay={0.1}
            >
              {DAILY_TASKS.map(t => (
                <TaskRow
                  key={t.id}
                  emoji={t.emoji}
                  title={t.title}
                  desc={t.desc}
                  done={!!state.dailyChecked[t.id]}
                  onToggle={() => handleToggleDaily(t.id)}
                  hasForm={t.hasForm}
                  onForm={openFORM}
                />
              ))}
            </SectionCard>

            {/* One-off tasks */}
            {state.oneOffTasks.length > 0 && (
              <SectionCard
                headerGrad="linear-gradient(135deg, #FF5F3D 0%, #E84520 100%)"
                icon="🎯" label="One-off Tasks"
                badge="rolls over until done"
                animDelay={0.2}
              >
                {state.oneOffTasks.map((t, i) => (
                  <TaskRow
                    key={`oneoff-${i}`}
                    emoji={t.smart ? '✨' : '📌'}
                    title={t.title}
                    desc={t.note ?? (t.smart ? `From: ${t.triggerEvent ?? 'calendar/email'}` : undefined)}
                    done={t.done}
                    isOneOff smart={t.smart}
                    onToggle={() => handleToggleOneOff(i)}
                    onDelete={() => handleDeleteOneOff(i)}
                  />
                ))}
              </SectionCard>
            )}

            {/* Add task */}
            <AddTaskInput value={newTask} onChange={setNewTask} onAdd={handleAddTask}/>

            {/* Smart task refresh */}
            {session && (
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => { handleSetSmartTasksDate(null); runSmartTaskFetch() }}
                  style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 13,
                    fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  ✨ Refresh smart tasks from calendar
                </button>
              </div>
            )}

            {/* Settings strip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 4, flexWrap: 'wrap', gap: 8 }}>
              <PhotoManager photos={photos} onRemove={handleRemovePhoto} fileRef={fileRef}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={lock} style={{
                  background: 'white', border: '1.5px solid rgba(108,99,255,0.2)',
                  color: '#6C63FF', fontFamily: "'Nunito', sans-serif",
                  fontSize: 12, fontWeight: 800, padding: '8px 14px',
                  borderRadius: 999, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                }}>🔒 Lock</button>
                {session && (
                  <button onClick={() => signOut()} style={{
                    background: 'white', border: '1.5px solid rgba(255,95,61,0.2)',
                    color: '#FF5F3D', fontFamily: "'Nunito', sans-serif",
                    fontSize: 12, fontWeight: 800, padding: '8px 14px',
                    borderRadius: 999, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  }}>Sign out</button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── END OF DAY ── */}
      {tab === 'eod' && (
        <div style={{ paddingBottom: 110, position: 'relative', zIndex: 1 }}>
          <div style={{
            background: 'linear-gradient(160deg, #12002E, #1A0030)',
            padding: '56px 24px 32px', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {['🍂','🕯️','🌙','🍵'].map((d, i) => (
              <div key={i} aria-hidden="true" style={{ position: 'absolute', top: 12 + i * 16,
                [i % 2 === 0 ? 'left' : 'right']: 12 + i * 4, fontSize: 20, opacity: .2,
                animation: `float ${3 + i * .5}s ease-in-out infinite`, animationDelay: `${i * .4}s`,
                userSelect: 'none', pointerEvents: 'none' }}>{d}</div>
            ))}
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 30,
              fontWeight: 700, marginBottom: 8, color: 'white',
              textShadow: '0 0 30px rgba(108,99,255,0.6)' }}>End of day 🌙</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 600, lineHeight: 1.6 }}>
              Brain dump how today went. I'll pull out anything to roll over.
            </p>
          </div>

          <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '2px solid rgba(108,99,255,0.2)',
              borderRadius: 18, padding: '13px 16px', fontSize: 12, fontWeight: 700, color: '#6C63FF',
              lineHeight: 1.6, boxShadow: '0 4px 16px rgba(108,99,255,0.08)' }}>
              <strong>Note:</strong> Daily habits never roll over. Only genuine one-off tasks carry over.
            </div>

            <div style={{ background: 'white', borderRadius: 22, padding: '18px 18px',
              boxShadow: '0 6px 24px rgba(26,10,61,0.08)',
              border: '1.5px solid rgba(108,99,255,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12,
                background: 'linear-gradient(90deg, #6C63FF, #FF2D78)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
                📝 how did today go?
              </div>
              <textarea
                value={eodText}
                onChange={e => setEodText(e.target.value)}
                placeholder="Did the walk but skipped gym again. Still need to do laundry. Work deadline tomorrow 10am..."
                maxLength={4000}
                aria-label="End of day summary"
                style={{ width: '100%', background: '#F8F5FF', border: '2px solid #E8E0FF',
                  borderRadius: 14, padding: 14, fontFamily: "'Nunito',sans-serif",
                  fontSize: 14, fontWeight: 600, color: '#1A0A3D', lineHeight: 1.7,
                  resize: 'none', minHeight: 150, outline: 'none' }}
                onFocus={e  => e.target.style.borderColor = '#6C63FF'}
                onBlur={e   => e.target.style.borderColor = '#E8E0FF'}
              />
            </div>

            <button onClick={handleRollover} disabled={roLoading} style={{
              width: '100%',
              background: roLoading ? '#C8C0E8' : 'linear-gradient(135deg, #6C63FF, #FF2D78)',
              color: 'white', border: 'none', borderRadius: 18, padding: 16,
              fontFamily: "'Poppins',sans-serif", fontSize: 16, fontWeight: 800,
              cursor: roLoading ? 'not-allowed' : 'pointer',
              boxShadow: roLoading ? 'none' : '0 6px 24px rgba(108,99,255,0.45)',
              WebkitTapHighlightColor: 'transparent', letterSpacing: '0.3px',
            }}>
              {roLoading ? '🌙 Thinking...' : "✨ Extract tomorrow's tasks"}
            </button>

            {rollover.length > 0 && (
              <div>
                <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 800,
                  marginBottom: 10,
                  background: 'linear-gradient(90deg, #6C63FF, #FF9500)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
                  Rolling over to tomorrow 🌅
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rollover.map((item, i) => (
                    <div key={i} style={{ background: 'white', borderRadius: 18, padding: '14px 16px',
                      boxShadow: '0 4px 16px rgba(26,10,61,0.08)', display: 'flex', gap: 12, alignItems: 'flex-start',
                      borderLeft: `4px solid ${item.priority === 'high' ? '#FF5F3D' : item.priority === 'low' ? '#00C853' : '#6C63FF'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: '#9B8FB0', fontWeight: 600 }}>{item.note}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'white',
                        background: item.priority === 'high' ? '#FF5F3D' : item.priority === 'low' ? '#00C853' : '#6C63FF',
                        borderRadius: 999, padding: '4px 10px', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2,
                        letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button onClick={saveRollover} style={{
                    flex: 1, background: 'linear-gradient(135deg, #00C853, #00A846)',
                    color: 'white', border: 'none', borderRadius: 18, padding: 16,
                    fontFamily: "'Poppins',sans-serif", fontSize: 15, fontWeight: 800,
                    cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,200,83,0.4)',
                    WebkitTapHighlightColor: 'transparent',
                  }}>＋ Add to my tasks</button>
                  <button onClick={() => setRollover([])} style={{
                    background: 'white', border: '1.5px solid rgba(108,99,255,0.2)',
                    color: '#6C63FF', fontFamily: "'Nunito', sans-serif",
                    fontSize: 20, padding: '14px 20px', borderRadius: 18, cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}>↺</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <nav aria-label="Main navigation" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,253,255,0.92)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(108,99,255,0.12)',
        display: 'flex', zIndex: 500,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -6px 30px rgba(26,10,61,0.08)',
      }}>
        {[
          { id: 'home', icon: '🏡', label: 'Home'    },
          { id: 'eod',  icon: '🌙', label: 'Evening' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            aria-label={t.label}
            aria-current={tab === t.id ? 'page' : undefined}
            style={{
              flex: 1, padding: '10px 4px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Nunito',sans-serif", fontSize: 10, fontWeight: 800,
              color: tab === t.id ? '#6C63FF' : '#9B8FB0',
              WebkitTapHighlightColor: 'transparent', transition: 'color .2s',
            }}>
            <span aria-hidden="true" style={{
              fontSize: 24, lineHeight: 1, display: 'block',
              transform: tab === t.id ? 'scale(1.25)' : 'scale(1)',
              filter: tab === t.id ? 'drop-shadow(0 2px 8px rgba(108,99,255,0.5))' : 'none',
              transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
            }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <Toast message={toast}/>
    </div>
  )
}
