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

function buildGenderExpression(db) {
  const hasGenderColumn = db ? hasColumn(db, "products", "gender") : false;
  const textParts = [
    hasGenderColumn ? "coalesce(nullif(trim(gender), ''), '')" : "''",
    "coalesce(name, '')",
    "coalesce(category, '')",
    "coalesce(description, '')",
    "coalesce(material, '')",
    "coalesce(material_tag, '')",
    "coalesce(activity, '')",
    "coalesce(fit, '')",
    "coalesce(vendor, '')",
    "coalesce(reason, '')",
  ];
  const normalizedText = `lower(${textParts.join(" || ' ' || ")})`;

  return `
    case
      when ${normalizedText} like '%unisex%'
        or ${normalizedText} like '%all gender%'
        or ${normalizedText} like '%all genders%'
        or ${normalizedText} like '%gender neutral%'
        or ${normalizedText} like '%neutral%'
        then 'Unisex'
      when ${normalizedText} like '%kid%'
        or ${normalizedText} like '%child%'
        or ${normalizedText} like '%boys%'
        or ${normalizedText} like '%girls%'
        or ${normalizedText} like '%junior%'
        then 'Kids'
      when ${normalizedText} like '%women%'
        or ${normalizedText} like '%woman%'
        or ${normalizedText} like '%women''s%'
        or ${normalizedText} like '%woman''s%'
        or ${normalizedText} like '%ladies%'
        or ${normalizedText} like '%lady%'
        or ${normalizedText} like '%female%'
        or ${normalizedText} like '%sports bra%'
        or ${normalizedText} like '%bralette%'
        then 'Women'
      when ${normalizedText} like '%men%'
        or ${normalizedText} like '%man%'
        or ${normalizedText} like '%men''s%'
        or ${normalizedText} like '%man''s%'
        or ${normalizedText} like '%male%'
        or ${normalizedText} like '%gents%'
        then 'Men'
      else 'Unisex'
    end
  `;
}

function getProductSelectClause(db) {
  const genderExpression = buildGenderExpression(db);

  return `
          id,
          handle,
          name,
          price,
          compare_at_price,
          category,
          ${genderExpression} as gender,
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
        `;
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
    gender: row.gender || "Unisex",
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

function buildProductFilters(filters = {}, options = {}) {
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

  if (filters.category) {
    clauses.push("lower(category) = ?");
    values.push(String(filters.category).toLowerCase());
  }

  if (filters.gender) {
    const normalizedGender = normalizeGenderLabel(filters.gender);
    if (normalizedGender) {
      clauses.push(`lower(${buildGenderExpression(options.db)}) = ?`);
      values.push(normalizedGender.toLowerCase());
    }
  }

  if (filters.search) {
    clauses.push(`
      (
        lower(name) like ?
        or lower(coalesce(description, '')) like ?
        or lower(coalesce(material, '')) like ?
        or lower(coalesce(material_tag, '')) like ?
        or lower(${buildGenderExpression(options.db)}) like ?
      )
    `);
    const searchValue = `%${String(filters.search).trim().toLowerCase()}%`;
    values.push(searchValue, searchValue, searchValue, searchValue, searchValue);
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values,
  };
}

function resolvePagination(filters = {}) {
  const limit = Number(filters.limit);
  const offset = Number(filters.offset);

  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
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
    const hasGenderColumn = hasColumn(db, "products", "gender");
    const { where, values } = buildProductFilters(filters, { db, hasGenderColumn });
    const { limit, offset } = resolvePagination(filters);
    const paginationSql = limit ? "limit ? offset ?" : "";
    const selectClause = getProductSelectClause(db);
    const rows = db
      .prepare(`
        select
          ${selectClause}
        from products
        ${where}
        order by name asc
        ${paginationSql}
      `)
      .all(...values, ...(limit ? [limit, offset] : []));

    return rows.map(mapProductRow);
  } finally {
    db.close();
  }
}

export function countCatalogProducts(filters = {}) {
  const db = openDatabase();
  if (!db) {
    return 0;
  }

  try {
    const hasGenderColumn = hasColumn(db, "products", "gender");
    const { where, values } = buildProductFilters(filters, { db, hasGenderColumn });
    const row = db
      .prepare(`
        select count(*) as total
        from products
        ${where}
      `)
      .get(...values);

    return Number(row?.total || 0);
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
    const selectClause = getProductSelectClause(db);
    const row = db
      .prepare(`
        select
          ${selectClause}
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
