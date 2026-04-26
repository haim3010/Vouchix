export type VoucherStatus = 'active' | 'used' | 'expired' | 'sold';
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
  status: OfferStatus;
  created_at: string;
  updated_at: string;
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
