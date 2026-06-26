# Morning Accountability

A personal habit tracker and morning check-in app built with Next.js. It reads your Google Calendar and Gmail to generate context-aware AI accountability nudges, suggests one-off tasks for the week, and tracks daily habit completion.

## Features

- **PIN-protected access** — simple local PIN so the app stays personal
- **Daily habit tracking** — mark habits complete with a tap; streak counter keeps you honest
- **AI morning roast** — Claude gives you a blunt, context-aware check-in based on your calendar and streak
- **Smart task suggestions** — Claude scans your calendar and unread email to surface one-off tasks you might miss
- **End-of-day rollover** — saves any unfinished one-off tasks to tomorrow

## Tech stack

- [Next.js 14](https://nextjs.org/) (Pages Router)
- [NextAuth.js](https://next-auth.js.org/) with Google OAuth
- [Google Calendar API](https://developers.google.com/calendar) + [Gmail API](https://developers.google.com/gmail/api)
- [Anthropic Claude API](https://www.anthropic.com/) (`claude-sonnet-4-6`)

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running tests

```bash
npm test
npm run test:coverage
```

## Environment variables

Create a `.env.local` file (never commit this):

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Google OAuth (see setup below)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Anthropic
ANTHROPIC_API_KEY=
```

### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add `http://localhost:3000/api/auth/callback/google` to **Authorised redirect URIs** (for local dev).
4. Enable the **Google Calendar API** and **Gmail API** in **APIs & Services → Library**.
5. Copy the Client ID and Client Secret into `.env.local`.

## Deploying to Vercel

### Required environment variables in Vercel

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Where to get it |
|---|---|
| `NEXTAUTH_URL` | Your production URL, e.g. `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` locally and paste the result |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 Client ID |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) → API Keys |

### Google OAuth — production redirect URI

Before deploying, add your production callback URL to the Google OAuth client's **Authorised redirect URIs**:

```
https://your-app.vercel.app/api/auth/callback/google
```

### Deploy

```bash
# via Vercel CLI
npx vercel --prod

# or connect the GitHub repo in the Vercel dashboard — it auto-deploys on push to main
```

No special build configuration is needed; Vercel detects Next.js automatically.
