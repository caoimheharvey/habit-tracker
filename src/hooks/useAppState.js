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

export function useAppState({ today, onAllDailyDone }) {
  const [state, setState] = useState(null)
  const saveTimer          = useRef(null)
  const skipNextSave       = useRef(false)  // set true when we receive a server load so we don't echo it back
  const serverSyncDone     = useRef(false)  // ensure we only register the focus listener once

  // 1. Load from localStorage immediately on mount
  useEffect(() => {
    setState(loadState(today))
  }, [today])

  // 2. Merge server state into local state (always prefer server as source of truth)
  const applyServerState = useCallback((serverState) => {
    if (!serverState) return
    skipNextSave.current = true
    setState(prev => {
      const migrated = migrateStateToDay(serverState, today)
      const merged = {
        ...migrated,
        photos: migrated.photos?.length ? migrated.photos : (prev?.photos ?? []),
      }
      persistState(merged)
      return merged
    })
  }, [today])

  const syncFromServer = useCallback(() => {
    fetchServerState().then(applyServerState)
  }, [applyServerState])

  // 3. Once local state is ready, do the initial server sync and register focus listener
  useEffect(() => {
    if (!state || serverSyncDone.current) return
    serverSyncDone.current = true

    syncFromServer()

    const onFocus = () => syncFromServer()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [state, syncFromServer])

  // 4. Save to localStorage + debounce-save to Redis on every state change
  useEffect(() => {
    if (!state) return
    persistState(state)

    if (skipNextSave.current) {
      skipNextSave.current = false
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
  const handleToggleOneOff   = useCallback((index)  => update(prev => toggleOneOffTask(prev, index)),  [update])
  const handleDeleteOneOff   = useCallback((index)  => update(prev => deleteOneOffTask(prev, index)),  [update])

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
