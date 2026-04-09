import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = process.env.CATALOG_DB_PATH || path.join(process.cwd(), "data", "catalog.sqlite");

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapProductRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    price: Number(row.price || 0),
    compare_at_price: Number(row.compare_at_price || 0),
    category: row.category,
    image_url: row.image_url,
    material: row.material,
    material_tag: row.material_tag,
    colors: parseJsonArray(row.colors_json),
    sizes: parseJsonArray(row.sizes_json),
    activity: row.activity,
    fit: row.fit,
    description: row.description,
    material_composition: row.material_composition,
    url: row.url,
    vendor: row.vendor,
    total_inventory_qty: Number(row.total_inventory_qty || 0),
    reason: row.reason,
  };
}

function openDatabase() {
  if (!fs.existsSync(DEFAULT_DB_PATH)) {
    return null;
  }

  return new DatabaseSync(DEFAULT_DB_PATH, { open: true, readOnly: true });
}

function buildProductFilters(filters = {}) {
  const clauses = [];
  const values = [];

  if (filters.activity) {
    clauses.push("activity = ?");
    values.push(filters.activity);
  }

  if (filters.fit) {
    clauses.push("fit = ?");
    values.push(filters.fit);
  }

  if (filters.material) {
    clauses.push("lower(material || ' ' || material_tag) like ?");
    values.push(`%${String(filters.material).toLowerCase()}%`);
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values,
  };
}

export function getCatalogDatabasePath() {
  return DEFAULT_DB_PATH;
}

export function hasCatalogDatabase() {
  return fs.existsSync(DEFAULT_DB_PATH);
}

export function getCatalogProducts(filters = {}) {
  const db = openDatabase();
  if (!db) {
    return [];
  }

  try {
    const { where, values } = buildProductFilters(filters);
    const rows = db
      .prepare(`
        select
          id,
          handle,
          name,
          price,
          compare_at_price,
          category,
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
        from products
        ${where}
        order by name asc
      `)
      .all(...values);

    return rows.map(mapProductRow);
  } finally {
    db.close();
  }
}

export function getCatalogProduct(productId) {
  const db = openDatabase();
  if (!db) {
    return null;
  }

  try {
    const row = db
      .prepare(`
        select
          id,
          handle,
          name,
          price,
          compare_at_price,
          category,
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
        from products
        where id = ? or handle = ?
        limit 1
      `)
      .get(productId, productId);

    if (!row) {
      return null;
    }

    const variants = db
      .prepare(`
        select variant_id, source_variant_id, sku, color, size, quantity, price, image_url
        from product_variants
        where product_id = ?
        order by color asc, size asc
      `)
      .all(row.id)
      .map((variant) => ({
        variant_id: variant.variant_id,
        source_variant_id: variant.source_variant_id,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        quantity: Number(variant.quantity || 0),
        price: Number(variant.price || 0),
        image_url: variant.image_url,
      }));

    return {
      ...mapProductRow(row),
      variants,
    };
  } finally {
    db.close();
  }
}
