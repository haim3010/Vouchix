import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Transaction, TransactionStatus, DisputeReason } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractMsg(e: unknown, fallback: string): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
  }
  return fallback;
}

/** Minimal base64 encode for voucher codes (replace with pgcrypto in production) */
export function encodeVoucherCode(code: string): string {
  return Buffer.from(code).toString('base64');
}
export function decodeVoucherCode(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

// ── Edge function helpers ─────────────────────────────────────────────────────
async function callEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message ?? `Edge function ${name} failed`);
  return data as T;
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface TransactionWithDetails extends Transaction {
  voucher?: { brand: string; original_value: number; listing_price: number | null };
  seller?: { id: string; display_name: string; rating: number };
  buyer?: { id: string; display_name: string; rating: number };
}

interface CreateTransactionInput {
  offerId: string;
  voucherId: string;
  sellerId: string;
  buyerId: string;
  salePrice: number;
  paymentIntentId: string;
}

interface TransactionState {
  transactions: TransactionWithDetails[];
  currentTransaction: TransactionWithDetails | null;
  loading: boolean;
  error: string | null;

  fetchTransactions: (userId: string) => Promise<void>;
  fetchTransaction: (id: string) => Promise<void>;
  createTransaction: (input: CreateTransactionInput) => Promise<TransactionWithDetails>;
  sellerUploadCode: (transactionId: string, voucherCode: string) => Promise<void>;
  buyerConfirmWorking: (transactionId: string) => Promise<void>;
  openDispute: (transactionId: string, reason: DisputeReason, description?: string) => Promise<void>;
  respondToDispute: (transactionId: string, response: string) => Promise<void>;
  setCurrentTransaction: (t: TransactionWithDetails | null) => void;
  subscribeToTransaction: (transactionId: string) => () => void;
}

const TX_SELECT = `
  *,
  voucher:vouchers!transactions_voucher_id_fkey(brand, original_value, listing_price),
  seller:profiles!transactions_seller_id_fkey(id, display_name, rating),
  buyer:profiles!transactions_buyer_id_fkey(id, display_name, rating)
`;

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  currentTransaction: null,
  loading: false,
  error: null,

  // ── Fetch all transactions for a user ──────────────────────────────────────
  fetchTransactions: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_SELECT)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ transactions: (data ?? []) as TransactionWithDetails[] });
    } catch (e) {
      set({ error: extractMsg(e, 'Failed to fetch transactions') });
    } finally {
      set({ loading: false });
    }
  },

  // ── Fetch a single transaction ─────────────────────────────────────────────
  fetchTransaction: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_SELECT)
        .eq('id', id)
        .single();
      if (error) throw error;
      set({ currentTransaction: data as TransactionWithDetails });
    } catch (e) {
      set({ error: extractMsg(e, 'Failed to load transaction') });
    } finally {
      set({ loading: false });
    }
  },

  // ── Create transaction after payment authorized ────────────────────────────
  createTransaction: async ({ offerId, voucherId, sellerId, buyerId, salePrice, paymentIntentId }) => {
    const platformFee = Math.round(salePrice * 0.05 * 100) / 100;
    // Auto-capture 48 hours from now if buyer doesn't confirm
    const autoCapture = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        offer_id: offerId,
        voucher_id: voucherId,
        seller_id: sellerId,
        buyer_id: buyerId,
        sale_price: salePrice,
        platform_fee: platformFee,
        payment_intent_id: paymentIntentId,
        status: 'pending',
        auto_capture_at: autoCapture,
      })
      .select(TX_SELECT)
      .single();
    if (error) throw new Error(extractMsg(error, 'Failed to create transaction'));
    const tx = data as TransactionWithDetails;
    set((s) => ({ transactions: [tx, ...s.transactions], currentTransaction: tx }));
    return tx;
  },

  // ── Seller: upload the voucher code (step 2) ──────────────────────────────
  sellerUploadCode: async (transactionId, voucherCode) => {
    const encoded = encodeVoucherCode(voucherCode);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        voucher_code_encrypted: encoded,
        seller_confirmed_at: now,
        status: 'processing',
        updated_at: now,
      } as Record<string, unknown>)
      .eq('id', transactionId)
      .select(TX_SELECT)
      .single();
    if (error) throw new Error(extractMsg(error, 'Failed to upload voucher code'));
    const tx = data as TransactionWithDetails;
    set((s) => ({
      currentTransaction: tx,
      transactions: s.transactions.map((t) => (t.id === transactionId ? tx : t)),
    }));
  },

  // ── Buyer: confirm voucher works → capture payment ─────────────────────────
  buyerConfirmWorking: async (transactionId) => {
    const tx = get().currentTransaction;
    if (!tx?.payment_intent_id) throw new Error('No payment intent found');

    // Call edge function to capture the payment
    await callEdgeFunction('capture-payment', {
      paymentIntentId: tx.payment_intent_id,
      transactionId,
    });

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        buyer_confirmed_at: now,
        status: 'completed',
        completed_at: now,
        updated_at: now,
      } as Record<string, unknown>)
      .eq('id', transactionId)
      .select(TX_SELECT)
      .single();
    if (error) throw new Error(extractMsg(error, 'Failed to confirm transaction'));
    const updated = data as TransactionWithDetails;
    set((s) => ({
      currentTransaction: updated,
      transactions: s.transactions.map((t) => (t.id === transactionId ? updated : t)),
    }));
  },

  // ── Buyer: open a dispute ─────────────────────────────────────────────────
  openDispute: async (transactionId, reason, description) => {
    const tx = get().currentTransaction ?? get().transactions.find((t) => t.id === transactionId);
    if (tx?.status === 'disputed') throw new Error('Dispute already open');

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'disputed',
        dispute_reason: reason,
        dispute_description: description ?? null,
        disputed_at: now,
        updated_at: now,
      } as Record<string, unknown>)
      .eq('id', transactionId)
      .select(TX_SELECT)
      .single();
    if (error) throw new Error(extractMsg(error, 'Failed to open dispute'));

    // If payment authorized but not captured — cancel intent (freeze funds)
    if (tx?.payment_intent_id) {
      try {
        await callEdgeFunction('cancel-payment', { paymentIntentId: tx.payment_intent_id, transactionId });
      } catch {
        // Log but don't block — dispute is already recorded
        console.warn('Could not cancel PaymentIntent — funds may still be held');
      }
    }

    const updated = data as TransactionWithDetails;
    set((s) => ({
      currentTransaction: updated,
      transactions: s.transactions.map((t) => (t.id === transactionId ? updated : t)),
    }));
  },

  // ── Seller: respond to a dispute ──────────────────────────────────────────
  respondToDispute: async (transactionId, response) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        dispute_response: response,
        dispute_responded_at: now,
        updated_at: now,
      } as Record<string, unknown>)
      .eq('id', transactionId)
      .select(TX_SELECT)
      .single();
    if (error) throw new Error(extractMsg(error, 'Failed to submit response'));
    const updated = data as TransactionWithDetails;
    set((s) => ({
      currentTransaction: updated,
      transactions: s.transactions.map((t) => (t.id === transactionId ? updated : t)),
    }));
  },

  setCurrentTransaction: (t) => set({ currentTransaction: t }),

  // ── Real-time subscription on a single transaction ─────────────────────────
  subscribeToTransaction: (transactionId) => {
    const channel = supabase
      .channel(`transaction-${transactionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${transactionId}` },
        async () => {
          // Refetch full transaction with joins
          const { data } = await supabase
            .from('transactions')
            .select(TX_SELECT)
            .eq('id', transactionId)
            .single();
          if (data) {
            set((s) => ({
              currentTransaction: data as TransactionWithDetails,
              transactions: s.transactions.map((t) => (t.id === transactionId ? (data as TransactionWithDetails) : t)),
            }));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
}));
