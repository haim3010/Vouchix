/**
 * cancel-payment
 * Cancels an authorized (uncaptured) Stripe PaymentIntent.
 * Called when a dispute is opened — funds are never taken from buyer.
 * If already captured, issues a refund instead.
 *
 * Deploy: supabase functions deploy cancel-payment
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
    const { paymentIntentId, transactionId } = await req.json() as {
      paymentIntentId: string;
      transactionId: string;
    };

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: 'Missing paymentIntentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch current PI status
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    let result: { action: string; status: string };

    if (pi.status === 'requires_capture') {
      // Not yet captured → simply cancel (no money moved)
      const cancelled = await stripe.paymentIntents.cancel(paymentIntentId);
      result = { action: 'cancelled', status: cancelled.status };
      console.log(`Cancelled PI ${paymentIntentId} for transaction ${transactionId}`);
    } else if (pi.status === 'succeeded') {
      // Already captured → issue a refund
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'fraudulent',
      });
      result = { action: 'refunded', status: refund.status };
      console.log(`Refunded PI ${paymentIntentId} for transaction ${transactionId}`);
    } else {
      result = { action: 'no_action', status: pi.status };
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('cancel-payment error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
