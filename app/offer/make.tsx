/**
 * offer/make.tsx
 * Payment authorization screen. Reached from Messages when an offer is accepted.
 *
 * Production setup required:
 *   npx expo install @stripe/stripe-react-native
 *   + native rebuild (expo-dev-client or EAS build)
 *   + add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env
 *
 * The Stripe PaymentSheet is guarded — the rest of the flow (edge function,
 * transaction record, status screen) works without it.
 */
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTransactionStore } from '@/lib/stores/transactionStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';

// Stripe is optional until native rebuild
let useStripe: (() => { initPaymentSheet: Function; presentPaymentSheet: Function }) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useStripe = require('@stripe/stripe-react-native').useStripe;
} catch {
  useStripe = null;
}

interface OfferDetails {
  id: string;
  offer_amount: number;
  message: string | null;
  buyer_id: string;
  voucher: {
    id: string;
    brand: string;
    original_value: number;
    owner_id: string;
    listing_price: number | null;
  };
  seller: {
    id: string;
    display_name: string;
    stripe_account_id: string | null;
  };
}

// ── Step row ─────────────────────────────────────────────────────────────────
function StepRow({ n, label, done }: { n: number; label: string; done?: boolean }) {
  return (
    <View style={s.stepRow}>
      <View style={[s.stepCircle, done && s.stepCircleDone]}>
        <Text style={[s.stepNum, done && s.stepNumDone]}>{done ? '✓' : n}</Text>
      </View>
      <Text style={[s.stepLabel, done && s.stepLabelDone]}>{label}</Text>
    </View>
  );
}

export default function MakePaymentScreen() {
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const { user } = useAuthStore();
  const { createTransaction } = useTransactionStore();

  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [stripeReady, setStripeReady] = useState(false);
  const [manualMode, setManualMode] = useState(false); // fallback if Stripe not installed

  const stripe = useStripe?.();

  const salePrice = offer?.offer_amount ?? 0;
  const platformFee = Math.round(salePrice * 0.05 * 100) / 100;
  const buyerPays = salePrice; // fee is taken from seller's side

  // Fetch offer details
  useEffect(() => {
    if (!offerId) return;
    supabase
      .from('offers')
      .select(`
        id, offer_amount, message, buyer_id,
        voucher:vouchers!offers_voucher_id_fkey(id, brand, original_value, owner_id, listing_price),
        seller:profiles!vouchers_owner_id_fkey(id, display_name, stripe_account_id)
      `)
      .eq('id', offerId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Could not load offer details'); }
        else {
          const d = data as Record<string, unknown>;
          const voucher = d.voucher as OfferDetails['voucher'];
          setOffer({
            id: d.id as string,
            offer_amount: d.offer_amount as number,
            message: d.message as string | null,
            buyer_id: d.buyer_id as string,
            voucher,
            seller: d.seller as OfferDetails['seller'],
          });
        }
        setLoading(false);
      });
  }, [offerId]);

  // Initialize Stripe PaymentSheet
  async function initializePaymentSheet() {
    if (!offer || !stripe) return false;
    try {
      // Call edge function to create PaymentIntent
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          offerId: offer.id,
          buyerId: user?.id,
          salePrice: offer.offer_amount,
          sellerStripeAccountId: offer.seller.stripe_account_id ?? '',
        },
      });
      if (fnErr) throw fnErr;
      const { clientSecret, paymentIntentId } = fnData as { clientSecret: string; paymentIntentId: string };

      const { error: initErr } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'VouchiX',
        returnURL: 'vouchix://payment-complete',
      });
      if (initErr) throw initErr;

      setStripeReady(true);
      return paymentIntentId as string;
    } catch (e) {
      console.warn('Stripe init failed:', e);
      return false;
    }
  }

  async function handlePay() {
    if (!offer || !user) return;
    setError('');
    setPaying(true);

    try {
      let paymentIntentId = `pi_manual_${Date.now()}`; // fallback PI id for dev

      if (stripe) {
        // Real Stripe flow
        const piId = await initializePaymentSheet();
        if (!piId) {
          setError('Could not initialize payment. Check Stripe configuration.');
          setPaying(false);
          return;
        }
        paymentIntentId = piId as string;
        const { error: pErr } = await stripe.presentPaymentSheet();
        if (pErr) {
          if (pErr.code !== 'Canceled') setError(pErr.message);
          setPaying(false);
          return;
        }
      } else {
        // Dev/manual mode — call edge function directly to create PI
        try {
          const { data } = await supabase.functions.invoke('create-payment-intent', {
            body: {
              offerId: offer.id,
              buyerId: user.id,
              salePrice: offer.offer_amount,
              sellerStripeAccountId: offer.seller.stripe_account_id ?? '',
            },
          });
          if (data?.paymentIntentId) paymentIntentId = data.paymentIntentId;
        } catch {
          // Edge function might not be deployed — use placeholder
        }
      }

      // Create the transaction record
      const tx = await createTransaction({
        offerId: offer.id,
        voucherId: offer.voucher.id,
        sellerId: offer.voucher.owner_id,
        buyerId: user.id,
        salePrice: offer.offer_amount,
        paymentIntentId,
      });

      // Mark offer as completed (payment initiated)
      await supabase
        .from('offers')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', offer.id);

      router.replace(`/offer/${tx.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed. Try again.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>⚠ {error || 'Offer not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBack}>
          <Text style={s.headerBackText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Secure Payment</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {error.length > 0 && (
          <View style={s.errorBanner}>
            <Text style={s.errorBannerText}>⚠ {error}</Text>
          </View>
        )}

        {/* Deal summary */}
        <View style={s.dealCard}>
          <Text style={s.dealBrand}>{offer.voucher.brand}</Text>
          <Text style={s.dealFace}>Face value {formatCurrency(offer.voucher.original_value)}</Text>
          {offer.message && (
            <Text style={s.dealMessage} numberOfLines={2}>"{offer.message}"</Text>
          )}
        </View>

        {/* Price breakdown */}
        <View style={s.breakdownCard}>
          <Text style={s.breakdownTitle}>Payment Breakdown</Text>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Voucher price</Text>
            <Text style={s.breakdownValue}>{formatCurrency(salePrice)}</Text>
          </View>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Platform fee (5% — charged to seller)</Text>
            <Text style={s.breakdownValue}>{formatCurrency(platformFee)}</Text>
          </View>
          <View style={s.breakdownDivider} />
          <View style={s.breakdownRow}>
            <Text style={s.breakdownTotal}>You pay</Text>
            <Text style={s.breakdownTotalValue}>{formatCurrency(buyerPays)}</Text>
          </View>
        </View>

        {/* Escrow explanation */}
        <View style={s.escrowCard}>
          <Text style={s.escrowTitle}>🔒 How escrow works</Text>
          <Text style={s.escrowText}>
            Your payment is held securely — not charged yet. It's only released to the seller
            after you confirm the voucher is working. If anything goes wrong, you can dispute
            and the funds are never taken.
          </Text>
        </View>

        {/* Steps */}
        <View style={s.stepsCard}>
          <Text style={s.stepsTitle}>What happens next</Text>
          <StepRow n={1} label="Your payment is authorized (held, not charged)" done />
          <StepRow n={2} label="Seller uploads the voucher code" />
          <StepRow n={3} label="You confirm the code works" />
          <StepRow n={4} label="Payment released to seller" />
          <StepRow n={5} label="Deal complete ✓" />
        </View>

        {!stripe && (
          <View style={s.devNotice}>
            <Text style={s.devNoticeText}>
              ℹ Dev mode: Stripe PaymentSheet not loaded.
              Install @stripe/stripe-react-native for card collection.
              The transaction flow will still work.
            </Text>
          </View>
        )}

        {/* Pay button */}
        <TouchableOpacity
          style={[s.payBtn, paying && s.payBtnDisabled]}
          onPress={handlePay}
          disabled={paying}
        >
          {paying
            ? <ActivityIndicator color={colors.white} />
            : <Text style={s.payBtnText}>🔒 Authorize Payment · {formatCurrency(buyerPays)}</Text>}
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          By proceeding, you agree to VouchiX's terms. Funds are held in escrow
          until both parties confirm the transfer.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  headerBack: { padding: spacing.xs },
  headerBackText: { fontSize: fontSizes.lg, color: colors.white },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.white },

  body: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  errorBanner: {
    backgroundColor: colors.error + '15',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorBannerText: { color: colors.error, fontWeight: '600', fontSize: fontSizes.sm },

  dealCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  dealBrand: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.text },
  dealFace: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 4 },
  dealMessage: { fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm, textAlign: 'center' },

  breakdownCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  breakdownTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: fontSizes.sm, color: colors.textMuted, flex: 1 },
  breakdownValue: { fontSize: fontSizes.sm, color: colors.text, fontWeight: '600' },
  breakdownDivider: { height: 1, backgroundColor: colors.border },
  breakdownTotal: { fontSize: fontSizes.md, fontWeight: '800', color: colors.text },
  breakdownTotalValue: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.secondary },

  escrowCard: {
    backgroundColor: colors.secondary + '10',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary + '30',
    gap: spacing.xs,
  },
  escrowTitle: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.secondary },
  escrowText: { fontSize: fontSizes.xs, color: colors.secondary, lineHeight: 18, opacity: 0.85 },

  stepsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stepsTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bgLight,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepNum: { fontSize: fontSizes.xs, fontWeight: '800', color: colors.textMuted },
  stepNumDone: { color: colors.white },
  stepLabel: { fontSize: fontSizes.sm, color: colors.textMuted, flex: 1 },
  stepLabelDone: { color: colors.text, fontWeight: '600' },

  devNotice: {
    backgroundColor: '#FFF3CD',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  devNoticeText: { fontSize: fontSizes.xs, color: '#B8860B' },

  payBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.lg },

  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  errorText: { color: colors.error, fontSize: fontSizes.md, textAlign: 'center', marginBottom: spacing.md },
  backBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtnText: { color: colors.white, fontWeight: '700' },
});
