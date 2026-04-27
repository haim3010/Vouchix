import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  offer_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { display_name: string };
}

export interface Conversation {
  offer_id: string;
  offer_status: string;
  offer_amount: number;
  offer_message: string | null;
  voucher_id: string;
  voucher_brand: string;
  voucher_original_value: number;
  voucher_owner_id: string;
  other_user_id: string;
  other_user_name: string;
  is_seller: boolean; // true = I own the voucher; false = I'm the buyer
  last_message?: string;
  last_message_at?: string;
  updated_at: string;
}

interface MessagesState {
  conversations: Conversation[];
  currentMessages: ChatMessage[];
  currentConversation: Conversation | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  sending: boolean;

  fetchConversations: (userId: string) => Promise<void>;
  openConversation: (conv: Conversation) => Promise<void>;
  closeConversation: () => void;
  sendMessage: (offerId: string, senderId: string, content: string) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;
  subscribeToMessages: (offerId: string) => () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  currentMessages: [],
  currentConversation: null,
  loadingConversations: false,
  loadingMessages: false,
  sending: false,

  fetchConversations: async (userId: string) => {
    set({ loadingConversations: true });
    try {
      // Offers I made as buyer
      const { data: buyerOffers } = await supabase
        .from('offers')
        .select(`
          id, status, offer_amount, message, updated_at, voucher_id,
          voucher:vouchers!offers_voucher_id_fkey(
            id, brand, original_value, owner_id,
            seller:profiles!vouchers_owner_id_fkey(id, display_name)
          )
        `)
        .eq('buyer_id', userId)
        .order('updated_at', { ascending: false });

      // Offers received on my vouchers (as seller)
      const { data: sellerOffers } = await supabase
        .from('offers')
        .select(`
          id, status, offer_amount, message, updated_at, voucher_id,
          buyer:profiles!offers_buyer_id_fkey(id, display_name),
          voucher:vouchers!offers_voucher_id_fkey(id, brand, original_value, owner_id)
        `)
        .eq('vouchers.owner_id', userId)
        .order('updated_at', { ascending: false });

      // Also get seller offers by checking voucher ownership
      const { data: myVouchersOffers } = await supabase
        .from('vouchers')
        .select(`
          id, brand, original_value, owner_id,
          offers(
            id, status, offer_amount, message, updated_at, buyer_id,
            buyer:profiles!offers_buyer_id_fkey(id, display_name)
          )
        `)
        .eq('owner_id', userId);

      const convMap = new Map<string, Conversation>();

      // Process buyer offers
      for (const o of (buyerOffers ?? []) as Record<string, unknown>[]) {
        const voucher = o.voucher as Record<string, unknown> | null;
        if (!voucher) continue;
        const seller = voucher.seller as Record<string, unknown> | null;
        convMap.set(o.id as string, {
          offer_id: o.id as string,
          offer_status: o.status as string,
          offer_amount: o.offer_amount as number,
          offer_message: o.message as string | null,
          voucher_id: voucher.id as string,
          voucher_brand: voucher.brand as string,
          voucher_original_value: voucher.original_value as number,
          voucher_owner_id: voucher.owner_id as string,
          other_user_id: voucher.owner_id as string,
          other_user_name: (seller?.display_name as string) ?? 'Seller',
          is_seller: false,
          updated_at: o.updated_at as string,
        });
      }

      // Process seller offers (from myVouchersOffers)
      for (const v of (myVouchersOffers ?? []) as Record<string, unknown>[]) {
        const offers = (v.offers as Record<string, unknown>[]) ?? [];
        for (const o of offers) {
          if (convMap.has(o.id as string)) continue; // already added
          const buyer = o.buyer as Record<string, unknown> | null;
          convMap.set(o.id as string, {
            offer_id: o.id as string,
            offer_status: o.status as string,
            offer_amount: o.offer_amount as number,
            offer_message: o.message as string | null,
            voucher_id: v.id as string,
            voucher_brand: v.brand as string,
            voucher_original_value: v.original_value as number,
            voucher_owner_id: v.owner_id as string,
            other_user_id: o.buyer_id as string,
            other_user_name: (buyer?.display_name as string) ?? 'Buyer',
            is_seller: true,
            updated_at: o.updated_at as string,
          });
        }
      }

      // Fetch last messages for each offer
      const offerIds = [...convMap.keys()];
      if (offerIds.length > 0) {
        const { data: lastMsgs } = await supabase
          .from('messages')
          .select('offer_id, content, created_at')
          .in('offer_id', offerIds)
          .order('created_at', { ascending: false });

        const seen = new Set<string>();
        for (const msg of (lastMsgs ?? []) as { offer_id: string; content: string; created_at: string }[]) {
          if (!seen.has(msg.offer_id)) {
            seen.add(msg.offer_id);
            const conv = convMap.get(msg.offer_id);
            if (conv) {
              conv.last_message = msg.content;
              conv.last_message_at = msg.created_at;
            }
          }
        }
      }

      const conversations = [...convMap.values()].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      set({ conversations });
    } catch (e) {
      console.warn('fetchConversations error', e);
    } finally {
      set({ loadingConversations: false });
    }
  },

  openConversation: async (conv: Conversation) => {
    set({ currentConversation: conv, currentMessages: [], loadingMessages: true });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(display_name)')
        .eq('offer_id', conv.offer_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      set({ currentMessages: (data ?? []) as ChatMessage[] });
    } catch (e) {
      console.warn('openConversation error', e);
    } finally {
      set({ loadingMessages: false });
    }
  },

  closeConversation: () => {
    set({ currentConversation: null, currentMessages: [] });
  },

  sendMessage: async (offerId: string, senderId: string, content: string) => {
    set({ sending: true });
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ offer_id: offerId, sender_id: senderId, content })
        .select('*, sender:profiles!messages_sender_id_fkey(display_name)')
        .single();
      if (error) throw error;
      const msg = data as ChatMessage;
      // Optimistically append
      set((state) => ({
        currentMessages: [...state.currentMessages, msg],
        conversations: state.conversations.map((c) =>
          c.offer_id === offerId
            ? { ...c, last_message: content, last_message_at: msg.created_at }
            : c
        ),
      }));
    } catch (e) {
      console.warn('sendMessage error', e);
      throw e;
    } finally {
      set({ sending: false });
    }
  },

  appendMessage: (msg: ChatMessage) => {
    set((state) => {
      // Avoid duplicates (realtime + optimistic)
      if (state.currentMessages.some((m) => m.id === msg.id)) return {};
      return {
        currentMessages: [...state.currentMessages, msg],
        conversations: state.conversations.map((c) =>
          c.offer_id === msg.offer_id
            ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
            : c
        ),
      };
    });
  },

  subscribeToMessages: (offerId: string) => {
    const channel = supabase
      .channel(`messages-${offerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `offer_id=eq.${offerId}`,
        },
        async (payload) => {
          const row = payload.new as ChatMessage;
          // Fetch sender name
          const { data } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', row.sender_id)
            .single();
          get().appendMessage({ ...row, sender: data ?? undefined });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
}));
