/**
 * create-payment-intent
 * Creates a Stripe PaymentIntent with capture_method: 'manual' (escrow).
 *
 * Deploy: supabase functions deploy create-payment-intent
 * Env vars required: STRIPE_SECRET_KEY
 */
import Stripe from 'npm:stripe@13';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { offerId, buyerId, salePrice, sellerStripeAccountId } = await req.json() as {
      offerId: string;
      buyerId: string;
      salePrice: number;
      sellerStripeAccountId: string;
    };

    if (!offerId || !buyerId || !salePrice) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: offerId, buyerId, salePrice' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const platformFee = Math.round(salePrice * 0.05 * 100); // 5% in agorot

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(salePrice * 100), // ILS in agorot
      currency: 'ils',
      capture_method: 'manual', // key: authorize now, capture later
      metadata: { offer_id: offerId, buyer_id: buyerId },
      description: `VouchiX voucher purchase — offer ${offerId}`,
    };

    // Only add transfer_data if seller has a Stripe Connect account
    if (sellerStripeAccountId && sellerStripeAccountId !== '') {
      intentParams.application_fee_amount = platformFee;
      intentParams.transfer_data = { destination: sellerStripeAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('create-payment-intent error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
