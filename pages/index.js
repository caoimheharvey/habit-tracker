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

// ── Button styles ─────────────────────────────────────────────────────────────
const btnPrimary = {
  width:        '100%',
  background:   'linear-gradient(135deg, var(--toffee), var(--caramel))',
  color:        'var(--white)',
  border:       'none',
  borderRadius: 18,
  padding:      16,
  fontFamily:   "'Nunito', sans-serif",
  fontSize:     16,
  fontWeight:   900,
  cursor:       'pointer',
  boxShadow:    '0 4px 18px rgba(140,98,46,.35)',
  WebkitTapHighlightColor: 'transparent',
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

// ── FORM deep link ────────────────────────────────────────────────────────────
function openFORM(e) {
  e.preventDefault()
  const start = Date.now()
  window.location = 'form-swimming://'
  setTimeout(() => {
    if (Date.now() - start < 1500) {
      window.location = 'https://apps.apple.com/app/form-swim-goggles/id1498219393'
    }
  }, 1000)
}

// ── Photo hero ────────────────────────────────────────────────────────────────
function PhotoHero({ photos, photoIdx, onPrev, onNext, greeting, dateStr, streak }) {
  const hasPhotos = photos.length > 0
  const photo     = hasPhotos ? photos[photoIdx] : null

  return (
    <div style={{ position: 'relative', height: 280, overflow: 'hidden', flexShrink: 0 }}>
      {/* Background */}
      {photo
        ? <img
            key={photoIdx}
            src={photo}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              filter: 'brightness(0.42) saturate(0.7) sepia(0.2)', animation: 'fadePhoto .5s ease' }}
          />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#D5C49A,#B8956A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span aria-hidden="true" style={{ fontSize: 56, filter: 'drop-shadow(0 2px 12px rgba(0,0,0,.2))' }}>🏡</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,253,245,.7)' }}>tap ⚙️ below to add photos</span>
          </div>
      }

      {/* Gradient scrim for text legibility */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(30,18,8,.65) 0%, transparent 55%)' }}/>

      {/* Floating deco */}
      {['🌿','🍄','🌸'].map((d, i) => (
        <div key={i} aria-hidden="true" style={{ position: 'absolute', top: 18 + i * 24, [i % 2 === 0 ? 'left' : 'right']: 14 + i * 8,
          fontSize: 18, opacity: .45, animation: `float ${2.8 + i * .5}s ease-in-out infinite`, animationDelay: `${i * .6}s`,
          userSelect: 'none', pointerEvents: 'none', zIndex: 5 }}>{d}</div>
      ))}

      {/* Prev / Next tap zones — only with multiple photos */}
      {photos.length > 1 && <>
        <button onClick={onPrev} aria-label="Previous photo"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', background: 'none',
            border: 'none', cursor: 'pointer', zIndex: 10, WebkitTapHighlightColor: 'transparent' }}/>
        <button onClick={onNext} aria-label="Next photo"
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%', background: 'none',
            border: 'none', cursor: 'pointer', zIndex: 10, WebkitTapHighlightColor: 'transparent' }}/>
      </>}

      {/* Overlay content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15, padding: '0 20px 18px', textAlign: 'center' }}>
        {/* Date chip */}
        <div style={{ display: 'inline-block', background: 'rgba(255,253,245,.18)', backdropFilter: 'blur(10px)',
          color: 'rgba(255,253,245,.9)', fontSize: 10, fontWeight: 800, letterSpacing: '2px',
          textTransform: 'uppercase', padding: '4px 14px', borderRadius: 999, marginBottom: 8 }}>
          {dateStr}
        </div>

        {/* Greeting */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 28,
          color: 'rgba(255,253,245,.97)', textShadow: '0 2px 16px rgba(0,0,0,.4)', marginBottom: 10 }}>
          {greeting} ✿
        </div>

        {/* Streak pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'rgba(255,253,245,.92)', color: 'var(--toffee)',
          fontSize: 13, fontWeight: 900, padding: '6px 16px', borderRadius: 999,
          boxShadow: '0 3px 12px rgba(0,0,0,.2)' }}>
          🔥 <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16 }}>{streak} day streak</span>
        </div>

        {/* Photo dots */}
        {photos.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
            {photos.map((_, i) => (
              <div key={i} style={{ height: 5, borderRadius: 999, transition: 'all .3s',
                width: i === photoIdx ? 18 : 5,
                background: i === photoIdx ? 'rgba(255,253,245,.95)' : 'rgba(255,253,245,.35)' }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── FORM button ───────────────────────────────────────────────────────────────
function FormButton() {
  return (
    <a href="#" onClick={openFORM} style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             10,
      textDecoration:  'none',
      background:      'linear-gradient(135deg, #4A8FAF, #3A7090)',
      color:           'white',
      borderRadius:    18,
      padding:         '15px 20px',
      fontFamily:      "'Nunito', sans-serif",
      fontSize:        15,
      fontWeight:      900,
      boxShadow:       '0 4px 18px rgba(58,112,144,.35)',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{ fontSize: 22 }}>🏊</span>
      <span>Open FORM App</span>
      <span style={{ fontSize: 12, opacity: .7, marginLeft: 'auto' }}>→</span>
    </a>
  )
}

// ── Compact progress bar ──────────────────────────────────────────────────────
function ProgressBar({ done, total }) {
  const pct = total ? done / total : 0
  const msgs = ['Let\'s go 🌱', 'Off to a start 🍄', 'Looking good 🕯️', 'Almost there 🌸', 'You did it! ✨']
  const msgIdx = done === 0 ? 0 : done < 3 ? 1 : done < 5 ? 2 : done < total ? 3 : 4
  return (
    <div style={{ background: 'var(--white)', borderRadius: 20, padding: '14px 18px',
      boxShadow: '0 2px 12px var(--shadow)', display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* Mini ring */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx="26" cy="26" r="20" fill="none" stroke="var(--warm)" strokeWidth="7"/>
          <circle cx="26" cy="26" r="20" fill="none"
            stroke={done === total ? 'var(--moss)' : 'var(--toffee)'}
            strokeWidth="7" strokeLinecap="round"
            strokeDasharray="125.66"
            strokeDashoffset={125.66 - pct * 125.66}
            style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }}/>
        </svg>
        <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', fontSize: 16, lineHeight: 1 }}>
          {done === total ? '🌸' : (ALL_DECO[done] ?? '🌱')}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, fontWeight: 700, marginBottom: 3 }}>
          {msgs[msgIdx]}
        </div>
        <div style={{ background: 'var(--warm)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, transition: 'width .5s cubic-bezier(.4,0,.2,1)',
            width: `${Math.round(pct * 100)}%`,
            background: done === total
              ? 'linear-gradient(90deg, var(--moss), #5A8E50)'
              : 'linear-gradient(90deg, var(--toffee), var(--blush))' }}/>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>
          {done} of {total} habits · {Math.round(pct * 100)}%
        </div>
      </div>
    </div>
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
              <div key={i} style={{ position: 'relative', width: 68, height: 68, borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 2px 8px var(--shadow)', flexShrink: 0 }}>
                <img src={src} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                <button onClick={() => onRemove(i)} aria-label={`Remove photo ${i + 1}`}
                  style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(60,30,10,.75)', border: 'none', color: 'white', fontSize: 12,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>
            ))}
            {photos.length < 10 && (
              <button onClick={() => fileRef.current?.click()}
                aria-label="Add photo"
                style={{ width: 68, height: 68, borderRadius: 12, border: '2px dashed var(--sand)',
                  background: 'var(--warm)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2, color: 'var(--muted)',
                  fontSize: 22, fontWeight: 800, WebkitTapHighlightColor: 'transparent' }}>
                +
              </button>
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

  const [showDone, setShowDone] = useState(false)
  const [tab, setTab]           = useState('home')
  const [newTask, setNewTask]   = useState('')
  const [eodText, setEodText]   = useState('')
  const [rollover, setRollover] = useState([])
  const [roLoading, setRoLoad]  = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)

  const fileRef = useRef()

  // ── TOTP ──
  const { mode: pinMode, error: pinError, loading: pinLoading, verify: verifyTotp, lock } = useTotp()

  // ── App state ──
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
    onAllDailyDone: useCallback(() => setTimeout(() => setShowDone(true), 500), []),
  })

  // ── Roast ──
  const { roast, loading: roastLoading, loadCached, generate: generateRoast } = useRoast({ today: TODAY })

  // Set initial photo index based on day of year once photos load
  useEffect(() => {
    if (!state?.photos?.length) return
    setPhotoIdx(DAY_OF_YEAR % state.photos.length)
  }, [state?.photos?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load roast once unlocked
  useEffect(() => {
    if (pinMode !== 'unlocked' || !state) return
    if (!loadCached()) {
      generateRoast({ streak: state.streak, events: [] })
    }
  }, [pinMode, state?.streak]) // eslint-disable-line react-hooks/exhaustive-deps

  // Smart task fetch once per day after unlock + sign-in
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
        console.error('[context]', ctxRes.status, error)
        // Don't set smartTasksDate — allow retry
        return
      }
      const ctx = await ctxRes.json()

      const taskRes = await fetch('/api/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mode:            'plan',
          events:          ctx.events,
          emails:          ctx.emails,
          existingOneOffs: state.oneOffTasks,
        }),
      })
      if (!taskRes.ok) {
        showToast('✨ AI task generation failed — try again later')
        return
      }
      const { tasks = [] } = await taskRes.json()

      const added = handleMergeSmartTasks(tasks, TODAY)
      if (added > 0) {
        setTimeout(() => showToast(`✨ ${added} smart task${added > 1 ? 's' : ''} added from your calendar`), 300)
      } else {
        showToast('📅 No new tasks found in your calendar')
        handleSetSmartTasksDate(TODAY)
      }
    } catch (e) {
      console.error('Smart task fetch failed:', e)
      showToast('Could not reach server — check your connection')
    }
  }, [session, state, handleMergeSmartTasks, handleSetSmartTasksDate, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Task handlers ──
  const handleAddTask = useCallback(() => {
    const ok = handleAddOneOff(newTask)
    if (ok) { setNewTask(''); showToast('Task added 📌') }
    else showToast('Task is empty or already exists')
  }, [newTask, handleAddOneOff, showToast])

  const handlePhotoFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      handleAddPhoto(ev.target.result)
      showToast('Photo added 📷')
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be re-added after removal
    e.target.value = ''
  }, [handleAddPhoto, showToast])

  // ── Photo cycling ──
  const prevPhoto = useCallback(() => {
    setPhotoIdx(i => (i - 1 + (state?.photos?.length ?? 1)) % Math.max(state?.photos?.length ?? 1, 1))
  }, [state?.photos?.length])

  const nextPhoto = useCallback(() => {
    setPhotoIdx(i => (i + 1) % Math.max(state?.photos?.length ?? 1, 1))
  }, [state?.photos?.length])

  // ── EOD rollover ──
  const handleRollover = useCallback(async () => {
    if (!eodText.trim()) { showToast('Write something first 🌿'); return }
    setRoLoad(true)
    try {
      const res = await fetch('/api/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: 'rollover', summary: eodText }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { tasks = [] } = await res.json()
      setRollover(tasks)
      if (!tasks.length) showToast('No one-off tasks found 🌿')
    } catch {
      showToast('Something went wrong, try again')
    } finally {
      setRoLoad(false)
    }
  }, [eodText, showToast])

  const saveRollover = useCallback(() => {
    const added = handleMergeSmartTasks(rollover, TODAY)
    showToast(`${added} task${added !== 1 ? 's' : ''} added 📌`)
    setRollover([])
    setEodText('')
    setTab('home')
  }, [rollover, handleMergeSmartTasks, showToast])

  // ── Derived ──────────────────────────────────────────────────────────────
  if (!state) return null

  const photos     = state.photos ?? []
  const dailyDone  = countDailyDone(state)
  const dailyTotal = DAILY_TASKS.length
  const now        = new Date()
  const greeting   = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr    = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // ── TOTP screen (checking = show nothing while verifying cookie) ──
  if (pinMode === 'checking') return null
  if (pinMode === 'locked') {
    return <TotpScreen error={pinError} loading={pinLoading} onVerify={verifyTotp}/>
  }

  // ── All-done overlay ──
  if (showDone) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,var(--parchment),var(--cream))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {['🌸','🍄','✨','🌿','🕯️','🌼'].map((d, i) => (
          <div key={i} aria-hidden="true" style={{ position: 'absolute', fontSize: 24, opacity: .3,
            top: `${10 + i * 15}%`, left: i % 2 === 0 ? '8%' : '82%',
            animation: `float ${2.5 + i * .3}s ease-in-out infinite`, animationDelay: `${i * .4}s`,
            userSelect: 'none', pointerEvents: 'none' }}>{d}</div>
        ))}
        <div style={{ fontSize: 80, marginBottom: 20, animation: 'bounceIn .6s cubic-bezier(.34,1.56,.64,1)', position: 'relative', zIndex: 1 }}>🌸</div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 34, marginBottom: 12, position: 'relative', zIndex: 1 }}>You did it.</h2>
        <p style={{ color: 'var(--muted)', fontSize: 15, fontWeight: 600, lineHeight: 1.7, marginBottom: 12, maxWidth: 270, position: 'relative', zIndex: 1 }}>
          Not because you felt like it. Because you showed up anyway.
        </p>
        <p style={{ fontSize: 20, marginBottom: 4, position: 'relative', zIndex: 1 }}>🔥</p>
        <p style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: 'var(--toffee)', marginBottom: 32, position: 'relative', zIndex: 1 }}>
          {state.streak} day streak
        </p>
        <button onClick={() => setShowDone(false)} style={{ ...btnPrimary, maxWidth: 260 }}>Back home</button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: "'Nunito',sans-serif", color: 'var(--text)' }}>

      {/* Hidden file input */}
      <input type="file" accept="image/*" ref={fileRef} onChange={handlePhotoFile} style={{ display: 'none' }} aria-label="Upload photo"/>

      {/* ── HOME ── */}
      {tab === 'home' && (
        <div style={{ paddingBottom: 100 }}>

          {/* Photo hero */}
          <PhotoHero
            photos={photos}
            photoIdx={photoIdx}
            onPrev={prevPhoto}
            onNext={nextPhoto}
            greeting={greeting}
            dateStr={dateStr}
            streak={state.streak}
          />

          <div style={{ padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Google connect banner */}
            {status === 'unauthenticated' && (
              <div style={{ background: 'var(--lav-l)', border: '2px dashed var(--lavender)', borderRadius: 16,
                padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#6B5280' }}>Connect Google 🔗</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Smart calendar-aware tasks</div>
                </div>
                <button onClick={() => signIn('google')} style={{ background: '#6B5280', color: 'white', border: 'none',
                  borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  fontFamily: "'Nunito',sans-serif" }}>Connect</button>
              </div>
            )}

            {/* Reality check */}
            <WhimsyCard accent="var(--moss-l)">
              <Label>🌱 today's reality check</Label>
              {roastLoading
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 14, fontWeight: 600, fontStyle: 'italic' }}>
                    <Spinner/> Brewing your check-in...
                  </div>
                : <p style={{ fontSize: 14, lineHeight: 1.8, fontWeight: 600 }}>{roast}</p>
              }
              <button onClick={() => generateRoast({ streak: state.streak, events: [] })} style={{ marginTop: 12, ...btnSmall }}>
                ↻ try again
              </button>
            </WhimsyCard>

            {/* FORM button — above the list */}
            <FormButton/>

            {/* Progress */}
            <ProgressBar done={dailyDone} total={dailyTotal}/>

            {/* ── Daily habits ── */}
            <div style={{ background: 'var(--white)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 3px 16px var(--shadow)' }}>
              <div style={{ padding: '14px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 17, fontWeight: 700 }}>Daily habits 🌱</span>
                <span style={{ background: 'var(--moss-l)', color: 'var(--moss)', fontSize: 9, fontWeight: 800,
                  padding: '3px 9px', borderRadius: 999 }}>resets every morning</span>
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
              <div style={{ background: 'var(--white)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 3px 16px var(--shadow)' }}>
                <div style={{ padding: '14px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'Caveat', cursive", fontSize: 17, fontWeight: 700 }}>One-off tasks 📌</span>
                  <span style={{ background: 'var(--blush-l)', color: 'var(--blush)', fontSize: 9, fontWeight: 800,
                    padding: '3px 9px', borderRadius: 999 }}>rolls over until done</span>
                </div>
                {state.oneOffTasks.map((t, i) => (
                  <TaskRow
                    key={`oneoff-${i}`}
                    emoji={t.smart ? '✨' : '📌'}
                    title={t.title}
                    desc={t.note ?? (t.smart ? `From: ${t.triggerEvent ?? 'calendar/email'}` : undefined)}
                    done={t.done}
                    isOneOff
                    smart={t.smart}
                    onToggle={() => handleToggleOneOff(i)}
                    onDelete={() => handleDeleteOneOff(i)}
                  />
                ))}
              </div>
            )}

            {/* ── Add task ── */}
            <div style={{ background: 'var(--white)', borderRadius: 20, padding: '14px 16px',
              boxShadow: '0 2px 12px var(--shadow)' }}>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, fontWeight: 700,
                color: 'var(--muted)', marginBottom: 10 }}>Add a task 🖊️</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  placeholder="e.g. do laundry, call dentist..."
                  maxLength={120}
                  aria-label="New task title"
                  style={{ flex: 1, background: 'var(--warm)', border: '2px solid var(--sand)', borderRadius: 14,
                    padding: '12px 14px', fontFamily: "'Nunito',sans-serif", fontSize: 14, fontWeight: 700,
                    color: 'var(--text)', outline: 'none' }}
                />
                <button onClick={handleAddTask} aria-label="Add task"
                  style={{ background: 'linear-gradient(135deg,var(--toffee),var(--caramel))', color: 'var(--white)',
                    border: 'none', borderRadius: 14, padding: '12px 18px', fontSize: 22, fontWeight: 900,
                    cursor: 'pointer', boxShadow: '0 3px 12px rgba(120,80,40,.25)',
                    WebkitTapHighlightColor: 'transparent' }}>+</button>
              </div>
            </div>

            {/* Smart task refresh */}
            {session && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => { handleSetSmartTasksDate(null); runSmartTaskFetch() }}
                  style={{ background: 'none', border: 'none', color: 'var(--toffee)', fontSize: 13,
                    fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  ✨ Refresh smart tasks from calendar
                </button>
              </div>
            )}

            {/* ── Settings strip ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, flexWrap: 'wrap', gap: 8 }}>
              <PhotoManager photos={photos} onAdd={() => fileRef.current?.click()} onRemove={handleRemovePhoto} fileRef={fileRef}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={lock} style={btnSmall}>🔒 Lock</button>
                {session && (
                  <button onClick={() => signOut()} style={btnSmall}>Sign out</button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── END OF DAY ── */}
      {tab === 'eod' && (
        <div style={{ paddingBottom: 100 }}>
          <div style={{ padding: '52px 20px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            {['🍂','🕯️','🌙','🍵'].map((d, i) => (
              <div key={i} aria-hidden="true" style={{ position: 'absolute', top: 8 + i * 18,
                [i % 2 === 0 ? 'left' : 'right']: 10 + i * 5, fontSize: 22, opacity: .2,
                animation: `float ${3 + i * .5}s ease-in-out infinite`, animationDelay: `${i * .4}s`,
                userSelect: 'none', pointerEvents: 'none' }}>{d}</div>
            ))}
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 28,
              fontWeight: 700, marginBottom: 8, position: 'relative', zIndex: 1 }}>End of day 🍂</h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, lineHeight: 1.6,
              position: 'relative', zIndex: 1 }}>
              Brain dump how today went. I'll extract anything that needs to roll over.
            </p>
          </div>

          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div role="note" style={{ background: 'var(--lav-l)', border: '2px solid var(--lavender)',
              borderRadius: 16, padding: '13px 16px', fontSize: 12, fontWeight: 700, color: '#6B5280', lineHeight: 1.6 }}>
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
                style={{ width: '100%', background: 'var(--warm)', border: '2px solid var(--sand)', borderRadius: 12,
                  padding: 14, fontFamily: "'Nunito',sans-serif", fontSize: 14, fontWeight: 600,
                  color: 'var(--text)', lineHeight: 1.7, resize: 'none', minHeight: 140, outline: 'none', marginTop: 6 }}
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
                      borderLeft: `4px solid ${item.priority === 'high' ? 'var(--blush)' : item.priority === 'low' ? 'var(--moss)' : 'var(--toffee)'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{item.note}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--white)',
                        background: item.priority === 'high' ? 'var(--blush)' : item.priority === 'low' ? 'var(--moss)' : 'var(--toffee)',
                        borderRadius: 999, padding: '3px 8px', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '12px 4px 0' }}>
                  <button onClick={saveRollover}
                    style={{ ...btnPrimary, flex: 1, background: 'linear-gradient(135deg,var(--moss),#5A8E50)' }}>
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
        background: 'rgba(255,253,245,0.96)', backdropFilter: 'blur(12px)',
        borderTop: '2px solid var(--sand)', display: 'flex', zIndex: 500,
        paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
              color: tab === t.id ? 'var(--toffee)' : 'var(--muted)',
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
