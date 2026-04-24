# VouchiX — Voucher Wallet & Marketplace

## Project Overview

**VouchiX** is a mobile-first application that solves two problems:
1. **Voucher Wallet** — Users store all their gift cards, vouchers, and store credit in one place so they never forget or lose them.
2. **Voucher Marketplace** — Users can list vouchers for sale at a discount, and other users can bid/buy them.

**Example:** A user has a ₪500 Nike voucher they won't use. They list it on VouchiX. Another user offers ₪430. The seller accepts, the buyer gets a ₪500 Nike voucher for ₪430, and the seller gets cash instead of an expiring voucher.

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native (Expo) |
| **Language** | TypeScript |
| **Navigation** | Expo Router (file-based routing) |
| **State Management** | Zustand |
| **Backend / Auth / DB** | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| **Payments** | Stripe Connect (for marketplace payouts) |
| **Notifications** | Expo Notifications |
| **Styling** | NativeWind (Tailwind for React Native) |
| **Barcode/QR** | expo-barcode-scanner, react-native-qrcode-svg |
| **Image/OCR** | expo-image-picker + Google Cloud Vision API (optional, for auto-reading voucher details) |
| **Testing** | Jest + React Native Testing Library |

## Core Architecture

```
app/
├── (auth)/                  # Auth flow screens
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (tabs)/                  # Main tab navigator
│   ├── wallet.tsx           # My vouchers list
│   ├── marketplace.tsx      # Browse & buy vouchers
│   ├── notifications.tsx    # Offers, expirations, alerts
│   └── profile.tsx          # Settings, payment methods, history
├── voucher/
│   ├── [id].tsx             # Voucher detail (shows barcode/QR)
│   ├── add.tsx              # Add new voucher (manual or scan)
│   └── sell.tsx             # List voucher for sale
├── offer/
│   ├── [id].tsx             # Offer detail / negotiation
│   └── make.tsx             # Make an offer on a listing
└── _layout.tsx              # Root layout

lib/
├── supabase.ts              # Supabase client init
├── stores/                  # Zustand stores
│   ├── authStore.ts
│   ├── walletStore.ts
│   └── marketplaceStore.ts
├── hooks/                   # Custom hooks
│   ├── useVouchers.ts
│   ├── useOffers.ts
│   └── useNotifications.ts
├── utils/
│   ├── currency.ts          # ₪ NIS formatting
│   ├── expiration.ts        # Days-left calculation, alerts
│   └── barcodeParser.ts     # Parse scanned voucher data
└── types/
    └── index.ts             # Global TypeScript types
```

## Database Schema (Supabase / PostgreSQL)

```sql
-- Users (extends Supabase auth.users)
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
  brand text not null,                    -- e.g. "Nike", "Zara"
  brand_logo_url text,
  original_value numeric(10,2) not null,  -- e.g. 500.00
  remaining_value numeric(10,2) not null, -- e.g. 500.00 (decreases with use)
  currency text default 'ILS',
  barcode_data text,                      -- raw barcode/QR content
  barcode_format text,                    -- 'QR', 'CODE128', 'EAN13', etc.
  voucher_code text,                      -- manual code if no barcode
  image_url text,                         -- photo of physical voucher
  expires_at timestamptz,
  notes text,
  is_listed boolean default false,        -- true = on marketplace
  listing_price numeric(10,2),            -- asking price when listed
  status text default 'active'            -- active | used | expired | sold
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
  payment_intent_id text,                -- Stripe reference
  status text default 'pending'
    check (status in ('pending','processing','completed','refunded','disputed')),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  type text not null,                     -- offer_received | offer_accepted | expiring_soon | sale_complete
  title text not null,
  body text not null,
  data jsonb,                             -- deep link info
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
```

## Key Features — Detailed

### 1. Voucher Wallet
- **Add voucher** by scanning barcode/QR, entering code manually, or snapping a photo
- **Auto-detect brand** from barcode or user selection from popular brands list
- **Track remaining balance** — user can update after partial use
- **Expiration alerts** — push notifications at 30, 14, 7, and 1 day before expiry
- **Quick access** — tap voucher to show full-screen barcode at store checkout
- **Categories/Tags** — organize by brand, category (fashion, food, electronics)
- **Search & filter** — find vouchers fast

### 2. Marketplace
- **List for sale** — set asking price or "open to offers"
- **Browse listings** — filter by brand, discount %, price range, location
- **Make offers** — buyer proposes a price, seller accepts/rejects/counters
- **Discount badge** — show "10% off" or "save ₪70" automatically
- **Seller rating** — builds trust between strangers
- **Secure transfer** — voucher code revealed to buyer only after payment confirmed
- **Escrow flow** — payment held until buyer confirms voucher works

### 3. Notifications & Alerts
- Voucher expiring soon
- New offer received on your listing
- Offer accepted / rejected
- Sale completed
- Price drop alerts (buyer can "watch" a brand)

### 4. User Profile
- Trade history
- Rating & reviews
- Payment methods (for buying)
- Payout settings (for selling — bank/PayBox/Bit)
- Preferred brands (for marketplace recommendations)

## Design System

| Element | Value |
|---|---|
| **Primary Color** | `#1A1A2E` (deep navy) |
| **Accent Color** | `#E94560` (vibrant coral-red) |
| **Secondary Accent** | `#0F3460` (rich blue) |
| **Success** | `#16C784` (green) |
| **Warning** | `#F5A623` (amber) |
| **Background** | `#F8F9FA` (light) / `#0D1117` (dark) |
| **Font — Headings** | Urbanist (bold, modern) |
| **Font — Body** | Plus Jakarta Sans |
| **Border Radius** | 16px cards, 12px buttons, 999px pills |
| **Spacing Unit** | 4px base grid |

### UI Principles
- **Card-based layout** — each voucher is a visually branded card showing the store logo, balance, and expiration
- **Bold brand colors** — each voucher card adapts its accent to the store's brand color (Nike = orange-ish, Zara = black, etc.)
- **Smooth animations** — card flip to reveal barcode, slide-up offer sheet, confetti on completed sale
- **Bottom sheet modals** — for quick actions (make offer, update balance)
- **Empty states** — friendly illustrations when wallet is empty ("Your wallet is lonely! Add your first voucher")

## Business Model

- **Free** to store vouchers (wallet is always free)
- **5% platform fee** on marketplace sales (charged to seller)
- **Premium tier** (optional, ₪9.99/mo): priority listing, no fees on first 3 sales/month, advanced analytics

## Security Considerations

- Voucher codes are **encrypted at rest** in Supabase (use pgcrypto)
- Codes are **never shown in marketplace listings** — only revealed after payment
- **Rate limiting** on offers to prevent spam
- **Report/block** functionality for bad actors
- **2FA** recommended for accounts with high-value vouchers
- All monetary transactions go through **Stripe** — app never handles card data directly

## Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
GOOGLE_CLOUD_VISION_API_KEY=       # optional, for OCR
```

## Development Phases

### Phase 1 — MVP (Wallet Only)
- Auth (email + Google sign-in)
- Add/edit/delete vouchers (manual entry + barcode scan)
- Voucher detail with full-screen barcode display
- Expiration tracking & local notifications
- Basic profile

### Phase 2 — Marketplace
- List vouchers for sale
- Browse marketplace with filters
- Make/accept/reject offers
- In-app messaging between buyer & seller
- Stripe Connect integration for payments

### Phase 3 — Growth
- Push notifications via Expo
- Brand auto-detection from barcode
- OCR from voucher photos
- Social features (share deals, refer friends)
- Premium subscription tier
- Analytics dashboard (total value saved, best deals)

### Phase 4 — Scale
- Location-based deals ("Nike vouchers near you")
- Brand partnerships & sponsored listings
- API for retailers to auto-issue vouchers into VouchiX
- Web companion app

## Claude Code Commands & Conventions

- **Use `npx expo` for all Expo CLI commands** — never use global `expo-cli`
- **File naming**: `kebab-case` for files, `PascalCase` for components
- **Imports**: absolute imports via `@/` alias mapped to project root
- **Error handling**: all Supabase calls wrapped in try/catch with user-friendly error toasts
- **Commit style**: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **No `any` types** — strict TypeScript throughout
- **All text in Hebrew AND English** — use i18n from day 1 (react-i18next)
- **RTL support** — app must work in RTL layout for Hebrew users
- **Offline-first** — cache vouchers locally with MMKV so wallet works without internet
