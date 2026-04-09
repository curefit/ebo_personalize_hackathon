# EBO Smart Display MVP

React + Express smart-kiosk demo for in-store personalization, live catalog sync, admin back office operations, and AI try-on previews.

## What this project is now

This repo has two main surfaces:

- Shopper kiosk: a fast, visual in-store styling experience
- Admin back office: a protected operations flow for catalog sync and search architecture controls

The catalog no longer has to depend only on a Matrixify Excel export. There is now a Shopify storefront sync subsystem that can ingest product data into the local SQLite catalog used by the kiosk.

## End-to-end flow

### Shopper flow

1. Open the kiosk landing screen.
2. Start as a member or guest.
3. For members, use the phone lookup + static OTP demo flow.
4. For guests, answer the richer brief so the rack can be re-ranked around fit, fabric, goal, climate, budget, and notes.
5. Browse the ranked rack, inspect product details, and open try-on when desired.

### Admin flow

1. Open the back office at `/admin`.
2. Sign in with one of the dummy admin accounts.
3. Save Shopify storefront sync settings.
4. Trigger a sync to import the storefront catalog into SQLite.
5. Review sync history and search architecture posture.

## Project structure

### Frontend

- [src/App.jsx](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/App.jsx): root app shell, kiosk flow routing, and admin view switching
- [src/components/AdminConsole.jsx](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/components/AdminConsole.jsx): dummy-authenticated back office UI
- [src/components/MemberLogin.jsx](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/components/MemberLogin.jsx): member demo login flow
- [src/components/NonMemberQuestions.jsx](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/components/NonMemberQuestions.jsx): guest discovery flow
- [src/components/ProductGrid.jsx](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/components/ProductGrid.jsx): rack view
- [src/components/ProductDetails.jsx](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/components/ProductDetails.jsx): product detail overlay
- [src/components/ARPreview.jsx](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/components/ARPreview.jsx): try-on capture and preview flow
- [src/styles.css](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/styles.css): kiosk and admin visual system
- [src/services/apiClient.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/services/apiClient.js): frontend API wrapper
- [src/services/recommendationEngine.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/services/recommendationEngine.js): heuristic ranking and profile summary logic

### Backend

- [server/index.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/server/index.js): Express app, shopper APIs, admin APIs, and static serving for production/Docker
- [server/catalogDb.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/server/catalogDb.js): read-side SQLite access
- [server/catalogAdminDb.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/server/catalogAdminDb.js): write-side SQLite helpers, settings, sync runs, and migration safety
- [server/catalogSyncService.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/server/catalogSyncService.js): Shopify sync orchestration
- [server/shopifyStorefrontService.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/server/shopifyStorefrontService.js): Shopify Storefront GraphQL ingestion
- [server/adminAuth.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/server/adminAuth.js): dummy admin auth/session handling
- [server/openrouterService.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/server/openrouterService.js): try-on generation via OpenRouter

### Data and schema

- [db/schema.sql](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/db/schema.sql): products, variants, imports, admin settings, sync history
- [data/catalog.sqlite](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/data/catalog.sqlite): local persisted catalog and back office state
- [scripts/bootstrapCatalogDb.js](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/scripts/bootstrapCatalogDb.js): legacy Excel bootstrap script

## Local development

```bash
npm install
npm run dev
```

Default local URLs:

- shopper kiosk: `http://localhost:5173/`
- admin back office: `http://localhost:5173/admin`
- toy mascot studio: `http://localhost:5173/?view=toy`
- API: `http://localhost:8787`

Use Node `24.x` or newer for the backend because this project uses `node:sqlite`.

## Docker

The Docker setup builds the frontend and serves both the compiled React app and the API from a single Express process on port `8787`.

Quick start:

```bash
docker compose up --build
```

Open:

- shopper kiosk: `http://localhost:8787/`
- admin back office: `http://localhost:8787/admin`
- toy mascot studio: `http://localhost:8787/?view=toy`

Plain Docker flow:

```bash
docker build -t ebo-smart-kiosk .
docker run --rm -p 8787:8787 --env-file .env -v "$(pwd)/data:/app/data" ebo-smart-kiosk
```

Docker notes:

- `./data` is mounted so SQLite catalog data and sync history survive container restarts
- the container expects `.env` for OpenRouter and optional admin overrides
- inside Docker the catalog DB path is `/app/data/catalog.sqlite`

## Dummy admin credentials

The admin back office is intentionally protected, even in demo mode.

Default dummy accounts:

- `merch.admin / ebo1234`
- `ops.lead / ebo5678`

These are also exposed by the bootstrap API and can be overridden with `ADMIN_USERS_JSON` in `.env`.

## Shopify sync

Yes, you do need Shopify credentials for a real sync.

Required values:

- Shopify store domain, for example `your-store.myshopify.com`
- Shopify Storefront access token
- Shopify API version, for example `2025-01`

Where they are used:

- you enter them in the admin back office
- they are saved into the local SQLite-backed admin settings for this demo
- the sync worker uses them to call Shopify Storefront GraphQL and normalize product data into the local catalog DB

Important limitation:

- Shopify Storefront API is enough for product catalog ingestion
- it is not enough for true admin-grade inventory-by-location sync
- if you want exact live stock and richer operational sync, the next step is Shopify Admin API integration

Current sync behavior:

- imports product, variant, price, compare-at price, image, handle, vendor, and option data
- derives activity, fit, and material tags heuristically
- overwrites the local SQLite product catalog with the synced storefront payload
- stores sync run history in SQLite

## Search and vector DB posture

Current search mode:

- deterministic keyword filtering
- heuristic recommendation ranking
- no live vector database yet

Why that is okay for now:

- cheaper
- easier to debug
- stable for kiosk/demo usage

When to add a vector DB:

- long natural-language stylist prompts
- semantic retrieval such as “breathable travel tee with a polished silhouette”
- similarity search over richer product content and embeddings

The back office already exposes this as a “vector-ready” architecture decision, but the actual vector DB is not implemented yet.

## Legacy Excel bootstrap

The old Matrixify import path still exists:

```bash
npm run db:bootstrap -- /absolute/path/to/Export.xlsx
```

That should now be treated as a fallback/bootstrap utility, not the preferred operating model.

## API endpoints

### Shopper-facing

- `GET /api/health`
- `GET /api/experience`
- `POST /api/member/login`
- `GET /api/member/:phone`
- `GET /api/products`
- `POST /api/recommendations`
- `GET /api/inventory/:productId`
- `POST /api/tryon`

### Admin-facing

- `GET /api/admin/bootstrap`
- `POST /api/admin/login`
- `GET /api/admin/backoffice`
- `POST /api/admin/shopify/settings`
- `POST /api/admin/shopify/sync`

## Environment notes

Useful env values:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_APP_URL`
- `OPENROUTER_APP_NAME`
- `CATALOG_DB_PATH`
- `ADMIN_USERS_JSON`

## Practical usage tips

- if you only want to demo the kiosk, you can run it without Shopify sync and keep using the existing SQLite catalog
- if you want the admin console to feel real, log in with a dummy account and save real Shopify storefront credentials there
- if try-on is expected to work, make sure `OPENROUTER_API_KEY` is set before starting the app
