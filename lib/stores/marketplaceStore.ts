import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Voucher, Offer } from '@/types';

function formatCurrencyRaw(n: number) { return `₪${n.toFixed(2)}`; }

function extractMsg(e: unknown, fallback: string): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
  }
  return fallback;
}

export interface ListingWithSeller extends Voucher {
  seller: {
    id: string;
    display_name: string;
    rating: number;
    total_trades: number;
  };
}

export interface OfferWithBuyer extends Offer {
  buyer: {
    id: string;
    display_name: string;
    rating: number;
    total_trades: number;
  };
  voucher: {
    brand: string;
    original_value: number;
    listing_price: number | null;
  };
}

interface MarketplaceState {
  listings: ListingWithSeller[];
  myOffers: OfferWithBuyer[];       // offers I made as buyer
  incomingOffers: OfferWithBuyer[]; // offers on my listings as seller
  loading: boolean;
  error: string | null;
  brandFilter: string | null;
  sortBy: 'discount' | 'price_asc' | 'price_desc' | 'newest';
  fetchListings: () => Promise<void>;
  fetchMyOffers: (userId: string) => Promise<void>;
  fetchIncomingOffers: (userId: string) => Promise<void>;
  makeOffer: (voucherId: string, buyerId: string, amount: number, message?: string, tradeBrand?: string, tradeValue?: number) => Promise<void>;
  respondToOffer: (offerId: string, status: 'accepted' | 'rejected') => Promise<void>;
  completeOffer: (offerId: string) => Promise<void>;
  cancelOffer: (offerId: string) => Promise<void>;
  counterOffer: (offerId: string, newAmount: number) => Promise<void>;
  setBrandFilter: (brand: string | null) => void;
  setSortBy: (sort: MarketplaceState['sortBy']) => void;
  applyVoucherUpdate: (id: string, patch: Partial<Voucher>) => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  listings: [],
  myOffers: [],
  incomingOffers: [],
  loading: false,
  error: null,
  brandFilter: null,
  sortBy: 'discount',

  fetchListings: async () => {
    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('vouchers')
        .select(`*, seller:profiles!vouchers_owner_id_fkey(id, display_name, rating, total_trades)`)
        .eq('is_listed', true)
        .eq('status', 'active');

      const { brandFilter } = get();
      if (brandFilter) query = query.eq('brand', brandFilter);

      const { data, error } = await query;
      if (error) throw error;

      let listings = (data ?? []) as ListingWithSeller[];
      const { sortBy } = get();
      listings = listings.sort((a, b) => {
        if (sortBy === 'discount') {
          const dA = (a.original_value - (a.listing_price ?? a.original_value)) / a.original_value;
          const dB = (b.original_value - (b.listing_price ?? b.original_value)) / b.original_value;
          return dB - dA;
        }
        if (sortBy === 'price_asc') return (a.listing_price ?? 0) - (b.listing_price ?? 0);
        if (sortBy === 'price_desc') return (b.listing_price ?? 0) - (a.listing_price ?? 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      set({ listings });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch listings' });
    } finally {
      set({ loading: false });
    }
  },

  // Offers I sent as a buyer
  fetchMyOffers: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          buyer:profiles!offers_buyer_id_fkey(id, display_name, rating, total_trades),
          voucher:vouchers!offers_voucher_id_fkey(brand, original_value, listing_price)
        `)
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ myOffers: (data ?? []) as OfferWithBuyer[] });
    } catch { /* non-critical */ }
  },

  // Offers received on my listed vouchers
  fetchIncomingOffers: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          buyer:profiles!offers_buyer_id_fkey(id, display_name, rating, total_trades),
          voucher:vouchers!offers_voucher_id_fkey(brand, original_value, listing_price)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Filter to only offers on vouchers I own (RLS handles this server-side too)
      const myVoucherIds = get().listings
        .filter((l) => l.owner_id === userId)
        .map((l) => l.id);

      const incoming = ((data ?? []) as OfferWithBuyer[]).filter(
        (o) => myVoucherIds.includes(o.voucher_id)
      );
      set({ incomingOffers: incoming });
    } catch { /* non-critical */ }
  },

  makeOffer: async (voucherId, buyerId, amount, message, tradeBrand, tradeValue) => {
    const selectQuery = `
      *,
      buyer:profiles!offers_buyer_id_fkey(id, display_name, rating, total_trades),
      voucher:vouchers!offers_voucher_id_fkey(brand, original_value, listing_price)
    `;

    // Always encode trade info in message so it's visible even without extra columns
    const tradePrefix = tradeBrand
      ? `🔄 Trade: ${tradeBrand} (${formatCurrencyRaw(tradeValue ?? 0)} value)\n`
      : '';
    const fullMessage = (tradePrefix + (message ?? '')).trim() || null;

    // Try with trade columns (if SQL migration has been run)
    if (tradeBrand) {
      const { data, error } = await supabase
        .from('offers')
        .insert({ voucher_id: voucherId, buyer_id: buyerId, offer_amount: amount,
          message: fullMessage, trade_brand: tradeBrand, trade_value: tradeValue ?? null })
        .select(selectQuery).single();
      if (!error) {
        set((state) => ({ myOffers: [data as OfferWithBuyer, ...state.myOffers] }));
        return;
      }
      // Columns might not exist yet — fall through to message-only insert
    }

    // Fallback: insert without trade columns, trade info is in message
    const { data, error } = await supabase
      .from('offers')
      .insert({ voucher_id: voucherId, buyer_id: buyerId, offer_amount: amount, message: fullMessage })
      .select(selectQuery).single();
    if (error) throw new Error(extractMsg(error, 'Failed to send offer'));
    set((state) => ({ myOffers: [data as OfferWithBuyer, ...state.myOffers] }));
  },

  respondToOffer: async (offerId: string, status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('offers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (error) throw new Error(extractMsg(error, 'Failed to update offer'));
    set((state) => ({
      incomingOffers: state.incomingOffers.filter((o) => o.id !== offerId),
      myOffers: state.myOffers.map((o) =>
        o.id === offerId ? { ...o, status } : o
      ),
    }));
  },

  completeOffer: async (offerId: string) => {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (error) throw new Error(extractMsg(error, 'Failed to mark offer as completed'));
    const patch = (o: OfferWithBuyer) => o.id === offerId ? { ...o, status: 'completed' } : o;
    set((state) => ({
      myOffers: state.myOffers.map(patch),
      incomingOffers: state.incomingOffers.map(patch),
    }));
  },

  cancelOffer: async (offerId: string) => {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (error) throw new Error(extractMsg(error, 'Failed to cancel offer'));
    const patch = (o: OfferWithBuyer) => o.id === offerId ? { ...o, status: 'cancelled' } : o;
    set((state) => ({
      myOffers: state.myOffers.map(patch),
      incomingOffers: state.incomingOffers.map(patch),
    }));
  },

  counterOffer: async (offerId: string, newAmount: number) => {
    const { error } = await supabase
      .from('offers')
      .update({ offer_amount: newAmount, updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (error) throw new Error(extractMsg(error, 'Failed to update offer amount'));
    const patch = (o: OfferWithBuyer) => o.id === offerId ? { ...o, offer_amount: newAmount } : o;
    set((state) => ({
      myOffers: state.myOffers.map(patch),
      incomingOffers: state.incomingOffers.map(patch),
    }));
  },

  setBrandFilter: (brand) => set({ brandFilter: brand }),
  setSortBy: (sort) => set({ sortBy: sort }),

  applyVoucherUpdate: (id, patch) => set((state) => ({
    listings: state.listings
      .map((l) => l.id === id ? { ...l, ...patch } as ListingWithSeller : l)
      .filter((l) => l.is_listed !== false && l.status !== 'used' && l.status !== 'expired' && l.status !== 'sold'),
  })),
}));
