import {
  getProductDocument,
  inferProductGender,
  normalizeCategory,
  parseShopperIntent,
  tokenizeText,
} from "../utils/queryIntent.js";

const ACTIVITY_NEIGHBORS = {
  gym: ["sports", "running"],
  running: ["gym", "sports"],
  yoga: ["casual"],
  casual: ["yoga"],
  sports: ["gym", "running"],
};

const MATERIAL_KEYWORDS = {
  cotton: ["cotton", "soft", "natural"],
  polyester: ["polyester", "mesh", "quick dry", "quick-dry"],
  blend: ["blend", "modal", "mix"],
  "moisture-wicking": ["moisture", "dry", "breathable", "sweat", "performance"],
  breathable: ["breathable", "mesh", "airy", "ventilation"],
  sculpted: ["structure", "support", "clean", "sharp"],
};

const CLIMATE_KEYWORDS = {
  cool: ["light", "breathable", "ventilation", "mesh", "airy"],
  commute: ["versatile", "soft", "everyday", "clean", "polished"],
  allweather: ["layer", "performance", "dry", "stretch"],
};

const BUDGET_BANDS = {
  smart: [0, 999],
  balanced: [900, 1299],
  premium: [1200, 99999],
};

function normalizeValue(value = "") {
  return String(value).trim().toLowerCase();
}

function overlapScore(target, variants = []) {
  if (!target) {
    return 0;
  }

  const targetValue = normalizeValue(target);
  return variants.some((variant) => normalizeValue(variant) === targetValue) ? 1 : 0;
}

function includesKeyword(productText, keywords = []) {
  const normalized = normalizeValue(productText);
  return keywords.some((keyword) => normalized.includes(normalizeValue(keyword)));
}

function genderScore(product, profile, intent) {
  const preferredGender = profile?.gender && normalizeValue(profile.gender) !== "any" ? profile.gender : intent.gender;
  if (!preferredGender) {
    return 0;
  }

  const productGender = inferProductGender(product);
  if (normalizeValue(productGender) === normalizeValue(preferredGender)) {
    return 24;
  }

  if (normalizeValue(productGender) === "unisex") {
    return 8;
  }

  return -18;
}

function budgetScore(price, budget = {}) {
  const band = normalizeValue(budget?.band || budget);
  const ceiling = Number(budget?.ceiling || 0);

  if (Number.isFinite(ceiling) && ceiling > 0) {
    if (price <= ceiling) {
      const slack = ceiling - price;
      return 18 + Math.max(0, 4 - Math.round(slack / 250));
    }

    const overrun = price - ceiling;
    return Math.max(0, 12 - Math.round(overrun / 120));
  }

  if (!band || !BUDGET_BANDS[band]) {
    return 0;
  }

  const [min, max] = BUDGET_BANDS[band];
  if (price >= min && price <= max) {
    return 14;
  }

  const distance = price < min ? min - price : price - max;
  return Math.max(0, 10 - Math.round(distance / 125));
}

function inventoryScore(product) {
  const quantity = Number(product.total_inventory_qty || 0);

  if (quantity >= 12) {
    return 14;
  }

  if (quantity >= 4) {
    return 8;
  }

  if (quantity > 0) {
    return 3;
  }

  return -10;
}

function categoryScore(product, profile) {
  const category = normalizeCategory(product.category);
  const mode = normalizeValue(profile?.shopping_mode);

  if (["tee", "polo", "tank"].includes(category)) {
    return mode === "layering" ? 18 : 28;
  }

  if (["shorts", "joggers", "track-pants"].includes(category)) {
    return mode === "complete look" ? 20 : 10;
  }

  if (category === "jacket") {
    return mode === "layering" ? 26 : 6;
  }

  return 0;
}

function activityScore(product, profile) {
  const activity = normalizeValue(product.activity);
  const shopperActivity = normalizeValue(profile?.activity);

  if (!shopperActivity) {
    return 0;
  }

  if (activity === shopperActivity) {
    return 44;
  }

  return ACTIVITY_NEIGHBORS[shopperActivity]?.includes(activity) ? 16 : 0;
}

function fitScore(product, profile) {
  const productFit = normalizeValue(product.fit);
  const preferredFit = normalizeValue(profile?.preferred_fit);

  if (!preferredFit) {
    return 0;
  }

  if (productFit === preferredFit) {
    return 22;
  }

  if ((preferredFit === "baggy" && productFit === "regular") || (preferredFit === "regular" && productFit === "baggy")) {
    return 10;
  }

  return 0;
}

function materialScore(product, profile) {
  const preference = normalizeValue(profile?.material_preference);
  if (!preference) {
    return 0;
  }

  const haystack = `${product.material} ${product.material_tag} ${product.description}`;
  const keywords = MATERIAL_KEYWORDS[preference] || [preference];
  return includesKeyword(haystack, keywords) ? 18 : 0;
}

function climateScore(product, profile) {
  const climate = normalizeValue(profile?.climate_preference);
  if (!climate) {
    return 0;
  }

  const keywords = CLIMATE_KEYWORDS[climate] || [climate];
  return includesKeyword(`${product.description} ${product.material}`, keywords) ? 12 : 0;
}

function noteScore(product, profile, intent = {}) {
  const note = normalizeValue(profile?.style_note);
  const keywords = intent.keywords?.length ? intent.keywords : tokenizeText(note).slice(0, 8);

  if (!note && !keywords.length) {
    return 0;
  }

  const productText = getProductDocument(product);
  const matches = keywords.filter((keyword) => keyword.length > 2 && normalizeValue(productText).includes(keyword));
  return Math.min(matches.length * 4, 18);
}

function intensityScore(product, profile) {
  const goal = normalizeValue(profile?.session_goal);

  if (!goal) {
    return 0;
  }

  const text = `${product.name} ${product.description} ${product.material}`;

  if (goal === "train hard") {
    return includesKeyword(text, ["performance", "breathable", "tempo", "high-intensity", "fast-dry"]) ? 12 : 0;
  }

  if (goal === "all day wear") {
    return includesKeyword(text, ["soft", "everyday", "polished", "comfort"]) ? 12 : 0;
  }

  if (goal === "studio ease") {
    return includesKeyword(text, ["soft", "relaxed", "studio", "draped"]) ? 12 : 0;
  }

  return 0;
}

function intentScore(product, intent) {
  if (!intent?.raw) {
    return 0;
  }

  let score = 0;
  const document = getProductDocument(product);
  const category = normalizeCategory(product.category);
  const keywords = intent.keywords || [];

  if (intent.activity && normalizeValue(product.activity) === normalizeValue(intent.activity)) {
    score += 18;
  }

  if (intent.preferred_fit && normalizeValue(product.fit) === normalizeValue(intent.preferred_fit)) {
    score += 14;
  }

  if (intent.material_preference && includesPhrase(document, intent.material_preference)) {
    score += 12;
  }

  if (intent.categories?.length && intent.categories.includes(category)) {
    score += 18;
  }

  if (intent.colors?.length && intent.colors.some((color) => document.includes(normalizeValue(color)))) {
    score += 10;
  }

  if (keywords.length) {
    const matches = keywords.filter((keyword) => keyword.length > 2 && document.includes(normalizeValue(keyword)));
    score += Math.min(matches.length * 3, 12);
  }

  if (intent.budget_band || intent.budget_ceiling) {
    score += budgetScore(Number(product.price || 0), {
      band: normalizeValue(intent.budget_band),
      ceiling: intent.budget_ceiling,
    });
  }

  score += genderScore(product, {}, intent);

  return score;
}

function includesPhrase(text, phrase) {
  return normalizeValue(text).includes(normalizeValue(phrase));
}

function buildReasons(product, profile) {
  const reasons = [];
  const intent = parseShopperIntent(profile?.style_note || "");
  const shopperActivity = normalizeValue(profile?.activity);
  const productActivity = normalizeValue(product.activity);
  const productCategory = normalizeCategory(product.category);
  const productDocument = getProductDocument(product);

  if (shopperActivity && shopperActivity === productActivity) {
    reasons.push(`${product.activity} match`);
  }

  if (normalizeValue(profile?.preferred_fit) && normalizeValue(product.fit) === normalizeValue(profile.preferred_fit)) {
    reasons.push(`${product.fit} fit`);
  }

  if (!normalizeValue(profile?.preferred_fit) && intent.preferred_fit && normalizeValue(product.fit) === normalizeValue(intent.preferred_fit)) {
    reasons.push(`${intent.preferred_fit} fit`);
  }

  if (materialScore(product, profile) > 0) {
    reasons.push(`${profile.material_preference} feel`);
  } else if (intent.material_preference && includesPhrase(getProductDocument(product), intent.material_preference)) {
    reasons.push(`${intent.material_preference} feel`);
  }

  if (intent.gender && genderScore(product, profile, intent) > 0) {
    reasons.push(`${inferProductGender(product)} silhouette`);
  }

  if (intent.categories?.length && intent.categories.includes(productCategory)) {
    reasons.push(`${product.category} match`);
  }

  if (intent.colors?.length) {
    const matchingColor = (product.colors || []).find((color) => intent.colors.some((item) => includesPhrase(color, item)));
    if (matchingColor) {
      reasons.push(`${matchingColor} palette`);
    }
  }

  if (intent.keywords?.length) {
    const keywordHit = intent.keywords.find((keyword) => keyword.length > 2 && includesPhrase(productDocument, keyword));
    if (keywordHit) {
      reasons.push(`"${keywordHit}" brief`);
    }
  }

  if (intent.budget_ceiling && Number(product.price || 0) <= intent.budget_ceiling) {
    reasons.push(intent.budget_label ? `${intent.budget_label} budget` : "within budget");
  }

  if (climateScore(product, profile) > 0) {
    reasons.push(`${profile.climate_preference} weather`);
  }

  if (inventoryScore(product) > 0) {
    reasons.push("ready in store");
  }

  return reasons.slice(0, 3);
}

function scoreProduct(product, shopperProfile) {
  const profile = shopperProfile || {};
  const intent = parseShopperIntent(profile.style_note || "");
  const budget = {
    band: profile.budget_band || intent.budget_band,
    ceiling: intent.budget_ceiling,
  };

  let score = 0;
  score += categoryScore(product, profile);
  score += activityScore(product, profile);
  score += fitScore(product, profile);
  score += materialScore(product, profile);
  score += climateScore(product, profile);
  score += intensityScore(product, profile);
  score += noteScore(product, profile, intent);
  score += genderScore(product, profile, intent);
  score += intentScore(product, intent);
  score += budgetScore(Number(product.price || 0), budget);
  score += inventoryScore(product);

  if (normalizeValue(profile.userType) === "member") {
    score += 6;
  }

  return score;
}

function diversifyProducts(products, count) {
  const picks = [];
  const seenCategories = new Map();

  for (const product of products) {
    const category = normalizeCategory(product.category);
    const seenCount = seenCategories.get(category) || 0;
    const limit = ["tee", "polo", "tank"].includes(category) ? 6 : 3;

    if (seenCount >= limit) {
      continue;
    }

    picks.push(product);
    seenCategories.set(category, seenCount + 1);

    if (picks.length >= count) {
      break;
    }
  }

  return picks;
}

export function buildRecommendationReason(product, shopperProfile) {
  const reasons = buildReasons(product, shopperProfile);

  if (!reasons.length) {
    return product.reason || "Strong everyday match";
  }

  return reasons.join(" · ");
}

export function summarizeProfile(profile) {
  if (!profile) {
    return {
      headline: "Start with a quick brief",
      subline: "We will tune the rack to fit, fabric, and where the shopper is headed next.",
    };
  }

  const intent = parseShopperIntent(profile.style_note || "");
  const bits = [
    profile.gender && profile.gender !== "Any" ? profile.gender : "",
    profile.activity,
    profile.preferred_fit,
    profile.material_preference,
    intent.categories?.[0],
    intent.colors?.[0],
    intent.budget_label,
  ].filter(Boolean);

  return {
    headline: `${profile.name || "Shopper"}'s edit`,
    subline: bits.join(" · ") || "Sharper suggestions are ready.",
  };
}

export function getRecommendations(products, shopperProfile, count = 8) {
  const sorted = [...products]
    .map((product) => ({
      ...product,
      recommendationScore: scoreProduct(product, shopperProfile),
    }))
    .sort((left, right) => right.recommendationScore - left.recommendationScore);

  return diversifyProducts(sorted, count).map((product, index) => ({
    ...product,
    ranking: index + 1,
    recommendationReason: buildRecommendationReason(product, shopperProfile),
  }));
}
