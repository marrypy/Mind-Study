# MindStudy AI

An AI-ready study planner that adapts to your mood, circumstances (ADHD, mental health, sickness, weekly plans), and goals. Get a tailored study plan with suggested blocks, deadline timing, and optional medication reminders.

## Features

- **Context input**: Mood, circumstances, health, ADHD/medication timing, week plans, classes, goals, and deadlines
- **Tailored plan**: Study blocks with suggested duration and time of day, deadline tips, and considerations
- **Medication reminders**: Optional ADHD med times and notes in the plan
- **Blue & green theme** with **light/dark mode** toggle (persists in `localStorage`)
- **Accounts (Supabase)**: Sign up / log in to save your plan and see it from any device

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Copy `.env.example` to `.env` and set `VITE_MINIMAX_API_KEY` for AI plans. For auth and saving plans, add Supabase keys (see below).

### Connecting Supabase (auth + saved plans)

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard) → New project.
2. **Get URL and anon key**: Project Settings → API → Project URL and `anon` (public) key.
3. **Add to `.env`**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```
4. **Create the `study_plans` table**: In the Supabase dashboard, open **SQL Editor** and run the script in `supabase/migrations/001_study_plans.sql`. That creates the table and Row Level Security so users only see their own plans.
5. **Auth**: Sign up and log in use Supabase Auth (email + password). No extra Auth config is required for basic sign up/sign in.

## Build

```bash
npm run build
```

## Making it agentic / AI-powered

Plan generation lives in `src/lib/generatePlan.js`. Right now it’s a rule-based mock. To plug in an AI agent or API:

1. Replace or wrap the `generatePlan(context)` call in `App.jsx` with your API call.
2. Send the same `context` object (mood, circumstances, classes, goals, deadlines, med times, etc.).
3. Map the API response to the shape expected by `StudyPlan`: `{ summary, considerations, medReminders, deadlines, studyBlocks, tips }`.

The UI already supports that structure; you only need to connect your backend.
