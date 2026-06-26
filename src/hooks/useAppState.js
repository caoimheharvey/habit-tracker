import { useState, useEffect, useCallback } from 'react'
import {
  loadState,
  persistState,
  toggleDailyTask,
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

/**
 * Central state hook for the app.
 * Handles localStorage persistence and all state mutations.
 *
 * @param {{ today: string, onAllDailyDone: () => void }} options
 */
export function useAppState({ today, onAllDailyDone }) {
  const [state, setState] = useState(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setState(loadState(today))
  }, [today])

  // Persist on every change
  useEffect(() => {
    if (state) persistState(state)
  }, [state])

  /**
   * Internal updater: applies a pure transform, persists, and returns the new state.
   * @param {(prev: import('../types').AppState) => import('../types').AppState} transform
   */
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

  const handleToggleOneOff = useCallback((index) => {
    update(prev => toggleOneOffTask(prev, index))
  }, [update])

  const handleDeleteOneOff = useCallback((index) => {
    update(prev => deleteOneOffTask(prev, index))
  }, [update])

  const handleAddOneOff = useCallback((rawTitle) => {
    const title = sanitiseTitle(rawTitle)
    if (!title) return false
    update(prev => addOneOffTask(prev, {
      title,
      done:      false,
      addedDate: today,
    }))
    return true
  }, [update, today])

  /**
   * @param {import('../types').SmartTask[]} tasks
   * @returns {number} number of tasks actually added
   */
  const handleMergeSmartTasks = useCallback((tasks, smartDate = today) => {
    let addedCount = 0
    update(prev => {
      const { state: next, added } = mergeSmartTasks(prev, tasks, smartDate)
      addedCount = added
      return next
    })
    return addedCount
  }, [update, today])

  const handleAddPhoto = useCallback((dataUrl) => {
    update(prev => addPhoto(prev, dataUrl))
  }, [update])

  const handleRemovePhoto = useCallback((index) => {
    update(prev => removePhoto(prev, index))
  }, [update])

  const handleSetSmartTasksDate = useCallback((date) => {
    update(prev => ({ ...prev, smartTasksDate: date }))
  }, [update])

  return {
    state,
    dailyTaskCount:  DAILY_TASKS.length,
    handleToggleDaily,
    handleToggleOneOff,
    handleDeleteOneOff,
    handleAddOneOff,
    handleMergeSmartTasks,
    handleAddPhoto,
    handleRemovePhoto,
    handleSetSmartTasksDate,
  }
}
