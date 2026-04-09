import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const DEFAULT_COHORT_RECOMMENDATION_PATH =
  process.env.COHORT_RECOMMENDATION_PATH ||
  "/Users/gokul.lakshmanan/Downloads/cohort_wise_recommendation_2026-04-09T12_03_39.166593Z.xlsx";

const MAX_SKU_PER_COHORT = Number(process.env.COHORT_RECOMMENDATION_MAX_SKU || 180);

const cache = {
  filePath: "",
  mtimeMs: 0,
  loadedAt: "",
  cohorts: new Map(),
};

function normalizeCohort(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSku(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function readWorkbookRows(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: null });
}

function rebuildCache(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    cache.filePath = absolutePath;
    cache.mtimeMs = 0;
    cache.loadedAt = new Date().toISOString();
    cache.cohorts = new Map();
    return;
  }

  const stats = fs.statSync(absolutePath);
  if (cache.filePath === absolutePath && cache.mtimeMs === stats.mtimeMs && cache.cohorts.size > 0) {
    return;
  }

  const rows = readWorkbookRows(absolutePath);
  const nextMap = new Map();

  for (const row of rows) {
    const cohortName = normalizeCohort(row.cohort_name);
    const skuCode = normalizeSku(row.sku_code);
    if (!cohortName || !skuCode) {
      continue;
    }

    const rank = Number(row.rnk || 9999);
    const orderCount = Number(row.order_count || 0);
    if (!nextMap.has(cohortName)) {
      nextMap.set(cohortName, []);
    }

    nextMap.get(cohortName).push({
      sku: skuCode,
      rank: Number.isFinite(rank) ? rank : 9999,
      orderCount: Number.isFinite(orderCount) ? orderCount : 0,
    });
  }

  for (const [cohortName, recommendations] of nextMap.entries()) {
    const ordered = [...recommendations]
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        return right.orderCount - left.orderCount;
      })
      .map((item) => item.sku);

    const deduped = [];
    const seen = new Set();
    for (const sku of ordered) {
      if (seen.has(sku)) {
        continue;
      }

      seen.add(sku);
      deduped.push(sku);
      if (deduped.length >= MAX_SKU_PER_COHORT) {
        break;
      }
    }

    nextMap.set(cohortName, deduped);
  }

  cache.filePath = absolutePath;
  cache.mtimeMs = stats.mtimeMs;
  cache.loadedAt = new Date().toISOString();
  cache.cohorts = nextMap;
}

export function getCohortRecommendedSkus(cohortName, limit = 80) {
  const normalizedCohort = normalizeCohort(cohortName);
  if (!normalizedCohort) {
    return [];
  }

  rebuildCache(DEFAULT_COHORT_RECOMMENDATION_PATH);
  const rankedSkus = cache.cohorts.get(normalizedCohort) || [];
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 80;
  return rankedSkus.slice(0, Math.max(0, safeLimit));
}

export function getCohortRecommendationStatus() {
  rebuildCache(DEFAULT_COHORT_RECOMMENDATION_PATH);
  return {
    filePath: cache.filePath || path.resolve(DEFAULT_COHORT_RECOMMENDATION_PATH),
    loadedAt: cache.loadedAt || null,
    cohortsLoaded: cache.cohorts.size,
  };
}
