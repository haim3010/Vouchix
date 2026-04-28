/**
 * dispute/[transactionId].tsx
 *
 * Two modes (via ?mode= query param):
 *   - default  → buyer opens a dispute
 *   - respond  → seller responds to a dispute
 */
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTransactionStore } from '@/lib/stores/transactionStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import { DisputeReason, DISPUTE_REASON_LABELS } from '@/types';

const REASONS: DisputeReason[] = ['invalid_code', 'wrong_balance', 'seller_not_responding', 'other'];

// ── Reason option card ─────────────────────────────────────────────────────────
function ReasonCard({
  reason, selected, onPress,
}: {
  reason: DisputeReason; selected: boolean; onPress: () => void;
}) {
  const icons: Record<DisputeReason, string> = {
    invalid_code: '🚫',
    wrong_balance: '⚖️',
    seller_not_responding: '🔇',
    other: '✏️',
  };
  return (
    <TouchableOpacity
      style={[d.reasonCard, selected && d.reasonCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={d.reasonIcon}>{icons[reason]}</Text>
      <Text style={[d.reasonLabel, selected && d.reasonLabelSelected]}>
        {DISPUTE_REASON_LABELS[reason]}
      </Text>
      {selected && <Text style={d.reasonCheck}>✓</Text>}
    </TouchableOpacity>
  );
}

export default function DisputeScreen() {
  const { transactionId, mode } = useLocalSearchParams<{ transactionId: string; mode?: string }>();
  const isRespondMode = mode === 'respond';

  const { user } = useAuthStore();
  const {
    currentTransaction, fetchTransaction, openDispute, respondToDispute, loading,
  } = useTransactionStore();

  const [selectedReason, setSelectedReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const tx = currentTransaction?.id === transactionId ? currentTransaction : null;

  useEffect(() => {
    if (transactionId && !tx) fetchTransaction(transactionId);
  }, [transactionId]);

  async function handleSubmitDispute() {
    if (!selectedReason) { setError('Please select a reason'); return; }
    if (selectedReason === 'other' && !description.trim()) {
      setError('Please describe the issue'); return;
    }
    setError('');
    setSubmitting(true);
    try {
      await openDispute(transactionId, selectedReason, description.trim() || undefined);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open dispute. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitResponse() {
    if (!response.trim()) { setError('Please enter your response'); return; }
    setError('');
    setSubmitting(true);
    try {
      await respondToDispute(transactionId, response.trim());
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit response. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={d.container}>
        <View style={d.header}>
          <TouchableOpacity onPress={() => router.back()} style={d.headerBack}>
            <Text style={d.headerBackText}>✕</Text>
          </TouchableOpacity>
          <Text style={d.headerTitle}>{isRespondMode ? 'Response Sent' : 'Dispute Filed'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={d.successWrap}>
          <Text style={d.successEmoji}>{isRespondMode ? '📩' : '🛡️'}</Text>
          <Text style={d.successTitle}>
            {isRespondMode ? 'Response submitted' : `Dispute #${transactionId?.slice(0, 8).toUpperCase()}`}
          </Text>
          <Text style={d.successSub}>
            {isRespondMode
              ? 'Your response has been recorded. The platform team will review and resolve the dispute.'
              : 'Your dispute has been received. Funds are frozen and the seller has 24 hours to respond. If unresolved, a refund will be issued automatically.'}
          </Text>
          <TouchableOpacity style={d.successBtn} onPress={() => router.back()}>
            <Text style={d.successBtnText}>Back to Transaction</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading && !tx) {
    return <View style={d.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={d.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={d.header}>
        <TouchableOpacity onPress={() => router.back()} style={d.headerBack}>
          <Text style={d.headerBackText}>✕</Text>
        </TouchableOpacity>
        <Text style={d.headerTitle}>{isRespondMode ? 'Respond to Dispute' : 'Report a Problem'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={d.body} showsVerticalScrollIndicator={false}>
        {/* Transaction summary */}
        {tx && (
          <View style={d.txSummary}>
            <Text style={d.txBrand}>{tx.voucher?.brand ?? 'Voucher'}</Text>
            <Text style={d.txPrice}>Deal: {formatCurrency(tx.sale_price)}</Text>
            <Text style={d.txId}>Ref: #{transactionId?.slice(0, 8).toUpperCase()}</Text>
          </View>
        )}

        {error.length > 0 && (
          <View style={d.errorBanner}>
            <Text style={d.errorText}>⚠ {error}</Text>
          </View>
        )}

        {/* ── BUYER MODE: select reason ── */}
        {!isRespondMode && (
          <>
            <Text style={d.sectionTitle}>What's the issue?</Text>
            {REASONS.map((r) => (
              <ReasonCard
                key={r}
                reason={r}
                selected={selectedReason === r}
                onPress={() => { setSelectedReason(r); setError(''); }}
              />
            ))}

            {/* Description field — always shown but required only for 'other' */}
            <Text style={d.sectionTitle}>
              {selectedReason === 'other' ? 'Describe the issue *' : 'Additional details (optional)'}
            </Text>
            <TextInput
              style={[d.textArea, selectedReason === 'other' && d.textAreaRequired]}
              placeholder={
                selectedReason === 'invalid_code'
                  ? 'e.g. Tried to redeem at Nike store, code shows as already used...'
                  : selectedReason === 'wrong_balance'
                  ? 'e.g. Listed as ₪500, but cashier showed only ₪200 remaining...'
                  : selectedReason === 'seller_not_responding'
                  ? 'e.g. Offer was accepted 3 days ago, seller has not uploaded the code...'
                  : 'Describe what happened...'
              }
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />

            {/* Warning */}
            <View style={d.warningCard}>
              <Text style={d.warningTitle}>⚠ Important</Text>
              <Text style={d.warningText}>
                Filing a dispute will freeze the payment immediately. The seller
                has 24 hours to respond. If they don't, a full refund will be issued.
                Frivolous disputes may result in account restrictions.
              </Text>
            </View>

            <TouchableOpacity
              style={[d.submitBtn, (!selectedReason || submitting) && d.submitBtnDisabled]}
              onPress={handleSubmitDispute}
              disabled={!selectedReason || submitting}
            >
              {submitting
                ? <ActivityIndicator color={colors.white} />
                : <Text style={d.submitBtnText}>🛡️ Open Dispute</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ── SELLER MODE: respond to dispute ── */}
        {isRespondMode && (
          <>
            {tx?.dispute_reason && (
              <View style={d.disputeSummary}>
                <Text style={d.disputeSummaryLabel}>Buyer's reason:</Text>
                <Text style={d.disputeSummaryReason}>
                  {DISPUTE_REASON_LABELS[tx.dispute_reason as DisputeReason]}
                </Text>
                {tx.dispute_description && (
                  <Text style={d.disputeSummaryDesc}>"{tx.dispute_description}"</Text>
                )}
              </View>
            )}

            <Text style={d.sectionTitle}>Your response *</Text>
            <TextInput
              style={[d.textArea, d.textAreaRequired, { minHeight: 120 }]}
              placeholder="Explain your side of the situation. e.g. The code was valid when I uploaded it. Here is the receipt..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={response}
              onChangeText={setResponse}
            />

            <View style={d.warningCard}>
              <Text style={d.warningTitle}>⏰ 24-hour window</Text>
              <Text style={d.warningText}>
                If you don't respond within 24 hours of the dispute being filed,
                the payment will be automatically cancelled and refunded to the buyer.
              </Text>
            </View>

            <TouchableOpacity
              style={[d.submitBtn, (!response.trim() || submitting) && d.submitBtnDisabled]}
              onPress={handleSubmitResponse}
              disabled={!response.trim() || submitting}
            >
              {submitting
                ? <ActivityIndicator color={colors.white} />
                : <Text style={d.submitBtnText}>📩 Submit Response</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const d = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
  },
  headerBack: { padding: spacing.xs },
  headerBackText: { fontSize: fontSizes.lg, color: colors.white },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.white },

  body: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  txSummary: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  txBrand: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.text },
  txPrice: { fontSize: fontSizes.sm, color: colors.textMuted },
  txId: { fontSize: fontSizes.xs, color: colors.textMuted },

  errorBanner: {
    backgroundColor: colors.error + '15', borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.error,
  },
  errorText: { color: colors.error, fontSize: fontSizes.sm, fontWeight: '600' },

  sectionTitle: {
    fontSize: fontSizes.sm, fontWeight: '700', color: colors.text,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  reasonCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.cardBg, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  reasonCardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '08' },
  reasonIcon: { fontSize: 22 },
  reasonLabel: { flex: 1, fontSize: fontSizes.sm, color: colors.text, lineHeight: 20 },
  reasonLabelSelected: { fontWeight: '700', color: colors.accent },
  reasonCheck: { fontSize: fontSizes.md, color: colors.accent, fontWeight: '800' },

  textArea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: fontSizes.md, color: colors.text,
    backgroundColor: colors.cardBg, minHeight: 100, textAlignVertical: 'top',
  },
  textAreaRequired: { borderColor: colors.secondary },

  warningCard: {
    backgroundColor: '#FFF3CD', borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: '#F5A623', gap: 4,
  },
  warningTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: '#B8860B' },
  warningText: { fontSize: fontSizes.xs, color: '#B8860B', lineHeight: 18 },

  submitBtn: {
    backgroundColor: colors.error, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },

  disputeSummary: {
    backgroundColor: colors.error + '10', borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.error, gap: 4,
  },
  disputeSummaryLabel: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.error },
  disputeSummaryReason: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text },
  disputeSummaryDesc: { fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic' },

  // Success state
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  successEmoji: { fontSize: 64 },
  successTitle: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  successSub: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  successBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  successBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.md },
});
