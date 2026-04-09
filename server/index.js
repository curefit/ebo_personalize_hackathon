import cors from "cors";
import express from "express";
import { getSpreadsheetCatalog, getSpreadsheetProduct, hasSpreadsheetCatalog } from "./catalogService.js";
import {
  fetchCultAppMemberByPhone,
  fetchInventoryFromMetabase,
  fetchNearbyStoresFromMetabase,
  fetchProductsFromMetabase,
} from "./metabaseService.js";
import { isMetabaseConfigured } from "./metabaseConfig.js";
import { isOpenRouterConfigured } from "./openrouterConfig.js";
import { generateTryOnImage } from "./openrouterService.js";
import { CURRENT_STORE_ID, ONLINE_DELIVERY_WINDOW } from "../src/utils/constants.js";
import { getAvailabilityTone, normalizePhoneNumber } from "../src/utils/helpers.js";
import { INVENTORY_ENTRIES, PRODUCTS, STORES } from "../src/utils/mockData.js";

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

function withStoreMeta(entry) {
  const store = STORES.find((item) => item.store_id === entry.store_id);
  return {
    ...entry,
    store_name: store?.store_name || entry.store_id,
    distance_km: store?.distance_km ?? null,
    is_primary: store?.is_primary || false,
  };
}

function summarizeStoreInventory(entries, storeId) {
  const scopedEntries = entries.filter((item) => item.store_id === storeId);
  const store = STORES.find((item) => item.store_id === storeId);

  return {
    store_id: storeId,
    store_name: store?.store_name || storeId,
    distance_km: store?.distance_km ?? null,
    totalQuantity: scopedEntries.reduce((sum, item) => sum + item.quantity, 0),
    items: scopedEntries.map((item) => ({
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    })),
  };
}

function buildInventoryResponse(productId, currentStoreId = CURRENT_STORE_ID) {
  const spreadsheetProduct = getSpreadsheetProduct(productId);
  if (spreadsheetProduct) {
    const currentStoreItems = spreadsheetProduct.variants
      .filter((variant) => Number(variant.quantity) > 0)
      .map((variant) => ({
        size: variant.size,
        color: variant.color,
        quantity: Number(variant.quantity),
      }));

    return {
      product_id: spreadsheetProduct.id,
      currentStore: {
        store_id: currentStoreId,
        store_name: "EBO - Current Store",
        distance_km: 0,
        totalQuantity: currentStoreItems.reduce((sum, item) => sum + item.quantity, 0),
        items: currentStoreItems,
      },
      nearbyStores: [],
      online: {
        available: true,
        eta: ONLINE_DELIVERY_WINDOW,
      },
    };
  }

  const entries = INVENTORY_ENTRIES.filter((item) => item.product_id === productId).map(withStoreMeta);
  const currentStore = summarizeStoreInventory(entries, currentStoreId);
  const nearbyStores = STORES.filter((store) => store.store_id !== currentStoreId)
    .map((store) => summarizeStoreInventory(entries, store.store_id))
    .filter((store) => store.totalQuantity > 0)
    .slice(0, 3);

  return {
    product_id: productId,
    currentStore,
    nearbyStores,
    online: {
      available: true,
      eta: ONLINE_DELIVERY_WINDOW,
    },
  };
}

function enrichProduct(product, currentStoreId = CURRENT_STORE_ID) {
  const inventory = buildInventoryResponse(product.id, currentStoreId);
  const totalCurrentStore = inventory.currentStore.totalQuantity;

  return {
    ...product,
    availabilityLabel:
      totalCurrentStore > 0
        ? `${totalCurrentStore} in ${inventory.currentStore.store_name}`
        : "Check nearby stores",
    availabilityTone: getAvailabilityTone(totalCurrentStore),
  };
}

async function getProducts(filters = {}) {
  if (hasSpreadsheetCatalog()) {
    const spreadsheetProducts = getSpreadsheetCatalog()
      .filter((product) => {
        const activityMatch = !filters.activity || product.activity === filters.activity;
        const fitMatch = !filters.fit || product.fit === filters.fit;
        const materialMatch =
          !filters.material ||
          `${product.material} ${product.material_tag}`.toLowerCase().includes(String(filters.material).toLowerCase());

        return activityMatch && fitMatch && materialMatch;
      })
      .map((product) => enrichProduct(product, filters.currentStoreId));

    if (spreadsheetProducts.length) {
      return spreadsheetProducts;
    }
  }

  if (isMetabaseConfigured()) {
    try {
      const metabaseProducts = await fetchProductsFromMetabase(filters);
      if (metabaseProducts.length) {
        return metabaseProducts.map((product) => enrichProduct(product, filters.currentStoreId));
      }
    } catch (error) {
      console.warn("Metabase products fetch failed. Falling back to mock data.", error.message);
    }
  }

  return PRODUCTS.filter((product) => {
    const activityMatch = !filters.activity || product.activity === filters.activity;
    const fitMatch = !filters.fit || product.fit === filters.fit;
    const materialMatch =
      !filters.material ||
      `${product.material} ${product.material_tag}`.toLowerCase().includes(String(filters.material).toLowerCase());

    return activityMatch && fitMatch && materialMatch;
  }).map((product) => enrichProduct(product, filters.currentStoreId));
}

async function getMember(phone) {
  if (isMetabaseConfigured()) {
    try {
      const metabaseMember = await fetchCultAppMemberByPhone(phone);
      if (metabaseMember) {
        const firstName = metabaseMember.firstname?.trim?.() || "";
        const lastName = metabaseMember.lastname?.trim?.() || "";
        const resolvedName = [firstName, lastName].filter(Boolean).join(" ").trim();

        return {
          phone,
          name: resolvedName || "Cult Member",
          activity: "Gym",
          fitness_level: "Member",
          preferred_fit: "Regular",
          material_preference: "Moisture-wicking",
          metabase_phone: metabaseMember.phone,
          source: "metabase",
        };
      }
    } catch (error) {
      console.warn("Metabase member fetch failed.", error.message);
    }
  }

  return null;
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    mode: isMetabaseConfigured() ? "metabase" : "mock",
    tryOn: isOpenRouterConfigured() ? "openrouter" : "disabled",
  });
});

app.post("/api/member/login", async (request, response) => {
  const phone = normalizePhoneNumber(request.body?.phone);

  if (phone.length !== 10) {
    response.status(400).json({ message: "Enter a valid 10-digit phone number." });
    return;
  }

  const member = await getMember(phone);

  if (!member) {
    response.status(404).json({
      message: "Member not found for this phone number.",
    });
    return;
  }

  response.json({ success: true, member });
});

app.get("/api/member/:phone", async (request, response) => {
  const member = await getMember(normalizePhoneNumber(request.params.phone));

  if (!member) {
    response.status(404).json({ message: "Member not found." });
    return;
  }

  response.json({ member });
});

app.get("/api/products", async (request, response) => {
  const products = await getProducts({
    activity: request.query.activity,
    fit: request.query.fit,
    material: request.query.material,
    currentStoreId: request.query.currentStoreId || CURRENT_STORE_ID,
  });

  response.json({
    products,
    source: hasSpreadsheetCatalog() ? "spreadsheet" : isMetabaseConfigured() ? "metabase-or-fallback" : "mock",
  });
});

app.get("/api/inventory/:productId", async (request, response) => {
  const { productId } = request.params;
  const currentStoreId = request.query.currentStoreId || CURRENT_STORE_ID;
  const spreadsheetProduct = getSpreadsheetProduct(productId);

  if (spreadsheetProduct) {
    response.json({
      inventory: buildInventoryResponse(productId, currentStoreId),
      source: "spreadsheet",
    });
    return;
  }

  if (isMetabaseConfigured()) {
    try {
      const inventoryRows = await fetchInventoryFromMetabase(productId, currentStoreId);
      const nearbyRows = await fetchNearbyStoresFromMetabase(currentStoreId);

      if (inventoryRows.length) {
        const stores = nearbyRows.length
          ? nearbyRows
          : STORES.filter((store) => store.store_id !== currentStoreId);

        const grouped = stores.map((store) => ({
          store_id: store.store_id,
          store_name: store.store_name,
          distance_km: store.distance_km,
          totalQuantity: inventoryRows
            .filter((item) => item.store_id === store.store_id)
            .reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          items: inventoryRows
            .filter((item) => item.store_id === store.store_id)
            .map((item) => ({
              size: item.size,
              color: item.color,
              quantity: Number(item.quantity || 0),
            })),
        }));

        response.json({
          inventory: {
            product_id: productId,
            currentStore: grouped.find((store) => store.store_id === currentStoreId) || {
              store_id: currentStoreId,
              store_name: "Current Store",
              distance_km: 0,
              totalQuantity: 0,
              items: [],
            },
            nearbyStores: grouped.filter((store) => store.store_id !== currentStoreId).slice(0, 3),
            online: {
              available: true,
              eta: ONLINE_DELIVERY_WINDOW,
            },
          },
          source: "metabase",
        });
        return;
      }
    } catch (error) {
      console.warn("Metabase inventory fetch failed. Falling back to mock data.", error.message);
    }
  }

  response.json({
    inventory: buildInventoryResponse(productId, currentStoreId),
    source: "mock",
  });
});

app.post("/api/tryon", async (request, response) => {
  const { personImage, referenceImage, productName, color, size, material, fit } = request.body || {};

  if (!personImage || !referenceImage || !productName || !color || !size) {
    response.status(400).json({ message: "Missing try-on inputs." });
    return;
  }

  if (!isOpenRouterConfigured()) {
    response.status(503).json({
      message: "OpenRouter is not configured on the server.",
    });
    return;
  }

  try {
    const result = await generateTryOnImage({
      personImage,
      referenceImage,
      productName,
      color,
      size,
      material,
      fit,
    });

    response.json({
      success: true,
      result,
    });
  } catch (error) {
    response.status(500).json({
      message: error.message || "Try-on generation failed.",
    });
  }
});

app.listen(port, () => {
  console.log(`EBO smart kiosk API listening on http://localhost:${port}`);
});
