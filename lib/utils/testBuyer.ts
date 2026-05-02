import { supabase } from '@/lib/supabase';

const TEST_BUYER_NAME = 'testbuyer';

let cachedId: string | null | undefined = undefined;

export async function getTestBuyerId(): Promise<string | null> {
  if (cachedId !== undefined) return cachedId;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('display_name', TEST_BUYER_NAME)
    .maybeSingle();
  cachedId = data?.id ?? null;
  return cachedId;
}

interface SimulateOfferArgs {
  voucherId: string;
  brand: string;
  listingPrice: number | null;
  remainingValue: number;
  sellerId: string;
}

export async function simulateTestBuyerOffer(args: SimulateOfferArgs): Promise<string | null> {
  const { voucherId, brand, listingPrice, remainingValue, sellerId } = args;
  const tbId = await getTestBuyerId();
  if (!tbId || tbId === sellerId) return null;

  const offerAmount = listingPrice != null
    ? Math.round(listingPrice * 0.9 * 100) / 100
    : Math.round(remainingValue * 0.5 * 100) / 100;

  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      voucher_id: voucherId,
      buyer_id: tbId,
      offer_amount: offerAmount,
      message: `Hi! I'm interested in your ${brand} voucher. Would you accept ₪${offerAmount.toFixed(2)}?`,
    })
    .select('id')
    .single();
  if (error || !offer) {
    console.warn('[testBuyer] failed to create offer:', error);
    return null;
  }
  console.log('[testBuyer] created offer:', offer.id);

  const { error: msgErr } = await supabase.from('messages').insert({
    offer_id: offer.id,
    sender_id: tbId,
    content: 'Let me know if this works for you 🙏',
  });
  if (msgErr) console.warn('[testBuyer] failed to create message:', msgErr);

  return offer.id;
}

const AUTO_REPLIES = [
  'Sounds good! 👍',
  'Yes, still interested!',
  'Great, looking forward to closing this.',
  'Perfect — what do you need from my side?',
  'Thanks for the quick reply!',
  'Works for me. Let\'s finalize.',
  'Awesome, ready when you are.',
];

export function pickAutoReply(): string {
  return AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
}

export async function sendTestBuyerReply(offerId: string): Promise<void> {
  const tbId = await getTestBuyerId();
  if (!tbId) return;
  await supabase.from('messages').insert({
    offer_id: offerId,
    sender_id: tbId,
    content: pickAutoReply(),
  });
}
