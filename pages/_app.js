import { SessionProvider } from 'next-auth/react'
import Head from 'next/head'
import { useEffect } from 'react'
import '../styles/globals.css'

async function registerPush() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')

    // Don't re-subscribe if already active
    const existing = await reg.pushManager.getSubscription()
    if (existing) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })

    await fetch('/api/push/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription: sub }),
    })
  } catch (err) {
    console.warn('[push]', err)
  }
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  useEffect(() => {
    // Delay so TOTP auth can complete before requesting permission
    const t = setTimeout(registerPush, 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <SessionProvider session={session}>
      <Head>
        <title>Morning Accountability ☀️</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☀️</text></svg>"/>
        <meta name="theme-color" content="#0B0B14"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="apple-mobile-web-app-title" content="Morning"/>
        <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☀️</text></svg>"/>
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  )
}
