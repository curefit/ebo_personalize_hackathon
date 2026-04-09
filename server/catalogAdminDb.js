import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = process.env.CATALOG_DB_PATH || path.join(process.cwd(), "data", "catalog.sqlite");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

function getSchemaSql() {
  return fs.readFileSync(SCHEMA_PATH, "utf8");
}

function openWritableDb() {
  fs.mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
  const db = new DatabaseSync(DEFAULT_DB_PATH);
  db.exec("pragma journal_mode = wal;");
  db.exec("pragma foreign_keys = on;");
  db.exec(getSchemaSql());
  applyMigrations(db);
  return db;
}

function hasColumn(db, tableName, columnName) {
  const rows = db.prepare(`pragma table_info(${tableName})`).all();
  return rows.some((row) => row.name === columnName);
}

function normalizeGenderLabel(value = "") {
  const content = String(value).toLowerCase();

  if (!content.trim()) {
    return "";
  }

  if (
    content.includes("unisex") ||
    content.includes("all gender") ||
    content.includes("all genders") ||
    content.includes("everyone")
  ) {
    return "Unisex";
  }

  if (
    content.includes("kid") ||
    content.includes("child") ||
    content.includes("boys") ||
    content.includes("girls") ||
    content.includes("junior")
  ) {
    return "Kids";
  }

  if (
    content.includes("women") ||
    content.includes("woman") ||
    content.includes("female") ||
    content.includes("ladies") ||
    content.includes("womens") ||
    content.includes("woman's") ||
    content.includes("women's") ||
    content.includes("sports bra") ||
    content.includes("bralette")
  ) {
    return "Women";
  }

  if (
    content.includes("men") ||
    content.includes("man") ||
    content.includes("male") ||
    content.includes("mens") ||
    content.includes("man's") ||
    content.includes("men's")
  ) {
    return "Men";
  }

  return "";
}

function inferGenderFromProduct(product = {}) {
  const explicitGender = normalizeGenderLabel(product.gender);
  if (explicitGender) {
    return explicitGender;
  }

  const contextText = [
    product.name,
    product.category,
    product.description,
    product.material,
    product.material_tag,
    product.activity,
    product.fit,
    product.vendor,
    product.reason,
    product.search_document,
    ...(Array.isArray(product.tags) ? product.tags : []),
  ]
    .filter(Boolean)
    .join(" ");

  const inferredGender = normalizeGenderLabel(contextText);
  return inferredGender || "Unisex";
}

function applyMigrations(db) {
  if (!hasColumn(db, "imports", "source_type")) {
    db.exec(`alter table imports add column source_type text not null default 'excel';`);
  }

  if (!hasColumn(db, "imports", "metadata_json")) {
    db.exec(`alter table imports add column metadata_json text not null default '{}';`);
  }

  if (!hasColumn(db, "products", "gender")) {
    db.exec(`alter table products add column gender text not null default 'Unisex';`);
  }

  db.exec(`create index if not exists idx_products_gender on products(gender);`);
}

export function overwriteCatalog(products, metadata = {}) {
  const db = openWritableDb();
  const variantCount = products.reduce((sum, product) => sum + (product.variants?.length || 0), 0);

  const insertProduct = db.prepare(`
    insert into products (
      id,
      handle,
      name,
      price,
      compare_at_price,
      category,
      gender,
      image_url,
      material,
      material_tag,
      colors_json,
      sizes_json,
      activity,
      fit,
      description,
      material_composition,
      url,
      vendor,
      total_inventory_qty,
      reason
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVariant = db.prepare(`
    insert into product_variants (
      variant_id,
      product_id,
      source_variant_id,
      sku,
      color,
      size,
      quantity,
      price,
      image_url
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertImport = db.prepare(`
    insert into imports (source_path, product_count, variant_count, source_type, metadata_json)
    values (?, ?, ?, ?, ?)
  `);

  try {
    db.exec("begin");
    db.exec(`
      delete from product_variants;
      delete from products;
    `);

    for (const product of products) {
      const normalizedGender = inferGenderFromProduct(product);
      insertProduct.run(
        product.id,
        product.handle,
        product.name,
        Number(product.price || 0),
        Number(product.compare_at_price || 0),
        product.category,
        normalizedGender,
        product.image_url,
        product.material,
        product.material_tag,
        JSON.stringify(product.colors || []),
        JSON.stringify(product.sizes || []),
        product.activity,
        product.fit,
        product.description,
        product.material_composition,
        product.url,
        product.vendor,
        Number(product.total_inventory_qty || 0),
        product.reason,
      );

      for (const variant of product.variants || []) {
        insertVariant.run(
          variant.variant_id,
          product.id,
          variant.source_variant_id,
          variant.sku,
          variant.color,
          variant.size,
          Number(variant.quantity || 0),
          Number(variant.price || 0),
          variant.image_url,
        );
      }
    }

    insertImport.run(
      metadata.sourcePath || metadata.sourceType || "catalog-sync",
      products.length,
      variantCount,
      metadata.sourceType || "sync",
      JSON.stringify(metadata),
    );

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    db.close();
    throw error;
  }

  db.close();

  return {
    productCount: products.length,
    variantCount,
  };
}

export function setAdminSetting(key, value) {
  const db = openWritableDb();

  try {
    db.prepare(`
      insert into admin_settings (key, value_json, updated_at)
      values (?, ?, current_timestamp)
      on conflict(key) do update set
        value_json = excluded.value_json,
        updated_at = current_timestamp
    `).run(key, JSON.stringify(value));
  } finally {
    db.close();
  }
}

export function getAdminSetting(key, fallback = null) {
  const db = openWritableDb();

  try {
    const row = db.prepare("select value_json from admin_settings where key = ? limit 1").get(key);
    if (!row) {
      return fallback;
    }

    return JSON.parse(row.value_json);
  } catch {
    return fallback;
  } finally {
    db.close();
  }
}

export function createSyncRun(provider, metadata = {}) {
  const db = openWritableDb();

  try {
    const result = db.prepare(`
      insert into sync_runs (provider, status, metadata_json)
      values (?, 'running', ?)
      returning id
    `).get(provider, JSON.stringify(metadata));

    return result?.id;
  } finally {
    db.close();
  }
}

export function completeSyncRun(id, updates = {}) {
  const db = openWritableDb();

  try {
    db.prepare(`
      update sync_runs
      set
        status = ?,
        completed_at = current_timestamp,
        product_count = ?,
        variant_count = ?,
        summary = ?,
        metadata_json = ?
      where id = ?
    `).run(
      updates.status || "completed",
      Number(updates.productCount || 0),
      Number(updates.variantCount || 0),
      updates.summary || "",
      JSON.stringify(updates.metadata || {}),
      id,
    );
  } finally {
    db.close();
  }
}

export function getRecentSyncRuns(limit = 8) {
  const db = openWritableDb();

  try {
    const rows = db.prepare(`
      select id, provider, status, started_at, completed_at, product_count, variant_count, summary, metadata_json
      from sync_runs
      order by id desc
      limit ?
    `).all(limit);

    return rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      productCount: row.product_count,
      variantCount: row.variant_count,
      summary: row.summary,
      metadata: JSON.parse(row.metadata_json || "{}"),
    }));
  } finally {
    db.close();
  }
}
