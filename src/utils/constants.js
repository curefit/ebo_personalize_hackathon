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
  {
    label: "Member",
    value: "member",
    description: "Load a saved profile.",
  },
  {
    label: "Guest",
    value: "guest",
    description: "Start a quick brief.",
  },
];

export const ACTIVITY_OPTIONS = ["Gym", "Running", "Yoga", "Casual", "Sports"];
export const GENDER_OPTIONS = ["Any", "Women", "Men", "Unisex"];
export const FIT_OPTIONS = ["Lightweight", "Regular", "Baggy"];
export const MATERIAL_OPTIONS = ["Cotton", "Polyester", "Blend", "Moisture-wicking", "Breathable"];
export const SESSION_GOAL_OPTIONS = ["Train hard", "All day wear", "Studio ease", "Layering", "Complete look"];
export const BUDGET_OPTIONS = ["Smart", "Balanced", "Premium"];
export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

export const GUEST_QUESTION_BANK = [
  {
    id: "activity",
    type: "choice",
    title: "What are they dressing for?",
    subtitle: "Start with the main use case.",
    options: ACTIVITY_OPTIONS,
  },
  {
    id: "preferred_fit",
    type: "choice",
    title: "Which fit should lead?",
    subtitle: "Pick the silhouette they wear most.",
    options: FIT_OPTIONS,
  },
  {
    id: "material_preference",
    type: "choice",
    title: "What feel should we favor?",
    subtitle: "Choose the fabric story that fits best.",
    options: MATERIAL_OPTIONS,
  },
  {
    id: "budget_band",
    type: "choice",
    title: "What price band should we stay in?",
    subtitle: "Keep the shortlist realistic.",
    options: BUDGET_OPTIONS,
  },
];

export const DEFAULT_GUEST_NAME = "Walk-in Shopper";

export const APP_COPY = {
  brand: "EBO",
  heroTitle: "Pick the shopper. Build the edit.",
  heroSubtitle: "Use a member profile or a quick guest brief, then refine the rack in seconds.",
  heroEyebrow: "Store styling",
  browseTitle: "Edit",
  browseSubtitle: "Ranked by fit, fabric, and inventory confidence.",
};
