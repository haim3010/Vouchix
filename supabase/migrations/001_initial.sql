-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users primary key,
  display_name text not null,
  avatar_url text,
  phone text,
  rating numeric(3,2) default 5.00,
  total_trades int default 0,
  created_at timestamptz default now()
);

-- Vouchers
create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) not null,
  brand text not null,
  brand_logo_url text,
  original_value numeric(10,2) not null,
  remaining_value numeric(10,2) not null,
  currency text default 'ILS',
  barcode_data text,
  barcode_format text,
  voucher_code text,
  image_url text,
  expires_at timestamptz,
  notes text,
  is_listed boolean default false,
  listing_price numeric(10,2),
  status text default 'active'
    check (status in ('active','used','expired','sold')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Marketplace Offers
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references public.vouchers(id) not null,
  buyer_id uuid references public.profiles(id) not null,
  offer_amount numeric(10,2) not null,
  message text,
  status text default 'pending'
    check (status in ('pending','accepted','rejected','cancelled','completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transactions (completed sales)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references public.vouchers(id) not null,
  seller_id uuid references public.profiles(id) not null,
  buyer_id uuid references public.profiles(id) not null,
  sale_price numeric(10,2) not null,
  platform_fee numeric(10,2) default 0,
  payment_intent_id text,
  status text default 'pending'
    check (status in ('pending','processing','completed','refunded','disputed')),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index idx_vouchers_owner on public.vouchers(owner_id);
create index idx_vouchers_listed on public.vouchers(is_listed) where is_listed = true;
create index idx_offers_voucher on public.offers(voucher_id);
create index idx_offers_buyer on public.offers(buyer_id);
create index idx_notifications_user on public.notifications(user_id);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.vouchers enable row level security;
alter table public.offers enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;

-- RLS Policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can view own vouchers"
  on public.vouchers for select using (auth.uid() = owner_id);

create policy "Users can insert own vouchers"
  on public.vouchers for insert with check (auth.uid() = owner_id);

create policy "Users can update own vouchers"
  on public.vouchers for update using (auth.uid() = owner_id);

create policy "Users can delete own vouchers"
  on public.vouchers for delete using (auth.uid() = owner_id);

create policy "Anyone can view listed vouchers"
  on public.vouchers for select using (is_listed = true);

create policy "Users can view own offers or offers on their vouchers"
  on public.offers for select using (
    auth.uid() = buyer_id or
    auth.uid() = (select owner_id from public.vouchers where id = voucher_id)
  );

create policy "Buyers can create offers"
  on public.offers for insert with check (auth.uid() = buyer_id);

create policy "Voucher owners can update offer status"
  on public.offers for update using (
    auth.uid() = buyer_id or
    auth.uid() = (select owner_id from public.vouchers where id = voucher_id)
  );

create policy "Users see own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vouchers_updated_at
  before update on public.vouchers
  for each row execute procedure public.handle_updated_at();

create trigger offers_updated_at
  before update on public.offers
  for each row execute procedure public.handle_updated_at();
