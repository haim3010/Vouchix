/**
 * auto-resolve-disputes
 * Runs every hour via Supabase cron (pg_cron).
 *
 * Schedule (run in Supabase SQL editor):
 *   select cron.schedule(
 *     'auto-resolve-disputes',
 *     '0 * * * *',
 *     $$select net.http_post(
 *       url := 'https://<project-ref>.supabase.co/functions/v1/auto-resolve-disputes',
 *       headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
 *     ) as request_id$$
 *   );
 *
 * Deploy: supabase functions deploy auto-resolve-disputes
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

  const now = new Date();
  const results: string[] = [];

  try {
    // ── 1. Disputed transactions: seller has not responded in 24h ────────────
    const disputeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: unresolvedDisputes } = await supabase
      .from('transactions')
      .select('id, payment_intent_id, buyer_id, seller_id, disputed_at')
      .eq('status', 'disputed')
      .is('dispute_responded_at', null)
      .lt('disputed_at', disputeCutoff);

    for (const tx of unresolvedDisputes ?? []) {
      try {
        // Cancel payment intent (or refund if already captured)
        if (tx.payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(tx.payment_intent_id);
          if (pi.status === 'requires_capture') {
            await stripe.paymentIntents.cancel(tx.payment_intent_id);
          } else if (pi.status === 'succeeded') {
            await stripe.refunds.create({ payment_intent: tx.payment_intent_id });
          }
        }

        // Update transaction to refunded
        await supabase
          .from('transactions')
          .update({
            status: 'refunded',
            updated_at: now.toISOString(),
          })
          .eq('id', tx.id);

        // Increment seller dispute_count
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('dispute_count')
          .eq('id', tx.seller_id)
          .single();

        const newCount = (sellerProfile?.dispute_count ?? 0) + 1;
        const updatePayload: Record<string, unknown> = { dispute_count: newCount };

        if (newCount >= 2) {
          updatePayload.suspended = true;
          results.push(`Seller ${tx.seller_id} suspended (${newCount} disputes)`);
        }

        await supabase.from('profiles').update(updatePayload).eq('id', tx.seller_id);

        // Notify buyer
        await supabase.from('notifications').insert({
          user_id: tx.buyer_id,
          type: 'offer_received', // reusing type; extend NotificationType for 'refund_issued'
          title: 'Refund Issued',
          body: `Your dispute was resolved in your favour. Refund issued — allow 3–5 business days.`,
          data: { transaction_id: tx.id },
        });

        // Notify seller
        await supabase.from('notifications').insert({
          user_id: tx.seller_id,
          type: 'offer_received',
          title: 'Dispute resolved against you',
          body: `You did not respond to a dispute within 24 hours. The transaction was refunded to the buyer.`,
          data: { transaction_id: tx.id },
        });

        results.push(`Auto-refunded transaction ${tx.id}`);
      } catch (err) {
        results.push(`Failed to auto-refund ${tx.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // ── 2. Pending confirmations: buyer has not confirmed in 48h ────────────
    // auto_capture_at is set at transaction creation to 48h after seller uploads code
    const { data: pendingCaptures } = await supabase
      .from('transactions')
      .select('id, payment_intent_id, buyer_id, seller_id, auto_capture_at')
      .eq('status', 'processing')
      .lte('auto_capture_at', now.toISOString());

    for (const tx of pendingCaptures ?? []) {
      try {
        if (tx.payment_intent_id) {
          await stripe.paymentIntents.capture(tx.payment_intent_id);
        }

        await supabase
          .from('transactions')
          .update({
            status: 'completed',
            completed_at: now.toISOString(),
            buyer_confirmed_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', tx.id);

        // Notify buyer
        await supabase.from('notifications').insert({
          user_id: tx.buyer_id,
          type: 'sale_complete',
          title: 'Payment auto-released',
          body: `You didn't confirm the voucher within 48 hours. Payment was automatically released to the seller.`,
          data: { transaction_id: tx.id },
        });

        // Notify seller
        await supabase.from('notifications').insert({
          user_id: tx.seller_id,
          type: 'sale_complete',
          title: 'Payment received 🎉',
          body: `The buyer's 48-hour window passed. Payment has been released to you.`,
          data: { transaction_id: tx.id },
        });

        results.push(`Auto-captured transaction ${tx.id}`);
      } catch (err) {
        results.push(`Failed to auto-capture ${tx.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log('auto-resolve-disputes results:', results);

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('auto-resolve-disputes top-level error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
