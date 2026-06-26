import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useCallback, useRef } from 'react'

import { useAppState }         from '../src/hooks/useAppState'
import { useTotp }             from '../src/hooks/useTotp'
import { useRoast }            from '../src/hooks/useRoast'
import { useToast }            from '../src/hooks/useToast'
import TotpScreen              from '../src/components/TotpScreen'
import TaskRow                 from '../src/components/TaskRow'
import { Toast, Spinner }      from '../src/components/ui'
import { DAILY_TASKS }         from '../src/lib/constants'
import { countDailyDone }      from '../src/lib/state'

const TODAY       = new Date().toDateString()
const DAY_OF_YEAR = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)

// ── Live clock ────────────────────────────────────────────────────────────────
function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])
  return now
}

// ── Deadline helpers ──────────────────────────────────────────────────────────
function getDeadlineInfo(by, done, now) {
  if (!by || done) return null
  const [h, m] = by.split(':').map(Number)
  const d = new Date(now); d.setHours(h, m, 0, 0)
  const diffMs = d - now
  const diffMin = Math.floor(diffMs / 60000)
  const isLate   = diffMs < 0
  const isUrgent = diffMs >= 0 && diffMs < 10 * 60 * 1000
  const isSoon   = diffMs >= 0 && diffMs < 25 * 60 * 1000
  const label    = `${h % 12 || 12}:${String(m).padStart(2,'0')}${h < 12 ? 'am' : 'pm'}`
  const countdown = isLate ? 'LATE'
    : diffMin < 60 ? `${diffMin}m`
    : `${Math.floor(diffMin/60)}h ${diffMin%60}m`
  return { isLate, isUrgent, isSoon, label, countdown, diffMs }
}

function nextPendingDeadline(dailyChecked, now) {
  return DAILY_TASKS
    .filter(t => !dailyChecked[t.id] && t.by)
    .map(t => ({ ...t, info: getDeadlineInfo(t.by, false, now) }))
    .filter(t => t.info)
    .sort((a, b) => a.info.diffMs - b.info.diffMs)[0] ?? null
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null
  const pieces = ['✦','★','◆','●','▲','✸','◉']
  const colors = ['#00D4B8','#F5A623','#30D158','#FF9F0A','#00C8FF','#FF453A']
  return (
    <div aria-hidden="true" style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:9999, overflow:'hidden' }}>
      {Array.from({ length: 32 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 3.1) % 100}%`,
          top: `${-5 - (i % 6) * 3}%`,
          fontSize: 12 + (i % 4) * 5,
          color: colors[i % colors.length],
          animation: `confettiDrop ${0.8 + (i % 5) * 0.2}s ease-in forwards`,
          animationDelay: `${(i % 8) * 0.05}s`,
        }}>{pieces[i % pieces.length]}</div>
      ))}
    </div>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ done, total }) {
  const pct  = total ? done / total : 0
  const r    = 68
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  const color  = pct === 1 ? '#30D158' : '#00D4B8'

  return (
    <div style={{ position: 'relative', width: 160, height: 160 }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        {/* Track */}
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
        {/* Fill */}
        <circle cx="80" cy="80" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke .5s',
            filter: pct > 0 ? `drop-shadow(0 0 6px ${color})` : 'none',
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-1px' }}>
          {Math.round(pct * 100)}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: 3 }}>
          {done}/{total} done
        </div>
      </div>
    </div>
  )
}

// ── Streak pill ───────────────────────────────────────────────────────────────
function StreakPill({ streak }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '20px 28px',
      background: 'rgba(245,166,35,0.08)',
      border: '1px solid rgba(245,166,35,0.18)',
      borderRadius: 20,
    }}>
      <span style={{ fontSize: 36, lineHeight: 1,
        animation: streak > 0 ? 'streakGlow 2.5s ease-in-out infinite' : 'none' }}>🔥</span>
      <div style={{ fontSize: 44, fontWeight: 900, color: '#F5A623', lineHeight: 1, letterSpacing: '-2px' }}>
        {streak}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,166,35,0.55)',
        textTransform: 'uppercase', letterSpacing: '2px' }}>streak</div>
    </div>
  )
}

// ── Deadline banner ───────────────────────────────────────────────────────────
function DeadlineBanner({ dailyChecked, now }) {
  const next = nextPendingDeadline(dailyChecked, now)
  if (!next) return null
  const { isLate, isUrgent, isSoon, label, countdown } = next.info

  const accentColor = isLate || isUrgent ? '#FF453A' : isSoon ? '#FF9F0A' : '#00D4B8'
  const bg          = isLate || isUrgent ? 'rgba(255,69,58,0.1)' : isSoon ? 'rgba(255,159,10,0.1)' : 'rgba(0,212,184,0.06)'

  return (
    <div style={{
      background: bg,
      borderBottom: `1px solid ${accentColor}22`,
      padding: '12px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      animation: isUrgent || isLate ? 'pulse 1.4s ease-in-out infinite' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor,
          boxShadow: `0 0 8px ${accentColor}`,
          animation: isUrgent || isLate ? 'pulse 0.8s ease-in-out infinite' : 'none' }}/>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
            {next.title}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>by {label}</span>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: accentColor, letterSpacing: '0.5px' }}>
        {countdown}
      </div>
    </div>
  )
}

// ── Photo carousel ────────────────────────────────────────────────────────────
function PhotoStrip({ photos, photoIdx, onPrev, onNext }) {
  if (!photos.length) return null
  return (
    <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
      <img key={photoIdx} src={photos[photoIdx]} alt="" aria-hidden="true"
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55,
          animation: 'fadePhoto .4s ease' }}/>
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(11,11,15,0.3) 0%, rgba(11,11,15,0.8) 100%)' }}/>
      {photos.length > 1 && <>
        <button onClick={onPrev} aria-label="Previous"
          style={{ position:'absolute', left:0, top:0, bottom:0, width:'35%',
            background:'none', border:'none', cursor:'pointer', zIndex:5, WebkitTapHighlightColor:'transparent' }}/>
        <button onClick={onNext} aria-label="Next"
          style={{ position:'absolute', right:0, top:0, bottom:0, width:'35%',
            background:'none', border:'none', cursor:'pointer', zIndex:5, WebkitTapHighlightColor:'transparent' }}/>
        <div style={{ position:'absolute', bottom:12, left:0, right:0,
          display:'flex', justifyContent:'center', gap:5 }}>
          {photos.map((_, i) => (
            <div key={i} style={{ height:3, borderRadius:999, transition:'all .3s',
              width: i===photoIdx ? 18 : 3,
              background: i===photoIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}/>
          ))}
        </div>
      </>}
    </div>
  )
}

// ── Photo manager ─────────────────────────────────────────────────────────────
function PhotoManager({ photos, onRemove, fileRef }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={styles.chipBtn}>
        📷 Photos ({photos.length}/10)
      </button>
      {open && (
        <div style={{ marginTop: 10, animation: 'slideUp .2s ease' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((src, i) => (
              <div key={i} style={{ position:'relative', width:64, height:64, borderRadius:12,
                overflow:'hidden', border:'1px solid var(--border)', flexShrink:0 }}>
                <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                <button onClick={() => onRemove(i)} aria-label={`Remove photo ${i+1}`}
                  style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:'50%',
                    background:'rgba(0,0,0,0.7)', border:'none', color:'white', fontSize:11,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
            ))}
            {photos.length < 10 && (
              <button onClick={() => fileRef.current?.click()} aria-label="Add photo"
                style={{ width:64, height:64, borderRadius:12, border:'1px dashed var(--border2)',
                  background:'var(--surface2)', cursor:'pointer', color:'var(--text2)',
                  fontSize:22, WebkitTapHighlightColor:'transparent' }}>+</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const styles = {
  card: {
    background: 'var(--surface)',
    border:     '1px solid var(--border)',
    borderRadius: 20,
    overflow:   'hidden',
  },
  cardHeader: {
    padding: '16px 18px 12px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.5px', color: 'rgba(255,255,255,0.35)',
  },
  chipBtn: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text2)', fontFamily: 'Inter, sans-serif',
    fontSize: 12, fontWeight: 600, padding: '7px 14px',
    borderRadius: 999, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { data: session, status } = useSession()
  const { message: toast, show: showToast } = useToast()
  const now = useLiveClock()

  const [showDone, setShowDone] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [tab, setTab]           = useState('home')
  const [newTask, setNewTask]   = useState('')
  const [eodText, setEodText]   = useState('')
  const [rollover, setRollover] = useState([])
  const [roLoading, setRoLoad]  = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const fileRef = useRef()

  const { mode: pinMode, error: pinError, loading: pinLoading, verify: verifyTotp, lock } = useTotp()

  const {
    state, handleToggleDaily, handleToggleOneOff, handleDeleteOneOff,
    handleAddOneOff, handleMergeSmartTasks, handleAddPhoto, handleRemovePhoto,
    handleSetSmartTasksDate,
  } = useAppState({
    today: TODAY,
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
    showToast('Checking your calendar…')
    try {
      const ctxRes = await fetch('/api/context')
      if (!ctxRes.ok) { const { error } = await ctxRes.json().catch(()=>({})); showToast(`Calendar: ${error??`HTTP ${ctxRes.status}`}`); return }
      const ctx = await ctxRes.json()
      const taskRes = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ mode:'plan', events:ctx.events, emails:ctx.emails, existingOneOffs:state.oneOffTasks }),
      })
      if (!taskRes.ok) { showToast('AI task gen failed — try later'); return }
      const { tasks=[] } = await taskRes.json()
      const added = handleMergeSmartTasks(tasks, TODAY)
      if (added > 0) setTimeout(() => showToast(`${added} smart task${added>1?'s':''} added`), 300)
      else { showToast('No new calendar tasks found'); handleSetSmartTasksDate(TODAY) }
    } catch (e) { console.error(e); showToast('Connection error') }
  }, [session, state, handleMergeSmartTasks, handleSetSmartTasksDate, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTask = useCallback(() => {
    const ok = handleAddOneOff(newTask)
    if (ok) { setNewTask(''); showToast('Task added') }
    else showToast('Empty or duplicate task')
  }, [newTask, handleAddOneOff, showToast])

  const handlePhotoFile = useCallback((e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { handleAddPhoto(ev.target.result); showToast('Photo added') }
    reader.readAsDataURL(file); e.target.value = ''
  }, [handleAddPhoto, showToast])

  const prevPhoto = useCallback(() => setPhotoIdx(i => (i-1+Math.max(state?.photos?.length??1,1))%Math.max(state?.photos?.length??1,1)), [state?.photos?.length])
  const nextPhoto = useCallback(() => setPhotoIdx(i => (i+1)%Math.max(state?.photos?.length??1,1)), [state?.photos?.length])

  const handleRollover = useCallback(async () => {
    if (!eodText.trim()) { showToast('Write something first'); return }
    setRoLoad(true)
    try {
      const res = await fetch('/api/claude', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({mode:'rollover',summary:eodText}) })
      if (!res.ok) throw new Error()
      const { tasks=[] } = await res.json()
      setRollover(tasks)
      if (!tasks.length) showToast('No tasks to roll over')
    } catch { showToast('Something went wrong') }
    finally   { setRoLoad(false) }
  }, [eodText, showToast])

  const saveRollover = useCallback(() => {
    const added = handleMergeSmartTasks(rollover, TODAY)
    showToast(`${added} task${added!==1?'s':''} added`)
    setRollover([]); setEodText(''); setTab('home')
  }, [rollover, handleMergeSmartTasks, showToast])

  if (!state) return null

  const photos     = state.photos ?? []
  const dailyDone  = countDailyDone(state)
  const dailyTotal = DAILY_TASKS.length
  const greeting   = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr    = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
  const timeStr    = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })

  if (pinMode === 'checking') return null
  if (pinMode === 'locked') return <TotpScreen error={pinError} loading={pinLoading} onVerify={verifyTotp}/>

  // ── All done ──
  if (showDone) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:48, textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0,
          background:'radial-gradient(ellipse at 50% 40%, rgba(48,209,88,0.12) 0%, transparent 70%)',
          pointerEvents:'none' }}/>
        <div style={{ fontSize:72, marginBottom:24, animation:'bounceIn .6s ease',
          filter:'drop-shadow(0 0 30px rgba(245,166,35,0.7))' }}>🔥</div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', letterSpacing:'3px',
          textTransform:'uppercase', marginBottom:12 }}>All habits complete</div>
        <div style={{ fontSize:42, fontWeight:900, color:'#FFFFFF', letterSpacing:'-1.5px', marginBottom:8 }}>
          Absolute legend.
        </div>
        <p style={{ color:'var(--text2)', fontSize:15, lineHeight:1.7, maxWidth:260, marginBottom:36 }}>
          Not because you felt like it. Because you showed up anyway.
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:48,
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:20, padding:'18px 28px' }}>
          <span style={{ fontSize:36, filter:'drop-shadow(0 0 16px rgba(245,166,35,0.7))' }}>🔥</span>
          <div>
            <div style={{ fontSize:48, fontWeight:900, color:'#F5A623', letterSpacing:'-2px', lineHeight:1 }}>
              {state.streak}
            </div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(245,166,35,0.5)',
              textTransform:'uppercase', letterSpacing:'2px' }}>day streak</div>
          </div>
        </div>
        <button onClick={() => setShowDone(false)} style={{
          background:'var(--teal)', color:'#000', border:'none',
          borderRadius:16, padding:'14px 36px', fontSize:15, fontWeight:800,
          cursor:'pointer', letterSpacing:'0.3px',
          boxShadow:'0 4px 24px rgba(0,212,184,0.4)',
        }}>Back home</button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <Confetti active={confetti}/>
      <input type="file" accept="image/*" ref={fileRef} onChange={handlePhotoFile}
        style={{ display:'none' }} aria-label="Upload photo"/>

      {/* ── HOME ── */}
      {tab === 'home' && (
        <div style={{ paddingBottom: 100 }}>

          {/* Photo carousel if photos exist */}
          {photos.length > 0 && (
            <PhotoStrip photos={photos} photoIdx={photoIdx} onPrev={prevPhoto} onNext={nextPhoto}/>
          )}

          {/* ── Top bar ── */}
          <div style={{ padding: photos.length ? '16px 20px 0' : '56px 20px 0',
            display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:4 }}>{dateStr}</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#FFFFFF', letterSpacing:'-0.5px' }}>
                {greeting}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:28, fontWeight:900, color:'#FFFFFF', letterSpacing:'-1px', lineHeight:1 }}>
                  {timeStr}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginTop:2 }}>
                  {dailyDone === dailyTotal ? 'All done ✓' : `${dailyTotal - dailyDone} remaining`}
                </div>
              </div>
              <button onClick={lock} style={{
                background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                color:'rgba(255,255,255,0.45)', fontFamily:'Inter, sans-serif',
                fontSize:11, fontWeight:600, padding:'5px 12px',
                borderRadius:999, cursor:'pointer', letterSpacing:'0.3px',
                WebkitTapHighlightColor:'transparent',
              }}>Lock</button>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div style={{ padding:'20px 20px 0', display:'flex', gap:12 }}>
            <div style={{ ...styles.card, flex:1, display:'flex', alignItems:'center',
              justifyContent:'center', padding:'20px 16px', animation:'cardEntrance .4s ease both' }}>
              <ScoreRing done={dailyDone} total={dailyTotal}/>
            </div>
            <div style={{ ...styles.card, display:'flex', alignItems:'center',
              justifyContent:'center', padding:'20px 16px', animation:'cardEntrance .5s ease both' }}>
              <StreakPill streak={state.streak}/>
            </div>
          </div>

          {/* ── Deadline banner ── */}
          <div style={{ margin:'16px 20px 0', borderRadius:16, overflow:'hidden',
            border:'1px solid var(--border)', animation:'cardEntrance .5s ease .1s both' }}>
            <DeadlineBanner dailyChecked={state.dailyChecked} now={now}/>
          </div>

          <div style={{ padding:'16px 20px 0', display:'flex', flexDirection:'column', gap:12 }}>

            {/* Google connect banner */}
            {(status === 'unauthenticated' || session?.error === 'RefreshAccessTokenError') && (
              <div style={{ ...styles.card, padding:'14px 16px',
                display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                border:'1px solid rgba(0,212,184,0.2)', animation:'cardEntrance .3s ease both' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--teal)' }}>
                    {session?.error ? 'Reconnect Google' : 'Connect Google'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, marginTop:2 }}>
                    {session?.error ? 'Session expired' : 'Enable smart calendar tasks'}
                  </div>
                </div>
                <button onClick={() => signIn('google')} style={{
                  background:'var(--teal)', color:'#000', border:'none',
                  borderRadius:10, padding:'8px 16px', fontSize:12, fontWeight:700,
                  cursor:'pointer', fontFamily:'Inter, sans-serif',
                }}>
                  {session?.error ? 'Reconnect' : 'Connect'}
                </button>
              </div>
            )}

            {/* Reality check */}
            <div style={{ ...styles.card, padding:'16px 18px', animation:'cardEntrance .4s ease .1s both' }}>
              <div style={styles.sectionLabel}>Daily insight</div>
              <div style={{ marginTop:10 }}>
                {roastLoading
                  ? <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text2)', fontSize:13 }}>
                      <Spinner/> Loading…
                    </div>
                  : <p style={{ fontSize:14, lineHeight:1.8, color:'rgba(255,255,255,0.8)', fontWeight:500 }}>{roast}</p>
                }
              </div>
              <button onClick={() => generateRoast({ streak: state.streak, events: [] })}
                style={{ ...styles.chipBtn, marginTop:12, fontSize:11 }}>↻ Refresh</button>
            </div>

            {/* Daily habits */}
            <div style={{ ...styles.card, animation:'cardEntrance .4s ease .15s both' }}>
              <div style={styles.cardHeader}>
                <span style={styles.sectionLabel}>Morning routine</span>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--teal)' }}>
                  {dailyDone}/{dailyTotal}
                </span>
              </div>
              {/* Thin progress bar */}
              <div style={{ height:2, background:'var(--surface2)', margin:'0 18px 6px' }}>
                <div style={{ height:'100%', borderRadius:999,
                  width:`${Math.round(dailyDone/dailyTotal*100)}%`,
                  background: dailyDone===dailyTotal ? 'var(--green)' : 'var(--teal)',
                  transition:'width .8s cubic-bezier(.4,0,.2,1)',
                  boxShadow: `0 0 8px ${dailyDone===dailyTotal ? '#30D158' : '#00D4B8'}`,
                }}/>
              </div>
              {DAILY_TASKS.map(t => (
                <TaskRow key={t.id}
                  emoji={t.emoji} title={t.title} desc={t.desc}
                  done={!!state.dailyChecked[t.id]}
                  onToggle={() => handleToggleDaily(t.id)}
                  by={t.by} color={t.color} now={now}
                />
              ))}
            </div>

            {/* One-off tasks */}
            {state.oneOffTasks.length > 0 && (
              <div style={{ ...styles.card, animation:'cardEntrance .4s ease .2s both' }}>
                <div style={styles.cardHeader}>
                  <span style={styles.sectionLabel}>One-off tasks</span>
                  <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,159,10,0.8)' }}>
                    {state.oneOffTasks.filter(t=>!t.done).length} pending
                  </span>
                </div>
                {state.oneOffTasks.map((t, i) => (
                  <TaskRow key={`oneoff-${i}`}
                    emoji={t.smart ? '✦' : '◆'}
                    title={t.title}
                    desc={t.note ?? (t.smart ? `From: ${t.triggerEvent ?? 'calendar'}` : undefined)}
                    done={t.done} isOneOff smart={t.smart}
                    onToggle={() => handleToggleOneOff(i)}
                    onDelete={() => handleDeleteOneOff(i)}
                  />
                ))}
              </div>
            )}

            {/* Add task */}
            <div style={{ ...styles.card, padding:'14px 16px', animation:'cardEntrance .4s ease .25s both' }}>
              <div style={{ ...styles.sectionLabel, marginBottom:10 }}>Add task</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleAddTask()}
                  placeholder="e.g. Call dentist, do laundry…"
                  maxLength={120}
                  aria-label="New task"
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)',
                    borderRadius:12, padding:'11px 14px', fontFamily:'Inter, sans-serif',
                    fontSize:14, fontWeight:500, color:'#FFFFFF', outline:'none',
                    transition:'border-color .2s', caretColor:'var(--teal)' }}
                  onFocus={e  => e.target.style.borderColor='var(--teal)'}
                  onBlur={e   => e.target.style.borderColor='var(--border)'}
                />
                <button onClick={handleAddTask} aria-label="Add"
                  style={{ background:'var(--teal)', color:'#000', border:'none',
                    borderRadius:12, padding:'11px 18px', fontSize:20, fontWeight:900,
                    cursor:'pointer', WebkitTapHighlightColor:'transparent',
                    boxShadow:'0 0 16px rgba(0,212,184,0.3)',
                  }}>+</button>
              </div>
            </div>

            {/* Smart task refresh */}
            {session && (
              <div style={{ textAlign:'center' }}>
                <button onClick={() => { handleSetSmartTasksDate(null); runSmartTaskFetch() }}
                  style={{ ...styles.chipBtn, fontSize:12 }}>
                  ✦ Refresh smart tasks
                </button>
              </div>
            )}

            {/* Bottom controls */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              flexWrap:'wrap', gap:8, paddingBottom:8 }}>
              <PhotoManager photos={photos} onRemove={handleRemovePhoto} fileRef={fileRef}/>
              {session && (
                <button onClick={() => signOut()} style={styles.chipBtn}>Google Sign Out</button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── EVENING ── */}
      {tab === 'eod' && (
        <div style={{ paddingBottom:100 }}>
          <div style={{ padding:'56px 20px 24px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
              letterSpacing:'2px', marginBottom:8 }}>End of day</div>
            <div style={{ fontSize:28, fontWeight:800, color:'#FFFFFF', letterSpacing:'-0.5px', marginBottom:6 }}>
              How'd it go?
            </div>
            <p style={{ fontSize:14, color:'var(--text2)', lineHeight:1.6 }}>
              Brain dump your day. I'll pull out anything to carry over.
            </p>
          </div>

          <div style={{ padding:'0 20px', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ ...styles.card, padding:'13px 16px', fontSize:12, fontWeight:600,
              color:'var(--text2)', lineHeight:1.6,
              borderLeft:'2px solid var(--teal)' }}>
              Daily habits never roll over. Only genuine one-off tasks carry forward.
            </div>

            <div style={{ ...styles.card, padding:'16px 18px' }}>
              <div style={{ ...styles.sectionLabel, marginBottom:10 }}>Today's summary</div>
              <textarea
                value={eodText}
                onChange={e => setEodText(e.target.value)}
                placeholder="Skipped the gym again. Need to call dentist. Deadline tomorrow at 10am…"
                maxLength={4000}
                style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)',
                  borderRadius:12, padding:14, fontFamily:'Inter, sans-serif',
                  fontSize:14, fontWeight:500, color:'#FFFFFF', lineHeight:1.7,
                  resize:'none', minHeight:140, outline:'none', caretColor:'var(--teal)' }}
                onFocus={e  => e.target.style.borderColor='var(--teal)'}
                onBlur={e   => e.target.style.borderColor='var(--border)'}
              />
            </div>

            <button onClick={handleRollover} disabled={roLoading} style={{
              width:'100%', background: roLoading ? 'var(--surface2)' : 'var(--teal)',
              color: roLoading ? 'var(--text2)' : '#000',
              border:'none', borderRadius:16, padding:16,
              fontFamily:'Inter, sans-serif', fontSize:15, fontWeight:700,
              cursor: roLoading ? 'not-allowed' : 'pointer',
              boxShadow: roLoading ? 'none' : '0 4px 20px rgba(0,212,184,0.35)',
            }}>
              {roLoading ? 'Thinking…' : "Extract tomorrow's tasks"}
            </button>

            {rollover.length > 0 && (
              <div>
                <div style={{ ...styles.sectionLabel, marginBottom:10 }}>Rolling over</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {rollover.map((item, i) => (
                    <div key={i} style={{ ...styles.card, padding:'13px 16px',
                      display:'flex', gap:12, alignItems:'flex-start',
                      borderLeft:`2px solid ${item.priority==='high'?'#FF453A':item.priority==='low'?'#30D158':'#00D4B8'}` }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#FFFFFF', marginBottom:2 }}>{item.title}</div>
                        <div style={{ fontSize:12, color:'var(--text2)' }}>{item.note}</div>
                      </div>
                      <span style={{ fontSize:9, fontWeight:700, color:'#000',
                        background: item.priority==='high'?'#FF453A':item.priority==='low'?'#30D158':'#00D4B8',
                        borderRadius:999, padding:'3px 8px', flexShrink:0, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:10, marginTop:12 }}>
                  <button onClick={saveRollover} style={{
                    flex:1, background:'var(--green)', color:'#000', border:'none',
                    borderRadius:16, padding:14, fontFamily:'Inter, sans-serif',
                    fontSize:14, fontWeight:700, cursor:'pointer',
                    boxShadow:'0 4px 16px rgba(48,209,88,0.35)',
                  }}>Add to tasks</button>
                  <button onClick={() => setRollover([])} style={{ ...styles.chipBtn, padding:'14px 18px', borderRadius:16 }}>↺</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <nav style={{ position:'fixed', bottom:0, left:0, right:0,
        background:'rgba(11,11,15,0.92)', backdropFilter:'blur(20px)',
        borderTop:'1px solid var(--border)',
        display:'flex', zIndex:500,
        paddingBottom:'env(safe-area-inset-bottom)' }}>
        {[
          { id:'home', icon:'⬡', label:'Today'   },
          { id:'eod',  icon:'◑', label:'Evening'  },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            aria-label={t.label}
            aria-current={tab===t.id ? 'page' : undefined}
            style={{ flex:1, padding:'12px 4px 10px',
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              background:'none', border:'none', cursor:'pointer',
              fontFamily:'Inter, sans-serif', fontSize:10, fontWeight:600,
              letterSpacing:'0.5px', textTransform:'uppercase',
              color: tab===t.id ? 'var(--teal)' : 'var(--text3)',
              WebkitTapHighlightColor:'transparent', transition:'color .15s' }}>
            <span aria-hidden="true" style={{ fontSize:20, lineHeight:1,
              opacity: tab===t.id ? 1 : 0.4,
              transition:'all .2s',
              filter: tab===t.id ? 'drop-shadow(0 0 6px var(--teal))' : 'none',
            }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <Toast message={toast}/>
    </div>
  )
}
