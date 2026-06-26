import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useCallback, useRef } from 'react'

import { useAppState }    from '../src/hooks/useAppState'
import { useTotp }        from '../src/hooks/useTotp'
import { useRoast }       from '../src/hooks/useRoast'
import { useToast }       from '../src/hooks/useToast'
import TotpScreen         from '../src/components/TotpScreen'
import TaskRow            from '../src/components/TaskRow'
import { Toast, Spinner } from '../src/components/ui'
import { DAILY_TASKS }    from '../src/lib/constants'
import { countDailyDone } from '../src/lib/state'

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
  const diffMs  = d - now
  const diffMin = Math.floor(diffMs / 60000)
  const isLate   = diffMs < 0
  const isUrgent = diffMs >= 0 && diffMs < 10 * 60 * 1000
  const isSoon   = diffMs >= 0 && diffMs < 25 * 60 * 1000
  const label    = `${h % 12 || 12}:${String(m).padStart(2,'0')}${h < 12 ? 'am' : 'pm'}`
  const countdown = isLate ? 'LATE'
    : diffMin < 60 ? `${diffMin}m`
    : `${Math.floor(diffMin/60)}h ${diffMin % 60 ? ` ${diffMin % 60}m` : ''}`
  return { isLate, isUrgent, isSoon, label, countdown, diffMs }
}

function nextPendingDeadline(dailyChecked, now) {
  return DAILY_TASKS
    .filter(t => !dailyChecked[t.id] && t.by)
    .map(t => ({ ...t, info: getDeadlineInfo(t.by, false, now) }))
    .filter(t => t.info)
    .sort((a, b) => a.info.diffMs - b.info.diffMs)[0] ?? null
}

// ── Glassmorphism helpers ─────────────────────────────────────────────────────
const glass = (alpha = 0.1, blur = 24) => ({
  background:           `rgba(255,255,255,${alpha})`,
  backdropFilter:       `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  border:               '1px solid rgba(255,255,255,0.14)',
})

const darkGlass = (alpha = 0.3, blur = 24) => ({
  background:           `rgba(0,0,0,${alpha})`,
  backdropFilter:       `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  border:               '1px solid rgba(255,255,255,0.08)',
})

// ── Background ────────────────────────────────────────────────────────────────
function Background({ photo }) {
  return (
    <div aria-hidden="true" style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden' }}>
      {photo ? (
        <>
          <img src={photo} alt="" style={{
            position:'absolute', inset:0, width:'100%', height:'100%',
            objectFit:'cover', objectPosition:'center',
            animation:'fadePhoto .6s ease',
          }}/>
          {/* Dual overlay: darken + gradient for readability */}
          <div style={{ position:'absolute', inset:0,
            background:'linear-gradient(160deg, rgba(10,6,30,0.55) 0%, rgba(5,15,35,0.45) 50%, rgba(10,6,30,0.6) 100%)' }}/>
        </>
      ) : (
        <>
          {/* Rich gradient backdrop when no photos */}
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(160deg, #0D0820 0%, #0A1628 35%, #0F2040 60%, #180D35 100%)',
          }}/>
          {/* Animated colour blobs */}
          {[
            { w:500, h:500, top:-120, left:-120, color:'rgba(108,60,255,0.18)', dur:10 },
            { w:400, h:400, top:'25%', right:-100, color:'rgba(0,180,220,0.14)', dur:13 },
            { w:350, h:350, bottom:-80, left:'25%', color:'rgba(0,190,140,0.12)', dur:9 },
            { w:280, h:280, bottom:'20%', right:'15%', color:'rgba(220,80,180,0.1)', dur:11 },
          ].map((b,i) => (
            <div key={i} style={{
              position:'absolute', borderRadius:'50%',
              width:b.w, height:b.h,
              top:b.top, left:b.left, right:b.right, bottom:b.bottom,
              background:b.color, filter:'blur(70px)',
              animation:`blobDrift ${b.dur}s ease-in-out infinite`,
              animationDelay:`${i*2.2}s`,
            }}/>
          ))}
        </>
      )}
    </div>
  )
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null
  const shapes = ['✦','★','◆','●','▲','✸']
  const colors = ['#00D4B8','#F5A623','#30D158','#FF9F0A','#00C8FF','#FF6B9D']
  return (
    <div aria-hidden="true" style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:9999, overflow:'hidden' }}>
      {Array.from({ length: 32 }).map((_,i) => (
        <div key={i} style={{
          position:'absolute', left:`${(i*3.1)%100}%`, top:`${-5-(i%6)*3}%`,
          fontSize:10+(i%4)*6, color:colors[i%colors.length],
          animation:`confettiDrop ${0.8+(i%5)*0.2}s ease-in forwards`,
          animationDelay:`${(i%8)*0.05}s`,
        }}>{shapes[i%shapes.length]}</div>
      ))}
    </div>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ done, total }) {
  const pct   = total ? done / total : 0
  const r     = 56
  const circ  = 2 * Math.PI * r
  const color = pct === 1 ? '#30D158' : '#00D4B8'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <div style={{ position:'relative', width:132, height:132 }}>
        <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform:'rotate(-90deg)' }} aria-hidden="true">
          <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9"/>
          <circle cx="66" cy="66" r={r} fill="none"
            stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
            style={{
              transition:'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke .5s',
              filter: pct > 0 ? `drop-shadow(0 0 8px ${color})` : 'none',
            }}/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:30, fontWeight:900, color:'#fff', lineHeight:1, letterSpacing:'-1px' }}>
            {Math.round(pct*100)}
          </div>
          <div style={{ fontSize:9, fontWeight:600, color:'rgba(255,255,255,0.4)',
            textTransform:'uppercase', letterSpacing:'1.5px', marginTop:2 }}>
            {done}/{total}
          </div>
        </div>
      </div>
      <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)',
        textTransform:'uppercase', letterSpacing:'2px' }}>Today</div>
    </div>
  )
}

// ── Streak ────────────────────────────────────────────────────────────────────
function StreakStat({ streak }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:40, lineHeight:1,
        animation: streak > 0 ? 'streakGlow 2.5s ease-in-out infinite' : 'none' }}>🔥</span>
      <div style={{ fontSize:40, fontWeight:900, color:'#F5A623', lineHeight:1, letterSpacing:'-2px' }}>
        {streak}
      </div>
      <div style={{ fontSize:10, fontWeight:700, color:'rgba(245,166,35,0.6)',
        textTransform:'uppercase', letterSpacing:'2px' }}>Streak</div>
    </div>
  )
}

// ── Deadline strip ────────────────────────────────────────────────────────────
function DeadlineStrip({ dailyChecked, now }) {
  const next = nextPendingDeadline(dailyChecked, now)
  if (!next) return null
  const { isLate, isUrgent, isSoon, label, countdown } = next.info
  const accent = isLate || isUrgent ? '#FF453A' : isSoon ? '#FF9F0A' : '#00D4B8'
  return (
    <div style={{
      ...darkGlass(0.22, 16),
      borderRadius:14, padding:'11px 16px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      borderLeft:`3px solid ${accent}`,
      animation: isUrgent || isLate ? 'pulse 1.3s ease-in-out infinite' : 'none',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:accent,
          boxShadow:`0 0 8px ${accent}`,
          animation: isUrgent || isLate ? 'pulse 0.8s ease-in-out infinite' : 'none' }}/>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.9)' }}>
            {next.emoji} {next.title}
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 }}>by {label}</div>
        </div>
      </div>
      <div style={{ fontSize:18, fontWeight:800, color:accent,
        textShadow: isLate || isUrgent ? `0 0 12px ${accent}` : 'none' }}>
        {countdown}
      </div>
    </div>
  )
}

// ── Glass section card ────────────────────────────────────────────────────────
function GlassCard({ children, style = {} }) {
  return (
    <div style={{
      ...darkGlass(0.28, 20),
      borderRadius:20, overflow:'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ padding:'14px 18px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)',
        textTransform:'uppercase', letterSpacing:'2px' }}>{children}</span>
      {right && <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.45)' }}>{right}</span>}
    </div>
  )
}

// ── Photo manager ─────────────────────────────────────────────────────────────
function PhotoManager({ photos, onRemove, fileRef }) {
  const [open, setOpen] = useState(false)
  const chipStyle = {
    ...darkGlass(0.3, 12), borderRadius:999,
    color:'rgba(255,255,255,0.5)', fontFamily:'Inter, sans-serif',
    fontSize:11, fontWeight:600, padding:'6px 12px',
    cursor:'pointer', border:'1px solid rgba(255,255,255,0.12)',
    WebkitTapHighlightColor:'transparent',
  }
  return (
    <div>
      <button onClick={() => setOpen(o=>!o)} style={chipStyle}>
        📷 Photos ({photos.length}/10)
      </button>
      {open && (
        <div style={{ marginTop:10, animation:'slideUp .2s ease' }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {photos.map((src,i) => (
              <div key={i} style={{ position:'relative', width:60, height:60, borderRadius:12,
                overflow:'hidden', border:'1px solid rgba(255,255,255,0.12)', flexShrink:0 }}>
                <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                <button onClick={() => onRemove(i)} aria-label={`Remove photo ${i+1}`}
                  style={{ position:'absolute', top:3, right:3, width:17, height:17, borderRadius:'50%',
                    background:'rgba(0,0,0,0.7)', border:'none', color:'white', fontSize:11,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
            ))}
            {photos.length < 10 && (
              <button onClick={() => fileRef.current?.click()} aria-label="Add photo"
                style={{ ...chipStyle, width:60, height:60, borderRadius:12, fontSize:20, padding:0,
                  border:'1px dashed rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chip button ───────────────────────────────────────────────────────────────
function ChipBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      ...darkGlass(0.3, 12), borderRadius:999,
      color:'rgba(255,255,255,0.5)', fontFamily:'Inter, sans-serif',
      fontSize:11, fontWeight:600, padding:'6px 14px',
      cursor:'pointer', border:'1px solid rgba(255,255,255,0.12)',
      WebkitTapHighlightColor:'transparent',
    }}>{children}</button>
  )
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
  const [dailyBg, setDailyBg]   = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    const fetchBg = () =>
      fetch('/api/background')
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.urlRegular && setDailyBg(d))
        .catch(() => {})

    fetchBg()

    // Re-fetch at the top of each hour
    const msUntilNextHour = (60 - new Date().getMinutes()) * 60000 - new Date().getSeconds() * 1000
    const first = setTimeout(() => { fetchBg(); }, msUntilNextHour)
    const interval = setInterval(fetchBg, 3600000)
    return () => { clearTimeout(first); clearInterval(interval) }
  }, [])

  const { mode: pinMode, error: pinError, loading: pinLoading, verify: verifyTotp, lock } = useTotp()

  const {
    state, handleToggleDaily, handleToggleOneOff, handleDeleteOneOff,
    handleAddOneOff, handleMergeSmartTasks, handleAddPhoto, handleRemovePhoto,
    handleSetSmartTasksDate,
  } = useAppState({
    today: TODAY,
    onAllDailyDone: useCallback(() => {
      setTimeout(() => { setConfetti(true); setTimeout(() => { setConfetti(false); setShowDone(true) }, 2200) }, 400)
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
      const res = await fetch('/api/claude', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ mode:'plan', events:ctx.events, emails:ctx.emails, existingOneOffs:state.oneOffTasks }) })
      if (!res.ok) { showToast('AI task gen failed'); return }
      const { tasks=[] } = await res.json()
      const added = handleMergeSmartTasks(tasks, TODAY)
      if (added > 0) setTimeout(() => showToast(`${added} smart task${added>1?'s':''} added`), 300)
      else { showToast('No new calendar tasks'); handleSetSmartTasksDate(TODAY) }
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
      if (!tasks.length) showToast('Nothing to roll over')
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
  const bgPhoto    = photos.length ? photos[photoIdx] : (dailyBg?.urlRegular ?? null)
  const dailyDone  = countDailyDone(state)
  const dailyTotal = DAILY_TASKS.length
  const greeting   = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr    = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
  const timeStr    = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })

  if (pinMode === 'checking') return null
  if (pinMode === 'locked')   return <TotpScreen error={pinError} loading={pinLoading} onVerify={verifyTotp}/>

  // ── All done ──
  if (showDone) {
    return (
      <>
        <Background photo={bgPhoto}/>
        <div style={{ position:'relative', zIndex:1, minHeight:'100vh',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:40, textAlign:'center' }}>
          <div style={{ ...darkGlass(0.45, 28), borderRadius:28, padding:'48px 40px', maxWidth:320, width:'100%' }}>
            <div style={{ fontSize:72, marginBottom:20, filter:'drop-shadow(0 0 28px rgba(245,166,35,0.8))' }}>🔥</div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', letterSpacing:'3px',
              textTransform:'uppercase', marginBottom:10 }}>All habits complete</div>
            <div style={{ fontSize:36, fontWeight:900, letterSpacing:'-1px', marginBottom:10 }}>Absolute legend.</div>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, lineHeight:1.7, marginBottom:32 }}>
              Not because you felt like it.<br/>Because you showed up anyway.
            </p>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14,
              ...glass(0.1,16), borderRadius:16, padding:'16px 24px', marginBottom:32 }}>
              <span style={{ fontSize:32 }}>🔥</span>
              <div>
                <div style={{ fontSize:42, fontWeight:900, color:'#F5A623', letterSpacing:'-2px', lineHeight:1 }}>{state.streak}</div>
                <div style={{ fontSize:9, fontWeight:700, color:'rgba(245,166,35,0.5)', textTransform:'uppercase', letterSpacing:'2px' }}>day streak</div>
              </div>
            </div>
            <button onClick={() => setShowDone(false)} style={{
              width:'100%', background:'#00D4B8', color:'#000', border:'none',
              borderRadius:14, padding:'14px 0', fontSize:15, fontWeight:700,
              cursor:'pointer', boxShadow:'0 4px 20px rgba(0,212,184,0.4)',
            }}>Back home</button>
          </div>
        </div>
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Background photo={bgPhoto}/>
      <Confetti active={confetti}/>
      <input type="file" accept="image/*" ref={fileRef} onChange={handlePhotoFile}
        style={{ display:'none' }} aria-label="Upload photo"/>

      <div style={{ position:'relative', zIndex:1, minHeight:'100vh' }}>

        {/* ── HOME ── */}
        {tab === 'home' && (
          <div style={{ paddingBottom:100 }}>

            {/* ── Top bar ── */}
            <div style={{ padding:'52px 22px 0',
              display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:500, marginBottom:5 }}>{dateStr}</div>
                <div style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.5px' }}>{greeting}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:30, fontWeight:900, letterSpacing:'-1.5px', lineHeight:1 }}>{timeStr}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:500, marginTop:3 }}>
                    {dailyDone === dailyTotal ? 'All done ✓' : `${dailyTotal-dailyDone} remaining`}
                  </div>
                </div>
                <button onClick={lock} style={{
                  ...darkGlass(0.3,12), borderRadius:999,
                  color:'rgba(255,255,255,0.35)', fontFamily:'Inter, sans-serif',
                  fontSize:10, fontWeight:600, padding:'5px 12px',
                  cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)',
                  letterSpacing:'0.3px', WebkitTapHighlightColor:'transparent',
                }}>Lock</button>
              </div>
            </div>

            {/* ── Stats ── */}
            <div style={{ padding:'22px 22px 0', display:'flex', gap:12 }}>
              {/* Score ring */}
              <div style={{ ...darkGlass(0.32,22), borderRadius:22, flex:1,
                display:'flex', alignItems:'center', justifyContent:'center', padding:'22px 16px',
                animation:'cardEntrance .4s ease both' }}>
                <ScoreRing done={dailyDone} total={dailyTotal}/>
              </div>
              {/* Streak */}
              <div style={{ ...darkGlass(0.32,22), borderRadius:22,
                display:'flex', alignItems:'center', justifyContent:'center', padding:'22px 24px',
                animation:'cardEntrance .45s ease both' }}>
                <StreakStat streak={state.streak}/>
              </div>
            </div>

            <div style={{ padding:'12px 22px 0', display:'flex', flexDirection:'column', gap:12 }}>

              {/* Deadline */}
              <DeadlineStrip dailyChecked={state.dailyChecked} now={now}/>

              {/* Google connect */}
              {(status === 'unauthenticated' || session?.error === 'RefreshAccessTokenError') && (
                <GlassCard style={{ padding:'14px 18px',
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                  animation:'cardEntrance .35s ease both' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#00D4B8' }}>
                      {session?.error ? 'Reconnect Google' : 'Connect Google'}
                    </div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>
                      {session?.error ? 'Session expired' : 'Enable smart calendar tasks'}
                    </div>
                  </div>
                  <button onClick={() => signIn('google')} style={{
                    background:'#00D4B8', color:'#000', border:'none',
                    borderRadius:10, padding:'8px 16px', fontSize:12, fontWeight:700,
                    cursor:'pointer', fontFamily:'Inter, sans-serif',
                  }}>{session?.error ? 'Reconnect' : 'Connect'}</button>
                </GlassCard>
              )}

              {/* Daily insight */}
              <GlassCard style={{ animation:'cardEntrance .4s ease .05s both' }}>
                <SectionLabel>Daily insight</SectionLabel>
                <div style={{ padding:'0 18px 16px' }}>
                  {roastLoading
                    ? <div style={{ display:'flex', alignItems:'center', gap:8, color:'rgba(255,255,255,0.35)', fontSize:13 }}>
                        <Spinner/> Loading…
                      </div>
                    : <p style={{ fontSize:14, lineHeight:1.8, color:'rgba(255,255,255,0.72)', fontWeight:500 }}>{roast}</p>
                  }
                  <button onClick={() => generateRoast({ streak:state.streak, events:[] })}
                    style={{ ...darkGlass(0.3,10), borderRadius:999, color:'rgba(255,255,255,0.4)',
                      fontFamily:'Inter, sans-serif', fontSize:11, fontWeight:600,
                      padding:'6px 14px', cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)',
                      marginTop:12, WebkitTapHighlightColor:'transparent' }}>↻ Refresh</button>
                </div>
              </GlassCard>

              {/* Morning routine */}
              <GlassCard style={{ animation:'cardEntrance .4s ease .1s both' }}>
                <SectionLabel right={`${dailyDone}/${dailyTotal}`}>Morning routine</SectionLabel>
                {/* Thin progress bar */}
                <div style={{ height:2, margin:'0 18px 4px', background:'rgba(255,255,255,0.06)', borderRadius:999 }}>
                  <div style={{ height:'100%', borderRadius:999, transition:'width .8s cubic-bezier(.4,0,.2,1)',
                    width:`${Math.round(dailyDone/dailyTotal*100)}%`,
                    background: dailyDone===dailyTotal ? '#30D158' : '#00D4B8',
                    boxShadow: `0 0 8px ${dailyDone===dailyTotal ? '#30D158' : '#00D4B8'}`,
                  }}/>
                </div>
                {DAILY_TASKS.map(t => (
                  <TaskRow key={t.id} emoji={t.emoji} title={t.title} desc={t.desc}
                    done={!!state.dailyChecked[t.id]} onToggle={() => handleToggleDaily(t.id)}
                    by={t.by} color={t.color} now={now}/>
                ))}
              </GlassCard>

              {/* One-off tasks */}
              {state.oneOffTasks.length > 0 && (
                <GlassCard style={{ animation:'cardEntrance .4s ease .15s both' }}>
                  <SectionLabel right={`${state.oneOffTasks.filter(t=>!t.done).length} pending`}>One-off tasks</SectionLabel>
                  {state.oneOffTasks.map((t,i) => (
                    <TaskRow key={`oneoff-${i}`} emoji={t.smart?'✦':'◆'}
                      title={t.title} desc={t.note??(t.smart?`From: ${t.triggerEvent??'calendar'}`:undefined)}
                      done={t.done} isOneOff smart={t.smart}
                      onToggle={() => handleToggleOneOff(i)} onDelete={() => handleDeleteOneOff(i)}/>
                  ))}
                </GlassCard>
              )}

              {/* Add task */}
              <GlassCard style={{ padding:'14px 18px', animation:'cardEntrance .4s ease .2s both' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)',
                  textTransform:'uppercase', letterSpacing:'2px', marginBottom:10 }}>Add task</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    value={newTask} onChange={e=>setNewTask(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&handleAddTask()}
                    placeholder="e.g. Call dentist, do laundry…" maxLength={120} aria-label="New task"
                    style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:12, padding:'11px 14px', fontFamily:'Inter, sans-serif',
                      fontSize:14, fontWeight:500, color:'#fff', outline:'none',
                      caretColor:'#00D4B8', transition:'border-color .2s' }}
                    onFocus={e=>e.target.style.borderColor='rgba(0,212,184,0.5)'}
                    onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}
                  />
                  <button onClick={handleAddTask} aria-label="Add" style={{
                    background:'#00D4B8', color:'#000', border:'none', borderRadius:12,
                    padding:'11px 18px', fontSize:20, fontWeight:900, cursor:'pointer',
                    boxShadow:'0 0 16px rgba(0,212,184,0.35)', WebkitTapHighlightColor:'transparent',
                  }}>+</button>
                </div>
              </GlassCard>

              {/* Bottom strip */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                flexWrap:'wrap', gap:10, paddingBottom:10 }}>
                <PhotoManager photos={photos} onRemove={handleRemovePhoto} fileRef={fileRef}/>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {session && <ChipBtn onClick={()=>{ handleSetSmartTasksDate(null); runSmartTaskFetch() }}>✦ Smart tasks</ChipBtn>}
                  {session && <ChipBtn onClick={()=>signOut()}>Google Sign Out</ChipBtn>}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── EVENING ── */}
        {tab === 'eod' && (
          <div style={{ paddingBottom:100 }}>
            <div style={{ padding:'56px 22px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)',
                textTransform:'uppercase', letterSpacing:'2.5px', marginBottom:10 }}>End of day</div>
              <div style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>How'd it go?</div>
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.45)', lineHeight:1.6 }}>
                Brain dump your day. I'll pull out anything to carry over.
              </p>
            </div>

            <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', gap:12 }}>
              <GlassCard style={{ padding:'13px 16px', fontSize:12, fontWeight:500,
                color:'rgba(255,255,255,0.45)', lineHeight:1.7,
                borderLeft:'2px solid rgba(0,212,184,0.5)' }}>
                Daily habits never roll over. Only genuine one-off tasks carry forward.
              </GlassCard>

              <GlassCard style={{ padding:'16px 18px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)',
                  textTransform:'uppercase', letterSpacing:'2px', marginBottom:10 }}>Today's summary</div>
                <textarea value={eodText} onChange={e=>setEodText(e.target.value)}
                  placeholder="Skipped the gym again. Need to call dentist. Deadline tomorrow 10am…"
                  maxLength={4000}
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                    borderRadius:12, padding:14, fontFamily:'Inter, sans-serif',
                    fontSize:14, fontWeight:500, color:'#fff', lineHeight:1.7,
                    resize:'none', minHeight:140, outline:'none', caretColor:'#00D4B8' }}
                  onFocus={e=>e.target.style.borderColor='rgba(0,212,184,0.4)'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
              </GlassCard>

              <button onClick={handleRollover} disabled={roLoading} style={{
                width:'100%', background: roLoading ? 'rgba(255,255,255,0.08)' : '#00D4B8',
                color: roLoading ? 'rgba(255,255,255,0.3)' : '#000', border:'none',
                borderRadius:16, padding:15, fontFamily:'Inter, sans-serif',
                fontSize:15, fontWeight:700, cursor: roLoading ? 'not-allowed' : 'pointer',
                boxShadow: roLoading ? 'none' : '0 4px 20px rgba(0,212,184,0.35)',
              }}>{roLoading ? 'Thinking…' : "Extract tomorrow's tasks"}</button>

              {rollover.length > 0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)',
                    textTransform:'uppercase', letterSpacing:'2px', marginBottom:10 }}>Rolling over</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {rollover.map((item,i) => (
                      <GlassCard key={i} style={{ padding:'13px 16px', display:'flex', gap:12, alignItems:'flex-start',
                        borderLeft:`2px solid ${item.priority==='high'?'#FF453A':item.priority==='low'?'#30D158':'#00D4B8'}` }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>{item.title}</div>
                          <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>{item.note}</div>
                        </div>
                        <span style={{ fontSize:9, fontWeight:700, color:'#000',
                          background: item.priority==='high'?'#FF453A':item.priority==='low'?'#30D158':'#00D4B8',
                          borderRadius:999, padding:'3px 8px', flexShrink:0,
                          textTransform:'uppercase', letterSpacing:'0.5px' }}>{item.priority}</span>
                      </GlassCard>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:12 }}>
                    <button onClick={saveRollover} style={{
                      flex:1, background:'#30D158', color:'#000', border:'none',
                      borderRadius:14, padding:14, fontFamily:'Inter, sans-serif',
                      fontSize:14, fontWeight:700, cursor:'pointer',
                      boxShadow:'0 4px 16px rgba(48,209,88,0.35)',
                    }}>Add to tasks</button>
                    <ChipBtn onClick={()=>setRollover([])}>↺</ChipBtn>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB BAR ── */}
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:500,
          ...darkGlass(0.55, 24),
          borderTop:'1px solid rgba(255,255,255,0.08)',
          display:'flex', paddingBottom:'env(safe-area-inset-bottom)' }}>
          {[
            { id:'home', label:'Today',   icon:'⬡' },
            { id:'eod',  label:'Evening', icon:'◑' },
          ].map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} aria-label={t.label}
              aria-current={tab===t.id?'page':undefined}
              style={{ flex:1, padding:'12px 4px 10px',
                display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                background:'none', border:'none', cursor:'pointer',
                fontFamily:'Inter, sans-serif', fontSize:9, fontWeight:700,
                letterSpacing:'1.5px', textTransform:'uppercase',
                color: tab===t.id ? '#00D4B8' : 'rgba(255,255,255,0.28)',
                WebkitTapHighlightColor:'transparent', transition:'color .15s' }}>
              <span aria-hidden="true" style={{ fontSize:22, lineHeight:1,
                filter: tab===t.id ? 'drop-shadow(0 0 8px #00D4B8)' : 'none',
                transition:'filter .2s' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {dailyBg && !photos.length && (
        <a href={dailyBg.photographerUrl + '?utm_source=morning_accountability&utm_medium=referral'}
          target="_blank" rel="noopener noreferrer"
          style={{ position:'fixed', bottom:'calc(env(safe-area-inset-bottom) + 62px)', left:14,
            fontSize:9, color:'rgba(255,255,255,0.22)', fontWeight:500, textDecoration:'none',
            zIndex:400, letterSpacing:'0.3px' }}>
          Photo: {dailyBg.photographer} / Unsplash
        </a>
      )}
      <Toast message={toast}/>
      </div>
    </>
  )
}
