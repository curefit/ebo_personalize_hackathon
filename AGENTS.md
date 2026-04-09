# AGENTS.md

Guidance for agents working in `ebo_personalize_hackathon`.

## Purpose

- This repo is a hackathon-friendly smart kiosk MVP for in-store personalization.
- The frontend is a Vite + React app.
- The backend is a small Express server that serves member lookup, product catalog, inventory, and try-on generation APIs.
- The app is designed to work even when external integrations are unavailable by falling back to local mock data.

## Stack

- Frontend: React 18, Vite
- Backend: Express 4, Node.js ESM
- 3D/visuals: Three.js
- Data adapters: local SQLite catalog, Metabase, Excel import via `xlsx`
- Image generation: OpenRouter image-capable models

## Runbook

- Install dependencies: `npm install`
- Start both frontend and backend: `npm run dev`
- Frontend only: `npm run dev:client`
- Backend only: `npm run dev:server`
- Production-style backend start: `npm start`
- Bootstrap local catalog DB: `npm run db:bootstrap -- /absolute/path/to/Export.xlsx`
- Frontend build: `npm run build`
- Frontend preview: `npm run preview`

Default local ports:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8787`

## Repository Layout

- `src/App.jsx`: top-level screen flow and state orchestration
- `src/components/`: UI building blocks such as onboarding, recommendations, AR preview, and mascot animation
- `src/services/apiClient.js`: browser API wrapper for `/api/*`
- `src/services/recommendationEngine.js`: ranking and recommendation logic
- `src/services/metabaseService.js`: frontend-side Metabase helpers and normalization
- `src/utils/constants.js`: UI copy, store constants, option lists, and placeholder Metabase config
- `src/utils/helpers.js`: shared formatting and utility helpers
- `src/utils/mockData.js`: local demo members, products, stores, and inventory
- `server/index.js`: Express API entrypoint
- `server/catalogDb.js`: local SQLite catalog reads used by the API
- `server/catalogImport.js`: Excel-to-catalog normalization used during DB bootstrap
- `scripts/bootstrapCatalogDb.js`: imports the Shopify export into `data/catalog.sqlite`
- `server/metabase*.js`: server-side Metabase config and queries
- `server/openrouter*.js`: try-on generation config and API calls

## How The App Works

### Frontend flow

- The default path starts in `member-check`.
- Members go through phone lookup and a static OTP demo flow.
- Guests answer a 3-step onboarding questionnaire.
- Both paths end in a welcome screen and recommendation browsing flow.
- Product detail and AR preview are overlay-driven from the main app state.

### Backend data resolution order

For products:

1. Local SQLite catalog DB, if `data/catalog.sqlite` exists and contains products.
2. Metabase, if configured and returns data.
3. Local mock data from `src/utils/mockData.js`.

For members:

1. Metabase lookup by phone.
2. No mock fallback in the current backend path, so unknown members return `404`.

For try-on:

1. OpenRouter image generation, only when `OPENROUTER_API_KEY` is present.
2. Otherwise try-on remains unavailable.

## Important Files And Behaviors

- `vite.config.js` proxies `/api` requests to the local Express server.
- `server/index.js` imports constants and helpers directly from `src/`, so shared utilities affect both frontend and backend behavior.
- `server/catalogDb.js` defaults to `data/catalog.sqlite` and can be overridden with `CATALOG_DB_PATH`.
- `scripts/bootstrapCatalogDb.js` imports from `PRODUCT_EXPORT_PATH`, a CLI path argument, or a default Downloads export path.
- `README.md` currently contains an absolute path in the Metabase example link; keep docs portable when updating them.
- `server/metabaseConfig.js` currently ships with real-looking defaults. Treat config changes here carefully and prefer environment variables over additional hard-coded values.

## Environment And Configuration

The backend uses `node --env-file-if-exists=.env`, so a local `.env` is the expected place for overrides.

Useful environment variables:

- `PORT`
- `CATALOG_DB_PATH`
- `PRODUCT_EXPORT_PATH`
- `METABASE_BASE_URL`
- `METABASE_API_KEY`
- `METABASE_DATABASE_ID`
- `METABASE_PRODUCTS_QUERY_ID`
- `METABASE_MEMBERS_QUERY_ID`
- `METABASE_INVENTORY_QUERY_ID`
- `METABASE_NEARBY_STORES_QUERY_ID`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_APP_URL`
- `OPENROUTER_APP_NAME`

## Change Guidance

- Keep the demo resilient. Prefer preserving mock fallbacks unless the task is explicitly about enforcing live integrations.
- Avoid breaking the hackathon flow with heavier abstractions unless there is a clear payoff.
- Preserve the current React + plain CSS style unless the repo is already moving in a different direction.
- When changing API shapes, update both `server/index.js` and `src/services/apiClient.js` consumers together.
- When changing recommendation behavior, check both `scoreProduct` and `buildRecommendationReason` in `src/services/recommendationEngine.js`.
- When editing member or guest onboarding, keep the branch points in `src/App.jsx` consistent with component-level assumptions.
- When touching shared helpers/constants under `src/utils`, verify the backend imports are still valid.

## Verification Expectations

There is no test suite or lint script configured right now.

Minimum verification after changes:

- Run `npm run build` for frontend-impacting changes.
- Run `npm run dev` for flow changes when practical and verify the main kiosk journey still loads.
- For backend-only edits, at least start the API with `npm run dev:server` or `npm start` and hit `/api/health`.
- For try-on changes, verify behavior both with and without `OPENROUTER_API_KEY`.
- For data-source changes, verify the intended fallback order still works.

## Known Gaps / Gotchas

- Member login uses a static OTP of `0000`; this is intentional for the demo.
- Product category naming is not perfectly normalized across mock data and scoring logic, so be careful when tightening matching rules.
- Excel import depends on a `Products` sheet and specific Shopify-like column names during DB bootstrap.
- Some defaults are machine-specific, so avoid assuming paths outside the repo will exist on another machine.
- The backend returns inventory synthesized from either catalog DB variants or local mock inventory; nearby store logic only exists in the mock path.

## Branching

- Base new feature or fix branches from `master` when following the broader team workflow, unless the user explicitly asks to work from another branch for alpha or stage promotion scenarios.
- For this local repo, confirm the current default branch before branching if branch topology changes in the future.

## When In Doubt

- Prefer small, reviewable changes.
- Document any environment assumption you had to make.
- Call out secrets, absolute paths, and fallback behavior if your change touches them.
