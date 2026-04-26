import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Voucher } from '@/types';

interface WalletState {
  vouchers: Voucher[];
  loading: boolean;
  error: string | null;
  fetchVouchers: (userId: string) => Promise<void>;
  addVoucher: (voucher: Omit<Voucher, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateVoucher: (id: string, updates: Partial<Voucher>) => Promise<void>;
  deleteVoucher: (id: string) => Promise<void>;
}

/** Extract a human-readable message from any thrown value (Error, PostgrestError, plain string, etc.) */
function extractMessage(e: unknown, fallback: string): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.details === 'string') return obj.details;
  }
  return fallback;
}

export const useWalletStore = create<WalletState>((set) => ({
  vouchers: [],
  loading: false,
  error: null,

  fetchVouchers: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('owner_id', userId)
        .neq('status', 'sold')
        .order('expires_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      set({ vouchers: (data ?? []) as Voucher[] });
    } catch (e) {
      set({ error: extractMessage(e, 'Failed to fetch vouchers') });
    } finally {
      set({ loading: false });
    }
  },

  addVoucher: async (voucher) => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .insert(voucher)
        .select()
        .single();
      if (error) throw error;
      set((state) => ({ vouchers: [data as Voucher, ...state.vouchers] }));
    } catch (e) {
      const msg = extractMessage(e, 'Failed to add voucher');
      set({ error: msg });
      throw new Error(msg); // always throw a proper Error so callers can use e.message
    }
  },

  updateVoucher: async (id: string, updates: Partial<Voucher>) => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      set((state) => ({
        vouchers: state.vouchers.map((v) => (v.id === id ? (data as Voucher) : v)),
      }));
    } catch (e) {
      const msg = extractMessage(e, 'Failed to update voucher');
      set({ error: msg });
      throw new Error(msg);
    }
  },

  deleteVoucher: async (id: string) => {
    // Delete related offers first (FK constraint fallback — DB has CASCADE but belt-and-suspenders)
    await supabase.from('offers').delete().eq('voucher_id', id);
    const { error } = await supabase.from('vouchers').delete().eq('id', id);
    if (error) {
      const msg = extractMessage(error, 'Failed to delete voucher');
      set({ error: msg });
      throw new Error(msg);
    }
    set((state) => ({ vouchers: state.vouchers.filter((v) => v.id !== id) }));
  },
}));
