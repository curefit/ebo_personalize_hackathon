import { SERVER_METABASE_CONFIG, isMetabaseConfigured } from "./metabaseConfig.js";

function normalizeRows(payload) {
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

async function metabaseRequest(path, body) {
  if (!isMetabaseConfigured()) {
    throw new Error("Metabase configuration is incomplete.");
  }

  const response = await fetch(`${SERVER_METABASE_CONFIG.BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERVER_METABASE_CONFIG.API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Metabase request failed with status ${response.status}`);
  }

  return response.json();
}

export async function queryMetabaseNative(sql) {
  const payload = await metabaseRequest("/api/dataset", {
    database: SERVER_METABASE_CONFIG.DATABASE_ID,
    type: "native",
    native: {
      query: sql,
    },
  });

  return normalizeRows(payload);
}

export async function fetchFromMetabaseCard(queryId, parameters = {}) {
  const payload = await metabaseRequest(`/api/card/${queryId}/query/json`, { parameters });
  return normalizeRows(payload);
}

export async function fetchCultAppMemberByPhone(phone) {
  const sanitized = String(phone).replace(/\D/g, "");

  if (sanitized.length !== 10) {
    return null;
  }

  const rows = await queryMetabaseNative(`
    select
      phone,
      firstname,
      lastname,
      isphoneverified,
      updatedat
    from pk_cfuserservice_cultapp.user
    where regexp_replace(coalesce(phone, ''), '[^0-9]', '') in ('${sanitized}', '91${sanitized}')
    order by isphoneverified desc, updatedat desc
    limit 1
  `);

  if (!rows[0]) {
    return null;
  }

  return rows[0];
}

export function fetchProductsFromMetabase(parameters = {}) {
  if (!SERVER_METABASE_CONFIG.PRODUCTS_QUERY_ID) {
    throw new Error("Products query ID is not configured.");
  }

  return fetchFromMetabaseCard(SERVER_METABASE_CONFIG.PRODUCTS_QUERY_ID, parameters);
}

export function fetchInventoryFromMetabase(productId, currentStoreId) {
  if (!SERVER_METABASE_CONFIG.INVENTORY_QUERY_ID) {
    throw new Error("Inventory query ID is not configured.");
  }

  return fetchFromMetabaseCard(SERVER_METABASE_CONFIG.INVENTORY_QUERY_ID, {
    product_id: productId,
    store_id: currentStoreId,
  });
}

export function fetchNearbyStoresFromMetabase(currentStoreId) {
  if (!SERVER_METABASE_CONFIG.NEARBY_STORES_QUERY_ID) {
    throw new Error("Nearby stores query ID is not configured.");
  }

  return fetchFromMetabaseCard(SERVER_METABASE_CONFIG.NEARBY_STORES_QUERY_ID, {
    store_id: currentStoreId,
  });
}
