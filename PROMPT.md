# VouchiX — Initial Project Prompt

Use this prompt to start building the app with Claude Code (or any AI coding assistant).

---

## Prompt

```
I'm building a mobile app called VouchiX — a voucher wallet and marketplace.

**What it does:**
1. Users store all their gift cards, vouchers, and store credit in one app (like a digital wallet for vouchers)
2. Users can list vouchers for sale at a discount, and other users can bid on them

**Example:** I have a ₪500 Nike voucher I won't use. I list it on VouchiX. Someone offers ₪430. I accept, they get the voucher code, I get ₪430 in cash.

**Tech stack:**
- React Native with Expo (Expo Router for navigation)
- TypeScript (strict, no `any`)
- Supabase for auth, database, storage, and realtime
- NativeWind (Tailwind CSS for React Native) for styling
- Zustand for state management
- expo-barcode-scanner for scanning voucher barcodes/QR codes
- Stripe Connect for marketplace payments (Phase 2)

**Start with Phase 1 — the Voucher Wallet MVP:**

1. **Auth screens** — email/password login & register using Supabase Auth
2. **Wallet screen (home tab)** — shows all my vouchers as branded cards with store logo, balance, and days until expiration. Empty state if no vouchers yet.
3. **Add Voucher screen** — form to add a new voucher:
   - Brand name (searchable dropdown of popular Israeli & global brands: Nike, Zara, Castro, Fox, IKEA, Shufersal, etc.)
   - Original value (₪)
   - Remaining balance (₪)
   - Voucher code (text input)
   - Barcode scan button (opens camera to scan barcode/QR)
   - Expiration date picker
   - Optional photo of physical voucher
   - Notes field
4. **Voucher Detail screen** — tap a voucher to see full details + a large scannable barcode/QR display for use at checkout
5. **Profile tab** — user info, logout
6. **Expiration tracking** — sort vouchers by expiring soonest, show warning badges

**Design direction:**
- Dark navy (#1A1A2E) + coral red (#E94560) accent color scheme
- Card-based UI — each voucher looks like a branded gift card
- Urbanist font for headings, Plus Jakarta Sans for body text
- Smooth animations on card interactions
- Support RTL layout for Hebrew
- Bottom tab navigation: Wallet | Marketplace (coming soon) | Notifications | Profile

**Database:** Use Supabase with this schema for the vouchers table:
- id (uuid, primary key)
- owner_id (uuid, references auth.users)
- brand (text)
- original_value (numeric)
- remaining_value (numeric)
- currency (text, default 'ILS')
- barcode_data (text)
- barcode_format (text)
- voucher_code (text)
- image_url (text)
- expires_at (timestamptz)
- notes (text)
- is_listed (boolean, default false)
- status (text: active/used/expired/sold)
- created_at, updated_at (timestamptz)

Please read the CLAUDE.md file in the project root for the full specification, architecture, and conventions before starting. Begin by scaffolding the Expo project and implementing the auth flow + wallet screen.
```

---

## How to Use

1. **Create a new project folder** and place `CLAUDE.md` in the root
2. **Open Claude Code** (or paste this prompt into your AI coding tool)
3. **Paste the prompt above** to kick off development
4. Claude will scaffold the Expo project, set up Supabase, and build the wallet MVP
5. Once Phase 1 works, come back and ask for **Phase 2 (Marketplace)** using the spec in CLAUDE.md

## Follow-Up Prompts (for later phases)

### Phase 2 — Marketplace
```
Now let's build Phase 2 — the Marketplace. Refer to CLAUDE.md for the full spec.

Add these features:
1. A "Sell This Voucher" button on each voucher in my wallet
2. A marketplace tab where users browse listed vouchers (filter by brand, price, discount %)
3. An offer system — buyers propose a price, sellers accept/reject/counter
4. Stripe Connect integration for secure payments
5. Escrow flow — voucher code only revealed after payment confirmed
6. Seller ratings after completed transactions

Start with the marketplace browse screen and the listing flow.
```

### Phase 3 — Notifications & Polish
```
Now let's add Phase 3 features. Refer to CLAUDE.md.

1. Push notifications via Expo Notifications (expiring vouchers, new offers, sale completed)
2. Offline mode — cache wallet data locally with MMKV
3. i18n support (Hebrew + English) with react-i18next
4. OCR — let users snap a photo of a voucher and auto-extract the code and brand
5. Analytics section in profile (total voucher value, money saved via marketplace)
```
