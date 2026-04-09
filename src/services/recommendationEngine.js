function scoreProduct(product, shopperProfile) {
  let score = 0;
  const category = String(product.category || "").toLowerCase();

  if (!shopperProfile) {
    return score;
  }

  if (category === "t-shirt") {
    score += 55;
  } else if (category === "polo t-shirt") {
    score += 38;
  } else if (category === "tank top") {
    score += 30;
  } else if (["shorts", "joggers", "track pants", "jacket", "sports bra"].includes(category)) {
    score += 10;
  }

  if (product.activity === shopperProfile.activity) {
    score += 60;
  }

  if (product.fit === shopperProfile.preferred_fit) {
    score += 25;
  }

  const materialPreference = shopperProfile.material_preference || "";
  if (
    materialPreference &&
    `${product.material} ${product.material_tag}`.toLowerCase().includes(materialPreference.toLowerCase())
  ) {
    score += 20;
  }

  if (shopperProfile.userType === "member") {
    score += shopperProfile.fitness_level === "Advanced" ? 10 : 4;
  }

  return score;
}

function diversifyProducts(products, count) {
  const teeFirst = [];
  const secondary = [];

  for (const product of products) {
    const category = String(product.category || "").toLowerCase();
    if (["t-shirt", "polo t-shirt", "tank top"].includes(category)) {
      teeFirst.push(product);
    } else {
      secondary.push(product);
    }
  }

  const primaryCount = Math.max(Math.min(count - 4, teeFirst.length), 0);
  const picks = [...teeFirst.slice(0, primaryCount)];

  for (const product of secondary) {
    if (picks.length >= count) {
      break;
    }
    picks.push(product);
  }

  for (const product of teeFirst.slice(primaryCount)) {
    if (picks.length >= count) {
      break;
    }
    picks.push(product);
  }

  return picks;
}

export function buildRecommendationReason(product, shopperProfile) {
  if (!shopperProfile) {
    return product.reason;
  }

  if (shopperProfile.userType === "member") {
    if (product.activity === shopperProfile.activity) {
      return `Popular with ${shopperProfile.activity} members`;
    }

    return `Matches your ${shopperProfile.activity.toLowerCase()} profile`;
  }

  return `Best for ${shopperProfile.preferred_fit.toLowerCase()} fit and ${shopperProfile.material_preference.toLowerCase()}`;
}

export function getRecommendations(products, shopperProfile, count = 6) {
  return diversifyProducts(
    [...products]
    .sort((left, right) => scoreProduct(right, shopperProfile) - scoreProduct(left, shopperProfile))
    ,
    count,
  )
    .map((product, index) => ({
      ...product,
      ranking: index + 1,
      recommendationReason: buildRecommendationReason(product, shopperProfile),
    }));
}
