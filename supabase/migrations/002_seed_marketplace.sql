-- Seed: 5 fake users + marketplace listings
-- Run in Supabase SQL Editor

set row_security = off;

-- Step 1: Insert into auth.users first (required by FK)
insert into auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'noa@demo.vouchix.com', crypt('Demo1234!', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   'authenticated', 'authenticated', '', ''),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'yossi@demo.vouchix.com', crypt('Demo1234!', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   'authenticated', 'authenticated', '', ''),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'maya@demo.vouchix.com', crypt('Demo1234!', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   'authenticated', 'authenticated', '', ''),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'amit@demo.vouchix.com', crypt('Demo1234!', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   'authenticated', 'authenticated', '', ''),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'shira@demo.vouchix.com', crypt('Demo1234!', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   'authenticated', 'authenticated', '', '')
on conflict (id) do nothing;

-- Step 2: Profiles
insert into public.profiles (id, display_name, avatar_url, phone, rating, total_trades, created_at)
values
  ('00000000-0000-0000-0000-000000000001', 'Noa Cohen',       null, null, 4.9, 12, now() - interval '60 days'),
  ('00000000-0000-0000-0000-000000000002', 'Yossi Levi',      null, null, 4.7, 8,  now() - interval '45 days'),
  ('00000000-0000-0000-0000-000000000003', 'Maya Shapira',    null, null, 5.0, 3,  now() - interval '30 days'),
  ('00000000-0000-0000-0000-000000000004', 'Amit Mizrahi',    null, null, 4.5, 21, now() - interval '90 days'),
  ('00000000-0000-0000-0000-000000000005', 'Shira Ben-David', null, null, 4.8, 6,  now() - interval '20 days')
on conflict (id) do nothing;

-- Step 3: Vouchers listed on marketplace
insert into public.vouchers (
  id, owner_id, brand, original_value, remaining_value, currency,
  voucher_code, expires_at, notes, is_listed, listing_price, status, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Nike', 500, 500, 'ILS', 'NIKE-NOA-2024', now() + interval '90 days',
   'Won in a raffle, prefer cash', true, 420, 'active', now() - interval '3 days', now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Zara', 300, 300, 'ILS', 'ZARA-NOA-7812', now() + interval '180 days',
   'Never used, birthday gift', true, 240, 'active', now() - interval '2 days', now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   'IKEA', 1000, 1000, 'ILS', 'IKEA-YOS-4421', now() + interval '365 days',
   'Moving abroad, no use for it', true, 850, 'active', now() - interval '5 days', now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002',
   'Starbucks', 150, 150, 'ILS', 'SB-YOS-9900', now() + interval '30 days',
   'Expiring soon, want to sell fast', true, 120, 'active', now() - interval '1 days', now()),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003',
   'Apple', 800, 800, 'ILS', 'APPLE-MAYA-3310', now() + interval '270 days',
   'Employee gift, prefer cash', true, 700, 'active', now() - interval '7 days', now()),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004',
   'Castro', 400, 400, 'ILS', 'CASTRO-AMIT-5512', now() + interval '120 days',
   'Unused, selling at discount', true, 310, 'active', now() - interval '10 days', now()),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004',
   'Shufersal', 600, 600, 'ILS', 'SHUF-AMIT-8843', now() + interval '60 days',
   'Bulk grocery voucher', true, 520, 'active', now() - interval '4 days', now()),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000005',
   'Tav Hazav', 250, 250, 'ILS', 'TAVHZ-SHR-1122', now() + interval '150 days',
   'Got two vouchers, selling one', true, 200, 'active', now() - interval '2 days', now()),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000005',
   'Aroma', 200, 200, 'ILS', 'AROMA-SHR-7731', now() + interval '45 days',
   'Perfect for coffee lovers', true, 165, 'active', now() - interval '1 days', now()),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003',
   'Adidas', 350, 350, 'ILS', 'ADIDAS-MAYA-6610', now() + interval '200 days',
   'Unused birthday gift', true, 280, 'active', now() - interval '6 days', now())
on conflict (id) do nothing;

set row_security = on;
