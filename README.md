# Landis Dashboard

A Next.js homework tracker that reads from the Canvas API: assignments, grades,
missing work, a schedule, and a nightly checklist.

## Setup

```bash
cp .env.example .env.local   # fill in your own values; never commit it
npm install
npm run dev
```

`APP_MODE=sample` serves fixture data only. `APP_MODE=live` serves real Canvas
data and requires `SITE_PASSWORD`.
