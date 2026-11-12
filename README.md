# Forge — Workout Tracker

An iPhone-first fitness PWA: log workouts set by set, follow a weekly split, track PRs,
body weight, measurements and progress photos. Installable to the home screen and works offline.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN for testing on an iPhone)
npm test           # unit tests (domain logic, store, backups)
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build on :4173
npm run e2e        # end-to-end flows at iPhone size (needs `npm run preview` running; uses local Edge/Chrome)
npm run e2e:webkit # same flows on WebKit (one-off: npx playwright-core install webkit)
```

`npm run deploy` builds the app and publishes it to the `gh-pages` branch, which GitHub Pages serves.
The build uses relative paths, so it works at any URL (for example `https://<user>.github.io/GymApp/`).

To try it on an iPhone, deploy `dist/` to any static HTTPS host (Netlify, Vercel, Cloudflare Pages,
GitHub Pages…), open it in Safari, then **Share → Add to Home Screen**. Service workers need HTTPS
(localhost is the only exception).

## Architecture

```
src/
  domain/      Pure TypeScript: types, PR detection, e1RM, stats, streaks, units, workout edit ops.
               No React, no storage — fully unit-tested.
  data/        Exercise library (143 exercises), home routines, split presets, sample-data generator.
  store/       Zustand stores. useData = persisted user data; useUI = ephemeral UI state;
               selectors = memoised derived data (PRs, today's plan, exercise lookup).
  lib/         Router (hash-based, iOS tab stacks), IndexedDB photo storage, audio/haptics, backups.
  ui/          Reusable components: Screen (collapsing large title), Sheet, dialogs, charts, controls, icons.
  features/    Screens: home, workouts, session (live logger), workout (shared set editor),
               progress, library (+ animated exercise figures), profile, exercises (picker),
               nutrition (onboarding, targets dashboard, food log).
```

Key decisions:

- **Minimal dependencies.** Runtime deps are React and Zustand only. Charts, icons, router, animations
  and the service worker are hand-written for size and control.
- **Derived, not stored.** PRs, streaks and stats are computed from workout history, so editing or
  deleting a workout can never leave stale records behind.
- **Canonical units.** Weights are stored in kg and lengths in cm; conversion happens only in the UI.
- **One editor.** The live session and history editing share `WorkoutEditor` and the pure ops in
  `domain/workoutOps.ts`.
- **Resilient sessions.** The active workout and the rest timer (stored as an end timestamp) persist,
  so a reload or iOS killing the app never loses a workout.
- **Exercise demos** are SVG figures driven by joint-angle keyframes (`features/library/figure`).
  `debug.html` (dev server only) renders every pattern's keyframes for visual checking.

## Home workouts

The Library's **Home** section lists 114 exercises you can do without a gym, in four groups:
Bodyweight, Dumbbell, Resistance Band, and Cardio & HIIT (all no-equipment). A second row of
chips narrows any group to a body area (chest, back, shoulders, arms, legs, abs, full body).

- **Levels.** Every exercise and routine is Beginner, Intermediate or Advanced, and each group
  lists them in that order, so the easier and harder versions of a movement sit together
  (knee → incline → regular → decline → archer push-up).
- **Alternatives.** Each exercise links to swaps for when you lack the equipment or need it easier
  or harder. Every exercise that needs equipment offers at least one you can do without any
  (household items such as a chair, table, wall or towel count as no equipment).
- **No duplicates.** Gym exercises that need only home equipment (pull-up, plank, lateral raise,
  hammer curl…) are listed in Home too, rather than being copied.
- **Routines.** 15 ready-made home routines across the three levels, for no equipment, dumbbells
  or a band. Each saves as a normal routine.
- **Data.** Exercises are defined in `src/data/exercises.ts` and `exercises.home.ts`. Level, body
  area, alternatives and Home listing for every exercise live in `src/data/exerciseMeta.ts`.
  `exerciseMeta.test.ts` checks that every exercise has metadata, an animation and Arabic text,
  that alternatives point to real exercises, and that the library covers every area and level.

## Nutrition

On first launch a short questionnaire sets personal daily calorie and macro targets (goal, gender,
age, height, weight, activity level, optional target weight) and picks a weekly training split that
starts today. Both are required before entering the app (`src/lib/onboarding.ts` decides which
questions are still needed). The Nutrition tab (also reachable from the Home card) shows the
targets, what has been eaten, what is left, and the day's food log.

- **Method** (`src/domain/nutrition.ts`): resting energy from the Mifflin-St Jeor equation, times a
  standard activity factor (1.2 / 1.375 / 1.55 / 1.725) for maintenance calories, then a goal
  adjustment: lose −20%, build muscle +10%, maintain 0, gain +15%.
- **Macros:** protein from body weight (1.6–2.0 g/kg by goal), fat as 25–30% of calories,
  carbohydrate from the remainder.
- **Safeguards:** a deficit never goes below 1,200 kcal (women) or 1,500 kcal (men), under-18s never
  get a deficit, and protein is capped for very high body weights.
- **Derived, not stored:** only the answers are saved. Targets are recalculated from them and the
  latest body-weight entry, so logging a new weight or editing the plan updates them immediately.
- Foods are entered by hand (name, calories, macros). There is no food database or recipes.

## Languages

English and Arabic (`src/i18n`). `en.ts` defines every key; `ar.ts` must cover all of them,
and the tests enforce this, Arabic plural forms included. Exercise content lives in
`src/data/exercises.ar.ts` and `src/data/exercises.home.ar.ts`. Arabic switches the layout to right-to-left (`src/styles/rtl.css`).

Arabic text uses the beIN Normal font (`src/assets/fonts/beIN-Normal.ttf`). It is loaded only for
Arabic characters. That font has no diacritic positioning, so Arabic UI text is shown without
tashkeel (`plainArabic` in `src/i18n`). The font belongs to beIN Media Group, so make sure your use
is licensed.

## Storage and adding a backend

- User data persists to `localStorage` via `store/storage.ts` (schema-versioned, with a `migrate` hook).
- Progress photos are compressed to JPEG and stored in IndexedDB (`lib/photoDb.ts`) as raw bytes,
  because some WebKit builds reject Blob values in IndexedDB.
- Every entity has a string UUID, so records can sync without remapping.

To add an account and sync, replace `safeStorage` in `store/storage.ts` with an adapter that writes
through to your API (or move the store actions to call an API layer), and add auth around `App`.
The JSON export format in `lib/backup.ts` is a ready-made sync and migration payload.

## Data safety

Profile → **Export backup** downloads all data as JSON. Photos are not included in backups.
Installing to the home screen also exempts the app from Safari's 7-day storage eviction.
