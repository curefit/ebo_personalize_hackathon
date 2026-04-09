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
    id: "workout_type",
    type: "choice",
    title: "What kind of workouts do you do?",
    subtitle: "Pick the closest match.",
    options: [
      "Cardio (running, cycling)",
      "Strength (weights, resistance)",
      "Flexibility (yoga, Pilates)",
      "Sports (football, tennis, etc.)",
      "Others",
    ],
  },
  {
    id: "gender",
    type: "choice",
    title: "What is your gender?",
    subtitle: "Used to filter the rack quickly.",
    options: ["Female", "Male"],
  },
  {
    id: "discomfort",
    type: "choice",
    title: "Do you experience any discomfort or pain?",
    subtitle: "Helps us tune the recommendation.",
    options: ["Foot/leg discomfort", "Back/shoulder pain", "No issues", "Others"],
  },
  {
    id: "style_priority",
    type: "choice",
    title: "Do you prioritize style or function?",
    subtitle: "Choose what matters most.",
    options: ["Style first", "Function first", "Both equally"],
  },
  {
    id: "workout_company",
    type: "choice",
    title: "Do you work out alone or with someone?",
    subtitle: "This helps personalize your shortlist.",
    options: ["Alone", "With a friend/partner", "Group classes"],
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
