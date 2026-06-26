import { useState, useEffect } from 'react'

export default function SetupTotp() {
  const [qr,    setQr]    = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/auth/totp-setup')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setQr(data.qrDataUrl)
      })
      .catch(() => setError('Failed to load setup data'))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #F0E8D5, #D5C49A)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, fontFamily: "'Nunito', sans-serif", color: '#3D2B1A', textAlign: 'center' }}>

      <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 26,
        marginBottom: 8 }}>Authenticator Setup</h1>
      <p style={{ fontSize: 14, color: '#8C6E56', fontWeight: 700, marginBottom: 28, maxWidth: 280, lineHeight: 1.6 }}>
        Scan this QR code with Google Authenticator, Authy, or any TOTP app.
        You only need to do this once.
      </p>

      {error && (
        <div style={{ background: '#FDECEA', border: '2px solid #C4614A', borderRadius: 16,
          padding: '14px 20px', color: '#C4614A', fontWeight: 800, fontSize: 14, maxWidth: 300 }}>
          {error}
          {error.includes('TOTP_SECRET') && (
            <p style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>
              Generate a secret by running:<br/>
              <code style={{ background: 'rgba(0,0,0,.08)', padding: '2px 6px', borderRadius: 4 }}>
                npm run generate-totp-secret
              </code>
              <br/>then add it as <strong>TOTP_SECRET</strong> in your environment variables.
            </p>
          )}
        </div>
      )}

      {qr && (
        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 8px 32px rgba(120,80,40,.2)' }}>
          <img src={qr} alt="TOTP QR code" width={220} height={220} style={{ display: 'block' }}/>
        </div>
      )}

      {qr && (
        <div style={{ marginTop: 24, background: 'rgba(255,253,245,.85)', borderRadius: 16,
          padding: '14px 20px', maxWidth: 300, lineHeight: 1.7, fontSize: 13, fontWeight: 600, color: '#8C6E56' }}>
          <strong style={{ color: '#3D2B1A' }}>Steps:</strong><br/>
          1. Open Google Authenticator<br/>
          2. Tap + → Scan a QR code<br/>
          3. Scan the code above<br/>
          4. Done — close this page
        </div>
      )}
    </div>
  )
}
