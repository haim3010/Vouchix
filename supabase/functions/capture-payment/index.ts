/**
 * capture-payment
 * Captures a previously authorized Stripe PaymentIntent.
 * Called when the buyer confirms the voucher is working.
 *
 * Deploy: supabase functions deploy capture-payment
 * Env vars required: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from 'npm:stripe@13';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

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

    if (!paymentIntentId || !transactionId) {
      return new Response(
        JSON.stringify({ error: 'Missing paymentIntentId or transactionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Safety check: ensure transaction is not disputed
    const { data: tx } = await supabase
      .from('transactions')
      .select('status')
      .eq('id', transactionId)
      .single();

    if (tx?.status === 'disputed') {
      return new Response(
        JSON.stringify({ error: 'Cannot capture payment while dispute is open' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Capture the payment
    const captured = await stripe.paymentIntents.capture(paymentIntentId);

    console.log(`Captured PaymentIntent ${paymentIntentId} for transaction ${transactionId}. Status: ${captured.status}`);

    return new Response(
      JSON.stringify({ status: captured.status, amount_captured: captured.amount_received }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('capture-payment error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
