import { DEFAULT_GUEST_NAME } from "./constants.js";

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function normalizePhoneNumber(value = "") {
  return String(value).replace(/\D/g, "").slice(-10);
}

export function createSvgDataUri(svgMarkup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
}

export function buildProductArtwork({
  name,
  accent = "#1d4ed8",
  background = "#eff6ff",
  secondary = "#f97316",
  badge = "EBO",
}) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="860" viewBox="0 0 720 860" fill="none">
      <rect width="720" height="860" rx="40" fill="${background}" />
      <circle cx="600" cy="128" r="116" fill="${secondary}" fill-opacity="0.14" />
      <circle cx="124" cy="720" r="168" fill="${accent}" fill-opacity="0.12" />
      <path d="M272 126c30-26 146-26 176 0l72 78c30 32 28 82-6 108l-46 36v312c0 34-28 62-62 62H314c-34 0-62-28-62-62V348l-46-36c-34-26-36-76-6-108l72-78Z" fill="${accent}" />
      <path d="M308 186c18 18 88 18 106 0" stroke="#fff" stroke-width="18" stroke-linecap="round" />
      <path d="M246 364h228" stroke="rgba(255,255,255,0.28)" stroke-width="10" />
      <path d="M246 454h228" stroke="rgba(255,255,255,0.18)" stroke-width="8" />
      <rect x="106" y="92" width="118" height="42" rx="21" fill="#111827" />
      <text x="165" y="119" text-anchor="middle" fill="#fff" font-size="20" font-family="Arial, sans-serif" font-weight="700">${badge}</text>
      <text x="70" y="774" fill="#0f172a" font-size="42" font-family="Arial, sans-serif" font-weight="700">${name}</text>
      <text x="70" y="818" fill="#334155" font-size="24" font-family="Arial, sans-serif">Performance edit for the smart kiosk demo</text>
    </svg>
  `;

  return createSvgDataUri(svg);
}

export function buildGuestName(activity) {
  if (!activity) {
    return DEFAULT_GUEST_NAME;
  }

  return `${activity} Explorer`;
}

export function buildProfileHeadline(profile) {
  if (!profile) {
    return "your profile";
  }

  if (profile.userType === "member") {
    return `${profile.activity || "fitness"} profile`;
  }

  return `${profile.activity || "guest"} preferences`;
}

export function getInitials(name = "") {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return initials || "EB";
}

export function getAvailabilityTone(totalQuantity = 0) {
  if (totalQuantity >= 8) {
    return "high";
  }

  if (totalQuantity > 0) {
    return "medium";
  }

  return "low";
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
