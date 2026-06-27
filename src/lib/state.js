import { DAILY_TASKS, EVENING_TASKS, STORE_KEY } from './constants'

/**
 * Returns a blank default AppState.
 * @param {string} today - result of new Date().toDateString()
 * @returns {import('../types').AppState}
 */
export function createDefaultState(today) {
  return {
    dailyChecked:    {},
    eveningChecked:  {},
    dailyFailed:     {},   // taskId → true for explicitly failed today
    eveningFailed:   {},
    failureStreaks:  {},   // taskId → consecutive fail count (persists across days)
    oneOffTasks:    [],
    streak:         0,
    lastCompleted:  null,
    lastDate:       today,
    photos:         [],
    smartTasksDate: null,
    history:        [],
  }
}

/**
 * Computes the consistency score for a given state snapshot.
 * Counts both daily habits and one-off tasks.
 *
 * @param {import('../types').AppState} state
 * @returns {{ done: number, total: number, score: number }}
 */
export function computeScore(state) {
  const dailyFailed  = Object.keys(state.dailyFailed  ?? {}).length
  const eveningFailed = Object.keys(state.eveningFailed ?? {}).length
  const dailyDone    = Object.keys(state.dailyChecked).length
  const eveningDone  = Object.keys(state.eveningChecked ?? {}).length
  // Exclude failed tasks from both numerator and denominator
  const dailyTotal   = DAILY_TASKS.length   - dailyFailed
  const eveningTotal = EVENING_TASKS.length - eveningFailed
  const oneOffDone   = state.oneOffTasks.filter(t => t.done).length
  const oneOffTotal  = state.oneOffTasks.length
  const done  = dailyDone + eveningDone + oneOffDone
  const total = dailyTotal + eveningTotal + oneOffTotal
  return { done, total, score: total > 0 ? Math.round((done / total) * 100) : 0 }
}

/**
 * Migrates state to a new day:
 * - resets daily habit checks
 * - removes completed one-off tasks (they were done, no need to carry over)
 * - updates lastDate
 *
 * Pure function — returns a new object, never mutates.
 *
 * @param {import('../types').AppState} state
 * @param {string} today
 * @returns {import('../types').AppState}
 */
export function migrateStateToDay(state, today) {
  if (state.lastDate === today) return state

  // Snapshot yesterday's score before resetting
  const { done, total, score } = computeScore(state)
  const record = { date: state.lastDate, score, done, total }
  const history = [record, ...(state.history ?? [])].slice(0, 90) // keep 90 days

  // Update failure streaks based on yesterday's outcome
  const prevFailed  = state.dailyFailed  ?? {}
  const prevChecked = state.dailyChecked ?? {}
  const prevEveningFailed  = state.eveningFailed  ?? {}
  const prevEveningChecked = state.eveningChecked ?? {}
  const streaks = { ...(state.failureStreaks ?? {}) }

  for (const t of [...DAILY_TASKS, ...EVENING_TASKS]) {
    const failed  = prevFailed[t.id] || prevEveningFailed[t.id]
    const done    = prevChecked[t.id] || prevEveningChecked[t.id]
    if (done)        streaks[t.id] = 0                      // completed → reset
    else if (failed) streaks[t.id] = (streaks[t.id] ?? 0) + 1  // failed → increment
    // not tracked (neither done nor failed) → leave streak unchanged
  }

  return {
    ...state,
    dailyChecked:   {},
    eveningChecked: {},
    dailyFailed:    {},
    eveningFailed:  {},
    failureStreaks:  streaks,
    oneOffTasks:    state.oneOffTasks.filter(t => !t.done),
    lastDate:       today,
    history,
  }
}

/**
 * Loads state from localStorage, migrating if necessary.
 * Returns null during SSR.
 *
 * @param {string} today
 * @returns {import('../types').AppState | null}
 */
export function loadState(today) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const base = parsed ?? createDefaultState(today)
    // Migrate legacy single-photo field → photos array
    if (!base.photos) {
      base.photos = base.photo ? [base.photo] : []
      delete base.photo
    }
    return migrateStateToDay(base, today)
  } catch {
    // Corrupted localStorage — start fresh
    return createDefaultState(today)
  }
}

/**
 * Persists state to localStorage.
 * @param {import('../types').AppState} state
 */
export function persistState(state) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
  } catch (e) {
    // Storage quota exceeded — fail silently but log
    console.warn('Failed to persist state:', e)
  }
}

/**
 * Toggles a daily task on or off.
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {string} taskId
 * @returns {import('../types').AppState}
 */
export function toggleDailyTask(state, taskId) {
  const checked = { ...state.dailyChecked }
  if (checked[taskId]) {
    delete checked[taskId]
  } else {
    checked[taskId] = true
  }
  return { ...state, dailyChecked: checked }
}

/**
 * Toggles a one-off task's done state.
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {number} index
 * @returns {import('../types').AppState}
 */
export function failDailyTask(state, taskId) {
  // Remove from checked if it was checked, mark as failed
  const checked = { ...state.dailyChecked }
  delete checked[taskId]
  return { ...state, dailyChecked: checked, dailyFailed: { ...(state.dailyFailed ?? {}), [taskId]: true } }
}

export function failEveningTask(state, taskId) {
  const checked = { ...state.eveningChecked }
  delete checked[taskId]
  return { ...state, eveningChecked: checked, eveningFailed: { ...(state.eveningFailed ?? {}), [taskId]: true } }
}

export function toggleEveningTask(state, taskId) {
  const checked = { ...state.eveningChecked }
  if (checked[taskId]) delete checked[taskId]
  else checked[taskId] = true
  return { ...state, eveningChecked: checked }
}

export function toggleOneOffTask(state, index) {
  const tasks = state.oneOffTasks.map((t, i) =>
    i === index ? { ...t, done: !t.done } : t
  )
  return { ...state, oneOffTasks: tasks }
}

/**
 * Removes a one-off task by index.
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {number} index
 * @returns {import('../types').AppState}
 */
export function deleteOneOffTask(state, index) {
  return {
    ...state,
    oneOffTasks: state.oneOffTasks.filter((_, i) => i !== index),
  }
}

/**
 * Adds a one-off task (deduplicates by title, case-insensitive).
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {import('../types').OneOffTask} task
 * @returns {import('../types').AppState}
 */
export function addOneOffTask(state, task) {
  const titleLower = task.title.toLowerCase()
  const exists = state.oneOffTasks.some(t => t.title.toLowerCase() === titleLower)
  if (exists) return state
  // Manual tasks get a 7-day deadline; smart tasks with a calendar-derived dueDate keep theirs
  const dueDate = task.dueDate ?? (() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10)
  })()
  return { ...state, oneOffTasks: [...state.oneOffTasks, { ...task, dueDate }] }
}

/**
 * Merges an array of smart tasks into the state, deduplicating.
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {import('../types').SmartTask[]} smartTasks
 * @param {string} today
 * @returns {{ state: import('../types').AppState, added: number }}
 */
export function mergeSmartTasks(state, smartTasks, today) {
  const existingTitles = new Set(state.oneOffTasks.map(t => t.title.toLowerCase()))
  const toAdd = smartTasks
    .filter(t => !existingTitles.has(t.title.toLowerCase()))
    .map(t => ({ ...t, done: false, addedDate: today, smart: true }))

  return {
    state: {
      ...state,
      oneOffTasks:    [...state.oneOffTasks, ...toAdd],
      smartTasksDate: today,
    },
    added: toAdd.length,
  }
}

/**
 * Returns how many daily tasks are done.
 *
 * @param {import('../types').AppState} state
 * @returns {number}
 */
export function countDailyDone(state) {
  return Object.keys(state.dailyChecked).length
}

/**
 * Checks if all daily tasks are complete.
 *
 * @param {import('../types').AppState} state
 * @returns {boolean}
 */
export function allDailyDone(state) {
  return countDailyDone(state) === DAILY_TASKS.length
}

/**
 * Updates streak when all daily tasks are completed.
 * Returns unchanged state if already completed today.
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {string} today
 * @returns {import('../types').AppState}
 */
export function recordCompletion(state, today) {
  if (state.lastCompleted === today) return state

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const wasYesterday = state.lastCompleted === yesterday.toDateString()

  return {
    ...state,
    streak:        wasYesterday ? state.streak + 1 : 1,
    lastCompleted: today,
  }
}

/**
 * Adds a photo data URL to the photos array (max 10).
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {string} dataUrl
 * @returns {import('../types').AppState}
 */
export function addPhoto(state, dataUrl) {
  if (state.photos.length >= 10) return state
  return { ...state, photos: [...state.photos, dataUrl] }
}

/**
 * Removes a photo by index.
 * Pure function.
 *
 * @param {import('../types').AppState} state
 * @param {number} index
 * @returns {import('../types').AppState}
 */
export function removePhoto(state, index) {
  return { ...state, photos: state.photos.filter((_, i) => i !== index) }
}

/**
 * Sanitises a user-supplied task title.
 * Trims whitespace, enforces max length, strips control characters.
 *
 * @param {string} raw
 * @returns {string}
 */
export function sanitiseTitle(raw) {
  return raw
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, 120)
}
