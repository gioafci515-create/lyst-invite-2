# UN/FOLD 2026: the living invitation

The invitation site for UN/FOLD 2026 (LYST). One invitation that lives through the event in three chapters: the
invitation before the night, the night itself, and the memory after it. Guests reply, take part during the evening
(camera, voice, video, live room, tasks with phone alerts) and find the gallery, their messages "for later" and the time
capsule afterwards. The hosts run everything from `/admin`.

Built with Next.js 16 (App Router), React 19 and TypeScript; deployed on Vercel with Upstash Redis and Vercel Blob.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000, no accounts needed (data in ./data, uploads on disk)
```

Copy `.env.example` to `.env.local` and fill in at least `ADMIN_PASSWORD` and `ADMIN_SECRET` to use `/admin`.

## Check it

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
npm run start:e2e      # the production build on :3100, server clock at 12 Nov 2026 (FAKE_NOW to change it)
node tests/e2e/lifecycle.e2e.mjs   # and the other suites in tests/e2e/
```

## Where to read more

- [BLUEPRINT.md](BLUEPRINT.md): how it is built, the repository map, every recipe and trap, the QA protocol.
- [DEPLOY.md](DEPLOY.md): putting it on Vercel, step by step, and changing settings later.
- [docs/redesign-review/](docs/redesign-review/): screenshots and notes from each review round.
- [AGENTS.md](AGENTS.md): this Next.js version differs from older ones; read its docs in `node_modules/next/dist/docs/`.
