const CATEGORY_ALIASES = {
  "t-shirt": "tee",
  "t-shirts": "tee",
  tshirt: "tee",
  tshirts: "tee",
  tee: "tee",
  tees: "tee",
  "polo t-shirt": "polo",
  polo: "polo",
  "tank top": "tank",
  tank: "tank",
  shorts: "shorts",
  short: "shorts",
  joggers: "joggers",
  jogger: "joggers",
  leggings: "tights",
  legging: "tights",
  treggings: "tights",
  tregging: "tights",
  tights: "tights",
  jacket: "jacket",
  hoodie: "jacket",
  sweatshirt: "jacket",
  "sports bra": "sports-bra",
  bra: "sports-bra",
};

const INTENT_DICTIONARIES = {
  gender: {
    Women: ["women", "woman", "womens", "ladies", "female", "girl"],
    Men: ["men", "man", "mens", "male", "guy", "guys", "boy"],
    Unisex: ["unisex", "gender neutral", "all gender"],
  },
  activity: {
    Gym: ["gym", "workout", "training", "train", "lifting", "strength"],
    Running: ["run", "running", "jog", "marathon", "cardio"],
    Yoga: ["yoga", "studio", "pilates", "stretch", "flow"],
    Sports: ["sport", "sports", "football", "cricket", "tennis", "match"],
    Casual: ["casual", "everyday", "commute", "lounge", "daily"],
  },
  fit: {
    Baggy: ["baggy", "oversized", "relaxed", "loose"],
    Regular: ["regular", "standard", "classic"],
    Lightweight: ["lightweight", "light", "airy", "barely there"],
  },
  material: {
    Cotton: ["cotton"],
    Polyester: ["polyester"],
    Blend: ["blend", "blended", "modal"],
    "Moisture-wicking": ["moisture wicking", "moisture-wicking", "quick dry", "quick-dry", "sweat wicking"],
    Breathable: ["breathable", "mesh", "airy", "ventilation"],
  },
  category: {
    tee: ["tee", "tees", "t-shirt", "tshirts", "tshirt", "top"],
    polo: ["polo"],
    tank: ["tank", "tank top", "sleeveless"],
    shorts: ["shorts", "short"],
    joggers: ["joggers", "jogger", "track pants", "trackpant", "pants", "bottoms"],
    tights: ["tights", "legging", "leggings", "treggings", "tregging"],
    jacket: ["jacket", "hoodie", "sweatshirt", "outerwear"],
    "sports-bra": ["sports bra", "bra"],
  },
  budget: {
    Smart: ["budget", "affordable", "value", "cheaper", "cheap", "entry"],
    Balanced: ["balanced", "mid-range", "midrange"],
    Premium: ["premium", "best", "top", "luxury", "high-end"],
  },
  color: {
    black: ["black", "dark"],
    white: ["white", "off white"],
    grey: ["grey", "gray", "charcoal", "slate"],
    navy: ["navy", "midnight"],
    blue: ["blue", "cobalt"],
    green: ["green", "olive", "lime"],
    red: ["red", "crimson", "maroon"],
    pink: ["pink", "rose", "lilac", "coral"],
    purple: ["purple", "violet"],
    beige: ["beige", "sand", "bone", "cream", "tan"],
  },
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "around",
  "as",
  "at",
  "best",
  "for",
  "from",
  "good",
  "her",
  "him",
  "in",
  "is",
  "it",
  "like",
  "me",
  "my",
  "near",
  "nice",
  "of",
  "on",
  "or",
  "please",
  "show",
  "something",
  "that",
  "the",
  "their",
  "them",
  "this",
  "to",
  "under",
  "with",
  "want",
  "need",
  "looking",
]);

function normalizeValue(value = "") {
  return String(value).trim().toLowerCase();
}

export function tokenizeText(value = "") {
  return normalizeValue(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function includesPhrase(haystack, phrase) {
  return haystack.includes(normalizeValue(phrase));
}

function findFirstIntentMatch(haystack, dictionary) {
  return Object.entries(dictionary).find(([, variants]) => variants.some((variant) => includesPhrase(haystack, variant)))?.[0] || "";
}

function findAllIntentMatches(haystack, dictionary) {
  return Object.entries(dictionary)
    .filter(([, variants]) => variants.some((variant) => includesPhrase(haystack, variant)))
    .map(([label]) => label);
}

function inferBudgetBand(haystack) {
  if (/\b(affordable|budget|value|cheap|entry|low cost|cost conscious|under)\b/.test(haystack)) {
    return "Smart";
  }

  if (/\b(mid-range|midrange|balanced|versatile|everyday|reasonable|moderate)\b/.test(haystack)) {
    return "Balanced";
  }

  if (/\b(premium|luxury|high-end|high end|best|elevated|splurge)\b/.test(haystack)) {
    return "Premium";
  }

  return "";
}

function inferBudgetCeiling(haystack) {
  const ceilingMatch = haystack.match(
    /\b(?:under|below|less than|max|maximum|up to|within|around|about|near)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(k|thousand)?\b/,
  );
  const bareAmountMatch = haystack.match(/\b(\d+(?:\.\d+)?)\s*(k|thousand)\b/);
  const directNumberMatch = haystack.match(/\b(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\b/);
  const match = ceilingMatch || bareAmountMatch || directNumberMatch;

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const multiplier = match[2] ? 1000 : 1;
  const ceiling = Math.round(amount * multiplier);

  return Number.isFinite(ceiling) && ceiling > 0 ? ceiling : null;
}

function buildIntentKeywords(haystack, dictionaries = []) {
  const excluded = new Set(
    dictionaries.flatMap((dictionary) => Object.values(dictionary).flat()).map((value) => normalizeValue(value)),
  );

  return tokenizeText(haystack)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token) && !excluded.has(token))
    .slice(0, 10);
}

export function normalizeCategory(category = "") {
  return CATEGORY_ALIASES[normalizeValue(category)] || normalizeValue(category);
}

export function inferProductGender(product = {}) {
  const explicitGender = normalizeValue(product.gender);
  if (explicitGender) {
    if (["men", "male"].includes(explicitGender)) return "Men";
    if (["women", "female"].includes(explicitGender)) return "Women";
    if (explicitGender === "unisex") {
      // Continue to infer from product text because some catalog entries are mislabeled as unisex.
    } else {
      return "Unisex";
    }
  }

  const category = normalizeCategory(product.category);
  const nameAndCategory = normalizeValue(`${product.name || ""} ${product.category || ""}`);
  if (/(^|\\s)(tights|legging|leggings|treggings|tregging|sports bra|bralette)(\\s|$)/.test(nameAndCategory)) {
    if (/(^|\\s)(men|male|man|mens)(\\s|$)/.test(nameAndCategory)) {
      return "Men";
    }

    return "Women";
  }

  const text = getProductDocument(product);
  const inferredGender = findFirstIntentMatch(text, INTENT_DICTIONARIES.gender);
  if (inferredGender) {
    return inferredGender;
  }

  return category === "sports-bra" ? "Women" : "Unisex";
}

export function getProductDocument(product = {}) {
  return normalizeValue(
    [
      product.name,
      product.category,
      product.description,
      product.material,
      product.material_tag,
      product.fit,
      product.activity,
      product.gender,
      ...(product.colors || []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function parseShopperIntent(text = "") {
  const normalized = normalizeValue(text);
  const tokens = tokenizeText(normalized);
  const budgetBand = findFirstIntentMatch(normalized, INTENT_DICTIONARIES.budget);
  const budgetCeiling = inferBudgetCeiling(normalized);
  const keywords = buildIntentKeywords(normalized, [
    INTENT_DICTIONARIES.gender,
    INTENT_DICTIONARIES.activity,
    INTENT_DICTIONARIES.fit,
    INTENT_DICTIONARIES.material,
    INTENT_DICTIONARIES.category,
    INTENT_DICTIONARIES.color,
    INTENT_DICTIONARIES.budget,
  ]);

  return {
    raw: text,
    tokens,
    gender: findFirstIntentMatch(normalized, INTENT_DICTIONARIES.gender),
    activity: findFirstIntentMatch(normalized, INTENT_DICTIONARIES.activity),
    preferred_fit: findFirstIntentMatch(normalized, INTENT_DICTIONARIES.fit),
    material_preference: findFirstIntentMatch(normalized, INTENT_DICTIONARIES.material),
    budget_band: budgetBand,
    budget_ceiling: budgetCeiling,
    budget_label: budgetBand || (budgetCeiling ? `Under ${budgetCeiling}` : ""),
    categories: findAllIntentMatches(normalized, INTENT_DICTIONARIES.category),
    colors: findAllIntentMatches(normalized, INTENT_DICTIONARIES.color),
    keywords,
  };
}

export function matchesIntentFilters(product, intent = {}) {
  const document = getProductDocument(product);
  const productGender = inferProductGender(product);
  const productCategory = normalizeCategory(product.category);

  if (intent.gender && productGender !== intent.gender && productGender !== "Unisex") {
    return false;
  }

  if (intent.activity && normalizeValue(product.activity) !== normalizeValue(intent.activity)) {
    return false;
  }

  if (intent.preferred_fit && normalizeValue(product.fit) !== normalizeValue(intent.preferred_fit)) {
    return false;
  }

  if (intent.material_preference && !includesPhrase(document, intent.material_preference)) {
    return false;
  }

  if (typeof intent.budget_ceiling === "number" && Number.isFinite(intent.budget_ceiling) && Number(product.price || 0) > intent.budget_ceiling) {
    return false;
  }

  if (intent.categories?.length && !intent.categories.includes(productCategory)) {
    return false;
  }

  if (intent.colors?.length && !intent.colors.some((color) => includesPhrase(document, color))) {
    return false;
  }

  return true;
}

export function scoreProductIntentMatch(product, intent = {}, query = "") {
  const normalizedQuery = normalizeValue(query);
  if (!normalizedQuery) {
    return 0;
  }

  const document = getProductDocument(product);
  const category = normalizeCategory(product.category);
  let score = 0;

  if (matchesIntentFilters(product, intent)) {
    score += 18;
  }

  if (intent.categories?.length && intent.categories.includes(category)) {
    score += 18;
  }

  if (intent.activity && normalizeValue(product.activity) === normalizeValue(intent.activity)) {
    score += 16;
  }

  if (intent.preferred_fit && normalizeValue(product.fit) === normalizeValue(intent.preferred_fit)) {
    score += 12;
  }

  if (intent.material_preference && includesPhrase(document, intent.material_preference)) {
    score += 12;
  }

  if (intent.gender) {
    const productGender = inferProductGender(product);
    if (productGender === intent.gender) {
      score += 14;
    } else if (productGender === "Unisex") {
      score += 6;
    }
  }

  if (intent.colors?.length) {
    const colorMatches = intent.colors.filter((color) => includesPhrase(document, color));
    score += colorMatches.length * 8;
  }

  if (intent.keywords?.length) {
    const keywordMatches = intent.keywords.filter((keyword) => includesPhrase(document, keyword));
    score += keywordMatches.length * 4;
  }

  if (!score && includesPhrase(document, normalizedQuery)) {
    score += 12;
  }

  return score;
}
