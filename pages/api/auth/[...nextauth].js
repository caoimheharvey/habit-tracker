import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const CANONICAL_URL = 'https://habit-tracker-caoimheaudhdhabittracker.vercel.app'

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
  secret:  process.env.NEXTAUTH_SECRET,
  // Tell NextAuth to use the stable URL for all internal URL construction
  url: CANONICAL_URL,
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
