import { METABASE_CONFIG } from "../utils/constants.js";

function isPlaceholder(value) {
  return !value || String(value).startsWith("YOUR_");
}

export function isMetabaseConfigured() {
  return !Object.values(METABASE_CONFIG).some(isPlaceholder);
}

function normalizeMetabaseResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload?.data) {
    return [];
  }

  const rows = payload.data.rows || [];
  const cols = payload.data.cols || [];

  if (!rows.length) {
    return [];
  }

  if (typeof rows[0] === "object" && !Array.isArray(rows[0])) {
    return rows;
  }

  return rows.map((row) =>
    row.reduce((accumulator, value, index) => {
      const key = cols[index]?.name || `column_${index}`;
      accumulator[key] = value;
      return accumulator;
    }, {}),
  );
}

export async function fetchFromMetabase(queryId, parameters = {}) {
  if (!isMetabaseConfigured()) {
    throw new Error("Metabase configuration is incomplete.");
  }

  const response = await fetch(`${METABASE_CONFIG.BASE_URL}/api/card/${queryId}/query/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": METABASE_CONFIG.API_KEY,
    },
    body: JSON.stringify({ parameters }),
  });

  if (!response.ok) {
    throw new Error(`Metabase request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return normalizeMetabaseResponse(payload);
}

export function fetchProductsFromMetabase(parameters = {}) {
  return fetchFromMetabase(METABASE_CONFIG.PRODUCTS_QUERY_ID, parameters);
}

export function fetchMemberFromMetabase(phone) {
  return fetchFromMetabase(METABASE_CONFIG.MEMBERS_QUERY_ID, { phone });
}

export function fetchInventoryFromMetabase(productId, currentStoreId) {
  return fetchFromMetabase(METABASE_CONFIG.INVENTORY_QUERY_ID, {
    product_id: productId,
    store_id: currentStoreId,
  });
}

export function fetchNearbyStoresFromMetabase(currentStoreId) {
  return fetchFromMetabase(METABASE_CONFIG.NEARBY_STORES_QUERY_ID, {
    store_id: currentStoreId,
  });
}
