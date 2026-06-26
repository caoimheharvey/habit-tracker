import { SessionProvider } from 'next-auth/react'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Head>
        <title>Morning Accountability ☀️</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☀️</text></svg>"
        />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  )
}
