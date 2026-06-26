import { createHmac } from 'crypto'

/** Decode a base32 string to a Buffer (RFC 4648). */
function base32Decode(s) {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const str   = s.toUpperCase().replace(/=+$/, '')
  let bits = 0, val = 0
  const out = []
  for (const ch of str) {
    const idx = ALPHA.indexOf(ch)
    if (idx < 0) continue
    val   = (val << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** Compute the 6-digit TOTP code for a given counter step. */
function hotpCode(keyBuf, counter) {
  const buf = Buffer.alloc(8)
  // counter is a 64-bit big-endian integer; JS safe integers fit in the low 32 bits for decades
  buf.writeUInt32BE(0, 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac   = createHmac('sha1', keyBuf).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code   =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
     (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

/**
 * Verify a 6-digit TOTP token against a base32 secret.
 * Accepts ±1 time step to tolerate clock drift.
 *
 * @param {string} secret - base32-encoded secret
 * @param {string} token  - 6-digit string from the authenticator app
 * @returns {boolean}
 */
export function totpVerify(secret, token) {
  const key     = base32Decode(secret)
  const step    = Math.floor(Date.now() / 1000 / 30)
  for (let delta = -1; delta <= 1; delta++) {
    if (hotpCode(key, step + delta) === token) return true
  }
  return false
}

/**
 * Build the otpauth:// URI for QR-code setup.
 *
 * @param {string} secret  - base32-encoded secret
 * @param {string} issuer  - app name shown in the authenticator
 * @param {string} account - account label (e.g. "me")
 * @returns {string}
 */
export function totpUri(secret, issuer, account) {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
