import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAdminUsersPreview, loginAdmin, requireAdmin } from "./adminAuth.js";
import { getBackOfficeSnapshot, runShopifySync, saveShopifySettings } from "./catalogSyncService.js";
import {
  countCatalogProducts,
  getCatalogProduct,
  getCatalogProductIdsBySkus,
  getCatalogProducts,
  hasCatalogDatabase,
} from "./catalogDb.js";
import { getCohortRecommendedSkus } from "./cohortRecommendationService.js";
import {
  fetchCultAppMemberByPhone,
  fetchItemDetailsSummaryBySkus,
  fetchInventoryFromMetabase,
  fetchNearbyStoresFromMetabase,
  fetchProductsFromMetabase,
  fetchUserCohortByUserId,
} from "./metabaseService.js";
import { isMetabaseConfigured } from "./metabaseConfig.js";
import { isOpenRouterConfigured } from "./openrouterConfig.js";
import { generateTryOnImage } from "./openrouterService.js";
import { getRecommendations, summarizeProfile } from "../src/services/recommendationEngine.js";
import { CURRENT_STORE_ID, ONLINE_DELIVERY_WINDOW } from "../src/utils/constants.js";
import { inferProductGender } from "../src/utils/queryIntent.js";
import { getAvailabilityTone, normalizePhoneNumber } from "../src/utils/helpers.js";
import { INVENTORY_ENTRIES, PRODUCTS, STORES } from "../src/utils/mockData.js";

const app = express();
const port = process.env.PORT || 8787;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");
const MEMBER_COHORT_TIMEOUT_MS = Number(process.env.MEMBER_COHORT_TIMEOUT_MS || 3500);
const ITEM_DETAILS_CACHE_TTL_MS = Number(process.env.ITEM_DETAILS_CACHE_TTL_MS || 20 * 60 * 1000);
const itemDetailsSummaryCache = new Map();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

function normalizeGenderPreference(value = "") {
  const normalized = String(value || "").trim().toLowerCase();

  if (["men", "male", "man", "m"].includes(normalized)) {
    return "Men";
  }

  if (["women", "woman", "female", "lady", "f"].includes(normalized)) {
    return "Women";
  }

  if (["unisex", "any", "all", "neutral"].includes(normalized)) {
    return "Any";
  }

  return "";
}

function normalizeSkuCode(value = "") {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isGenderCompatible(productGender, preferredGender, productContext = "") {
  const normalizedPreference = normalizeGenderPreference(preferredGender);
  if (!normalizedPreference || normalizedPreference === "Any") {
    return true;
  }

  const normalizedContext = String(productContext || "").toLowerCase();
  if (normalizedPreference === "Men" && normalizedContext.includes("tregging")) {
    return false;
  }

  const normalizedProductGender = normalizeGenderPreference(productGender) || "Any";
  return normalizedProductGender === normalizedPreference;
}

function dedupeProductsById(products = []) {
  const deduped = [];
  const seen = new Set();

  for (const product of products) {
    if (!product?.id || seen.has(product.id)) {
      continue;
    }

    seen.add(product.id);
    deduped.push(product);
  }

  return deduped;
}

async function fetchItemDetailsBySkusWithCache(skus = []) {
  if (!isMetabaseConfigured()) {
    return {};
  }

  const normalizedSkus = [...new Set(skus.map(normalizeSkuCode).filter(Boolean))];
  if (!normalizedSkus.length) {
    return {};
  }

  const now = Date.now();
  const detailsBySku = {};
  const missingSkus = [];

  for (const sku of normalizedSkus) {
    const cached = itemDetailsSummaryCache.get(sku);
    if (cached && now - cached.updatedAt < ITEM_DETAILS_CACHE_TTL_MS) {
      detailsBySku[sku] = cached.value;
      continue;
    }

    missingSkus.push(sku);
  }

  if (missingSkus.length) {
    try {
      const rows = await fetchItemDetailsSummaryBySkus(missingSkus);
      for (const row of rows) {
        const skuCode = normalizeSkuCode(row.sku_code);
        if (!skuCode) {
          continue;
        }

        const value = {
          gender: normalizeGenderPreference(row.gender) || "Any",
          item_status: String(row.item_status || "Unknown"),
        };
        itemDetailsSummaryCache.set(skuCode, { value, updatedAt: now });
        detailsBySku[skuCode] = value;
      }

      for (const sku of missingSkus) {
        if (detailsBySku[sku]) {
          continue;
        }

        const fallback = {
          gender: "Any",
          item_status: "Unknown",
        };
        itemDetailsSummaryCache.set(sku, { value: fallback, updatedAt: now });
        detailsBySku[sku] = fallback;
      }
    } catch (error) {
      console.warn("Item details summary fetch failed.", error.message);
    }
  }

  return detailsBySku;
}

async function getPrioritizedCohortProductIds(cohort, preferredGender) {
  const cohortSkus = getCohortRecommendedSkus(cohort, 140).map(normalizeSkuCode).filter(Boolean);
  if (!cohortSkus.length || !hasCatalogDatabase()) {
    return [];
  }

  const skuDetailsByCode = await fetchItemDetailsBySkusWithCache(cohortSkus);
  const skuToProductId = getCatalogProductIdsBySkus(cohortSkus);
  const prioritizedProductIds = [];
  const seenProductIds = new Set();

  for (const sku of cohortSkus) {
    const productId = skuToProductId[sku];
    if (!productId || seenProductIds.has(productId)) {
      continue;
    }

    const detail = skuDetailsByCode[sku];
    const normalizedStatus = String(detail?.item_status || "").trim().toLowerCase();
    if (["inactive", "deactive", "disabled", "blocked", "discontinued"].some((status) => normalizedStatus.includes(status))) {
      continue;
    }

    if (!isGenderCompatible(detail?.gender, preferredGender)) {
      continue;
    }

    seenProductIds.add(productId);
    prioritizedProductIds.push(productId);
  }

  return prioritizedProductIds;
}

function promoteRecommendations(baseRankedProducts, poolProducts, prioritizedProductIds, limit) {
  const rankedMap = new Map(baseRankedProducts.map((product) => [product.id, product]));
  const poolMap = new Map(poolProducts.map((product) => [product.id, product]));
  const selected = [];
  const used = new Set();

  for (const productId of prioritizedProductIds) {
    if (used.has(productId)) {
      continue;
    }

    const fromRanked = rankedMap.get(productId);
    const fromPool = poolMap.get(productId);
    const product = fromRanked || fromPool;
    if (!product) {
      continue;
    }

    used.add(productId);
    selected.push({
      ...product,
      recommendationReason: "Recommended for you",
      recommendedForYou: true,
    });

    if (selected.length >= limit) {
      return selected.map((item, index) => ({ ...item, ranking: index + 1 }));
    }
  }

  for (const product of baseRankedProducts) {
    if (used.has(product.id)) {
      continue;
    }

    used.add(product.id);
    selected.push(product);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected.slice(0, limit).map((item, index) => ({ ...item, ranking: index + 1 }));
}

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
  const catalogProduct = getCatalogProduct(productId);
  if (catalogProduct) {
    const currentStoreItems = catalogProduct.variants
      .filter((variant) => Number(variant.quantity) > 0)
      .map((variant) => ({
        size: variant.size,
        color: variant.color,
        quantity: Number(variant.quantity),
      }));

    return {
      product_id: catalogProduct.id,
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

function getTotalQuantity(product) {
  const directQuantity = Number(product?.total_inventory_qty);
  if (Number.isFinite(directQuantity) && directQuantity >= 0) {
    return directQuantity;
  }

  return INVENTORY_ENTRIES
    .filter((item) => item.product_id === product.id)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function enrichProduct(product, currentStoreId = CURRENT_STORE_ID) {
  const totalQuantity = getTotalQuantity(product);

  return {
    ...product,
    gender: product.gender || inferProductGender(product),
    availabilityLabel:
      totalQuantity > 0
        ? `${totalQuantity} ready in store`
        : "Check nearby stores",
    availabilityTone: getAvailabilityTone(totalQuantity),
  };
}

async function getProducts(filters = {}) {
  if (hasCatalogDatabase()) {
    const catalogProducts = getCatalogProducts(filters).map((product) => enrichProduct(product, filters.currentStoreId));

    if (catalogProducts.length) {
      return catalogProducts;
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
    const categoryMatch = !filters.category || String(product.category).toLowerCase() === String(filters.category).toLowerCase();
    const materialMatch =
      !filters.material ||
      `${product.material} ${product.material_tag}`.toLowerCase().includes(String(filters.material).toLowerCase());
    const genderMatch =
      !filters.gender ||
      filters.gender === "Any" ||
      inferProductGender(product) === filters.gender ||
      inferProductGender(product) === "Unisex";
    const searchMatch =
      !filters.search ||
      `${product.name} ${product.description} ${product.material} ${product.material_tag}`
        .toLowerCase()
        .includes(String(filters.search).toLowerCase());

    return activityMatch && fitMatch && categoryMatch && materialMatch && genderMatch && searchMatch;
  })
    .slice(Number(filters.offset || 0), Number(filters.offset || 0) + Number(filters.limit || PRODUCTS.length))
    .map((product) => enrichProduct(product, filters.currentStoreId));
}

async function getProductCount(filters = {}) {
  if (hasCatalogDatabase()) {
    return countCatalogProducts(filters);
  }

  return PRODUCTS.filter((product) => {
    const activityMatch = !filters.activity || product.activity === filters.activity;
    const fitMatch = !filters.fit || product.fit === filters.fit;
    const categoryMatch = !filters.category || String(product.category).toLowerCase() === String(filters.category).toLowerCase();
    const materialMatch =
      !filters.material ||
      `${product.material} ${product.material_tag}`.toLowerCase().includes(String(filters.material).toLowerCase());
    const genderMatch =
      !filters.gender ||
      filters.gender === "Any" ||
      inferProductGender(product) === filters.gender ||
      inferProductGender(product) === "Unisex";
    const searchMatch =
      !filters.search ||
      `${product.name} ${product.description} ${product.material} ${product.material_tag}`
        .toLowerCase()
        .includes(String(filters.search).toLowerCase());

    return activityMatch && fitMatch && categoryMatch && materialMatch && genderMatch && searchMatch;
  }).length;
}

async function buildExperiencePayload() {
  const featuredProducts = await getProducts({ currentStoreId: CURRENT_STORE_ID, limit: 6 });
  const totalProducts = await getProductCount({});
  const activities = [...new Set(featuredProducts.map((product) => product.activity).filter(Boolean))];

  return {
    mode: hasCatalogDatabase() ? "catalog-db" : isMetabaseConfigured() ? "metabase" : "mock",
    tryOn: isOpenRouterConfigured() ? "openrouter" : "disabled",
    totalProducts,
    featuredProducts,
    activities,
    currentStore: STORES.find((store) => store.store_id === CURRENT_STORE_ID) || {
      store_id: CURRENT_STORE_ID,
      store_name: "EBO - Current Store",
    },
  };
}

async function buildRecommendationPayload(profile, limit = 10) {
  const normalizedProfileGender = normalizeGenderPreference(profile?.gender) || "Any";
  const baseFilters = {
    currentStoreId: CURRENT_STORE_ID,
    activity: profile?.activity,
    fit: profile?.preferred_fit,
    material: profile?.material_preference,
    gender: normalizedProfileGender === "Any" ? "" : normalizedProfileGender,
  };

  const candidateProducts = await getProducts({
    ...baseFilters,
    limit: 220,
  });

  const genderScopedCandidates = normalizedProfileGender === "Any"
    ? candidateProducts
    : candidateProducts.filter((product) =>
      isGenderCompatible(product.gender, normalizedProfileGender, `${product?.name || ""} ${product?.category || ""}`));

  const widenedCandidates = genderScopedCandidates.length >= Math.max(limit, 20)
    ? genderScopedCandidates
    : dedupeProductsById([
      ...genderScopedCandidates,
      ...(await getProducts({
        currentStoreId: CURRENT_STORE_ID,
        gender: normalizedProfileGender === "Any" ? "" : normalizedProfileGender,
        limit: 340,
      })).filter((product) =>
        isGenderCompatible(product.gender, normalizedProfileGender, `${product?.name || ""} ${product?.category || ""}`)),
    ]);

  const activeProfile = {
    ...profile,
    gender: normalizedProfileGender,
  };

  const cohortSupportPool = profile?.cohort
    ? dedupeProductsById([
      ...widenedCandidates,
      ...(await getProducts({
        currentStoreId: CURRENT_STORE_ID,
        gender: normalizedProfileGender === "Any" ? "" : normalizedProfileGender,
        limit: 360,
      })).filter((product) =>
        isGenderCompatible(product.gender, normalizedProfileGender, `${product?.name || ""} ${product?.category || ""}`)),
    ])
    : widenedCandidates;

  const baselineRecommendations = getRecommendations(cohortSupportPool, activeProfile, Math.max(limit * 4, 24));
  const prioritizedProductIds = await getPrioritizedCohortProductIds(profile?.cohort, normalizedProfileGender);
  const recommendations = promoteRecommendations(baselineRecommendations, cohortSupportPool, prioritizedProductIds, limit);

  const profileSummary = summarizeProfile({
    ...activeProfile,
    style_note:
      prioritizedProductIds.length > 0
        ? `${profile?.style_note || ""} recommended for you`.trim()
        : profile?.style_note,
  });

  return {
    profileSummary,
    recommendations,
  };
}

async function getMember(phone) {
  if (isMetabaseConfigured()) {
    try {
      const metabaseMember = await fetchCultAppMemberByPhone(phone);
      if (metabaseMember) {
        const memberUserId = String(metabaseMember.user_id || "").trim();
        let cohort = null;

        if (memberUserId) {
          try {
            const cohortRow = await Promise.race([
              fetchUserCohortByUserId(memberUserId),
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Member cohort query timed out.")), MEMBER_COHORT_TIMEOUT_MS);
              }),
            ]);
            cohort = cohortRow?.cohort || null;
          } catch (cohortError) {
            console.warn("Member cohort fetch failed.", cohortError.message);
          }
        }

        const firstName = metabaseMember.firstname?.trim?.() || "";
        const lastName = metabaseMember.lastname?.trim?.() || "";
        const resolvedName = [firstName, lastName].filter(Boolean).join(" ").trim();
        const resolvedGender = normalizeGenderPreference(metabaseMember.gender) || "Any";

        return {
          user_id: memberUserId || null,
          phone,
          name: resolvedName || "Cult Member",
          activity: "Gym",
          fitness_level: "Member",
          preferred_fit: "Regular",
          material_preference: "Moisture-wicking",
          gender: resolvedGender,
          metabase_phone: metabaseMember.phone,
          cohort,
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
    mode: hasCatalogDatabase() ? "catalog-db" : isMetabaseConfigured() ? "metabase" : "mock",
    tryOn: isOpenRouterConfigured() ? "openrouter" : "disabled",
  });
});

app.get("/api/admin/bootstrap", (_request, response) => {
  response.json({
    demoAccounts: getAdminUsersPreview(),
  });
});

app.post("/api/admin/login", (request, response) => {
  const username = String(request.body?.username || "").trim();
  const password = String(request.body?.password || "").trim();
  const result = loginAdmin(username, password);

  if (!result) {
    response.status(401).json({ message: "Invalid admin credentials." });
    return;
  }

  response.json(result);
});

app.get("/api/admin/backoffice", requireAdmin, (_request, response) => {
  response.json(getBackOfficeSnapshot());
});

app.post("/api/admin/shopify/settings", requireAdmin, (request, response) => {
  const settings = saveShopifySettings(request.body || {});
  response.json({ settings });
});

app.post("/api/admin/shopify/sync", requireAdmin, async (request, response) => {
  try {
    const payload = await runShopifySync(request.body || {});
    response.json({ success: true, sync: payload });
  } catch (error) {
    response.status(400).json({ message: error.message || "Shopify sync failed." });
  }
});

app.get("/api/experience", async (_request, response) => {
  response.json(await buildExperiencePayload());
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
  const offset = Number(request.query.offset || 0);
  const limit = Number(request.query.limit || 24);
  const filters = {
    activity: request.query.activity,
    fit: request.query.fit,
    gender: request.query.gender,
    category: request.query.category,
    material: request.query.material,
    search: request.query.search,
    offset,
    limit,
    currentStoreId: request.query.currentStoreId || CURRENT_STORE_ID,
  };
  const [products, total] = await Promise.all([getProducts(filters), getProductCount(filters)]);

  response.json({
    products,
    total,
    hasMore: offset + products.length < total,
    source: hasCatalogDatabase() ? "catalog-db" : isMetabaseConfigured() ? "metabase-or-fallback" : "mock",
  });
});

app.post("/api/recommendations", async (request, response) => {
  const profile = request.body?.profile;
  const limit = Number(request.body?.limit || 10);

  if (!profile) {
    response.status(400).json({ message: "Missing shopper profile." });
    return;
  }

  response.json(await buildRecommendationPayload(profile, limit));
});

app.get("/api/inventory/:productId", async (request, response) => {
  const { productId } = request.params;
  const currentStoreId = request.query.currentStoreId || CURRENT_STORE_ID;
  const catalogProduct = getCatalogProduct(productId);

  if (catalogProduct) {
    response.json({
      inventory: buildInventoryResponse(productId, currentStoreId),
      source: "catalog-db",
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
  const { personImage, referenceImage, productName, color, size, material, fit, category } = request.body || {};

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
      category,
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

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get("/admin", (_request, response) => {
    response.sendFile(path.join(distPath, "index.html"));
  });

  app.get("/admin/*", (_request, response) => {
    response.sendFile(path.join(distPath, "index.html"));
  });

  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api/")) {
      next();
      return;
    }

    response.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`EBO smart kiosk API listening on http://localhost:${port}`);
});
