import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useCallback, useRef } from 'react'

import { useAppState }  from '../src/hooks/useAppState'
import { usePin }       from '../src/hooks/usePin'
import { useRoast }     from '../src/hooks/useRoast'
import { useToast }     from '../src/hooks/useToast'

import PinScreen        from '../src/components/PinScreen'
import TaskRow          from '../src/components/TaskRow'
import { WhimsyCard, Label, SectionHead, Toast, Spinner } from '../src/components/ui'

import { DAILY_TASKS, ALL_DECO }  from '../src/lib/constants'
import { countDailyDone }         from '../src/lib/state'
import { sanitiseTitle }          from '../src/lib/state'

const TODAY = new Date().toDateString()

// ── Shared button styles ──────────────────────────────────────────────────────
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

const btnOutline = {
  ...btnPrimary,
  background: 'var(--white)',
  color:      'var(--toffee)',
  border:     '2px solid var(--sand)',
  boxShadow:  'none',
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

  const fileRef = useRef()

  // ── Pin ──
  const { mode: pinMode, input: pinInput, error: pinError, shaking: pinShaking, onDigit, onDelete, lock } = usePin()

  // ── App state ──
  const {
    state,
    handleToggleDaily,
    handleToggleOneOff,
    handleDeleteOneOff,
    handleAddOneOff,
    handleMergeSmartTasks,
    handleSetPhoto,
    handleSetSmartTasksDate,
  } = useAppState({
    today:        TODAY,
    onAllDailyDone: useCallback(() => setTimeout(() => setShowDone(true), 500), []),
  })

  // ── Roast ──
  const { roast, loading: roastLoading, loadCached, generate: generateRoast } = useRoast({ today: TODAY })

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
    try {
      const ctxRes = await fetch('/api/context')
      if (!ctxRes.ok) { handleSetSmartTasksDate(TODAY); return }
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
      if (!taskRes.ok) { handleSetSmartTasksDate(TODAY); return }
      const { tasks = [] } = await taskRes.json()

      const added = handleMergeSmartTasks(tasks, TODAY)
      if (added > 0) {
        setTimeout(() => showToast(`✨ ${added} smart task${added > 1 ? 's' : ''} added from your calendar`), 800)
      } else {
        handleSetSmartTasksDate(TODAY)
      }
    } catch (e) {
      console.error('Smart task fetch failed:', e)
      handleSetSmartTasksDate(TODAY)
    }
  }, [session, state, handleMergeSmartTasks, handleSetSmartTasksDate, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Task handlers ──
  const handleAddTask = useCallback(() => {
    const ok = handleAddOneOff(newTask)
    if (ok) { setNewTask(''); showToast('Task added 📌') }
    else showToast('Task is empty or already exists')
  }, [newTask, handleAddOneOff, showToast])

  const handlePhoto = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => handleSetPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }, [handleSetPhoto])

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
    setTab('checklist')
  }, [rollover, handleMergeSmartTasks, showToast])

  // ── Derived ──────────────────────────────────────────────────────────────
  if (!state) return null  // SSR guard

  const dailyDone  = countDailyDone(state)
  const dailyTotal = DAILY_TASKS.length
  const pct        = dailyDone / dailyTotal
  const circ       = 163.36
  const ringOffset = circ - pct * circ
  const now        = new Date()
  const greeting   = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr    = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })

  function progressMsg() {
    if (!dailyDone)             return "Let's begin, little one 🌱"
    if (dailyDone < 3)          return "Off to a lovely start 🍄"
    if (dailyDone < 5)          return "The cottage is proud of you 🕯️"
    if (dailyDone < dailyTotal) return "Almost there, brave soul 🌸"
    return "You did it! ✨"
  }

  // ── PIN screens ──
  if (pinMode === 'locked' || pinMode === 'setup' || pinMode === 'confirm') {
    return (
      <PinScreen
        mode={pinMode}
        input={pinInput}
        error={pinError}
        shaking={pinShaking}
        onDigit={onDigit}
        onDelete={onDelete}
      />
    )
  }

  // ── All-done overlay ──
  if (showDone) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,var(--parchment),var(--cream))', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:48, textAlign:'center', position:'relative', overflow:'hidden' }}>
        {['🌸','🍄','✨','🌿','🕯️','🌼'].map((d,i) => (
          <div key={i} aria-hidden="true" style={{ position:'absolute', fontSize:24, opacity:.3, top:`${10+i*15}%`, left:i%2===0?'8%':'82%', animation:`float ${2.5+i*.3}s ease-in-out infinite`, animationDelay:`${i*.4}s`, userSelect:'none', pointerEvents:'none' }}>{d}</div>
        ))}
        <div style={{ fontSize:80, marginBottom:20, animation:'bounceIn .6s cubic-bezier(.34,1.56,.64,1)', position:'relative', zIndex:1 }}>🌸</div>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontStyle:'italic', fontSize:34, marginBottom:12, position:'relative', zIndex:1 }}>You did it.</h2>
        <p style={{ color:'var(--muted)', fontSize:15, fontWeight:600, lineHeight:1.7, marginBottom:12, maxWidth:270, position:'relative', zIndex:1 }}>Not because you felt like it. Because you showed up anyway.</p>
        <p style={{ fontSize:20, marginBottom:4, position:'relative', zIndex:1 }}>🔥</p>
        <p style={{ fontFamily:"'Caveat',cursive", fontSize:20, fontWeight:700, color:'var(--toffee)', marginBottom:32, position:'relative', zIndex:1 }}>{state.streak} day streak</p>
        <button onClick={() => { setShowDone(false); setTab('home') }} style={{ ...btnPrimary, maxWidth:260 }}>Back home</button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'var(--cream)', fontFamily:"'Nunito',sans-serif", color:'var(--text)' }}>

      {/* ── HOME ── */}
      {tab === 'home' && (
        <div style={{ paddingBottom:88 }}>
          {/* Hero */}
          <div style={{ position:'relative', minHeight:300, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:'0 20px 28px', overflow:'hidden' }}>
            {state.photo
              ? <img src={state.photo} alt="Motivation photo" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:'brightness(0.45) saturate(0.65) sepia(0.25)' }}/>
              : <div style={{ position:'absolute', inset:0, background:'linear-gradient(160deg,#D5C49A,#B8956A)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:6, color:'rgba(255,253,245,.8)' }}>
                  <span aria-hidden="true" style={{ fontSize:52, filter:'drop-shadow(0 2px 8px rgba(0,0,0,.2))' }}>🏡</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>Tap ⚙️ to add your photo</span>
                </div>
            }
            {['🌿','🍄','🌸'].map((d,i) => (
              <div key={i} aria-hidden="true" style={{ position:'absolute', top:16+i*22, [i%2===0?'left':'right']:12+i*8, fontSize:20, opacity:.5, animation:`float ${2.8+i*.5}s ease-in-out infinite`, animationDelay:`${i*.6}s`, userSelect:'none', pointerEvents:'none', zIndex:5 }}>{d}</div>
            ))}
            <div style={{ position:'relative', zIndex:10, width:'100%', textAlign:'center' }}>
              <div style={{ background:'rgba(255,253,245,.18)', backdropFilter:'blur(10px)', color:'rgba(255,253,245,.95)', fontSize:11, fontWeight:800, letterSpacing:'2px', textTransform:'uppercase', padding:'5px 16px', borderRadius:999, display:'inline-block', marginBottom:12 }}>{dateStr}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontStyle:'italic', fontSize:30, color:'rgba(255,253,245,.98)', textShadow:'0 2px 16px rgba(0,0,0,.35)', marginBottom:14 }}>{greeting} ✿</div>
              <div style={{ background:'rgba(255,253,245,.92)', color:'var(--toffee)', fontSize:13, fontWeight:900, padding:'7px 18px', borderRadius:999, display:'inline-flex', alignItems:'center', gap:8, boxShadow:'0 3px 12px rgba(0,0,0,.2)' }}>
                🔥 <span style={{ fontFamily:"'Caveat',cursive", fontSize:17 }}>{state.streak} day streak</span>
              </div>
            </div>
          </div>

          <div style={{ padding:'20px 20px 8px', display:'flex', flexDirection:'column', gap:16 }}>
            {/* Google connect banner */}
            {status === 'unauthenticated' && (
              <div style={{ background:'var(--lav-l)', border:'2px dashed var(--lavender)', borderRadius:16, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#6B5280' }}>Connect Google 🔗</div>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>For smart calendar-aware tasks</div>
                </div>
                <button onClick={() => signIn('google')} style={{ background:'#6B5280', color:'white', border:'none', borderRadius:10, padding:'8px 14px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:"'Nunito',sans-serif" }}>Connect</button>
              </div>
            )}

            {/* Roast card */}
            <WhimsyCard accent="var(--moss-l)">
              <Label>🌱 today's reality check</Label>
              {roastLoading
                ? <div style={{ display:'flex', alignItems:'center', gap:10, color:'var(--muted)', fontSize:14, fontWeight:600, fontStyle:'italic' }}><Spinner/> Brewing your check-in...</div>
                : <p style={{ fontSize:14, lineHeight:1.8, fontWeight:600 }}>{roast}</p>
              }
              <button
                onClick={() => generateRoast({ streak: state.streak, events: [] })}
                style={{ marginTop:12, ...btnSmall }}
              >
                ↻ try again
              </button>
            </WhimsyCard>

            {/* Progress ring */}
            <WhimsyCard accent="var(--sky-l)">
              <Label>✨ today's progress</Label>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ position:'relative', flexShrink:0 }} role="img" aria-label={`${dailyDone} of ${dailyTotal} habits done`}>
                  <svg width="72" height="72" viewBox="0 0 64 64" aria-hidden="true" style={{ transform:'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--warm)" strokeWidth="9"/>
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke={dailyDone === dailyTotal ? 'var(--moss)' : 'var(--toffee)'}
                      strokeWidth="9" strokeLinecap="round"
                      strokeDasharray={circ} strokeDashoffset={ringOffset}
                      style={{ transition:'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }}/>
                  </svg>
                  <div aria-hidden="true" style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:22, lineHeight:1 }}>
                    {dailyDone === dailyTotal ? '🌸' : (ALL_DECO[dailyDone] ?? '🌱')}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily:"'Caveat',cursive", fontSize:20, fontWeight:700, marginBottom:4 }}>{progressMsg()}</div>
                  <div style={{ fontSize:13, color:'var(--muted)', fontWeight:700 }}>{dailyDone} of {dailyTotal} habits done</div>
                  {state.oneOffTasks.filter(t => !t.done).length > 0 && (
                    <div style={{ fontSize:11, color:'var(--blush)', fontWeight:800, marginTop:4 }}>
                      + {state.oneOffTasks.filter(t => !t.done).length} one-off task{state.oneOffTasks.filter(t => !t.done).length !== 1 ? 's' : ''} pending
                    </div>
                  )}
                </div>
              </div>
            </WhimsyCard>

            <button onClick={() => setTab('checklist')} style={btnPrimary}>Open the checklist 🌿</button>
            <a href="#" onClick={openFORM} style={{ ...btnOutline, display:'flex', alignItems:'center', justifyContent:'center', gap:8, textDecoration:'none' }}>🏊 Open FORM app</a>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:4 }}>
              <input type="file" accept="image/*" ref={fileRef} onChange={handlePhoto} style={{ display:'none' }} aria-label="Upload motivation photo"/>
              <button onClick={() => fileRef.current?.click()} style={btnSmall}>
                ⚙️ {state.photo ? 'Change photo' : 'Add photo'}
              </button>
              <button onClick={lock} style={btnSmall}>🔒 Lock</button>
            </div>

            {session && (
              <button onClick={() => signOut()} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                Sign out of Google
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── CHECKLIST ── */}
      {tab === 'checklist' && (
        <div style={{ paddingBottom:88 }}>
          <div style={{ padding:'52px 20px 20px', background:'var(--white)', borderRadius:'0 0 32px 32px', boxShadow:'0 4px 20px var(--shadow)', marginBottom:16, position:'relative', overflow:'hidden' }}>
            {['🍄','🌿','🌸'].map((d,i) => (
              <div key={i} aria-hidden="true" style={{ position:'absolute', top:8+i*6, right:16+i*18, fontSize:18, opacity:.2, animation:`float ${3+i*.4}s ease-in-out infinite`, animationDelay:`${i*.5}s`, userSelect:'none', pointerEvents:'none' }}>{d}</div>
            ))}
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontStyle:'italic', fontSize:28, fontWeight:700, marginBottom:16, position:'relative', zIndex:1 }}>
              Today's tasks 🌿
            </h1>
            <div role="progressbar" aria-valuenow={dailyDone} aria-valuemin={0} aria-valuemax={dailyTotal} aria-label={`${dailyDone} of ${dailyTotal} habits done`} style={{ background:'var(--warm)', borderRadius:999, height:12, overflow:'hidden', position:'relative', zIndex:1 }}>
              <div style={{ height:'100%', background:dailyDone===dailyTotal?'linear-gradient(90deg,var(--moss),#5A8E50)':'linear-gradient(90deg,var(--toffee),var(--blush))', borderRadius:999, width:`${Math.round(pct*100)}%`, transition:'width .5s cubic-bezier(.4,0,.2,1)' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:12, fontWeight:800, color:'var(--muted)', position:'relative', zIndex:1 }}>
              <span>{dailyDone} / {dailyTotal} habits</span>
              <span style={{ fontFamily:"'Caveat',cursive", fontSize:15 }}>{Math.round(pct*100)}% ✓</span>
            </div>
          </div>

          <SectionHead label="Daily habits 🌱" badge="resets every morning" badgeColor="var(--moss)" badgeBg="var(--moss-l)"/>
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

          {state.oneOffTasks.length > 0 && (
            <>
              <SectionHead label="One-off tasks 📌" badge="rolls over until done" badgeColor="var(--blush)" badgeBg="var(--blush-l)"/>
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
            </>
          )}

          {/* Add custom task */}
          <div style={{ padding:'20px 16px 8px' }}>
            <SectionHead label="Add a task 🖊️" badge="" badgeColor="" badgeBg=""/>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                placeholder="e.g. do laundry, call dentist..."
                maxLength={120}
                aria-label="New task title"
                style={{ flex:1, background:'var(--white)', border:'2px solid var(--sand)', borderRadius:14, padding:'13px 15px', fontFamily:"'Nunito',sans-serif", fontSize:14, fontWeight:700, color:'var(--text)', outline:'none' }}
              />
              <button onClick={handleAddTask} aria-label="Add task" style={{ background:'linear-gradient(135deg,var(--toffee),var(--caramel))', color:'var(--white)', border:'none', borderRadius:14, padding:'13px 20px', fontSize:24, fontWeight:900, cursor:'pointer', boxShadow:'0 3px 12px rgba(120,80,40,.25)', WebkitTapHighlightColor:'transparent' }}>+</button>
            </div>
          </div>

          {session && (
            <div style={{ textAlign:'center', paddingTop:8 }}>
              <button onClick={runSmartTaskFetch} style={{ background:'none', border:'none', color:'var(--toffee)', fontSize:13, fontWeight:800, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                ✨ Refresh smart tasks from calendar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── END OF DAY ── */}
      {tab === 'eod' && (
        <div style={{ paddingBottom:88 }}>
          <div style={{ padding:'52px 20px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
            {['🍂','🕯️','🌙','🍵'].map((d,i) => (
              <div key={i} aria-hidden="true" style={{ position:'absolute', top:8+i*18, [i%2===0?'left':'right']:10+i*5, fontSize:22, opacity:.2, animation:`float ${3+i*.5}s ease-in-out infinite`, animationDelay:`${i*.4}s`, userSelect:'none', pointerEvents:'none' }}>{d}</div>
            ))}
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontStyle:'italic', fontSize:28, fontWeight:700, marginBottom:8, position:'relative', zIndex:1 }}>End of day 🍂</h1>
            <p style={{ fontSize:14, color:'var(--muted)', fontWeight:600, lineHeight:1.6, position:'relative', zIndex:1 }}>Brain dump how today went. I'll extract anything that needs to roll over.</p>
          </div>

          <div style={{ padding:'0 20px', display:'flex', flexDirection:'column', gap:16 }}>
            <div role="note" style={{ background:'var(--lav-l)', border:'2px solid var(--lavender)', borderRadius:16, padding:'13px 16px', fontSize:12, fontWeight:700, color:'#6B5280', lineHeight:1.6 }}>
              <strong>Note:</strong> Daily habits never roll over. Only genuine one-off tasks (errands, deadlines, appointments) carry over.
            </div>

            <WhimsyCard accent="var(--sky-l)">
              <Label>📝 how did today go?</Label>
              <textarea
                value={eodText}
                onChange={e => setEodText(e.target.value)}
                placeholder="Did the walk but skipped gym again. Still need to do laundry. Work deadline tomorrow 10am. Forgot to call the dentist..."
                maxLength={4000}
                aria-label="End of day summary"
                style={{ width:'100%', background:'var(--warm)', border:'2px solid var(--sand)', borderRadius:12, padding:14, fontFamily:"'Nunito',sans-serif", fontSize:14, fontWeight:600, color:'var(--text)', lineHeight:1.7, resize:'none', minHeight:140, outline:'none', marginTop:6 }}
              />
            </WhimsyCard>

            <button onClick={handleRollover} disabled={roLoading} style={{ ...btnPrimary, opacity:roLoading ? .6 : 1 }}>
              {roLoading ? '🌙 Thinking...' : "✨ Extract tomorrow's tasks"}
            </button>

            {rollover.length > 0 && (
              <div>
                <SectionHead label="Rolling over to tomorrow 🌅" badge="" badgeColor="" badgeBg=""/>
                <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 16px' }}>
                  {rollover.map((item, i) => (
                    <div key={i} style={{ background:'var(--white)', borderRadius:16, padding:'14px 16px', boxShadow:'0 2px 10px var(--shadow)', display:'flex', gap:12, alignItems:'flex-start', borderLeft:`4px solid ${item.priority==='high'?'var(--blush)':item.priority==='low'?'var(--moss)':'var(--toffee)'}` }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:800, marginBottom:3 }}>{item.title}</div>
                        <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>{item.note}</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:800, color:'var(--white)', background:item.priority==='high'?'var(--blush)':item.priority==='low'?'var(--moss)':'var(--toffee)', borderRadius:999, padding:'3px 8px', flexShrink:0, alignSelf:'flex-start', marginTop:2 }}>{item.priority}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:10, padding:'12px 16px 0' }}>
                  <button onClick={saveRollover} style={{ ...btnPrimary, flex:1, background:'linear-gradient(135deg,var(--moss),#5A8E50)' }}>＋ Add to my tasks</button>
                  <button onClick={() => setRollover([])} style={{ ...btnSmall, fontSize:15, padding:'14px 18px', borderRadius:16 }}>↺</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <nav aria-label="Main navigation" style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(255,253,245,0.96)', backdropFilter:'blur(12px)', borderTop:'2px solid var(--sand)', display:'flex', zIndex:500, paddingBottom:'env(safe-area-inset-bottom)' }}>
        {[
          { id:'home',      icon:'🏡', label:'Home'    },
          { id:'checklist', icon:'🌿', label:'Tasks'   },
          { id:'eod',       icon:'🌙', label:'Evening' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-label={t.label}
            aria-current={tab === t.id ? 'page' : undefined}
            style={{ flex:1, padding:'10px 4px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', fontFamily:"'Nunito',sans-serif", fontSize:10, fontWeight:800, color:tab===t.id?'var(--toffee)':'var(--muted)', WebkitTapHighlightColor:'transparent', transition:'color .15s' }}
          >
            <span aria-hidden="true" style={{ fontSize:22, lineHeight:1, display:'block', transform:tab===t.id?'scale(1.2)':'scale(1)', transition:'transform .2s cubic-bezier(.34,1.56,.64,1)' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <Toast message={toast}/>
    </div>
  )
}
