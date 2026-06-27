import { useState, useEffect, useCallback, useRef } from 'react'
import {
  loadState,
  persistState,
  migrateStateToDay,
  toggleDailyTask,
  toggleEveningTask,
  failDailyTask,
  failEveningTask,
  toggleOneOffTask,
  deleteOneOffTask,
  addOneOffTask,
  mergeSmartTasks,
  allDailyDone,
  recordCompletion,
  sanitiseTitle,
  addPhoto,
  removePhoto,
} from '../lib/state'
import { DAILY_TASKS } from '../lib/constants'

const SAVE_DEBOUNCE_MS = 500

async function fetchServerState() {
  try {
    const res = await fetch('/api/state')
    if (!res.ok) return null
    const { state } = await res.json()
    return state ?? null
  } catch {
    return null
  }
}

async function saveServerState(state) {
  try {
    await fetch('/api/state', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ state }),
    })
  } catch {
    // localStorage is the fallback — fail silently
  }
}

/**
 * Central state hook for the app.
 * Uses localStorage as an instant-load cache and Vercel KV as the
 * cross-device source of truth. Changes are debounced 1.5s before
 * being written to the server.
 *
 * @param {{ today: string, onAllDailyDone: () => void }} options
 */
export function useAppState({ today, onAllDailyDone }) {
  const [state, setState] = useState(null)
  const saveTimer = useRef(null)
  // Prevent the initial server-state load from triggering a redundant save
  const isInitialServerLoad = useRef(false)

  // 1. Hydrate from localStorage immediately (instant)
  useEffect(() => {
    setState(loadState(today))
  }, [today])

  // 2. Load from server and re-sync whenever the tab/app regains focus
  const loadFromServer = useCallback(() => {
    let cancelled = false
    fetchServerState().then(serverState => {
      if (cancelled || !serverState) return
      isInitialServerLoad.current = true
      setState(prev => {
        const migrated = migrateStateToDay(serverState, today)
        const merged = {
          ...migrated,
          photos: migrated.photos?.length ? migrated.photos : (prev?.photos ?? []),
        }
        persistState(merged)
        return merged
      })
    })
    return () => { cancelled = true }
  }, [today])

  useEffect(() => {
    if (!state) return
    const cleanup = loadFromServer()
    // Re-sync from Redis whenever the user switches back to this tab/app
    const onFocus = () => loadFromServer()
    window.addEventListener('focus', onFocus)
    return () => { cleanup?.(); window.removeEventListener('focus', onFocus) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Persist to localStorage and debounce-save to server on every change
  useEffect(() => {
    if (!state) return
    persistState(state)

    // Skip the server save triggered by the initial server load itself
    if (isInitialServerLoad.current) {
      isInitialServerLoad.current = false
      return
    }

    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveServerState(state), SAVE_DEBOUNCE_MS)
  }, [state])

  const update = useCallback((transform) => {
    setState(prev => {
      if (!prev) return prev
      const next = transform(prev)
      persistState(next)
      return next
    })
  }, [])

  const handleToggleDaily = useCallback((taskId) => {
    update(prev => {
      const next = toggleDailyTask(prev, taskId)
      if (allDailyDone(next)) {
        const withStreak = recordCompletion(next, today)
        onAllDailyDone()
        return withStreak
      }
      return next
    })
  }, [update, today, onAllDailyDone])

  const handleToggleEvening  = useCallback((taskId) => update(prev => toggleEveningTask(prev, taskId)), [update])
  const handleFailDaily      = useCallback((taskId) => update(prev => failDailyTask(prev, taskId)),    [update])
  const handleFailEvening    = useCallback((taskId) => update(prev => failEveningTask(prev, taskId)),  [update])
  const handleToggleOneOff  = useCallback((index) => update(prev => toggleOneOffTask(prev, index)), [update])
  const handleDeleteOneOff  = useCallback((index) => update(prev => deleteOneOffTask(prev, index)), [update])

  const handleAddOneOff = useCallback((rawTitle) => {
    const title = sanitiseTitle(rawTitle)
    if (!title) return false
    update(prev => addOneOffTask(prev, { title, done: false, addedDate: today }))
    return true
  }, [update, today])

  const handleMergeSmartTasks = useCallback((tasks, smartDate = today) => {
    let addedCount = 0
    update(prev => {
      const { state: next, added } = mergeSmartTasks(prev, tasks, smartDate)
      addedCount = added
      return next
    })
    return addedCount
  }, [update, today])

  const handleAddPhoto    = useCallback((dataUrl) => update(prev => addPhoto(prev, dataUrl)),    [update])
  const handleRemovePhoto = useCallback((index)   => update(prev => removePhoto(prev, index)),   [update])

  const handleSetSmartTasksDate = useCallback((date) => {
    update(prev => ({ ...prev, smartTasksDate: date }))
  }, [update])

  return {
    state,
    dailyTaskCount: DAILY_TASKS.length,
    handleToggleDaily,
    handleToggleEvening,
    handleFailDaily,
    handleFailEvening,
    handleToggleOneOff,
    handleDeleteOneOff,
    handleAddOneOff,
    handleMergeSmartTasks,
    handleAddPhoto,
    handleRemovePhoto,
    handleSetSmartTasksDate,
  }
}
