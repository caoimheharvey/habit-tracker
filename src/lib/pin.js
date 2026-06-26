import { PIN_KEY } from './constants'

/**
 * Cheap deterministic hash — NOT cryptographic, just obfuscates
 * the PIN from a casual glance at DevTools / localStorage.
 * A 4-digit PIN has only 10,000 combinations so no storage-level
 * hash can be truly secure; the real protection is device lock + short PIN.
 *
 * @param {string} pin
 * @returns {string}
 */
export function hashPin(pin) {
  // djb2 variant seeded with a fixed salt
  const salted = `cosy::${pin}::morning`
  let h = 5381
  for (let i = 0; i < salted.length; i++) {
    h = ((h << 5) + h) ^ salted.charCodeAt(i)
    h >>>= 0 // keep as unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * @param {string} pin
 * @returns {boolean}
 */
export function verifyPin(pin) {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(PIN_KEY)
  if (!stored) return false
  return stored === hashPin(pin)
}

/**
 * @param {string} pin
 */
export function storePin(pin) {
  localStorage.setItem(PIN_KEY, hashPin(pin))
}

/**
 * @returns {boolean}
 */
export function pinIsSet() {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(PIN_KEY)
}

/**
 * Validates a PIN candidate before storing/checking.
 * Must be exactly 4 ASCII digits.
 *
 * @param {string} pin
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePin(pin) {
  if (typeof pin !== 'string') return { valid: false, error: 'PIN must be a string' }
  if (!/^\d{4}$/.test(pin))   return { valid: false, error: 'PIN must be exactly 4 digits' }
  return { valid: true }
}
