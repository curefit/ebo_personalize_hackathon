import { createSyncRun, completeSyncRun, getAdminSetting, getRecentSyncRuns, setAdminSetting, overwriteCatalog } from "./catalogAdminDb.js";
import { fetchStorefrontCatalog } from "./shopifyStorefrontService.js";

const SHOPIFY_SETTINGS_KEY = "shopify-storefront-sync";

function sanitizeShopifySettings(settings = {}) {
  return {
    storeDomain: settings.storeDomain || "",
    apiVersion: settings.apiVersion || "2025-01",
    syncEnabled: Boolean(settings.syncEnabled),
    maxProducts: Number(settings.maxProducts || 250),
    hasStorefrontToken: Boolean(settings.storefrontToken),
    searchMode: settings.searchMode || "keyword-plus-recommendation-heuristics",
    vectorDbPlanned: true,
  };
}

export function getShopifySettings() {
  const settings = getAdminSetting(SHOPIFY_SETTINGS_KEY, {
    storeDomain: "",
    storefrontToken: "",
    apiVersion: "2025-01",
    syncEnabled: false,
    maxProducts: 250,
    searchMode: "keyword-plus-recommendation-heuristics",
  });

  return sanitizeShopifySettings(settings);
}

export function saveShopifySettings(input) {
  const current = getAdminSetting(SHOPIFY_SETTINGS_KEY, {
    storeDomain: "",
    storefrontToken: "",
    apiVersion: "2025-01",
    syncEnabled: false,
    maxProducts: 250,
    searchMode: "keyword-plus-recommendation-heuristics",
  });

  const next = {
    ...current,
    storeDomain: String(input.storeDomain || current.storeDomain || "").trim(),
    storefrontToken: String(input.storefrontToken || current.storefrontToken || "").trim(),
    apiVersion: String(input.apiVersion || current.apiVersion || "2025-01").trim(),
    syncEnabled: Boolean(input.syncEnabled),
    maxProducts: Math.min(Math.max(Number(input.maxProducts || current.maxProducts || 250), 20), 1000),
    searchMode: input.searchMode || current.searchMode || "keyword-plus-recommendation-heuristics",
  };

  setAdminSetting(SHOPIFY_SETTINGS_KEY, next);
  return sanitizeShopifySettings(next);
}

export async function runShopifySync(override = {}) {
  const current = getAdminSetting(SHOPIFY_SETTINGS_KEY, null);
  const settings = {
    ...current,
    ...override,
  };

  if (!settings?.storeDomain || !settings?.storefrontToken) {
    throw new Error("Shopify storefront domain and token are required before syncing.");
  }

  const runId = createSyncRun("shopify-storefront", {
    storeDomain: settings.storeDomain,
    apiVersion: settings.apiVersion || "2025-01",
  });

  try {
    const { products, metadata } = await fetchStorefrontCatalog({
      storeDomain: settings.storeDomain,
      storefrontToken: settings.storefrontToken,
      apiVersion: settings.apiVersion || "2025-01",
      maxProducts: Number(settings.maxProducts || 250),
    });

    const persisted = overwriteCatalog(products, {
      sourceType: "shopify-storefront",
      storeDomain: settings.storeDomain,
      apiVersion: settings.apiVersion || "2025-01",
      searchMode: settings.searchMode || "keyword-plus-recommendation-heuristics",
      metadata,
    });

    completeSyncRun(runId, {
      status: "completed",
      productCount: persisted.productCount,
      variantCount: persisted.variantCount,
      summary: `Synced ${persisted.productCount} storefront products from ${settings.storeDomain}.`,
      metadata,
    });

    return {
      runId,
      ...persisted,
      settings: sanitizeShopifySettings(settings),
      metadata,
    };
  } catch (error) {
    completeSyncRun(runId, {
      status: "failed",
      summary: error.message,
      metadata: {
        storeDomain: settings.storeDomain,
      },
    });
    throw error;
  }
}

export function getBackOfficeSnapshot() {
  return {
    shopify: getShopifySettings(),
    syncRuns: getRecentSyncRuns(),
    searchArchitecture: {
      currentMode: "keyword-plus-recommendation-heuristics",
      vectorDbPlanned: true,
      note: "Current product search stays deterministic and cheap. A vector index can be added later for semantic retail queries or free-text stylist prompts.",
    },
  };
}
