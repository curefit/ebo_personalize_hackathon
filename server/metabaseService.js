import { SERVER_METABASE_CONFIG, isMetabaseConfigured } from "./metabaseConfig.js";

function normalizeRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload?.data) {
    return [];
  }

  const rows = payload.data.rows || [];
  const cols = payload.data.cols || [];

  if (!rows.length) {
    return [];
  }

  if (typeof rows[0] === "object" && !Array.isArray(rows[0])) {
    return rows;
  }

  return rows.map((row) =>
    row.reduce((accumulator, value, index) => {
      const key = cols[index]?.name || `column_${index}`;
      accumulator[key] = value;
      return accumulator;
    }, {}),
  );
}

async function metabaseRequest(path, body) {
  if (!isMetabaseConfigured()) {
    throw new Error("Metabase configuration is incomplete.");
  }

  const response = await fetch(`${SERVER_METABASE_CONFIG.BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERVER_METABASE_CONFIG.API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Metabase request failed with status ${response.status}`);
  }

  return response.json();
}

export async function queryMetabaseNative(sql) {
  const payload = await metabaseRequest("/api/dataset", {
    database: SERVER_METABASE_CONFIG.DATABASE_ID,
    type: "native",
    native: {
      query: sql,
    },
  });

  return normalizeRows(payload);
}

export async function fetchFromMetabaseCard(queryId, parameters = {}) {
  const payload = await metabaseRequest(`/api/card/${queryId}/query/json`, { parameters });
  return normalizeRows(payload);
}

export async function fetchCultAppMemberByPhone(phone) {
  const sanitized = String(phone).replace(/\D/g, "");

  if (sanitized.length !== 10) {
    return null;
  }

  const rows = await queryMetabaseNative(`
    select
      cast(id as varchar) as user_id,
      phone,
      firstname,
      lastname,
      gender,
      isphoneverified,
      updatedat
    from pk_cfuserservice_cultapp.user
    where regexp_replace(coalesce(phone, ''), '[^0-9]', '') in ('${sanitized}', '91${sanitized}')
    order by isphoneverified desc, updatedat desc
    limit 1
  `);

  if (!rows[0]) {
    return null;
  }

  return rows[0];
}

function sanitizeSkuCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function fetchItemDetailsSummaryBySkus(skuCodes = []) {
  const normalizedSkus = [...new Set(skuCodes.map(sanitizeSkuCode).filter(Boolean))].slice(0, 240);
  if (!normalizedSkus.length) {
    return [];
  }

  const skuListSql = normalizedSkus.map((sku) => `'${sku.replace(/'/g, "''")}'`).join(", ");
  const rows = await queryMetabaseNative(`
    with normalized_items as (
      select
        upper(replace(replace(replace(replace(trim(coalesce(_item_number, '')), '!', ''), ' ', ''), '-', ''), '/', '')) as normalized_item_number,
        upper(replace(replace(replace(replace(trim(coalesce(vendor_article_number, '')), '!', ''), ' ', ''), '-', ''), '/', '')) as normalized_vendor_article,
        coalesce(nullif(trim(gender), ''), 'Unisex') as gender,
        coalesce(nullif(trim(item_status), ''), 'Unknown') as item_status
      from pk_fitstore_unicommerce.item_details_summary
    )
    select
      normalized_item_number,
      normalized_vendor_article,
      gender,
      item_status
    from normalized_items
    where
      normalized_item_number in (${skuListSql})
      or normalized_vendor_article in (${skuListSql})
  `);

  const requestedSkuSet = new Set(normalizedSkus);
  const bestBySku = new Map();

  for (const row of rows) {
    const mappedValues = [sanitizeSkuCode(row.normalized_item_number), sanitizeSkuCode(row.normalized_vendor_article)].filter(Boolean);
    for (const candidateSku of mappedValues) {
      if (!requestedSkuSet.has(candidateSku)) {
        continue;
      }

      const candidate = {
        sku_code: candidateSku,
        gender: String(row.gender || "Unisex").trim(),
        item_status: String(row.item_status || "Unknown").trim(),
      };

      const current = bestBySku.get(candidateSku);
      const candidateStatus = candidate.item_status.toLowerCase();
      const currentStatus = String(current?.item_status || "").toLowerCase();
      const candidateIsActive = candidateStatus === "active";
      const currentIsActive = currentStatus === "active";

      if (!current || (candidateIsActive && !currentIsActive)) {
        bestBySku.set(candidateSku, candidate);
      }
    }
  }

  return normalizedSkus.map((sku) => bestBySku.get(sku)).filter(Boolean);
}

export async function fetchUserCohortByUserId(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return null;
  }

  const escapedUserId = normalizedUserId.replace(/'/g, "''");

  const rows = await queryMetabaseNative(`
    with user_service_6m as (
      select
        user_id::varchar as user_id,
        service_type,
        count(*) as attended_sessions_6m
      from dwh_fitness_mart.booking_fact
      where class_date >= date_trunc('month', current_date) - interval '5' month
        and service_type in ('GYM', 'GX')
        and attendance_time is not null
        and user_id::varchar = '${escapedUserId}'
      group by 1, 2
    ),
    ranked_service as (
      select
        user_id,
        service_type,
        attended_sessions_6m,
        row_number() over (
          partition by user_id
          order by attended_sessions_6m desc,
          case when service_type = 'GYM' then 1 else 2 end
        ) as rn
      from user_service_6m
    ),
    primary_service as (
      select
        user_id,
        service_type as max_service_used,
        attended_sessions_6m
      from ranked_service
      where rn = 1
    ),
    user_subservice_6m as (
      select
        bf.user_id::varchar as user_id,
        bf.service_type,
        bf.sub_service_type,
        count(*) as attended_sessions_subservice_6m
      from dwh_fitness_mart.booking_fact bf
      where bf.class_date >= date_trunc('month', current_date) - interval '5' month
        and bf.service_type in ('GYM', 'GX')
        and bf.attendance_time is not null
        and bf.user_id::varchar = '${escapedUserId}'
        and bf.sub_service_type is not null
      group by 1, 2, 3
    ),
    ranked_subservice as (
      select
        us.user_id,
        us.service_type,
        us.sub_service_type,
        us.attended_sessions_subservice_6m,
        row_number() over (
          partition by us.user_id, us.service_type
          order by us.attended_sessions_subservice_6m desc, us.sub_service_type
        ) as rn
      from user_subservice_6m us
    ),
    primary_subservice as (
      select
        user_id,
        service_type,
        sub_service_type as max_sub_service_type
      from ranked_subservice
      where rn = 1
    ),
    user_month_activity as (
      select
        user_id::varchar as user_id,
        service_type,
        date_trunc('month', class_date) as activity_month,
        count(*) as attended_sessions_month
      from dwh_fitness_mart.booking_fact
      where class_date >= date_trunc('month', current_date) - interval '5' month
        and service_type in ('GYM', 'GX')
        and attendance_time is not null
        and user_id::varchar = '${escapedUserId}'
      group by 1, 2, 3
    ),
    dominant_service_months as (
      select
        uma.user_id,
        uma.service_type,
        avg(uma.attended_sessions_month) as avg_monthly_attended_sessions
      from user_month_activity uma
      inner join primary_service ps
        on uma.user_id = ps.user_id
       and uma.service_type = ps.max_service_used
      group by 1, 2
    ),
    final_base as (
      select
        ps.user_id,
        case
          when ps.max_service_used = 'GYM' and dsm.avg_monthly_attended_sessions <= 4 then 'Low'
          when ps.max_service_used = 'GYM' and dsm.avg_monthly_attended_sessions <= 9 then 'Medium'
          when ps.max_service_used = 'GYM' then 'High'
          when ps.max_service_used = 'GX' and dsm.avg_monthly_attended_sessions <= 3 then 'Low'
          when ps.max_service_used = 'GX' and dsm.avg_monthly_attended_sessions <= 8 then 'Medium'
          when ps.max_service_used = 'GX' then 'High'
          else 'Unknown'
        end as activity_level,
        ps.max_service_used as service,
        pss.max_sub_service_type as sub_service
      from primary_service ps
      left join dominant_service_months dsm
        on ps.user_id = dsm.user_id
       and ps.max_service_used = dsm.service_type
      left join primary_subservice pss
        on ps.user_id = pss.user_id
       and ps.max_service_used = pss.service_type
    )
    select
      user_id,
      case
        when service = 'GYM' or coalesce(trim(sub_service), '') = ''
          then concat(service, '_', activity_level)
        else concat(service, '_', sub_service, '_', activity_level)
      end as cohort
    from final_base
    order by user_id
    limit 1
  `);

  return rows[0] || null;
}

export function fetchProductsFromMetabase(parameters = {}) {
  if (!SERVER_METABASE_CONFIG.PRODUCTS_QUERY_ID) {
    throw new Error("Products query ID is not configured.");
  }

  return fetchFromMetabaseCard(SERVER_METABASE_CONFIG.PRODUCTS_QUERY_ID, parameters);
}

export function fetchInventoryFromMetabase(productId, currentStoreId) {
  if (!SERVER_METABASE_CONFIG.INVENTORY_QUERY_ID) {
    throw new Error("Inventory query ID is not configured.");
  }

  return fetchFromMetabaseCard(SERVER_METABASE_CONFIG.INVENTORY_QUERY_ID, {
    product_id: productId,
    store_id: currentStoreId,
  });
}

export function fetchNearbyStoresFromMetabase(currentStoreId) {
  if (!SERVER_METABASE_CONFIG.NEARBY_STORES_QUERY_ID) {
    throw new Error("Nearby stores query ID is not configured.");
  }

  return fetchFromMetabaseCard(SERVER_METABASE_CONFIG.NEARBY_STORES_QUERY_ID, {
    store_id: currentStoreId,
  });
}
