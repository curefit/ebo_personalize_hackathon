export const SERVER_METABASE_CONFIG = {
  BASE_URL: process.env.METABASE_BASE_URL || "https://metabase.curefit.co",
  API_KEY:
    process.env.METABASE_API_KEY || "mb_rSLw0niKojXHbPmg2QqgnjNaoDrTjQHLb6YJ+fPb5XM=",
  DATABASE_ID: Number(process.env.METABASE_DATABASE_ID || 39),
  PRODUCTS_QUERY_ID: process.env.METABASE_PRODUCTS_QUERY_ID || "",
  MEMBERS_QUERY_ID: process.env.METABASE_MEMBERS_QUERY_ID || "",
  INVENTORY_QUERY_ID: process.env.METABASE_INVENTORY_QUERY_ID || "",
  NEARBY_STORES_QUERY_ID: process.env.METABASE_NEARBY_STORES_QUERY_ID || "",
};

export function isMetabaseConfigured() {
  return Boolean(SERVER_METABASE_CONFIG.BASE_URL && SERVER_METABASE_CONFIG.API_KEY);
}
