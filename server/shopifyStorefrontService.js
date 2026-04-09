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
    content.includes("tregging") ||
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

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  if (content.includes("mesh") || content.includes("breathable")) return "Breathable";
  return "Performance Fabric";
}

function inferGender(node) {
  const explicitGender =
    normalizeGenderLabel(node.gender) ||
    normalizeGenderLabel(node.category?.name) ||
    normalizeGenderLabel(node.productType);

  if (explicitGender) {
    return explicitGender;
  }

  const contextText = [
    node.title,
    node.productType,
    node.category?.name,
    node.vendor,
    node.tags?.join(" "),
    node.descriptionHtml,
    node.description,
  ]
    .filter(Boolean)
    .join(" ");

  return normalizeGenderLabel(contextText) || "Unisex";
}

function normalizeCategory(node) {
  const candidate = node.productType || node.category?.name || "Apparel";
  return String(candidate).replace(/\s+/g, " ").trim();
}

function buildReason(category) {
  return `${category} pick from the Shopify storefront sync`;
}

function mapProduct(node) {
  const description = stripHtml(node.descriptionHtml || node.description || "");
  const material = inferMaterial(`${node.title} ${description} ${node.tags?.join(" ") || ""}`);
  const variantEdges = node.variants?.edges || [];
  const variants = variantEdges.map(({ node: variantNode }) => {
    const options = Object.fromEntries((variantNode.selectedOptions || []).map((option) => [option.name, option.value]));
    const price = Number(variantNode.price?.amount || 0);
    return {
      variant_id: `${node.id}:${variantNode.id}`,
      source_variant_id: String(variantNode.id),
      sku: variantNode.sku || "",
      color: options.Color || options.Colour || "Default",
      size: options.Size || "Free Size",
      quantity: 0,
      price,
      image_url: variantNode.image?.url || node.featuredImage?.url || "",
    };
  });

  const prices = variants.map((variant) => variant.price).filter((value) => Number.isFinite(value));
  const compareAtPrices = variantEdges
    .map(({ node: variantNode }) => Number(variantNode.compareAtPrice?.amount || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const category = normalizeCategory(node);

  return {
    id: String(node.id),
    handle: node.handle,
    name: node.title,
    price: prices.length ? Math.min(...prices) : 0,
    compare_at_price: compareAtPrices.length ? Math.max(...compareAtPrices) : 0,
    category,
    gender: inferGender(node),
    image_url: node.featuredImage?.url || variants[0]?.image_url || "",
    material,
    material_tag: material,
    colors: unique(variants.map((variant) => variant.color)),
    sizes: unique(variants.map((variant) => variant.size)),
    activity: inferActivity(`${node.title} ${description} ${node.tags?.join(" ") || ""}`),
    fit: inferFit(node.title),
    description,
    material_composition: material,
    url: node.onlineStoreUrl || "",
    vendor: node.vendor || "",
    total_inventory_qty: 0,
    reason: buildReason(category),
    variants,
    search_document: `${node.title} ${description} ${node.tags?.join(" ") || ""}`.trim(),
  };
}

function buildStorefrontEndpoint(storeDomain, apiVersion) {
  const domain = String(storeDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}/api/${apiVersion}/graphql.json`;
}

async function storefrontRequest(endpoint, token, query, variables = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors) {
    const message =
      payload.errors?.map((error) => error.message).join(", ") ||
      payload.message ||
      `Shopify request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
}

export async function fetchStorefrontCatalog({
  storeDomain,
  storefrontToken,
  apiVersion = "2025-01",
  pageSize = 100,
  maxProducts = 400,
}) {
  const endpoint = buildStorefrontEndpoint(storeDomain, apiVersion);
  const query = `
    query SyncProducts($cursor: String, $pageSize: Int!) {
      products(first: $pageSize, after: $cursor, sortKey: TITLE) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            handle
            title
            description
            descriptionHtml
            vendor
            productType
            tags
            onlineStoreUrl
            featuredImage {
              url
            }
            variants(first: 25) {
              edges {
                node {
                  id
                  sku
                  price {
                    amount
                  }
                  compareAtPrice {
                    amount
                  }
                  image {
                    url
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const products = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage && products.length < maxProducts) {
    const data = await storefrontRequest(endpoint, storefrontToken, query, {
      cursor,
      pageSize: Math.min(pageSize, maxProducts - products.length),
    });

    const connection = data.products;
    for (const edge of connection.edges || []) {
      if (products.length >= maxProducts) {
        break;
      }

      products.push(mapProduct(edge.node));
    }

    hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
    cursor = connection.pageInfo?.endCursor || null;
  }

  return {
    products,
    metadata: {
      storeDomain,
      apiVersion,
      syncedAt: new Date().toISOString(),
      productCount: products.length,
      strategy: "storefront-api",
      vectorSearchReady: true,
      currentSearchMode: "keyword-plus-recommendation-heuristics",
    },
  };
}
