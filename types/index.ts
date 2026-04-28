export type VoucherStatus = 'active' | 'used' | 'expired' | 'sold';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'refunded' | 'disputed' | 'cancelled';
export type DisputeReason = 'invalid_code' | 'wrong_balance' | 'seller_not_responding' | 'other';

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  invalid_code: 'Code is invalid — tried to redeem, it doesn\'t work',
  wrong_balance: 'Wrong balance — lower than advertised',
  seller_not_responding: 'Seller not responding after offer accepted',
  other: 'Other issue',
};
export type ListingType = 'sale' | 'trade' | 'both';
export type BarcodeFormat = 'QR' | 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'OTHER';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
export type NotificationType = 'offer_received' | 'offer_accepted' | 'expiring_soon' | 'sale_complete';
export type VoucherClassification = 'credit' | 'regular_voucher' | 'gift_card' | 'voucher_group';
export type VoucherCategory = 'shopping' | 'food_and_beverage' | 'restaurants' | 'culture_and_leisure' | 'sports' | 'other';
export type VoucherType = 'digital' | 'physical';

export const CLASSIFICATION_LABELS: Record<VoucherClassification, string> = {
  credit: 'Credit',
  regular_voucher: 'Regular Voucher',
  gift_card: 'Gift Card',
  voucher_group: 'Voucher Group',
};

export const CATEGORY_LABELS: Record<VoucherCategory, string> = {
  shopping: 'Shopping',
  food_and_beverage: 'Food & Beverage',
  restaurants: 'Restaurants',
  culture_and_leisure: 'Culture & Leisure',
  sports: 'Sports',
  other: 'Other',
};

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  rating: number;
  total_trades: number;
  created_at: string;
}

export interface Voucher {
  id: string;
  owner_id: string;
  brand: string;
  brand_logo_url: string | null;
  original_value: number;
  remaining_value: number;
  currency: string;
  barcode_data: string | null;
  barcode_format: BarcodeFormat | null;
  voucher_code: string | null;
  pin_code: string | null;
  image_url: string | null;
  expires_at: string | null;
  notes: string | null;
  is_listed: boolean;
  listing_price: number | null;
  listing_type: ListingType | null;
  status: VoucherStatus;
  classification: VoucherClassification | null;
  category: VoucherCategory | null;
  voucher_type: VoucherType | null;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  voucher_id: string;
  buyer_id: string;
  offer_amount: number;
  message: string | null;
  trade_brand: string | null;
  trade_value: number | null;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  offer_id: string | null;
  voucher_id: string;
  seller_id: string;
  buyer_id: string;
  sale_price: number;
  platform_fee: number;
  payment_intent_id: string | null;
  status: TransactionStatus;
  // Voucher code (base64 encoded — only revealed to buyer after completion)
  voucher_code_encrypted: string | null;
  // Dispute fields
  dispute_reason: DisputeReason | null;
  dispute_description: string | null;
  disputed_at: string | null;
  dispute_response: string | null;
  dispute_responded_at: string | null;
  // Timeline
  seller_confirmed_at: string | null;
  buyer_confirmed_at: string | null;
  auto_capture_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface AddVoucherForm {
  brand: string;
  original_value: string;
  remaining_value: string;
  voucher_code: string;
  barcode_data: string;
  barcode_format: BarcodeFormat | null;
  expires_at: Date | null;
  notes: string;
}
