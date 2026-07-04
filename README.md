# Trizodiac Authentication Backend

Express authentication system using Google OAuth, Passport.js, Supabase PostgreSQL, persistent Supabase-backed sessions, EJS, and Tailwind CSS.

## Features

- Google OAuth sign-in with Passport
- Supabase user records with Google ID, name, email, avatar, created date, last login, and admin flag
- Initial admin bootstrap for `jr.dguzman@gmail.com`
- Admin-only `/admin`, `/dashboard`, and `/settings`
- Non-admin authenticated users see only `/black`
- Persistent `express-session` storage in Supabase
- Secure HTTP-only cookies with production `secure` and `SameSite=Lax`
- Admin user search, sorting, promotion, and demotion
- CSRF protection for admin role changes
- Vercel-compatible Express export
- Order dashboard with generated waybill labels and high-resolution PNG downloads

## Local Setup

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy the environment template.

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`.

   ```bash
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   SUPABASE_URL=
   SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   SESSION_SECRET=
   PORT=3000
   INITIAL_ADMIN_EMAIL=jr.dguzman@gmail.com
   APP_TIME_ZONE=Asia/Manila
   ```

4. Run the SQL migration in Supabase SQL Editor.

   ```sql
   -- supabase/migrations/20260705000000_create_auth_tables.sql
   ```

5. Configure Google OAuth authorized redirect URIs.

   ```text
   http://localhost:3000/auth/google/callback
   https://YOUR_VERCEL_DOMAIN/auth/google/callback
   ```

6. Build CSS and start the app.

   ```bash
   npm run build
   npm start
   ```

## Vercel Deployment

Set these environment variables in Vercel for Production and Preview:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET
INITIAL_ADMIN_EMAIL
APP_TIME_ZONE
```

Deploy from the project root after linking the project:

```bash
npx vercel
npx vercel --prod
```

## Admin Behavior

The first user created with email `jr.dguzman@gmail.com` receives `is_admin = true`. Other users are created with `is_admin = false` and are redirected to `/black` after sign-in. Admins can promote and demote other users from `/admin`; the app prevents removing the last admin or demoting the currently signed-in admin account.

## Orders

Admins can create orders from `/dashboard`. The database generates unique order numbers in the format `TZ-YYYYMMDD-XXX`, with the sequence resetting by `APP_TIME_ZONE` date. Each order can be previewed as a Trizodiac waybill label, edited, deleted, and downloaded as a PNG.
