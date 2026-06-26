import { hashPin, verifyPin, storePin, pinIsSet, validatePin } from '../../src/lib/pin'
import { PIN_KEY } from '../../src/lib/constants'

beforeEach(() => localStorage.clear())

describe('hashPin', () => {
  it('returns a consistent hash for the same input', () => {
    expect(hashPin('1234')).toBe(hashPin('1234'))
  })

  it('produces different hashes for different PINs', () => {
    expect(hashPin('1234')).not.toBe(hashPin('4321'))
    expect(hashPin('0000')).not.toBe(hashPin('9999'))
  })

  it('returns an 8-character hex string', () => {
    const h = hashPin('5678')
    expect(h).toMatch(/^[0-9a-f]{8}$/)
  })

  it('does not return the plain PIN', () => {
    expect(hashPin('1234')).not.toBe('1234')
  })
})

describe('validatePin', () => {
  it('accepts exactly 4 digits', () => {
    expect(validatePin('0000').valid).toBe(true)
    expect(validatePin('9999').valid).toBe(true)
    expect(validatePin('1234').valid).toBe(true)
  })

  it('rejects non-string input', () => {
    expect(validatePin(1234).valid).toBe(false)
    expect(validatePin(null).valid).toBe(false)
    expect(validatePin(undefined).valid).toBe(false)
  })

  it('rejects PINs shorter or longer than 4 digits', () => {
    expect(validatePin('123').valid).toBe(false)
    expect(validatePin('12345').valid).toBe(false)
    expect(validatePin('').valid).toBe(false)
  })

  it('rejects PINs with non-digit characters', () => {
    expect(validatePin('12ab').valid).toBe(false)
    expect(validatePin('12 4').valid).toBe(false)
    expect(validatePin('!@#$').valid).toBe(false)
  })

  it('returns a human-readable error message on failure', () => {
    expect(validatePin('abc').error).toContain('4 digits')
  })
})

describe('storePin / verifyPin / pinIsSet', () => {
  it('pinIsSet returns false when no PIN stored', () => {
    expect(pinIsSet()).toBe(false)
  })

  it('pinIsSet returns true after storing', () => {
    storePin('1234')
    expect(pinIsSet()).toBe(true)
  })

  it('stores a hash, not the plain PIN', () => {
    storePin('1234')
    expect(localStorage.getItem(PIN_KEY)).not.toBe('1234')
  })

  it('verifyPin returns true for correct PIN', () => {
    storePin('5678')
    expect(verifyPin('5678')).toBe(true)
  })

  it('verifyPin returns false for wrong PIN', () => {
    storePin('5678')
    expect(verifyPin('1234')).toBe(false)
    expect(verifyPin('5679')).toBe(false)
    expect(verifyPin('')).toBe(false)
  })

  it('verifyPin returns false when no PIN is stored', () => {
    expect(verifyPin('1234')).toBe(false)
  })

  it('is consistent — store then verify multiple PINs', () => {
    storePin('0000')
    expect(verifyPin('0000')).toBe(true)
    storePin('9999')
    expect(verifyPin('9999')).toBe(true)
    expect(verifyPin('0000')).toBe(false)
  })
})
