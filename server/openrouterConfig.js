export const OPENROUTER_CONFIG = {
  BASE_URL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  API_KEY: process.env.OPENROUTER_API_KEY || "",
  MODEL: process.env.OPENROUTER_MODEL || "google/gemini-3.1-flash-image-preview",
  APP_URL: process.env.OPENROUTER_APP_URL || "http://localhost:5173",
  APP_NAME: process.env.OPENROUTER_APP_NAME || "EBO Smart Kiosk",
};

export function isOpenRouterConfigured() {
  return Boolean(OPENROUTER_CONFIG.API_KEY);
}
