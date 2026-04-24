import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Voucher, Offer } from '@/types';

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
  makeOffer: (voucherId: string, buyerId: string, amount: number, message?: string) => Promise<void>;
  respondToOffer: (offerId: string, status: 'accepted' | 'rejected') => Promise<void>;
  setBrandFilter: (brand: string | null) => void;
  setSortBy: (sort: MarketplaceState['sortBy']) => void;
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

  makeOffer: async (voucherId, buyerId, amount, message) => {
    const { data, error } = await supabase
      .from('offers')
      .insert({ voucher_id: voucherId, buyer_id: buyerId, offer_amount: amount, message: message ?? null })
      .select(`
        *,
        buyer:profiles!offers_buyer_id_fkey(id, display_name, rating, total_trades),
        voucher:vouchers!offers_voucher_id_fkey(brand, original_value, listing_price)
      `)
      .single();
    if (error) throw error;
    set((state) => ({ myOffers: [data as OfferWithBuyer, ...state.myOffers] }));
  },

  respondToOffer: async (offerId: string, status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('offers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (error) throw error;
    set((state) => ({
      incomingOffers: state.incomingOffers.filter((o) => o.id !== offerId),
      myOffers: state.myOffers.map((o) =>
        o.id === offerId ? { ...o, status } : o
      ),
    }));
  },

  setBrandFilter: (brand) => set({ brandFilter: brand }),
  setSortBy: (sort) => set({ sortBy: sort }),
}));
