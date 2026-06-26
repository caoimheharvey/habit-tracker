import {
  createDefaultState,
  migrateStateToDay,
  loadState,
  toggleDailyTask,
  toggleOneOffTask,
  deleteOneOffTask,
  addOneOffTask,
  mergeSmartTasks,
  countDailyDone,
  allDailyDone,
  recordCompletion,
  sanitiseTitle,
} from '../../src/lib/state'
import { DAILY_TASKS, STORE_KEY } from '../../src/lib/constants'

const TODAY     = 'Mon Jan 01 2024'
const YESTERDAY = 'Sun Dec 31 2023'
const TOMORROW  = 'Tue Jan 02 2024'

// ── helpers ──────────────────────────────────────────────────────────────────
function makeState(overrides = {}) {
  return { ...createDefaultState(TODAY), ...overrides }
}

function allChecked() {
  return Object.fromEntries(DAILY_TASKS.map(t => [t.id, true]))
}

// ── createDefaultState ────────────────────────────────────────────────────────
describe('createDefaultState', () => {
  it('returns empty daily checked and one-off tasks', () => {
    const s = createDefaultState(TODAY)
    expect(s.dailyChecked).toEqual({})
    expect(s.oneOffTasks).toEqual([])
    expect(s.streak).toBe(0)
    expect(s.lastDate).toBe(TODAY)
    expect(s.photo).toBeNull()
    expect(s.smartTasksDate).toBeNull()
  })
})

// ── migrateStateToDay ─────────────────────────────────────────────────────────
describe('migrateStateToDay', () => {
  it('returns the same reference if lastDate already matches today', () => {
    const s = makeState({ lastDate: TODAY })
    expect(migrateStateToDay(s, TODAY)).toBe(s)
  })

  it('resets dailyChecked when the day changes', () => {
    const s = makeState({ lastDate: YESTERDAY, dailyChecked: { water: true } })
    const next = migrateStateToDay(s, TODAY)
    expect(next.dailyChecked).toEqual({})
    expect(next.lastDate).toBe(TODAY)
  })

  it('carries over incomplete one-off tasks', () => {
    const tasks = [
      { title: 'laundry', done: false, addedDate: YESTERDAY },
      { title: 'dentist', done: false, addedDate: YESTERDAY },
    ]
    const s = makeState({ lastDate: YESTERDAY, oneOffTasks: tasks })
    const next = migrateStateToDay(s, TODAY)
    expect(next.oneOffTasks).toHaveLength(2)
  })

  it('drops completed one-off tasks when the day changes', () => {
    const tasks = [
      { title: 'laundry', done: true,  addedDate: YESTERDAY },
      { title: 'dentist', done: false, addedDate: YESTERDAY },
    ]
    const s = makeState({ lastDate: YESTERDAY, oneOffTasks: tasks })
    const next = migrateStateToDay(s, TODAY)
    expect(next.oneOffTasks).toHaveLength(1)
    expect(next.oneOffTasks[0].title).toBe('dentist')
  })

  it('does not mutate the original state', () => {
    const s = makeState({ lastDate: YESTERDAY, dailyChecked: { water: true } })
    migrateStateToDay(s, TODAY)
    expect(s.dailyChecked).toEqual({ water: true })
  })
})

// ── loadState ─────────────────────────────────────────────────────────────────
describe('loadState', () => {
  beforeEach(() => localStorage.clear())

  it('returns default state when localStorage is empty', () => {
    const s = loadState(TODAY)
    expect(s).toMatchObject({ dailyChecked: {}, oneOffTasks: [], streak: 0 })
  })

  it('returns null during SSR (window undefined)', () => {
    const originalWindow = global.window
    delete global.window
    expect(loadState(TODAY)).toBeNull()
    global.window = originalWindow
  })

  it('returns default state when localStorage contains corrupted JSON', () => {
    localStorage.setItem(STORE_KEY, '{bad json}}}')
    const s = loadState(TODAY)
    expect(s).toMatchObject({ dailyChecked: {}, streak: 0 })
  })

  it('hydrates and migrates stale state', () => {
    const stale = { ...createDefaultState(YESTERDAY), dailyChecked: { water: true }, streak: 5, lastDate: YESTERDAY }
    localStorage.setItem(STORE_KEY, JSON.stringify(stale))
    const s = loadState(TODAY)
    expect(s.dailyChecked).toEqual({})
    expect(s.streak).toBe(5)   // streak preserved
    expect(s.lastDate).toBe(TODAY)
  })
})

// ── toggleDailyTask ───────────────────────────────────────────────────────────
describe('toggleDailyTask', () => {
  it('marks an unchecked task as checked', () => {
    const s    = makeState()
    const next = toggleDailyTask(s, 'water')
    expect(next.dailyChecked.water).toBe(true)
  })

  it('removes a checked task', () => {
    const s    = makeState({ dailyChecked: { water: true } })
    const next = toggleDailyTask(s, 'water')
    expect(next.dailyChecked.water).toBeUndefined()
  })

  it('does not mutate original state', () => {
    const s = makeState()
    toggleDailyTask(s, 'water')
    expect(s.dailyChecked).toEqual({})
  })

  it('does not affect other checked tasks', () => {
    const s    = makeState({ dailyChecked: { stretch: true } })
    const next = toggleDailyTask(s, 'water')
    expect(next.dailyChecked.stretch).toBe(true)
    expect(next.dailyChecked.water).toBe(true)
  })
})

// ── toggleOneOffTask ──────────────────────────────────────────────────────────
describe('toggleOneOffTask', () => {
  const tasks = [
    { title: 'laundry', done: false },
    { title: 'dentist', done: true  },
  ]

  it('toggles done → undone', () => {
    const s    = makeState({ oneOffTasks: tasks })
    const next = toggleOneOffTask(s, 1)
    expect(next.oneOffTasks[1].done).toBe(false)
  })

  it('toggles undone → done', () => {
    const s    = makeState({ oneOffTasks: tasks })
    const next = toggleOneOffTask(s, 0)
    expect(next.oneOffTasks[0].done).toBe(true)
  })

  it('does not affect other tasks', () => {
    const s    = makeState({ oneOffTasks: tasks })
    const next = toggleOneOffTask(s, 0)
    expect(next.oneOffTasks[1].done).toBe(true)
  })

  it('does not mutate original', () => {
    const s = makeState({ oneOffTasks: tasks })
    toggleOneOffTask(s, 0)
    expect(s.oneOffTasks[0].done).toBe(false)
  })
})

// ── deleteOneOffTask ──────────────────────────────────────────────────────────
describe('deleteOneOffTask', () => {
  it('removes the task at the given index', () => {
    const s    = makeState({ oneOffTasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] })
    const next = deleteOneOffTask(s, 1)
    expect(next.oneOffTasks).toHaveLength(2)
    expect(next.oneOffTasks.map(t => t.title)).toEqual(['A', 'C'])
  })

  it('does not mutate original', () => {
    const s = makeState({ oneOffTasks: [{ title: 'A' }] })
    deleteOneOffTask(s, 0)
    expect(s.oneOffTasks).toHaveLength(1)
  })
})

// ── addOneOffTask ─────────────────────────────────────────────────────────────
describe('addOneOffTask', () => {
  it('adds a new task', () => {
    const s    = makeState()
    const next = addOneOffTask(s, { title: 'laundry', done: false, addedDate: TODAY })
    expect(next.oneOffTasks).toHaveLength(1)
    expect(next.oneOffTasks[0].title).toBe('laundry')
  })

  it('deduplicates by title (case-insensitive)', () => {
    const s    = makeState({ oneOffTasks: [{ title: 'Laundry', done: false }] })
    const next = addOneOffTask(s, { title: 'laundry', done: false, addedDate: TODAY })
    expect(next.oneOffTasks).toHaveLength(1)
  })

  it('does not mutate original', () => {
    const s = makeState()
    addOneOffTask(s, { title: 'X', done: false, addedDate: TODAY })
    expect(s.oneOffTasks).toHaveLength(0)
  })
})

// ── mergeSmartTasks ───────────────────────────────────────────────────────────
describe('mergeSmartTasks', () => {
  const smart = [
    { title: 'Prep interview questions', note: 'Interview tomorrow', priority: 'high', triggerEvent: 'Nebius interview' },
    { title: 'Pack bag',                 note: 'Trip in 2 days',     priority: 'med',  triggerEvent: 'Amsterdam trip'   },
  ]

  it('adds all smart tasks when none exist yet', () => {
    const s = makeState()
    const { state: next, added } = mergeSmartTasks(s, smart, TODAY)
    expect(next.oneOffTasks).toHaveLength(2)
    expect(added).toBe(2)
    expect(next.smartTasksDate).toBe(TODAY)
  })

  it('skips duplicates (case-insensitive)', () => {
    const s = makeState({ oneOffTasks: [{ title: 'prep interview questions', done: false }] })
    const { state: next, added } = mergeSmartTasks(s, smart, TODAY)
    expect(next.oneOffTasks).toHaveLength(2)
    expect(added).toBe(1)
  })

  it('marks added tasks as smart=true', () => {
    const s = makeState()
    const { state: next } = mergeSmartTasks(s, smart, TODAY)
    expect(next.oneOffTasks[0].smart).toBe(true)
    expect(next.oneOffTasks[0].done).toBe(false)
  })

  it('returns added=0 when all tasks are duplicates', () => {
    const existing = smart.map(t => ({ ...t, done: false }))
    const s = makeState({ oneOffTasks: existing })
    const { added } = mergeSmartTasks(s, smart, TODAY)
    expect(added).toBe(0)
  })
})

// ── countDailyDone / allDailyDone ─────────────────────────────────────────────
describe('countDailyDone', () => {
  it('returns 0 for empty state', () => {
    expect(countDailyDone(makeState())).toBe(0)
  })

  it('counts checked tasks', () => {
    const s = makeState({ dailyChecked: { water: true, stretch: true } })
    expect(countDailyDone(s)).toBe(2)
  })
})

describe('allDailyDone', () => {
  it('returns false when not all tasks are done', () => {
    const s = makeState({ dailyChecked: { water: true } })
    expect(allDailyDone(s)).toBe(false)
  })

  it('returns true when all tasks are done', () => {
    const s = makeState({ dailyChecked: allChecked() })
    expect(allDailyDone(s)).toBe(true)
  })
})

// ── recordCompletion ──────────────────────────────────────────────────────────
describe('recordCompletion', () => {
  it('sets streak to 1 on first completion', () => {
    const s    = makeState({ streak: 0, lastCompleted: null })
    const next = recordCompletion(s, TODAY)
    expect(next.streak).toBe(1)
    expect(next.lastCompleted).toBe(TODAY)
  })

  it('increments streak when completed yesterday', () => {
    // We need yesterday relative to TODAY constant
    // Since TODAY is a fixed string, we mock by setting lastCompleted manually
    // Use a real Date to get a real yesterday
    const realToday = new Date().toDateString()
    const realYesterday = new Date()
    realYesterday.setDate(realYesterday.getDate() - 1)
    const s    = makeState({ streak: 5, lastCompleted: realYesterday.toDateString() })
    const next = recordCompletion(s, realToday)
    expect(next.streak).toBe(6)
  })

  it('resets streak to 1 when there was a gap', () => {
    const s    = makeState({ streak: 10, lastCompleted: 'Fri Dec 29 2023' })
    const next = recordCompletion(s, TODAY)
    expect(next.streak).toBe(1)
  })

  it('is idempotent — does not double-count if already completed today', () => {
    const s    = makeState({ streak: 3, lastCompleted: TODAY })
    const next = recordCompletion(s, TODAY)
    expect(next).toBe(s)
  })
})

// ── sanitiseTitle ─────────────────────────────────────────────────────────────
describe('sanitiseTitle', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitiseTitle('  laundry  ')).toBe('laundry')
  })

  it('strips control characters', () => {
    expect(sanitiseTitle('hello\x00\x1Fworld')).toBe('helloworld')
  })

  it('enforces max length of 120 characters', () => {
    expect(sanitiseTitle('a'.repeat(200))).toHaveLength(120)
  })

  it('returns empty string for whitespace-only input', () => {
    expect(sanitiseTitle('   ')).toBe('')
  })

  it('preserves valid unicode (emoji, accented chars)', () => {
    expect(sanitiseTitle('Call café 🌿')).toBe('Call café 🌿')
  })
})
