import XLSX from "xlsx";

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

function mergeGender(currentGender, nextGender) {
  const current = normalizeGenderLabel(currentGender) || "Unisex";
  const next = normalizeGenderLabel(nextGender) || "Unisex";

  if (current === next) {
    return current;
  }

  if (current === "Unisex") {
    return next;
  }

  if (next === "Unisex") {
    return current;
  }

  return "Unisex";
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

function inferGender(row = {}) {
  const explicitValue =
    row.Gender ||
    row.gender ||
    row["Product Gender"] ||
    row["Target Gender"] ||
    row["Audience"];

  const explicitGender = normalizeGenderLabel(explicitValue);
  if (explicitGender) {
    return explicitGender;
  }

  const contextText = [
    row.Title,
    row.Type,
    row.Tags,
    row["Body HTML"],
    row["Product Category"],
    row["Collection"],
  ]
    .filter(Boolean)
    .join(" ");

  const inferredGender = normalizeGenderLabel(contextText);
  if (inferredGender) {
    return inferredGender;
  }

  return "Unisex";
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

export function parseProductsExport(filePath) {
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
      const gender = inferGender(row);

      groups.set(handle, {
        id: String(row.ID || handle),
        handle,
        name: row.Title,
        price: Number(row["Variant Price"] || row["Price / India"] || 0),
        compare_at_price: Number(row["Variant Compare At Price"] || row["Compare At Price / India"] || 0),
        category: row.Type,
        gender,
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
        reason: `${row.Type} pick from the imported catalog`,
      });
    }

    const product = groups.get(handle);
    product.gender = mergeGender(product.gender, inferGender(row));
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

    const sourceVariantId = String(row["Variant ID"] || "").trim();
    const rowNumber = String(row["Row #"] || "").trim();
    const variantKey = [product.id, sourceVariantId || "no-variant-id", rowNumber || "no-row-number"].join(":");

    product.variants.push({
      variant_id: variantKey,
      source_variant_id: sourceVariantId,
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
