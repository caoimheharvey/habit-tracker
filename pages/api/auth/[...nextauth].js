import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const CANONICAL_URL = 'https://habit-tracker-caoimheaudhdhabittracker.vercel.app'

async function refreshAccessToken(token) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type:    'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })
    const refreshed = await res.json()
    if (!res.ok) throw refreshed
    return {
      ...token,
      accessToken:  refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      expiresAt:    Math.floor(Date.now() / 1000) + refreshed.expires_in,
      error:        undefined,
    }
  } catch (err) {
    console.error('[nextauth] token refresh failed:', err)
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/gmail.readonly',
          ].join(' '),
          access_type:  'offline',
          prompt:       'consent',
          redirect_uri: `${CANONICAL_URL}/api/auth/callback/google`,
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  url:    CANONICAL_URL,
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in — store tokens
      if (account) {
        return {
          ...token,
          accessToken:  account.access_token,
          refreshToken: account.refresh_token,
          expiresAt:    account.expires_at,
        }
      }

      // Token still valid (with 60s buffer)
      if (Date.now() < (token.expiresAt - 60) * 1000) {
        return token
      }

      // Access token expired — refresh it silently
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.error       = token.error
      return session
    },
  },
}

export default NextAuth(authOptions)
