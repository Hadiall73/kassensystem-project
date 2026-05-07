-- Kassensystem Datenbankschema
-- Ausführen in: Supabase → SQL Editor → New Query

create table if not exists pos_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text default 'Mein Restaurant',
  table_count int default 10,
  currency text default 'EUR',
  created_at timestamptz default now()
);

create table if not exists pos_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('chef', 'kellner', 'kueche')),
  pin text not null unique,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists pos_tables (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  name text,
  capacity int default 4,
  status text default 'free' check (status in ('free', 'occupied', 'reserved')),
  created_at timestamptz default now()
);

create table if not exists pos_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0,
  color text default '#f97316',
  created_at timestamptz default now()
);

create table if not exists pos_menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references pos_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  is_available boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists pos_orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references pos_tables(id) on delete set null,
  table_number int,
  status text default 'open' check (status in ('open', 'cooking', 'ready', 'paid')),
  payment_method text,
  total numeric(10,2) default 0,
  note text,
  staff_name text,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create table if not exists pos_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references pos_orders(id) on delete cascade,
  menu_item_id uuid references pos_menu_items(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  quantity int not null default 1,
  note text,
  status text default 'pending' check (status in ('pending', 'cooking', 'done')),
  created_at timestamptz default now()
);

-- RLS deaktivieren (server-seitig über service_role key)
alter table pos_settings disable row level security;
alter table pos_staff disable row level security;
alter table pos_tables disable row level security;
alter table pos_categories disable row level security;
alter table pos_menu_items disable row level security;
alter table pos_orders disable row level security;
alter table pos_order_items disable row level security;

-- Ersten Chef-Account anlegen (PIN: 1234)
insert into pos_staff (name, role, pin, is_active)
values ('Chef', 'chef', '1234', true)
on conflict do nothing;
