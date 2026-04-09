# EBO Smart Display MVP

Hackathon-friendly React + Express kiosk demo for in-store personalization, stock visibility, and tee preview.

## What is included

- Member vs non-member onboarding flow
- Mock member login with backend endpoints
- Procedural Three.js welcome character
- Personalized tee recommendations
- Product details overlay
- Current store, nearby store, and online stock view
- Lightweight AR-style tee preview on a body silhouette
- Metabase-ready service layer with mock fallback

## Run locally

```bash
npm install
npm run db:bootstrap
npm run dev
```

Frontend runs on `http://localhost:5173` and the API runs on `http://localhost:8787`.

The app now reads its local catalog from `data/catalog.sqlite`. Bootstrap that DB from the Shopify export with:

```bash
npm run db:bootstrap -- /absolute/path/to/Export.xlsx
```

If no path is passed, the bootstrap script will use `PRODUCT_EXPORT_PATH` or the default Downloads export path.

## Demo flow

Use any of these member numbers:

- `9876543210` for Raj Kumar
- `9123456780` for Neha Sharma
- `9988776655` for Aman Verma

Or continue as a guest and answer the 3-step discovery flow.

## Metabase configuration

Update [`src/utils/constants.js`](/Users/ananthapadmanabhakurup/Developer/cultsport/ebo_personalize_hackathon/src/utils/constants.js) with your Metabase values:

```js
export const METABASE_CONFIG = {
  BASE_URL: "YOUR_METABASE_URL",
  API_KEY: "YOUR_METABASE_API_KEY",
  PRODUCTS_QUERY_ID: "YOUR_PRODUCTS_QUERY_ID",
  MEMBERS_QUERY_ID: "YOUR_MEMBERS_QUERY_ID",
  INVENTORY_QUERY_ID: "YOUR_INVENTORY_QUERY_ID",
  NEARBY_STORES_QUERY_ID: "YOUR_NEARBY_STORES_QUERY_ID",
};
```

If those values stay as placeholders, the app automatically falls back to the local catalog DB first, then to mock data.

## API endpoints

- `POST /api/member/login`
- `GET /api/member/:phone`
- `GET /api/products`
- `GET /api/inventory/:productId`

## Notes

- The preview experience is implemented as a lightweight 2D AR-style silhouette overlay so the demo remains reliable for the hackathon.
- The Metabase integration utilities are shared and ready to swap in once real query IDs and API credentials are available.
