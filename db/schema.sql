create table if not exists imports (
  id integer primary key autoincrement,
  source_path text not null,
  imported_at text not null default current_timestamp,
  product_count integer not null default 0,
  variant_count integer not null default 0
);

create table if not exists products (
  id text primary key,
  handle text not null unique,
  name text not null,
  price real not null default 0,
  compare_at_price real not null default 0,
  category text,
  image_url text,
  material text,
  material_tag text,
  colors_json text not null default '[]',
  sizes_json text not null default '[]',
  activity text,
  fit text,
  description text,
  material_composition text,
  url text,
  vendor text,
  total_inventory_qty integer not null default 0,
  reason text
);

create table if not exists product_variants (
  variant_id text primary key,
  product_id text not null references products(id) on delete cascade,
  source_variant_id text,
  sku text,
  color text,
  size text,
  quantity integer not null default 0,
  price real not null default 0,
  image_url text
);

create index if not exists idx_products_activity on products(activity);
create index if not exists idx_products_fit on products(fit);
create index if not exists idx_products_material_tag on products(material_tag);
create index if not exists idx_product_variants_product_id on product_variants(product_id);
