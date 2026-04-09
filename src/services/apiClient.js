async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Request failed");
  }

  return response.json();
}

export function loginMember(phone) {
  return request("/api/member/login", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
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

export function generateTryOn(payload) {
  return request("/api/tryon", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
