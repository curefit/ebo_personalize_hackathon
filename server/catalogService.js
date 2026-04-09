import fs from "fs";
import XLSX from "xlsx";

const DEFAULT_EXPORT_PATH =
  process.env.PRODUCT_EXPORT_PATH || "/Users/gokul.lakshmanan/Downloads/Export_2026-04-08_214743.xlsx";

let cachedCatalog = null;

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inferActivity(text) {
  const content = String(text).toLowerCase();
  if (content.includes("yoga")) return "Yoga";
  if (content.includes("run")) return "Running";
  if (content.includes("train") || content.includes("workout") || content.includes("gym")) return "Gym";
  if (content.includes("sport")) return "Sports";
  return "Casual";
}

function inferFit(title) {
  const content = String(title).toLowerCase();
  if (content.includes("oversized") || content.includes("relaxed")) return "Baggy";
  if (content.includes("light") || content.includes("lite")) return "Lightweight";
  return "Regular";
}

function inferMaterial(text) {
  const content = String(text).toLowerCase();
  if (content.includes("cotton")) return "Cotton";
  if (content.includes("polyester")) return "Polyester";
  if (content.includes("moisture") || content.includes("dry")) return "Moisture-wicking";
  if (content.includes("blend")) return "Blend";
  return "Performance Fabric";
}

function isSupportedProduct(type) {
  const normalized = String(type || "").toLowerCase();
  return [
    "t-shirt",
    "polo t-shirt",
    "tank top",
    "shorts",
    "tights",
    "joggers",
    "track pants",
    "jacket",
    "sweatshirt",
    "sports bra",
  ].some((item) => normalized.includes(item));
}

function isBundleProduct(title) {
  const normalized = String(title || "").toLowerCase();
  return normalized.includes("pack of") || normalized.includes("combo") || normalized.includes("bundle");
}

function getOptionValue(row, optionName) {
  const targets = [
    ["Option1 Name", "Option1 Value"],
    ["Option2 Name", "Option2 Value"],
    ["Option3 Name", "Option3 Value"],
  ];

  for (const [nameKey, valueKey] of targets) {
    if (String(row[nameKey] || "").toLowerCase() === optionName.toLowerCase()) {
      return row[valueKey];
    }
  }

  return null;
}

function parseProductsSheet(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets.Products;
  if (!sheet) {
    throw new Error("Products sheet not found in export.");
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const groups = new Map();

  for (const row of rows) {
    if (!isSupportedProduct(row.Type) || row.Status !== "Active" || isBundleProduct(row.Title)) {
      continue;
    }

    const handle = row.Handle;
    if (!handle) {
      continue;
    }

    if (!groups.has(handle)) {
      const description = stripHtml(row["Body HTML"]);
      const activity = inferActivity(`${row.Title} ${row.Tags} ${description}`);
      const material = inferMaterial(`${row.Title} ${row.Tags} ${description}`);

      groups.set(handle, {
        id: String(row.ID || handle),
        handle,
        name: row.Title,
        price: Number(row["Variant Price"] || row["Price / India"] || 0),
        compare_at_price: Number(row["Variant Compare At Price"] || row["Compare At Price / India"] || 0),
        category: row.Type,
        image_url: row["Image Src"] || row["Variant Image"] || "",
        material,
        material_tag: material,
        colors: [],
        sizes: [],
        activity,
        fit: inferFit(row.Title),
        description,
        material_composition: material,
        url: row.URL || "",
        vendor: row.Vendor || "",
        total_inventory_qty: 0,
        variants: [],
        reason: `${row.Type} pick from the live catalog`,
      });
    }

    const product = groups.get(handle);
    const color = getOptionValue(row, "Color");
    const size = getOptionValue(row, "Size");
    const variantQty = Number(row["Variant Inventory Qty"] || 0);
    const variantPrice = Number(row["Variant Price"] || product.price || 0);
    const imageSrc = row["Image Src"] || row["Variant Image"];

    if (!product.image_url && imageSrc) {
      product.image_url = imageSrc;
    }

    product.price = product.price || variantPrice;
    product.total_inventory_qty += Number.isFinite(variantQty) ? variantQty : 0;
    if (color) product.colors.push(color);
    if (size) product.sizes.push(size);

    product.variants.push({
      variant_id: String(row["Variant ID"] || ""),
      sku: row["Variant SKU"] || "",
      color: color || "Default",
      size: size || "Free Size",
      quantity: Number.isFinite(variantQty) ? variantQty : 0,
      price: variantPrice,
      image_url: row["Variant Image"] || imageSrc || product.image_url,
    });
  }

  return [...groups.values()].map((product) => ({
    ...product,
    colors: unique(product.colors),
    sizes: unique(product.sizes),
  }));
}

export function hasSpreadsheetCatalog() {
  return fs.existsSync(DEFAULT_EXPORT_PATH);
}

export function getSpreadsheetCatalog() {
  if (!hasSpreadsheetCatalog()) {
    return [];
  }

  if (!cachedCatalog) {
    cachedCatalog = parseProductsSheet(DEFAULT_EXPORT_PATH);
  }

  return cachedCatalog;
}

export function getSpreadsheetProduct(productId) {
  return getSpreadsheetCatalog().find((product) => product.id === productId || product.handle === productId) || null;
}
