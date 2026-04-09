import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { parseProductsExport } from "../server/catalogImport.js";

const exportPath =
  process.argv[2] ||
  process.env.PRODUCT_EXPORT_PATH ||
  "/Users/ananthapadmanabhakurup/Downloads/Export_2026-04-08_214743.xlsx";
const dbPath = process.env.CATALOG_DB_PATH || path.join(process.cwd(), "data", "catalog.sqlite");
const schemaPath = path.join(process.cwd(), "db", "schema.sql");

if (!fs.existsSync(exportPath)) {
  console.error(`Catalog export not found at ${exportPath}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
for (const suffix of ["", "-shm", "-wal"]) {
  fs.rmSync(`${dbPath}${suffix}`, { force: true });
}

const schemaSql = fs.readFileSync(schemaPath, "utf8");
const products = parseProductsExport(exportPath);
const variantCount = products.reduce((sum, product) => sum + product.variants.length, 0);

const db = new DatabaseSync(dbPath);
db.exec("pragma journal_mode = wal;");
db.exec("pragma foreign_keys = on;");
db.exec(schemaSql);

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
  insert into imports (source_path, product_count, variant_count)
  values (?, ?, ?)
`);

try {
  db.exec("begin");
  db.exec(`
    delete from product_variants;
    delete from products;
    delete from imports;
  `);

  for (const product of products) {
    insertProduct.run(
      product.id,
      product.handle,
      product.name,
      Number(product.price || 0),
      Number(product.compare_at_price || 0),
      product.category,
      product.gender || "Unisex",
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

    for (const variant of product.variants) {
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

  insertImport.run(exportPath, products.length, variantCount);
  db.exec("commit");
} catch (error) {
  db.exec("rollback");
  db.close();
  throw error;
}

db.close();

console.log(`Bootstrapped catalog DB at ${dbPath}`);
console.log(`Imported ${products.length} products and ${variantCount} variants from ${exportPath}`);
