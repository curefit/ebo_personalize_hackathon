import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = process.env.CATALOG_DB_PATH || path.join(process.cwd(), "data", "catalog.sqlite");
const DEFAULT_NON_MEMBER_TAG_SEED_PATH =
  process.env.NON_MEMBER_TAG_FEED_PATH || path.join(process.cwd(), "db", "seeds", "codex_feed_non_member_tags.csv");
const MAX_SKU = Number(process.env.NON_MEMBER_TAG_MAX_SKU || 1400);
const CACHE_TTL_MS = Number(process.env.NON_MEMBER_TAG_CACHE_TTL_MS || 120000);

const cache = {
  dbPath: "",
  loadedAt: 0,
  rows: [],
};

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSku(value = "") {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function toBool(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y";
}

function parsePipeTags(value) {
  return String(value || "")
    .split("|")
    .map((item) => normalizeToken(item))
    .filter(Boolean);
}

function ensureSchema(db) {
  db.exec(`
    create table if not exists non_member_tag_feed (
      sku text primary key,
      product_name text,
      supports_female integer not null default 0,
      supports_male integer not null default 0,
      workout_cardio integer not null default 0,
      workout_strength integer not null default 0,
      workout_flexibility integer not null default 0,
      workout_sports integer not null default 0,
      workout_others integer not null default 0,
      issue_foot_leg_discomfort integer not null default 0,
      issue_back_shoulder_pain integer not null default 0,
      issue_other_recovery integer not null default 0,
      issue_no_issues integer not null default 0,
      priority_style_first integer not null default 0,
      priority_function_first integer not null default 0,
      priority_both_equally integer not null default 0,
      social_alone integer not null default 0,
      social_with_friend_partner integer not null default 0,
      social_group_classes integer not null default 0,
      shopping_apparel integer not null default 0,
      shopping_footwear integer not null default 0,
      shopping_accessories integer not null default 0,
      workout_tags text,
      discomfort_tags text,
      priority_tag text,
      social_tags text,
      store_count integer not null default 0,
      total_stock integer not null default 0,
      sale_price real not null default 0,
      updated_at text not null default current_timestamp
    );
    create index if not exists idx_non_member_tag_feed_shopping_apparel
      on non_member_tag_feed(shopping_apparel);
    create index if not exists idx_non_member_tag_feed_supports_male
      on non_member_tag_feed(supports_male);
    create index if not exists idx_non_member_tag_feed_supports_female
      on non_member_tag_feed(supports_female);
  `);
}

function normalizePipeList(value) {
  return String(value || "")
    .split("|")
    .map((item) => normalizeToken(item))
    .filter(Boolean)
    .join("|");
}

function importSeedRows(db, seedPath) {
  if (!fs.existsSync(seedPath)) {
    return 0;
  }

  const workbook = XLSX.readFile(seedPath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return 0;
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: null });
  const insertRow = db.prepare(`
    insert into non_member_tag_feed (
      sku,
      product_name,
      supports_female,
      supports_male,
      workout_cardio,
      workout_strength,
      workout_flexibility,
      workout_sports,
      workout_others,
      issue_foot_leg_discomfort,
      issue_back_shoulder_pain,
      issue_other_recovery,
      issue_no_issues,
      priority_style_first,
      priority_function_first,
      priority_both_equally,
      social_alone,
      social_with_friend_partner,
      social_group_classes,
      shopping_apparel,
      shopping_footwear,
      shopping_accessories,
      workout_tags,
      discomfort_tags,
      priority_tag,
      social_tags,
      store_count,
      total_stock,
      sale_price,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
    on conflict(sku) do update set
      product_name = excluded.product_name,
      supports_female = excluded.supports_female,
      supports_male = excluded.supports_male,
      workout_cardio = excluded.workout_cardio,
      workout_strength = excluded.workout_strength,
      workout_flexibility = excluded.workout_flexibility,
      workout_sports = excluded.workout_sports,
      workout_others = excluded.workout_others,
      issue_foot_leg_discomfort = excluded.issue_foot_leg_discomfort,
      issue_back_shoulder_pain = excluded.issue_back_shoulder_pain,
      issue_other_recovery = excluded.issue_other_recovery,
      issue_no_issues = excluded.issue_no_issues,
      priority_style_first = excluded.priority_style_first,
      priority_function_first = excluded.priority_function_first,
      priority_both_equally = excluded.priority_both_equally,
      social_alone = excluded.social_alone,
      social_with_friend_partner = excluded.social_with_friend_partner,
      social_group_classes = excluded.social_group_classes,
      shopping_apparel = excluded.shopping_apparel,
      shopping_footwear = excluded.shopping_footwear,
      shopping_accessories = excluded.shopping_accessories,
      workout_tags = excluded.workout_tags,
      discomfort_tags = excluded.discomfort_tags,
      priority_tag = excluded.priority_tag,
      social_tags = excluded.social_tags,
      store_count = excluded.store_count,
      total_stock = excluded.total_stock,
      sale_price = excluded.sale_price,
      updated_at = current_timestamp
  `);

  let imported = 0;
  db.exec("begin");
  try {
    for (const row of rows) {
      const sku = normalizeSku(row.sku);
      if (!sku) {
        continue;
      }

      insertRow.run(
        sku,
        String(row.product_name || "").trim(),
        toBool(row.supports_female),
        toBool(row.supports_male),
        toBool(row.workout_cardio),
        toBool(row.workout_strength),
        toBool(row.workout_flexibility),
        toBool(row.workout_sports),
        toBool(row.workout_others),
        toBool(row.issue_foot_leg_discomfort),
        toBool(row.issue_back_shoulder_pain),
        toBool(row.issue_other_recovery),
        toBool(row.issue_no_issues),
        toBool(row.priority_style_first),
        toBool(row.priority_function_first),
        toBool(row.priority_both_equally),
        toBool(row.social_alone),
        toBool(row.social_with_friend_partner),
        toBool(row.social_group_classes),
        toBool(row.shopping_apparel),
        toBool(row.shopping_footwear),
        toBool(row.shopping_accessories),
        normalizePipeList(row.workout_tags),
        normalizePipeList(row.discomfort_tags),
        normalizeToken(row.priority_tag),
        normalizePipeList(row.social_tags),
        Number(row.store_count || 0),
        Number(row.total_stock || 0),
        Number(row.sale_price || 0),
      );
      imported += 1;
    }
    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }

  return imported;
}

function mapDbRow(row = {}) {
  return {
    sku: normalizeSku(row.sku),
    productName: String(row.product_name || "").trim(),
    supportsFemale: toBool(row.supports_female),
    supportsMale: toBool(row.supports_male),
    workout: {
      cardio: toBool(row.workout_cardio),
      strength: toBool(row.workout_strength),
      flexibility: toBool(row.workout_flexibility),
      sports: toBool(row.workout_sports),
      others: toBool(row.workout_others),
    },
    issue: {
      foot_leg_discomfort: toBool(row.issue_foot_leg_discomfort),
      back_shoulder_pain: toBool(row.issue_back_shoulder_pain),
      other_recovery: toBool(row.issue_other_recovery),
      no_issues: toBool(row.issue_no_issues),
    },
    priority: {
      style_first: toBool(row.priority_style_first),
      function_first: toBool(row.priority_function_first),
      both_equally: toBool(row.priority_both_equally),
    },
    social: {
      alone: toBool(row.social_alone),
      with_friend_partner: toBool(row.social_with_friend_partner),
      group_classes: toBool(row.social_group_classes),
    },
    shoppingApparel: toBool(row.shopping_apparel),
    shoppingFootwear: toBool(row.shopping_footwear),
    shoppingAccessories: toBool(row.shopping_accessories),
    workoutTags: parsePipeTags(row.workout_tags),
    discomfortTags: parsePipeTags(row.discomfort_tags),
    priorityTag: normalizeToken(row.priority_tag),
    socialTags: parsePipeTags(row.social_tags),
    storeCount: Number(row.store_count || 0),
    totalStock: Number(row.total_stock || 0),
    salePrice: Number(row.sale_price || 0),
  };
}

function rebuildCacheFromDb() {
  const dbPath = path.resolve(DEFAULT_DB_PATH);
  const now = Date.now();
  if (cache.rows.length && cache.dbPath === dbPath && now - cache.loadedAt < CACHE_TTL_MS) {
    return;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("pragma journal_mode = wal;");
  db.exec("pragma foreign_keys = on;");
  ensureSchema(db);

  try {
    const countRow = db.prepare("select count(*) as total from non_member_tag_feed").get();
    const total = Number(countRow?.total || 0);
    if (total <= 0) {
      const seedPath = path.resolve(DEFAULT_NON_MEMBER_TAG_SEED_PATH);
      importSeedRows(db, seedPath);
    }

    const rows = db
      .prepare(`
        select
          sku,
          product_name,
          supports_female,
          supports_male,
          workout_cardio,
          workout_strength,
          workout_flexibility,
          workout_sports,
          workout_others,
          issue_foot_leg_discomfort,
          issue_back_shoulder_pain,
          issue_other_recovery,
          issue_no_issues,
          priority_style_first,
          priority_function_first,
          priority_both_equally,
          social_alone,
          social_with_friend_partner,
          social_group_classes,
          shopping_apparel,
          shopping_footwear,
          shopping_accessories,
          workout_tags,
          discomfort_tags,
          priority_tag,
          social_tags,
          store_count,
          total_stock,
          sale_price
        from non_member_tag_feed
      `)
      .all();

    cache.dbPath = dbPath;
    cache.loadedAt = now;
    cache.rows = rows.map(mapDbRow).filter((row) => row.sku);
  } finally {
    db.close();
  }
}

function resolveSelections(profile = {}) {
  const workoutType = normalizeToken(profile.workout_type);
  const discomfort = normalizeToken(profile.discomfort);
  const stylePriority = normalizeToken(profile.style_priority);
  const workoutCompany = normalizeToken(profile.workout_company);
  const gender = normalizeToken(profile.gender);

  const workout =
    workoutType.includes("cardio") || workoutType.includes("running")
      ? "cardio"
      : workoutType.includes("strength")
        ? "strength"
        : workoutType.includes("flexibility") || workoutType.includes("yoga") || workoutType.includes("pilates")
          ? "flexibility"
          : workoutType.includes("sports")
            ? "sports"
            : workoutType.includes("other")
              ? "others"
              : "";

  const issue =
    discomfort.includes("foot") || discomfort.includes("leg")
      ? "foot_leg_discomfort"
      : discomfort.includes("back") || discomfort.includes("shoulder")
        ? "back_shoulder_pain"
        : discomfort.includes("no_issue") || discomfort.includes("no_issues")
          ? "no_issues"
          : discomfort.includes("other")
            ? "other_recovery"
            : "";

  const priority =
    stylePriority.includes("style")
      ? "style_first"
      : stylePriority.includes("function")
        ? "function_first"
        : stylePriority.includes("both")
          ? "both_equally"
          : "";

  const social =
    workoutCompany.includes("group")
      ? "group_classes"
      : workoutCompany.includes("friend") || workoutCompany.includes("partner")
        ? "with_friend_partner"
        : workoutCompany.includes("alone")
          ? "alone"
          : "";

  const normalizedGender =
    gender === "female" || gender === "women" || gender === "woman"
      ? "female"
      : gender === "male" || gender === "men" || gender === "man"
        ? "male"
        : "";

  return {
    workout,
    issue,
    priority,
    social,
    gender: normalizedGender,
  };
}

function rowSupportsGender(row, gender) {
  if (!gender) {
    return true;
  }

  if (gender === "female") {
    return row.supportsFemale;
  }

  if (gender === "male") {
    return row.supportsMale;
  }

  return true;
}

function strictMatch(row, selections) {
  if (!rowSupportsGender(row, selections.gender)) {
    return false;
  }

  if (selections.workout && !row.workout[selections.workout] && !row.workoutTags.includes(selections.workout)) {
    return false;
  }

  if (selections.issue && !row.issue[selections.issue] && !row.discomfortTags.includes(selections.issue)) {
    return false;
  }

  if (selections.priority && !row.priority[selections.priority] && row.priorityTag !== selections.priority) {
    return false;
  }

  if (selections.social && !row.social[selections.social] && !row.socialTags.includes(selections.social)) {
    return false;
  }

  return true;
}

function scoreRow(row, selections) {
  let score = 0;

  if (rowSupportsGender(row, selections.gender)) score += 5;
  if (selections.workout && (row.workout[selections.workout] || row.workoutTags.includes(selections.workout))) score += 6;
  if (selections.issue && (row.issue[selections.issue] || row.discomfortTags.includes(selections.issue))) score += 4;
  if (selections.priority && (row.priority[selections.priority] || row.priorityTag === selections.priority)) score += 3;
  if (selections.social && (row.social[selections.social] || row.socialTags.includes(selections.social))) score += 2;
  if (row.shoppingApparel) score += 3;
  if (row.shoppingFootwear) score += 1;

  score += Math.min(2, Number.isFinite(row.storeCount) ? row.storeCount / 80 : 0);
  score += Math.min(2, Number.isFinite(row.totalStock) ? row.totalStock / 500 : 0);

  return score;
}

function rankRows(rows, selections, limit) {
  const strict = rows.filter((row) => strictMatch(row, selections));
  const strictApparel = strict.filter((row) => row.shoppingApparel);
  const apparelRows = rows.filter((row) => row.shoppingApparel);
  const source = strictApparel.length
    ? strictApparel
    : strict.length
      ? strict
      : apparelRows.length
        ? apparelRows
        : rows;

  return source
    .map((row) => ({
      row,
      score: scoreRow(row, selections),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.row.totalStock !== left.row.totalStock) {
        return right.row.totalStock - left.row.totalStock;
      }

      if (right.row.storeCount !== left.row.storeCount) {
        return right.row.storeCount - left.row.storeCount;
      }

      return left.row.salePrice - right.row.salePrice;
    })
    .map((item) => item.row.sku)
    .filter(Boolean)
    .slice(0, Math.max(0, Math.min(limit, MAX_SKU)));
}

export function getNonMemberRecommendedSkus(profile, limit = 120) {
  rebuildCacheFromDb();
  if (!cache.rows.length) {
    return [];
  }

  const selections = resolveSelections(profile);
  const rankedSkus = rankRows(cache.rows, selections, limit);

  const deduped = [];
  const seen = new Set();
  for (const sku of rankedSkus) {
    if (seen.has(sku)) {
      continue;
    }
    seen.add(sku);
    deduped.push(sku);
  }

  return deduped;
}

export function getNonMemberRecommendationStatus() {
  rebuildCacheFromDb();
  return {
    dbPath: cache.dbPath || path.resolve(DEFAULT_DB_PATH),
    seedPath: path.resolve(DEFAULT_NON_MEMBER_TAG_SEED_PATH),
    loadedAt: cache.loadedAt ? new Date(cache.loadedAt).toISOString() : null,
    rowsLoaded: cache.rows.length,
  };
}
