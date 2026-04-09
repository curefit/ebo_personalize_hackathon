import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = process.env.CATALOG_DB_PATH || path.join(process.cwd(), "data", "catalog.sqlite");
const DEFAULT_FEED_PATH =
  process.argv[2] ||
  process.env.NON_MEMBER_TAG_FEED_PATH ||
  path.join(process.cwd(), "db", "seeds", "codex_feed_non_member_tags.csv");

function normalizeSku(value = "") {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toBool(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y" ? 1 : 0;
}

function readRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Non-member tag feed not found at ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: null });
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

function main() {
  const feedPath = path.resolve(DEFAULT_FEED_PATH);
  const dbPath = path.resolve(DEFAULT_DB_PATH);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const rows = readRows(feedPath);
  const db = new DatabaseSync(dbPath);
  db.exec("pragma journal_mode = wal;");
  db.exec("pragma foreign_keys = on;");
  ensureSchema(db);

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

  try {
    db.exec("begin");
    db.exec("delete from non_member_tag_feed");

    let imported = 0;
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
        String(row.workout_tags || "")
          .split("|")
          .map((item) => normalizeToken(item))
          .filter(Boolean)
          .join("|"),
        String(row.discomfort_tags || "")
          .split("|")
          .map((item) => normalizeToken(item))
          .filter(Boolean)
          .join("|"),
        normalizeToken(row.priority_tag),
        String(row.social_tags || "")
          .split("|")
          .map((item) => normalizeToken(item))
          .filter(Boolean)
          .join("|"),
        Number(row.store_count || 0),
        Number(row.total_stock || 0),
        Number(row.sale_price || 0),
      );
      imported += 1;
    }

    db.exec("commit");
    console.log(`Imported ${imported} non-member tag rows into ${dbPath}`);
  } catch (error) {
    db.exec("rollback");
    throw error;
  } finally {
    db.close();
  }
}

main();
