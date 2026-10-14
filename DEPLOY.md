# Deploying to Vercel

The site stores nothing on Vercel's disk (it's read-only/ephemeral). Three things are connected instead:

| What | Service | Why |
| --- | --- | --- |
| RSVPs, tasks, votes, notifications, push subscriptions | **Upstash Redis** | database |
| Photos, voice memos, videos | **Vercel Blob** | file storage (phones upload straight to it) |
| The 20-minute task reminders | **cron-job.org** (free) | pings `/api/cron/tick` every minute |

## 1. Connect the database
Vercel dashboard → your project → **Storage** → **Create Database** → **Upstash** → **Redis** (free plan) → connect it to this project.
This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically (the code reads those or the `UPSTASH_REDIS_REST_*` names).

## 2. Connect file storage
Same **Storage** tab → **Create Database** → **Blob** → connect to this project. This adds `BLOB_READ_WRITE_TOKEN`.

## 3. Environment variables
Project → **Settings** → **Environment Variables** (Production). Values for the first four are in your local `.env.local`:

| Name | Value |
| --- | --- |
| `ADMIN_PASSWORD` | the admin login password |
| `ADMIN_SECRET` | long random string (signs the admin cookie) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | push notification keys |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | long random string (protects the cron endpoint) |

## 4. Redeploy
Deployments → the latest one → **Redeploy** (env vars only apply to new deployments).

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
- `/admin/tasks` shows subscribed phones; use **Start now (test run)** and watch Task 1 arrive within a minute.
- iPhones: guests must **Add to Home Screen** first, then turn reminders on from the Tasks section. Everyone needs https (Vercel provides it).

## Local development
Without the variables above, everything falls back to a JSON file in `./data` and local disk uploads, so `npm run dev` works with no accounts. Trigger reminders locally with
`curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/tick`.
