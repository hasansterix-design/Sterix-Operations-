-- =========================================================
-- STERIX OPERATIONS — FULL SCHEMA
-- Covers: Auth/Permissions, Material Master, Procurement (PR/PO/GRN),
-- QC, Material Issue, Production, WIP, Sterilization, Final QC,
-- Finished Goods, Dispatch, Scrap, Batch Traceability
-- =========================================================

-- ---------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. USERS & PERMISSIONS
-- ---------------------------------------------------------
-- app_users mirrors auth.users with app-specific role/profile info.
-- is_admin = true gives full access to everything, and admins can
-- grant/revoke per-module permissions to other users.

create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

-- Modules are the permissionable units (one row per app section).
-- Seeded once; admin UI lets you assign access per user per module.
create table modules (
  id text primary key,            -- e.g. 'material_master', 'purchase_orders'
  label text not null,            -- display name e.g. 'Purchase Orders'
  module_group text not null,     -- e.g. 'Procurement', 'Production', 'Dispatch'
  sort_order int not null default 0
);

-- access_level: 'none' | 'view' | 'edit'
create table user_permissions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_users(id) on delete cascade,
  module_id text not null references modules(id) on delete cascade,
  access_level text not null default 'none' check (access_level in ('none','view','edit')),
  granted_by uuid references app_users(id),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

-- ---------------------------------------------------------
-- 2. MATERIAL MASTER
-- ---------------------------------------------------------
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  gst_number text,
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table material_master (
  id uuid primary key default uuid_generate_v4(),
  item_code text not null unique,
  item_name text not null,
  category text,                  -- e.g. Raw Material, Packaging, Component
  unit text not null,              -- e.g. PCS, KG, MTR
  default_supplier_id uuid references suppliers(id),
  lead_time_days numeric,
  moq numeric,                     -- minimum order quantity
  safety_stock numeric default 0,
  reorder_level numeric default 0,
  max_level numeric,
  avg_daily_consumption numeric default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- BOM: which raw materials/components a finished product consumes
create table bill_of_materials (
  id uuid primary key default uuid_generate_v4(),
  finished_item_id uuid not null references material_master(id),
  component_item_id uuid not null references material_master(id),
  qty_per_unit numeric not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. RAW MATERIAL STOCK REGISTER (rolling ledger)
-- ---------------------------------------------------------
create table stock_ledger (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references material_master(id),
  txn_date date not null default current_date,
  txn_type text not null check (txn_type in ('opening','receipt','issue','adjustment','return')),
  quantity numeric not null,        -- positive for in, negative for out
  reference_table text,             -- e.g. 'grn', 'material_issue'
  reference_id uuid,
  batch_id uuid,                    -- references raw_material_batches when applicable
  running_balance numeric,
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

create index idx_stock_ledger_item on stock_ledger(item_id, txn_date);

-- ---------------------------------------------------------
-- 4. PURCHASE REQUISITION
-- ---------------------------------------------------------
create table purchase_requisitions (
  id uuid primary key default uuid_generate_v4(),
  pr_no text not null unique,
  department text not null,
  item_id uuid not null references material_master(id),
  required_qty numeric not null,
  required_date date,
  status text not null default 'pending' check (status in ('pending','approved','rejected','converted_to_po')),
  approved_by uuid references app_users(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

-- ---------------------------------------------------------
-- 5. PURCHASE ORDER
-- ---------------------------------------------------------
create table purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  po_no text not null unique,
  pr_id uuid references purchase_requisitions(id),
  supplier_id uuid not null references suppliers(id),
  gst_number text,
  expected_delivery date,
  status text not null default 'open' check (status in ('open','partial','closed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

create table purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  item_id uuid not null references material_master(id),
  ordered_qty numeric not null,
  received_qty numeric not null default 0,
  unit_price numeric,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 6. GOODS RECEIPT NOTE (GRN) — and raw material batch creation
-- ---------------------------------------------------------
create table raw_material_batches (
  id uuid primary key default uuid_generate_v4(),
  batch_code text not null unique,   -- human readable e.g. RM-2026-0001
  item_id uuid not null references material_master(id),
  supplier_id uuid references suppliers(id),
  vendor_lot_no text,
  expiry_date date,
  received_qty numeric not null,
  accepted_qty numeric not null default 0,
  rejected_qty numeric not null default 0,
  remaining_qty numeric not null default 0,  -- decremented as consumed by production
  qc_status text not null default 'pending' check (qc_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table grn (
  id uuid primary key default uuid_generate_v4(),
  grn_no text not null unique,
  po_id uuid references purchase_orders(id),
  supplier_id uuid not null references suppliers(id),
  invoice_no text,
  received_date date not null default current_date,
  status text not null default 'pending_qc' check (status in ('pending_qc','qc_approved','qc_rejected','partial')),
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

create table grn_items (
  id uuid primary key default uuid_generate_v4(),
  grn_id uuid not null references grn(id) on delete cascade,
  po_item_id uuid references purchase_order_items(id),
  item_id uuid not null references material_master(id),
  batch_id uuid references raw_material_batches(id),
  lot_no text,
  batch_no text,
  expiry_date date,
  received_qty numeric not null,
  accepted_qty numeric default 0,
  rejected_qty numeric default 0,
  qc_status text not null default 'pending' check (qc_status in ('pending','approved','rejected'))
);

-- ---------------------------------------------------------
-- 7. QUALITY INSPECTION REGISTER (generic — incoming / in-process / final)
-- ---------------------------------------------------------
create table quality_inspections (
  id uuid primary key default uuid_generate_v4(),
  inspection_type text not null check (inspection_type in ('incoming','in_process','final')),
  reference_table text not null,     -- 'grn_items', 'wip_batches', 'finished_goods_batches'
  reference_id uuid not null,
  acceptance_status text not null default 'pending' check (acceptance_status in ('pending','accepted','rejected')),
  deviation_notes text,
  capa_notes text,                   -- corrective and preventive action
  inspected_by uuid references app_users(id),
  inspected_at timestamptz default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 8. MATERIAL ISSUE (raw material -> production)
-- ---------------------------------------------------------
create table material_issues (
  id uuid primary key default uuid_generate_v4(),
  issue_no text not null unique,
  department text not null,
  production_order_id uuid,          -- references production_orders, added FK below after table exists
  item_id uuid not null references material_master(id),
  batch_id uuid references raw_material_batches(id),
  quantity numeric not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references app_users(id)
);

-- ---------------------------------------------------------
-- 9. PRODUCTION PLANNING
-- ---------------------------------------------------------
create table production_orders (
  id uuid primary key default uuid_generate_v4(),
  production_order_no text not null unique,
  product_id uuid not null references material_master(id),
  batch_code text not null unique,      -- production batch, e.g. PB-2026-0001
  target_qty numeric not null,
  actual_qty numeric default 0,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  yield_percent numeric,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

alter table material_issues
  add constraint fk_material_issue_po
  foreign key (production_order_id) references production_orders(id);

-- Links a production batch to the raw material batches it actually consumed
-- (many-to-many — this is the heart of batch traceability)
create table production_batch_consumption (
  id uuid primary key default uuid_generate_v4(),
  production_order_id uuid not null references production_orders(id) on delete cascade,
  raw_material_batch_id uuid not null references raw_material_batches(id),
  quantity_consumed numeric not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 10. WIP (WORK IN PROCESS)
-- ---------------------------------------------------------
create table wip_batches (
  id uuid primary key default uuid_generate_v4(),
  production_order_id uuid not null references production_orders(id),
  operation text not null,           -- e.g. 'Molding', 'Assembly', 'Printing'
  input_qty numeric not null,
  output_qty numeric not null,
  loss_qty numeric default 0,
  status text not null default 'in_progress' check (status in ('in_progress','completed','on_hold')),
  recorded_at timestamptz not null default now(),
  recorded_by uuid references app_users(id)
);

-- ---------------------------------------------------------
-- 11. STERILIZATION
-- ---------------------------------------------------------
create table sterilization_batches (
  id uuid primary key default uuid_generate_v4(),
  sterilization_batch_code text not null unique,  -- e.g. STR-2026-0001
  cycle_no text,
  eo_concentration text,
  cycle_start timestamptz,
  cycle_end timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','completed','failed')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

-- Links a sterilization load to the production batches (WIP) it contains
create table sterilization_batch_inputs (
  id uuid primary key default uuid_generate_v4(),
  sterilization_batch_id uuid not null references sterilization_batches(id) on delete cascade,
  production_order_id uuid not null references production_orders(id),
  quantity numeric not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 12. FINAL QC -> FINISHED GOODS / SCRAP
-- ---------------------------------------------------------
create table finished_goods_batches (
  id uuid primary key default uuid_generate_v4(),
  fg_batch_code text not null unique,   -- e.g. FG-2026-0001
  product_id uuid not null references material_master(id),
  sterilization_batch_id uuid references sterilization_batches(id),
  manufacturing_date date,
  expiry_date date,
  qc_status text not null default 'pending' check (qc_status in ('pending','approved','rejected')),
  available_stock numeric not null default 0,
  reserved_stock numeric not null default 0,
  dispatched_stock numeric not null default 0,
  created_at timestamptz not null default now()
);

create table scrap_register (
  id uuid primary key default uuid_generate_v4(),
  source_table text not null,        -- 'grn_items', 'wip_batches', 'finished_goods_batches'
  source_id uuid,
  item_id uuid references material_master(id),
  rejected_qty numeric not null,
  reason text,
  weight numeric,
  value numeric,
  disposal_method text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references app_users(id)
);

-- ---------------------------------------------------------
-- 13. PACKING (sits between Final QC approval and FG store)
-- ---------------------------------------------------------
create table packing_records (
  id uuid primary key default uuid_generate_v4(),
  fg_batch_id uuid not null references finished_goods_batches(id),
  packed_qty numeric not null,
  pack_type text,                    -- e.g. box of 100, carton of 1000
  packed_at timestamptz not null default now(),
  packed_by uuid references app_users(id)
);

-- ---------------------------------------------------------
-- 14. DISPATCH
-- ---------------------------------------------------------
create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  gst_number text,
  address text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dispatches (
  id uuid primary key default uuid_generate_v4(),
  invoice_no text not null unique,
  customer_id uuid not null references customers(id),
  vehicle_no text,
  lr_no text,
  dispatch_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

-- Links a dispatch to the FG batches it shipped from (supports partial/multi-batch dispatch)
create table dispatch_items (
  id uuid primary key default uuid_generate_v4(),
  dispatch_id uuid not null references dispatches(id) on delete cascade,
  fg_batch_id uuid not null references finished_goods_batches(id),
  quantity numeric not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 15. INDEXES for common lookups / traceability joins
-- ---------------------------------------------------------
create index idx_pbc_po on production_batch_consumption(production_order_id);
create index idx_pbc_rmb on production_batch_consumption(raw_material_batch_id);
create index idx_sbi_str on sterilization_batch_inputs(sterilization_batch_id);
create index idx_sbi_po on sterilization_batch_inputs(production_order_id);
create index idx_di_dispatch on dispatch_items(dispatch_id);
create index idx_di_fg on dispatch_items(fg_batch_id);
create index idx_fg_str on finished_goods_batches(sterilization_batch_id);

-- ---------------------------------------------------------
-- 16. SEED MODULES (for permission system)
-- ---------------------------------------------------------
insert into modules (id, label, module_group, sort_order) values
  ('material_master', 'Material Master', 'Setup', 10),
  ('suppliers', 'Suppliers', 'Setup', 20),
  ('customers', 'Customers', 'Setup', 30),
  ('stock_register', 'Raw Material Stock Register', 'Procurement', 40),
  ('purchase_requisition', 'Purchase Requisition', 'Procurement', 50),
  ('purchase_order', 'Purchase Order', 'Procurement', 60),
  ('grn', 'Goods Receipt Note (GRN)', 'Procurement', 70),
  ('incoming_qc', 'Incoming Quality Inspection', 'Quality', 80),
  ('material_issue', 'Material Issue', 'Production', 90),
  ('production_planning', 'Production Planning', 'Production', 100),
  ('wip', 'WIP Inventory', 'Production', 110),
  ('sterilization', 'Sterilization', 'Production', 120),
  ('final_qc', 'Final QC', 'Quality', 130),
  ('packing', 'Packing', 'Production', 140),
  ('finished_goods', 'Finished Goods Inventory', 'Dispatch', 150),
  ('dispatch', 'Dispatch Register', 'Dispatch', 160),
  ('scrap_register', 'Scrap Register', 'Quality', 170),
  ('batch_traceability', 'Batch Traceability', 'Reports', 180),
  ('inventory_dashboard', 'Inventory Dashboard', 'Reports', 190),
  ('master_dashboard', 'Master Dashboard', 'Reports', 200),
  ('stock_calculator', 'Stock Level Calculator', 'Reports', 210),
  ('user_management', 'User & Permission Management', 'Admin', 220)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- 17. ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table app_users enable row level security;
alter table user_permissions enable row level security;
alter table modules enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table material_master enable row level security;
alter table bill_of_materials enable row level security;
alter table stock_ledger enable row level security;
alter table purchase_requisitions enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table raw_material_batches enable row level security;
alter table grn enable row level security;
alter table grn_items enable row level security;
alter table quality_inspections enable row level security;
alter table material_issues enable row level security;
alter table production_orders enable row level security;
alter table production_batch_consumption enable row level security;
alter table wip_batches enable row level security;
alter table sterilization_batches enable row level security;
alter table sterilization_batch_inputs enable row level security;
alter table finished_goods_batches enable row level security;
alter table scrap_register enable row level security;
alter table packing_records enable row level security;
alter table dispatches enable row level security;
alter table dispatch_items enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from app_users where id = auth.uid()), false);
$$;

-- Helper: does the current user have at least 'view' or 'edit' on a module?
create or replace function has_module_access(p_module_id text, p_min_level text default 'view')
returns boolean
language sql
security definer
stable
as $$
  select
    is_admin()
    or exists (
      select 1 from user_permissions
      where user_id = auth.uid()
        and module_id = p_module_id
        and (
          (p_min_level = 'view' and access_level in ('view','edit'))
          or (p_min_level = 'edit' and access_level = 'edit')
        )
    );
$$;

-- app_users: everyone can see active users (for dropdowns); only admins manage
create policy app_users_select on app_users for select using (true);
create policy app_users_admin_write on app_users for all using (is_admin()) with check (is_admin());

-- modules: readable by all logged-in users
create policy modules_select on modules for select using (auth.uid() is not null);

-- user_permissions: users can see their own; admins manage all
create policy permissions_select_own on user_permissions for select using (user_id = auth.uid() or is_admin());
create policy permissions_admin_write on user_permissions for all using (is_admin()) with check (is_admin());

-- Generic pattern applied per module-backed table below.
-- (Repeat select/insert/update/delete policies per table, keyed to its module_id)

create policy suppliers_select on suppliers for select using (has_module_access('suppliers','view'));
create policy suppliers_write on suppliers for all using (has_module_access('suppliers','edit')) with check (has_module_access('suppliers','edit'));

create policy customers_select on customers for select using (has_module_access('customers','view'));
create policy customers_write on customers for all using (has_module_access('customers','edit')) with check (has_module_access('customers','edit'));

create policy material_master_select on material_master for select using (has_module_access('material_master','view'));
create policy material_master_write on material_master for all using (has_module_access('material_master','edit')) with check (has_module_access('material_master','edit'));

create policy bom_select on bill_of_materials for select using (has_module_access('material_master','view'));
create policy bom_write on bill_of_materials for all using (has_module_access('material_master','edit')) with check (has_module_access('material_master','edit'));

create policy stock_ledger_select on stock_ledger for select using (has_module_access('stock_register','view'));
create policy stock_ledger_write on stock_ledger for all using (has_module_access('stock_register','edit')) with check (has_module_access('stock_register','edit'));

create policy pr_select on purchase_requisitions for select using (has_module_access('purchase_requisition','view'));
create policy pr_write on purchase_requisitions for all using (has_module_access('purchase_requisition','edit')) with check (has_module_access('purchase_requisition','edit'));

create policy po_select on purchase_orders for select using (has_module_access('purchase_order','view'));
create policy po_write on purchase_orders for all using (has_module_access('purchase_order','edit')) with check (has_module_access('purchase_order','edit'));

create policy poi_select on purchase_order_items for select using (has_module_access('purchase_order','view'));
create policy poi_write on purchase_order_items for all using (has_module_access('purchase_order','edit')) with check (has_module_access('purchase_order','edit'));

create policy rmb_select on raw_material_batches for select using (has_module_access('grn','view') or has_module_access('stock_register','view'));
create policy rmb_write on raw_material_batches for all using (has_module_access('grn','edit')) with check (has_module_access('grn','edit'));

create policy grn_select on grn for select using (has_module_access('grn','view'));
create policy grn_write on grn for all using (has_module_access('grn','edit')) with check (has_module_access('grn','edit'));

create policy grn_items_select on grn_items for select using (has_module_access('grn','view'));
create policy grn_items_write on grn_items for all using (has_module_access('grn','edit')) with check (has_module_access('grn','edit'));

create policy qi_select on quality_inspections for select using (
  has_module_access('incoming_qc','view') or has_module_access('final_qc','view')
);
create policy qi_write on quality_inspections for all using (
  has_module_access('incoming_qc','edit') or has_module_access('final_qc','edit')
) with check (
  has_module_access('incoming_qc','edit') or has_module_access('final_qc','edit')
);

create policy mi_select on material_issues for select using (has_module_access('material_issue','view'));
create policy mi_write on material_issues for all using (has_module_access('material_issue','edit')) with check (has_module_access('material_issue','edit'));

create policy po_orders_select on production_orders for select using (has_module_access('production_planning','view'));
create policy po_orders_write on production_orders for all using (has_module_access('production_planning','edit')) with check (has_module_access('production_planning','edit'));

create policy pbc_select on production_batch_consumption for select using (
  has_module_access('production_planning','view') or has_module_access('batch_traceability','view')
);
create policy pbc_write on production_batch_consumption for all using (has_module_access('production_planning','edit')) with check (has_module_access('production_planning','edit'));

create policy wip_select on wip_batches for select using (has_module_access('wip','view'));
create policy wip_write on wip_batches for all using (has_module_access('wip','edit')) with check (has_module_access('wip','edit'));

create policy str_select on sterilization_batches for select using (has_module_access('sterilization','view'));
create policy str_write on sterilization_batches for all using (has_module_access('sterilization','edit')) with check (has_module_access('sterilization','edit'));

create policy sbi_select on sterilization_batch_inputs for select using (
  has_module_access('sterilization','view') or has_module_access('batch_traceability','view')
);
create policy sbi_write on sterilization_batch_inputs for all using (has_module_access('sterilization','edit')) with check (has_module_access('sterilization','edit'));

create policy fg_select on finished_goods_batches for select using (has_module_access('finished_goods','view'));
create policy fg_write on finished_goods_batches for all using (has_module_access('finished_goods','edit')) with check (has_module_access('finished_goods','edit'));

create policy scrap_select on scrap_register for select using (has_module_access('scrap_register','view'));
create policy scrap_write on scrap_register for all using (has_module_access('scrap_register','edit')) with check (has_module_access('scrap_register','edit'));

create policy packing_select on packing_records for select using (has_module_access('packing','view'));
create policy packing_write on packing_records for all using (has_module_access('packing','edit')) with check (has_module_access('packing','edit'));

create policy dispatch_select on dispatches for select using (has_module_access('dispatch','view'));
create policy dispatch_write on dispatches for all using (has_module_access('dispatch','edit')) with check (has_module_access('dispatch','edit'));

create policy di_select on dispatch_items for select using (has_module_access('dispatch','view'));
create policy di_write on dispatch_items for all using (has_module_access('dispatch','edit')) with check (has_module_access('dispatch','edit'));
