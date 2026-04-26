-- Add classification, category, voucher_type, and pin_code columns to vouchers table

alter table public.vouchers
  add column if not exists classification text
    check (classification in ('credit','regular_voucher','gift_card','voucher_group')),
  add column if not exists category text
    check (category in ('shopping','food_and_beverage','restaurants','culture_and_leisure','sports','other')),
  add column if not exists voucher_type text
    check (voucher_type in ('digital','physical')),
  add column if not exists pin_code text;
