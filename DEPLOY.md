# Deploying to Vercel

The site stores nothing on Vercel's disk (it's read-only/ephemeral). Three things are connected instead:

| What | Service | Why |
| --- | --- | --- |
| RSVPs, tasks, votes, notifications, push subscriptions | **Upstash Redis** | database |
| Photos, voice memos, videos | **Vercel Blob** | file storage (phones upload straight to it) |
| The task alerts (every 20 minutes by default; the hosts set the rhythm in `/admin/tasks`) | **cron-job.org** (free) | pings `/api/cron/tick` every minute |

## 1. Connect the database
Vercel dashboard → your project → **Storage** → **Create Database** → **Upstash** → **Redis** (free plan) → connect it to this project.
This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically (the code reads those or the `UPSTASH_REDIS_REST_*` names).

## 2. Connect file storage
Same **Storage** tab → **Create Database** → **Blob** (private) → connect to this project. This adds `BLOB_STORE_ID`
(Vercel's keyless access); older stores add `BLOB_READ_WRITE_TOKEN` instead. The code accepts either.

## 3. Environment variables
Project → **Settings** → **Environment Variables**, tick **Production**. The values are in your local `.env.local`.
Preview deployments don't need them: previews never use the database or file storage (see "Preview deployments" below).

| Name | Value |
| --- | --- |
| `ADMIN_PASSWORD` | the admin login password |
| `ADMIN_SECRET` | long random string (signs the admin cookie) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | push notification keys |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | long random string (protects the cron endpoint) |

## 4. Redeploy
Deployments → the latest one → **Redeploy** (env vars only apply to new deployments). Do the same whenever you change
one later, for example a new admin password. A new password does not sign out an admin who is already logged in
(sessions last 8 hours); a new `ADMIN_SECRET` does.

From a terminal with the Vercel CLI logged in (`vercel link` refuses `--scope` when it can't ask, so name the project
with two variables instead):

```bash
export VERCEL_ORG_ID=<team id> VERCEL_PROJECT_ID=<project id>   # both from: vercel project inspect <project> --scope <team>
grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '\r\n' | vercel env add ADMIN_PASSWORD production --force
vercel ls --prod                                                 # the current production deployment
vercel redeploy <that deployment's url> --target production
```

## 5. Start the reminder timer
Vercel's free plan can't run a job every minute, so use a free external pinger:

1. Create an account at <https://cron-job.org>.
2. New cron job:
   - URL: `https://YOUR-SITE.vercel.app/api/cron/tick`
   - Schedule: every **1 minute**
   - Advanced → Headers → `Authorization` = `Bearer YOUR_CRON_SECRET`
3. Save. Each call returns JSON like `{"ok":true,"due":[],"announced":null}`; when a task's time arrives it returns `"announced": 0` etc. and phones get the notification.

(On Vercel Pro you can instead add `"crons": [{ "path": "/api/cron/tick", "schedule": "* * * * *" }]` to `vercel.json`; Vercel sends the `Authorization` header itself when `CRON_SECRET` is set.)

## 6. Check it
- Open the site, submit an RSVP, then look at `/admin`.
- `/admin/event`: the times (in the event's timezone), the RSVP deadline and which features are on.
- `/admin/tasks` shows subscribed phones; use **Start now (test run)** and watch Task 1 arrive within a minute.
- iPhones: guests must **Add to Home Screen** first, then turn reminders on (the site asks after their first task, and
  on the Tasks screen). Everyone needs https (Vercel provides it).

## Preview deployments
Every branch pushed to GitHub gets a preview link. Previews keep their data in memory and refuse uploads, even though
Vercel may hand them the production database and Blob credentials, so testing a branch never touches the real event.
Set `ALLOW_PREVIEW_WRITES=1` on a preview only if it has its own database and Blob store. A switch at
`/api/preview/chapter?to=before|during|after|live` (previews only) shows any chapter for review. Previews sit behind
Vercel's login, and the admin works there only if `ADMIN_PASSWORD` and `ADMIN_SECRET` are also set for Preview.

## Local development
Without the variables above, everything falls back to a JSON file in `./data` and local disk uploads, so `npm run dev` works with no accounts. Trigger reminders locally with
`curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/tick`.
Tests: `npm run build`, then `npm run start:e2e` (the production build on :3100 with a test clock), then the suites in
`tests/e2e/` (see BLUEPRINT.md section 10).
