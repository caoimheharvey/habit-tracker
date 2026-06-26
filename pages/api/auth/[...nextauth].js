import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// Force NextAuth to always use the configured URL, never the per-deployment Vercel preview URL.
// Without this, VERCEL_URL leaks into the redirect_uri and breaks OAuth on every new deploy.
if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL_INTERNAL = process.env.NEXTAUTH_URL
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
          access_type: 'offline',
          prompt:      'consent',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken  = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt    = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      return session
    },
  },
}

export default NextAuth(authOptions)
