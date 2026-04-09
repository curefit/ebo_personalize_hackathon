export const METABASE_CONFIG = {
  BASE_URL: "YOUR_METABASE_URL",
  API_KEY: "YOUR_METABASE_API_KEY",
  PRODUCTS_QUERY_ID: "YOUR_PRODUCTS_QUERY_ID",
  MEMBERS_QUERY_ID: "YOUR_MEMBERS_QUERY_ID",
  INVENTORY_QUERY_ID: "YOUR_INVENTORY_QUERY_ID",
  NEARBY_STORES_QUERY_ID: "YOUR_NEARBY_STORES_QUERY_ID",
};

export const CURRENT_STORE_ID = "STORE_001";
export const CURRENT_STORE_NAME = "EBO - MG Road";
export const ONLINE_DELIVERY_WINDOW = "2-3 days";

export const MEMBER_OPTIONS = [
  { label: "I am a Cult Member", value: "member" },
  { label: "Continue as guest", value: "guest" },
];

export const ACTIVITY_OPTIONS = ["Gym", "Running", "Yoga", "Casual", "Sports"];
export const FIT_OPTIONS = ["Lightweight", "Regular", "Baggy"];
export const MATERIAL_OPTIONS = ["Cotton", "Polyester", "Blend", "Moisture-wicking"];
export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

export const NON_MEMBER_QUESTIONS = [
  {
    id: "activity",
    title: "What's your main activity?",
    subtitle: "We'll tailor the rack to how you move.",
    options: ACTIVITY_OPTIONS,
  },
  {
    id: "preferred_fit",
    title: "Which fit feels right?",
    subtitle: "Choose the silhouette you naturally reach for.",
    options: FIT_OPTIONS,
  },
  {
    id: "material_preference",
    title: "Pick your preferred fabric.",
    subtitle: "We'll bias recommendations toward your comfort preference.",
    options: MATERIAL_OPTIONS,
  },
];

export const DEFAULT_GUEST_NAME = "Guest Athlete";

export const APP_COPY = {
  heroTitle: "Built for the way you move",
  heroSubtitle: "Discover the best tees for your profile and preview them instantly.",
  browseTitle: "Recommended for your profile",
};
