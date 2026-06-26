import { renderHook, act } from '@testing-library/react'
import { usePin } from '../../src/hooks/usePin'
import { storePin } from '../../src/lib/pin'
import { PIN_KEY } from '../../src/lib/constants'

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('usePin — no PIN stored (setup flow)', () => {
  it('starts in setup mode when no PIN exists', () => {
    const { result } = renderHook(() => usePin())
    expect(result.current.mode).toBe('setup')
  })

  it('accumulates digits in setup mode', () => {
    const { result } = renderHook(() => usePin())
    act(() => { result.current.onDigit('1') })
    act(() => { result.current.onDigit('2') })
    expect(result.current.input).toBe('12')
  })

  it('moves to confirm mode after 4 digits in setup', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) })
    expect(result.current.mode).toBe('confirm')
    expect(result.current.input).toBe('')
  })

  it('unlocks after correct confirmation', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) }) // setup
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) }) // confirm
    expect(result.current.mode).toBe('unlocked')
  })

  it('returns to setup with error if confirmation does not match', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) }) // setup
    act(() => { '5678'.split('').forEach(d => result.current.onDigit(d)) }) // wrong confirm
    expect(result.current.error).toBeTruthy()
    expect(result.current.shaking).toBe(true)
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.mode).toBe('setup')
    expect(result.current.shaking).toBe(false)
  })

  it('stores the PIN in localStorage after setup', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) })
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) })
    expect(localStorage.getItem(PIN_KEY)).toBeTruthy()
    expect(localStorage.getItem(PIN_KEY)).not.toBe('1234') // stored as hash
  })
})

describe('usePin — PIN already stored (locked flow)', () => {
  beforeEach(() => storePin('9876'))

  it('starts in locked mode when PIN exists', () => {
    const { result } = renderHook(() => usePin())
    expect(result.current.mode).toBe('locked')
  })

  it('unlocks with the correct PIN', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '9876'.split('').forEach(d => result.current.onDigit(d)) })
    expect(result.current.mode).toBe('unlocked')
    expect(result.current.error).toBe('')
  })

  it('shakes and shows error for wrong PIN', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) })
    expect(result.current.shaking).toBe(true)
    expect(result.current.error).toBeTruthy()
  })

  it('clears input after wrong PIN after shake duration', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) })
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.input).toBe('')
    expect(result.current.shaking).toBe(false)
  })

  it('does not accept additional input while shaking', () => {
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) }) // wrong PIN -> shaking
    expect(result.current.shaking).toBe(true)
    const inputBeforeExtra = result.current.input
    act(() => { result.current.onDigit('9') }) // should be ignored while shaking
    // The extra digit must not be appended
    expect(result.current.input).toBe(inputBeforeExtra)
  })
})

describe('usePin — delete and lock', () => {
  it('deletes the last digit with onDelete', () => {
    const { result } = renderHook(() => usePin())
    act(() => { result.current.onDigit('1') })
    act(() => { result.current.onDigit('2') })
    act(() => { result.current.onDelete() })
    expect(result.current.input).toBe('1')
  })

  it('does nothing on delete when input is empty', () => {
    const { result } = renderHook(() => usePin())
    act(() => { result.current.onDelete() })
    expect(result.current.input).toBe('')
  })

  it('lock() sets mode to locked and clears input', () => {
    storePin('1234')
    const { result } = renderHook(() => usePin())
    act(() => { '1234'.split('').forEach(d => result.current.onDigit(d)) }) // unlock
    expect(result.current.mode).toBe('unlocked')
    act(() => { result.current.lock() })
    expect(result.current.mode).toBe('locked')
    expect(result.current.input).toBe('')
  })
})
