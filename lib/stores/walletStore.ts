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

export const useWalletStore = create<WalletState>((set, get) => ({
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
      set({ error: e instanceof Error ? e.message : 'Failed to fetch vouchers' });
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
      set({ error: e instanceof Error ? e.message : 'Failed to add voucher' });
      throw e;
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
      set({ error: e instanceof Error ? e.message : 'Failed to update voucher' });
      throw e;
    }
  },

  deleteVoucher: async (id: string) => {
    try {
      const { error } = await supabase.from('vouchers').delete().eq('id', id);
      if (error) throw error;
      set((state) => ({ vouchers: state.vouchers.filter((v) => v.id !== id) }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to delete voucher' });
      throw e;
    }
  },
}));
