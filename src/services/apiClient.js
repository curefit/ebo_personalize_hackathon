async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const payloadMessage =
      payload && typeof payload === "object" ? payload.message || payload.error || payload.detail : "";
    const fallbackMessage = response.status >= 500 ? "The service is temporarily unavailable." : "The request could not be completed.";
    throw new Error(payloadMessage || fallbackMessage);
  }

  return response.json();
}

export function loginMember(phone) {
  return request("/api/member/login", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function fetchExperience() {
  return request("/api/experience");
}

export function fetchProducts(filters = {}) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );

  return request(`/api/products${params.toString() ? `?${params.toString()}` : ""}`);
}

export function fetchInventory(productId) {
  return request(`/api/inventory/${productId}`);
}

export function fetchRecommendations(profile, limit = 10) {
  return request("/api/recommendations", {
    method: "POST",
    body: JSON.stringify({ profile, limit }),
  });
}

export function generateTryOn(payload, options = {}) {
  return request("/api/tryon", {
    method: "POST",
    body: JSON.stringify(payload),
    ...options,
  });
}

export function fetchAdminBootstrap() {
  return request("/api/admin/bootstrap");
}

export function loginAdmin(username, password) {
  return request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

function withAdminHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function fetchBackOffice(token) {
  return request("/api/admin/backoffice", {
    headers: withAdminHeaders(token),
  });
}

export function saveShopifySettings(token, payload) {
  return request("/api/admin/shopify/settings", {
    method: "POST",
    headers: withAdminHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function triggerShopifySync(token, payload = {}) {
  return request("/api/admin/shopify/sync", {
    method: "POST",
    headers: withAdminHeaders(token),
    body: JSON.stringify(payload),
  });
}
