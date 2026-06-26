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

const TODAY = new Date().toDateString()
const DAY_OF_YEAR = Math.floor(
  (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
)

// ── FORM deep link ────────────────────────────────────────────────────────────
function openFORM(e) {
  e.preventDefault()
  window.location.href = 'form-swimming://'
}

// ── Button styles ─────────────────────────────────────────────────────────────
const btnPrimary = {
  width:        '100%',
  background:   'linear-gradient(135deg, var(--punch), #E84520)',
  color:        'white',
  border:       'none',
  borderRadius: 18,
  padding:      16,
  fontFamily:   "'Nunito', sans-serif",
  fontSize:     16,
  fontWeight:   900,
  cursor:       'pointer',
  boxShadow:    '0 4px 18px rgba(255,95,61,.40)',
  WebkitTapHighlightColor: 'transparent',
  letterSpacing: '0.3px',
}

const btnSmall = {
  background:   'var(--warm)',
  border:       '2px solid var(--sand)',
  color:        'var(--caramel)',
  fontFamily:   "'Nunito', sans-serif",
  fontSize:     12,
  fontWeight:   800,
  padding:      '8px 14px',
  borderRadius: 999,
  cursor:       'pointer',
  WebkitTapHighlightColor: 'transparent',
}

// ── Confetti burst ────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null
  const pieces = ['🎉','⭐','✨','🌟','💥','🎊','🔥']
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {Array.from({ length: 22 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${5 + (i * 4.3) % 90}%`,
          top:  `${-10 + (i * 7) % 30}%`,
          fontSize: 18 + (i % 3) * 8,
          animation: `confettiDrop ${0.8 + (i % 4) * 0.3}s ease-in forwards`,
          animationDelay: `${(i % 6) * 0.07}s`,
        }}>
          {pieces[i % pieces.length]}
        </div>
      ))}
    </div>
  )
}

// ── Streak Hero ───────────────────────────────────────────────────────────────
function StreakHero({ streak, done, total, greeting, dateStr }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (pct / 100) * circumference
  const ringColor = pct === 100
    ? '#00C853'
    : pct >= 60
      ? 'var(--electric)'
      : pct >= 30
        ? 'var(--fire)'
        : 'var(--punch)'

  return (
    <div style={{
      background: 'linear-gradient(160deg, var(--deep) 0%, #2D1060 50%, #0D2060 100%)',
      padding: '48px 24px 32px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative orbs */}
      {[
        { size: 160, top: -40, left: -40, color: 'rgba(108,99,255,0.18)' },
        { size: 100, top: 10,  right: -20, color: 'rgba(255,95,61,0.15)' },
        { size: 80,  bottom: -20, left: '40%', color: 'rgba(0,200,83,0.1)' },
      ].map((o, i) => (
        <div key={i} aria-hidden="true" style={{
          position: 'absolute', borderRadius: '50%',
          width: o.size, height: o.size,
          top: o.top, left: o.left, right: o.right, bottom: o.bottom,
          background: o.color,
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}/>
      ))}

      {/* Date chip */}
      <div style={{
        background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
        color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 800,
        letterSpacing: '2px', textTransform: 'uppercase',
        padding: '5px 16px', borderRadius: 999,
      }}>
        {dateStr}
      </div>

      {/* Greeting */}
      <div style={{
        fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
        fontSize: 26, color: 'white',
        textShadow: '0 2px 20px rgba(108,99,255,0.5)',
        textAlign: 'center',
      }}>
        {greeting} ✨
      </div>

      {/* Progress ring + streak side-by-side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, width: '100%', justifyContent: 'center' }}>

        {/* Progress ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
            <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"/>
            <circle cx="64" cy="64" r="54" fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1), stroke 0.5s', filter: `drop-shadow(0 0 8px ${ringColor})` }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: 30, fontWeight: 900, color: 'white', lineHeight: 1,
            }}>{pct}%</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginTop: 2 }}>
              {done}/{total} done
            </div>
          </div>
        </div>

        {/* Streak */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{
            fontSize: 56, lineHeight: 1,
            animation: streak > 0 ? 'streakPop 2s ease-in-out infinite' : 'none',
            filter: streak > 0 ? 'drop-shadow(0 0 14px rgba(255,149,0,0.7))' : 'none',
          }}>🔥</div>
          <div style={{
            fontFamily: "'Nunito', sans-serif",
            fontSize: 48, fontWeight: 900, color: 'white', lineHeight: 1,
            textShadow: '0 0 30px rgba(255,149,0,0.6)',
          }}>{streak}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
            day streak
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Photo hero (when photos exist) ───────────────────────────────────────────
function PhotoHero({ photos, photoIdx, onPrev, onNext, greeting, dateStr, streak, done, total }) {
  const hasPhotos = photos.length > 0
  const photo     = hasPhotos ? photos[photoIdx] : null

  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div style={{ position: 'relative', height: 300, overflow: 'hidden', flexShrink: 0 }}>
      {photo
        ? <img key={photoIdx} src={photo} alt="" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              filter: 'brightness(0.38) saturate(0.6)', animation: 'fadePhoto .5s ease' }}/>
        : null
      }

      {/* Deep gradient */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg, rgba(26,10,61,0.85) 0%, rgba(13,32,96,0.7) 100%)' }}/>

      {/* Tap zones */}
      {photos.length > 1 && <>
        <button onClick={onPrev} aria-label="Previous photo"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%',
            background: 'none', border: 'none', cursor: 'pointer', zIndex: 10,
            WebkitTapHighlightColor: 'transparent' }}/>
        <button onClick={onNext} aria-label="Next photo"
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%',
            background: 'none', border: 'none', cursor: 'pointer', zIndex: 10,
            WebkitTapHighlightColor: 'transparent' }}/>
      </>}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15, padding: '0 22px 22px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
          color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: 800, letterSpacing: '2px',
          textTransform: 'uppercase', padding: '4px 14px', borderRadius: 999, marginBottom: 8 }}>
          {dateStr}
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 26,
          color: 'white', textShadow: '0 2px 20px rgba(108,99,255,0.5)', marginBottom: 14 }}>
          {greeting} ✨
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(12px)',
            padding: '8px 18px', borderRadius: 999 }}>
            <span style={{ fontSize: 22, filter: 'drop-shadow(0 0 8px rgba(255,149,0,0.8))' }}>🔥</span>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 900 }}>{streak}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700 }}>streak</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(12px)',
            padding: '8px 18px', borderRadius: 999 }}>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 900 }}>{pct}%</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700 }}>done</span>
          </div>
        </div>

        {photos.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 12 }}>
            {photos.map((_, i) => (
              <div key={i} style={{ height: 5, borderRadius: 999, transition: 'all .3s',
                width: i === photoIdx ? 18 : 5,
                background: i === photoIdx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)' }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── FORM button ───────────────────────────────────────────────────────────────
function FormButton() {
  const [pressed, setPressed] = useState(false)
  return (
    <a
      href="#"
      onClick={e => { setPressed(true); setTimeout(() => setPressed(false), 300); openFORM(e) }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        textDecoration: 'none',
        background: 'linear-gradient(135deg, #1A7FC1, #0D5A8E)',
        color: 'white', borderRadius: 20, padding: '18px 22px',
        fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 900,
        boxShadow: '0 6px 24px rgba(26,127,193,0.45)',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
        letterSpacing: '0.3px',
      }}
    >
      <span style={{ fontSize: 26 }}>🏊</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span>Open FORM App</span>
        <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 700 }}>Track your swim workout</span>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 18, opacity: 0.7 }}>→</span>
    </a>
  )
}

// ── Photo manager strip ───────────────────────────────────────────────────────
function PhotoManager({ photos, onAdd, onRemove, fileRef }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ ...btnSmall, display: 'flex', alignItems: 'center', gap: 6 }}>
        📷 Photos ({photos.length}/10) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 10, animation: 'slideUp .2s ease' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 68, height: 68, borderRadius: 12,
                overflow: 'hidden', boxShadow: '0 2px 8px var(--shadow)', flexShrink: 0 }}>
                <img src={src} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                <button onClick={() => onRemove(i)} aria-label={`Remove photo ${i + 1}`}
                  style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(60,30,10,.75)', border: 'none', color: 'white', fontSize: 12,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
            {photos.length < 10 && (
              <button onClick={() => fileRef.current?.click()} aria-label="Add photo"
                style={{ width: 68, height: 68, borderRadius: 12, border: '2px dashed var(--sand)',
                  background: 'var(--warm)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2, color: 'var(--muted)',
                  fontSize: 22, fontWeight: 800, WebkitTapHighlightColor: 'transparent' }}>+</button>
            )}
          </div>
          {photos.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 8, fontStyle: 'italic' }}>
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
        setTimeout(() => { setConfetti(false); setShowDone(true) }, 1800)
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
      console.error('Smart task fetch failed:', e)
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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

  // ── All-done celebration ──
  if (showDone) {
    return (
      <div style={{ minHeight: '100vh',
        background: 'linear-gradient(160deg, var(--deep) 0%, #2D1060 60%, #0D2060 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {['🌸','⭐','✨','🎉','💥','🌟','🎊'].map((d, i) => (
          <div key={i} aria-hidden="true" style={{ position: 'absolute', fontSize: 28, opacity: .25,
            top: `${10 + i * 13}%`, left: i % 2 === 0 ? '6%' : '84%',
            animation: `float ${2.5 + i * .3}s ease-in-out infinite`, animationDelay: `${i * .4}s`,
            userSelect: 'none', pointerEvents: 'none' }}>{d}</div>
        ))}
        <div style={{ fontSize: 88, marginBottom: 20, animation: 'bounceIn .6s cubic-bezier(.34,1.56,.64,1)', position: 'relative', zIndex: 1,
          filter: 'drop-shadow(0 0 30px rgba(255,149,0,0.7))' }}>🔥</div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 36, marginBottom: 12,
          position: 'relative', zIndex: 1, color: 'white', textShadow: '0 0 30px rgba(108,99,255,0.8)' }}>Absolute legend.</h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: 600, lineHeight: 1.7,
          marginBottom: 12, maxWidth: 270, position: 'relative', zIndex: 1 }}>
          Not because you felt like it. Because you showed up anyway.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36, position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 40, filter: 'drop-shadow(0 0 14px rgba(255,149,0,0.7))' }}>🔥</span>
          <div>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 48, fontWeight: 900, color: 'white', lineHeight: 1 }}>
              {state.streak}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              day streak
            </div>
          </div>
        </div>
        <button onClick={() => setShowDone(false)} style={{ ...btnPrimary, maxWidth: 260 }}>Back home 🏡</button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: "'Nunito',sans-serif", color: 'var(--text)' }}>
      <Confetti active={confetti}/>

      <input type="file" accept="image/*" ref={fileRef} onChange={handlePhotoFile} style={{ display: 'none' }} aria-label="Upload photo"/>

      {/* ── HOME ── */}
      {tab === 'home' && (
        <div style={{ paddingBottom: 100 }}>

          {/* Hero: photo if available, else dark stats hero */}
          {photos.length > 0
            ? <PhotoHero photos={photos} photoIdx={photoIdx} onPrev={prevPhoto} onNext={nextPhoto}
                greeting={greeting} dateStr={dateStr} streak={state.streak} done={dailyDone} total={dailyTotal}/>
            : <StreakHero greeting={greeting} dateStr={dateStr} streak={state.streak} done={dailyDone} total={dailyTotal}/>
          }

          <div style={{ padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Google connect / token-expired banner */}
            {(status === 'unauthenticated' || session?.error === 'RefreshAccessTokenError') && (
              <div style={{ background: 'var(--electric-l)', border: '2px solid var(--electric)',
                borderRadius: 16, padding: '13px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--electric)' }}>
                    {session?.error ? 'Reconnect Google 🔄' : 'Connect Google 🔗'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                    {session?.error ? 'Your session expired — tap to refresh' : 'Smart calendar-aware tasks'}
                  </div>
                </div>
                <button onClick={() => signIn('google')}
                  style={{ background: 'var(--electric)', color: 'white', border: 'none',
                    borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 800,
                    cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>
                  {session?.error ? 'Reconnect' : 'Connect'}
                </button>
              </div>
            )}

            {/* FORM button — prominent, above everything */}
            <FormButton/>

            {/* Reality check */}
            <div style={{ background: 'linear-gradient(135deg, #F8F4FF, #EDE6FF)',
              border: '2px solid rgba(108,99,255,0.2)', borderRadius: 22,
              padding: '16px 18px', boxShadow: '0 4px 16px rgba(108,99,255,0.1)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--electric)', letterSpacing: '1.5px',
                textTransform: 'uppercase', marginBottom: 8 }}>🌱 today's reality check</div>
              {roastLoading
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)',
                    fontSize: 14, fontWeight: 600, fontStyle: 'italic' }}>
                    <Spinner/> Brewing your check-in...
                  </div>
                : <p style={{ fontSize: 14, lineHeight: 1.8, fontWeight: 700, color: 'var(--text)' }}>{roast}</p>
              }
              <button onClick={() => generateRoast({ streak: state.streak, events: [] })}
                style={{ marginTop: 12, ...btnSmall, borderColor: 'rgba(108,99,255,0.3)', color: 'var(--electric)', background: 'rgba(108,99,255,0.08)' }}>
                ↻ try again
              </button>
            </div>

            {/* Progress mini-bar (only when photos showing, since ring is in hero otherwise) */}
            {photos.length > 0 && (
              <div style={{ background: 'var(--white)', borderRadius: 18, padding: '14px 18px',
                boxShadow: '0 2px 12px var(--shadow)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fontWeight: 700 }}>
                      {dailyDone === dailyTotal ? '🎉 All done!' : dailyDone === 0 ? "Let's go 🌱" : dailyDone < 3 ? 'Off to a start 🍄' : dailyDone < 5 ? 'Looking good 💪' : 'Almost there ⚡'}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 15, color: dailyDone === dailyTotal ? 'var(--neon)' : 'var(--electric)' }}>
                      {Math.round((dailyDone / dailyTotal) * 100)}%
                    </span>
                  </div>
                  <div style={{ background: 'var(--warm)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, transition: 'width .6s cubic-bezier(.4,0,.2,1)',
                      width: `${Math.round((dailyDone / dailyTotal) * 100)}%`,
                      background: dailyDone === dailyTotal
                        ? 'linear-gradient(90deg, var(--neon), #00A846)'
                        : 'linear-gradient(90deg, var(--electric), var(--punch))',
                      boxShadow: dailyDone === dailyTotal ? '0 0 10px rgba(0,200,83,0.5)' : '0 0 10px rgba(108,99,255,0.4)',
                    }}/>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginTop: 5 }}>
                    {dailyDone} of {dailyTotal} habits · keep going!
                  </div>
                </div>
              </div>
            )}

            {/* ── Daily habits ── */}
            <div style={{ background: 'var(--white)', borderRadius: 24, overflow: 'hidden',
              boxShadow: '0 4px 20px var(--shadow)' }}>
              <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #F8F4FF, white)' }}>
                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 19, fontWeight: 700 }}>Daily habits 💪</span>
                <span style={{ background: 'var(--electric-l)', color: 'var(--electric)', fontSize: 9, fontWeight: 800,
                  padding: '3px 10px', borderRadius: 999 }}>resets every morning</span>
              </div>
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
            </div>

            {/* ── One-off tasks ── */}
            {state.oneOffTasks.length > 0 && (
              <div style={{ background: 'var(--white)', borderRadius: 24, overflow: 'hidden',
                boxShadow: '0 4px 20px var(--shadow)' }}>
                <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #FFF5F3, white)' }}>
                  <span style={{ fontFamily: "'Caveat', cursive", fontSize: 19, fontWeight: 700 }}>One-off tasks 📌</span>
                  <span style={{ background: 'var(--punch-l)', color: 'var(--punch)', fontSize: 9, fontWeight: 800,
                    padding: '3px 10px', borderRadius: 999 }}>rolls over until done</span>
                </div>
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
              </div>
            )}

            {/* ── Add task ── */}
            <div style={{ background: 'var(--white)', borderRadius: 22, padding: '16px 18px',
              boxShadow: '0 4px 20px var(--shadow)',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
            }}>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fontWeight: 700,
                color: 'var(--muted)', marginBottom: 10 }}>Add a task ✏️</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  placeholder="e.g. do laundry, call dentist..."
                  maxLength={120}
                  aria-label="New task title"
                  style={{ flex: 1, background: 'var(--warm)', border: '2px solid var(--sand)',
                    borderRadius: 14, padding: '13px 15px',
                    fontFamily: "'Nunito',sans-serif", fontSize: 14, fontWeight: 700,
                    color: 'var(--text)', outline: 'none' }}
                />
                <button onClick={handleAddTask} aria-label="Add task"
                  style={{ background: 'linear-gradient(135deg, var(--electric), #5249E0)', color: 'white',
                    border: 'none', borderRadius: 14, padding: '13px 20px',
                    fontSize: 22, fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
                    WebkitTapHighlightColor: 'transparent' }}>+</button>
              </div>
            </div>

            {/* Smart task refresh */}
            {session && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => { handleSetSmartTasksDate(null); runSmartTaskFetch() }}
                  style={{ background: 'none', border: 'none', color: 'var(--electric)', fontSize: 13,
                    fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  ✨ Refresh smart tasks from calendar
                </button>
              </div>
            )}

            {/* ── Settings strip ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 4, flexWrap: 'wrap', gap: 8 }}>
              <PhotoManager photos={photos} onAdd={() => fileRef.current?.click()} onRemove={handleRemovePhoto} fileRef={fileRef}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={lock} style={btnSmall}>🔒 Lock</button>
                {session && <button onClick={() => signOut()} style={btnSmall}>Sign out</button>}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── END OF DAY ── */}
      {tab === 'eod' && (
        <div style={{ paddingBottom: 100 }}>
          <div style={{ padding: '52px 20px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(160deg, var(--deep), #1A0A3D)',
            color: 'white' }}>
            {['🍂','🕯️','🌙','🍵'].map((d, i) => (
              <div key={i} aria-hidden="true" style={{ position: 'absolute', top: 8 + i * 18,
                [i % 2 === 0 ? 'left' : 'right']: 10 + i * 5, fontSize: 22, opacity: .2,
                animation: `float ${3 + i * .5}s ease-in-out infinite`, animationDelay: `${i * .4}s`,
                userSelect: 'none', pointerEvents: 'none' }}>{d}</div>
            ))}
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 28,
              fontWeight: 700, marginBottom: 8, position: 'relative', zIndex: 1 }}>End of day 🍂</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 600, lineHeight: 1.6,
              position: 'relative', zIndex: 1 }}>
              Brain dump how today went. I'll extract anything that needs to roll over.
            </p>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div role="note" style={{ background: 'var(--electric-l)', border: '2px solid var(--electric)',
              borderRadius: 16, padding: '13px 16px', fontSize: 12, fontWeight: 700, color: 'var(--electric)', lineHeight: 1.6 }}>
              <strong>Note:</strong> Daily habits never roll over. Only genuine one-off tasks carry over.
            </div>

            <WhimsyCard accent="var(--sky-l)">
              <Label>📝 how did today go?</Label>
              <textarea
                value={eodText}
                onChange={e => setEodText(e.target.value)}
                placeholder="Did the walk but skipped gym again. Still need to do laundry. Work deadline tomorrow 10am..."
                maxLength={4000}
                aria-label="End of day summary"
                style={{ width: '100%', background: 'var(--warm)', border: '2px solid var(--sand)',
                  borderRadius: 12, padding: 14, fontFamily: "'Nunito',sans-serif",
                  fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.7,
                  resize: 'none', minHeight: 140, outline: 'none', marginTop: 6 }}
              />
            </WhimsyCard>

            <button onClick={handleRollover} disabled={roLoading}
              style={{ ...btnPrimary, opacity: roLoading ? .6 : 1 }}>
              {roLoading ? '🌙 Thinking...' : "✨ Extract tomorrow's tasks"}
            </button>

            {rollover.length > 0 && (
              <div>
                <SectionHead label="Rolling over to tomorrow 🌅" badge="" badgeColor="" badgeBg=""/>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 4px' }}>
                  {rollover.map((item, i) => (
                    <div key={i} style={{ background: 'var(--white)', borderRadius: 16, padding: '14px 16px',
                      boxShadow: '0 2px 10px var(--shadow)', display: 'flex', gap: 12, alignItems: 'flex-start',
                      borderLeft: `4px solid ${item.priority === 'high' ? 'var(--punch)' : item.priority === 'low' ? 'var(--neon)' : 'var(--electric)'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{item.note}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'white',
                        background: item.priority === 'high' ? 'var(--punch)' : item.priority === 'low' ? 'var(--neon)' : 'var(--electric)',
                        borderRadius: 999, padding: '3px 8px', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '12px 4px 0' }}>
                  <button onClick={saveRollover}
                    style={{ ...btnPrimary, flex: 1, background: 'linear-gradient(135deg, var(--neon), #00A846)',
                      boxShadow: '0 4px 18px rgba(0,200,83,0.4)' }}>
                    ＋ Add to my tasks
                  </button>
                  <button onClick={() => setRollover([])} style={{ ...btnSmall, fontSize: 15, padding: '14px 18px', borderRadius: 16 }}>↺</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <nav aria-label="Main navigation" style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,253,245,0.96)', backdropFilter: 'blur(16px)',
        borderTop: '1.5px solid var(--sand)', display: 'flex', zIndex: 500,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.06)' }}>
        {[
          { id: 'home', icon: '🏡', label: 'Home'    },
          { id: 'eod',  icon: '🌙', label: 'Evening' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-label={t.label}
            aria-current={tab === t.id ? 'page' : undefined}
            style={{ flex: 1, padding: '10px 4px 8px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Nunito',sans-serif", fontSize: 10, fontWeight: 800,
              color: tab === t.id ? 'var(--electric)' : 'var(--muted)',
              WebkitTapHighlightColor: 'transparent', transition: 'color .15s' }}
          >
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, display: 'block',
              transform: tab === t.id ? 'scale(1.2)' : 'scale(1)',
              transition: 'transform .2s cubic-bezier(.34,1.56,.64,1)' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <Toast message={toast}/>
    </div>
  )
}
