/**
 * offer/[id].tsx  ←  Transaction status screen
 *
 * Shows a 5-step progress tracker for the escrow flow.
 * Both buyer and seller land here after payment is authorized.
 *
 * Step 1: Payment authorized (buyer done)
 * Step 2: Seller uploads voucher code
 * Step 3: Buyer confirms voucher works → captures payment
 * Step 4: Code revealed to buyer
 * Step 5: Complete
 */
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTransactionStore, decodeVoucherCode } from '@/lib/stores/transactionStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import type { TransactionStatus } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_STEP: Record<TransactionStatus, number> = {
  pending:    1, // authorized, waiting for seller
  processing: 2, // seller uploaded code, waiting for buyer
  completed:  5,
  refunded:   0,
  disputed:   0,
  cancelled:  0,
};

const STATUS_COLOR: Record<TransactionStatus, string> = {
  pending:    colors.warning,
  processing: colors.secondary,
  completed:  colors.success,
  refunded:   colors.textMuted,
  disputed:   colors.error,
  cancelled:  colors.textMuted,
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending:    '⏳ Awaiting seller',
  processing: '🔍 Awaiting your confirmation',
  completed:  '✅ Completed',
  refunded:   '↩ Refunded',
  disputed:   '⚠ Under dispute',
  cancelled:  '✕ Cancelled',
};

// ── Step indicator ────────────────────────────────────────────────────────────
function ProgressStep({
  n, label, sublabel, currentStep, isLast,
}: {
  n: number; label: string; sublabel?: string; currentStep: number; isLast?: boolean;
}) {
  const done = currentStep > n;
  const active = currentStep === n;
  return (
    <View style={st.progressRow}>
      <View style={st.progressLeft}>
        <View style={[
          st.progressCircle,
          done && st.progressCircleDone,
          active && st.progressCircleActive,
        ]}>
          <Text style={[
            st.progressNum,
            (done || active) && st.progressNumActive,
          ]}>
            {done ? '✓' : n}
          </Text>
        </View>
        {!isLast && <View style={[st.progressLine, done && st.progressLineDone]} />}
      </View>
      <View style={st.progressText}>
        <Text style={[
          st.progressLabel,
          active && st.progressLabelActive,
          done && st.progressLabelDone,
        ]}>
          {label}
        </Text>
        {sublabel && active && (
          <Text style={st.progressSublabel}>{sublabel}</Text>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { currentTransaction, fetchTransaction, sellerUploadCode, buyerConfirmWorking, loading, subscribeToTransaction } = useTransactionStore();

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const unsubRef = useRef<(() => void) | null>(null);

  const tx = currentTransaction?.id === id ? currentTransaction : null;

  useEffect(() => {
    if (id) {
      fetchTransaction(id);
      unsubRef.current = subscribeToTransaction(id);
    }
    return () => { unsubRef.current?.(); unsubRef.current = null; };
  }, [id]);

  const isBuyer  = tx?.buyer_id  === user?.id;
  const isSeller = tx?.seller_id === user?.id;
  const status   = tx?.status ?? 'pending';
  const currentStep = STATUS_STEP[status] ?? 1;

  const isActive = status === 'pending' || status === 'processing';
  const isTerminal = status === 'completed' || status === 'refunded' || status === 'cancelled';
  const isDisputed = status === 'disputed';

  async function handleSellerUpload() {
    if (!codeInput.trim() || !id) return;
    setActionError('');
    setActionLoading(true);
    try {
      await sellerUploadCode(id, codeInput.trim());
      setShowCodeInput(false);
      setCodeInput('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to upload code');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBuyerConfirm() {
    if (!id) return;
    setActionError('');
    setActionLoading(true);
    try {
      await buyerConfirmWorking(id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to confirm');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchTransaction(id!);
    setRefreshing(false);
  }

  if (loading && !tx) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={st.center}>
        <Text style={st.errorText}>Transaction not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Text style={st.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const revealCode = status === 'completed' && isBuyer && tx.voucher_code_encrypted;
  const decodedCode = revealCode ? decodeVoucherCode(tx.voucher_code_encrypted!) : null;

  return (
    <View style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.headerBack}>
          <Text style={st.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Deal Status</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={st.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        {/* Status pill */}
        <View style={[st.statusPill, { backgroundColor: STATUS_COLOR[status] + '20', borderColor: STATUS_COLOR[status] }]}>
          <Text style={[st.statusText, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
        </View>

        {/* Deal summary */}
        <View style={st.summaryCard}>
          <Text style={st.summaryBrand}>{tx.voucher?.brand ?? 'Voucher'}</Text>
          <Text style={st.summaryFace}>Face value {formatCurrency(tx.voucher?.original_value ?? 0)}</Text>
          <Text style={st.summaryPrice}>Deal price: <Text style={{ color: colors.secondary, fontWeight: '800' }}>{formatCurrency(tx.sale_price)}</Text></Text>
          <Text style={st.summaryRole}>{isBuyer ? '🛒 You are the buyer' : '🏷️ You are the seller'}</Text>
        </View>

        {/* Error */}
        {actionError.length > 0 && (
          <View style={st.errorBanner}>
            <Text style={st.errorBannerText}>⚠ {actionError}</Text>
          </View>
        )}

        {/* ── Disputed state ── */}
        {isDisputed && (
          <View style={st.disputeCard}>
            <Text style={st.disputeTitle}>⚠ Dispute Open</Text>
            <Text style={st.disputeReason}>Reason: {tx.dispute_reason?.replace(/_/g, ' ') ?? 'Unknown'}</Text>
            {tx.dispute_description && (
              <Text style={st.disputeDesc}>{tx.dispute_description}</Text>
            )}
            {tx.dispute_responded_at ? (
              <View style={st.disputeResponse}>
                <Text style={st.disputeResponseLabel}>Seller responded:</Text>
                <Text style={st.disputeResponseText}>{tx.dispute_response}</Text>
              </View>
            ) : isSeller ? (
              <Text style={st.disputeWaiting}>You have 24 hours to respond to avoid an automatic refund.</Text>
            ) : (
              <Text style={st.disputeWaiting}>Waiting for seller to respond. Auto-refund in 24 hours if no response.</Text>
            )}
            {tx.dispute_response && !tx.dispute_responded_at && isSeller && (
              <Text style={st.disputeWaiting}>Your response is being reviewed.</Text>
            )}
          </View>
        )}

        {/* ── Progress steps ── */}
        {!isDisputed && (
          <View style={st.stepsCard}>
            <ProgressStep n={1} label="Payment authorized" sublabel="Funds held securely — not charged yet" currentStep={currentStep} />
            <ProgressStep n={2} label="Seller uploads voucher code" sublabel={isSeller ? "Upload your voucher code below" : "Waiting for seller..."} currentStep={currentStep} />
            <ProgressStep n={3} label="You confirm the code works" sublabel={isBuyer && currentStep === 3 ? "Test the code, then confirm below" : undefined} currentStep={currentStep} />
            <ProgressStep n={4} label="Payment released to seller" currentStep={currentStep} />
            <ProgressStep n={5} label="Deal complete" currentStep={currentStep} isLast />
          </View>
        )}

        {/* ── Revealed voucher code (buyer, completed) ── */}
        {revealCode && decodedCode && (
          <View style={st.codeRevealCard}>
            <Text style={st.codeRevealLabel}>🎉 Your Voucher Code</Text>
            <Text style={st.codeRevealCode}>{decodedCode}</Text>
            <Text style={st.codeRevealSub}>Save this code — it's now yours!</Text>
          </View>
        )}

        {/* ── Timeline ── */}
        <View style={st.timelineCard}>
          <Text style={st.timelineTitle}>Timeline</Text>
          <TimelineRow label="Payment authorized" time={tx.created_at} />
          {tx.seller_confirmed_at && <TimelineRow label="Seller uploaded code" time={tx.seller_confirmed_at} />}
          {tx.buyer_confirmed_at && <TimelineRow label="Buyer confirmed" time={tx.buyer_confirmed_at} />}
          {tx.disputed_at && <TimelineRow label="Dispute opened" time={tx.disputed_at} color={colors.error} />}
          {tx.dispute_responded_at && <TimelineRow label="Seller responded" time={tx.dispute_responded_at} />}
          {tx.completed_at && <TimelineRow label="Deal completed" time={tx.completed_at} color={colors.success} />}
        </View>

        {/* ── Actions ── */}

        {/* SELLER: upload code (step 1 = pending) */}
        {isSeller && status === 'pending' && (
          <View style={st.actionCard}>
            <Text style={st.actionTitle}>📤 Upload Voucher Code</Text>
            <Text style={st.actionSub}>
              Enter the voucher code. It will be encrypted and hidden until the buyer confirms it works.
            </Text>
            {showCodeInput ? (
              <>
                <TextInput
                  style={st.codeInput}
                  placeholder="Enter voucher code..."
                  placeholderTextColor={colors.textMuted}
                  value={codeInput}
                  onChangeText={setCodeInput}
                  autoCapitalize="none"
                  autoFocus
                />
                <TouchableOpacity
                  style={[st.primaryBtn, (!codeInput.trim() || actionLoading) && st.btnDisabled]}
                  onPress={handleSellerUpload}
                  disabled={!codeInput.trim() || actionLoading}
                >
                  {actionLoading
                    ? <ActivityIndicator color={colors.white} />
                    : <Text style={st.primaryBtnText}>✓ Upload Code Securely</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowCodeInput(false); setCodeInput(''); }}>
                  <Text style={st.cancelLink}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={st.primaryBtn} onPress={() => setShowCodeInput(true)}>
                <Text style={st.primaryBtnText}>📤 Enter Voucher Code</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* BUYER: confirm working (step 2 = processing) */}
        {isBuyer && status === 'processing' && (
          <View style={st.actionCard}>
            <Text style={st.actionTitle}>✅ Confirm Voucher Works</Text>
            <Text style={st.actionSub}>
              Test the voucher code at the store. If it works, tap Confirm to release payment to the seller.
              If not, tap Report a Problem.
            </Text>
            <TouchableOpacity
              style={[st.primaryBtn, actionLoading && st.btnDisabled]}
              onPress={handleBuyerConfirm}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={st.primaryBtnText}>✅ Confirm Voucher Received & Working</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* REPORT A PROBLEM (buyer, active transaction, not disputed) */}
        {isBuyer && isActive && !isDisputed && (
          <TouchableOpacity
            style={st.disputeBtn}
            onPress={() => router.push(`/dispute/${id}`)}
          >
            <Text style={st.disputeBtnText}>⚠ Report a Problem</Text>
          </TouchableOpacity>
        )}

        {/* SELLER: respond to dispute */}
        {isSeller && isDisputed && !tx.dispute_responded_at && (
          <TouchableOpacity
            style={st.disputeBtn}
            onPress={() => router.push(`/dispute/${id}?mode=respond`)}
          >
            <Text style={st.disputeBtnText}>📝 Respond to Dispute</Text>
          </TouchableOpacity>
        )}

        {/* Auto-capture notice */}
        {isBuyer && status === 'processing' && tx.auto_capture_at && (
          <View style={st.autoCapture}>
            <Text style={st.autoCaptureText}>
              ⏱ If you don't confirm by {new Date(tx.auto_capture_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })},
              payment will be automatically released to the seller.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TimelineRow({ label, time, color }: { label: string; time: string; color?: string }) {
  return (
    <View style={st.timelineRow}>
      <View style={[st.timelineDot, color ? { backgroundColor: color } : {}]} />
      <View style={{ flex: 1 }}>
        <Text style={[st.timelineLabel, color ? { color } : {}]}>{label}</Text>
        <Text style={st.timelineTime}>
          {new Date(time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
  },
  headerBack: { padding: spacing.xs },
  headerBackText: { fontSize: fontSizes.lg, color: colors.white },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.white },

  body: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  statusPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  statusText: { fontSize: fontSizes.sm, fontWeight: '800' },

  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryBrand: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.text },
  summaryFace: { fontSize: fontSizes.sm, color: colors.textMuted },
  summaryPrice: { fontSize: fontSizes.md, color: colors.text, marginTop: spacing.xs },
  summaryRole: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.xs },

  errorBanner: {
    backgroundColor: colors.error + '15',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorBannerText: { color: colors.error, fontSize: fontSizes.sm, fontWeight: '600' },

  stepsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 0,
  },
  progressRow: { flexDirection: 'row', gap: spacing.sm, minHeight: 60 },
  progressLeft: { alignItems: 'center', width: 32 },
  progressCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bgLight, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  progressCircleActive: { borderColor: colors.secondary, backgroundColor: colors.secondary + '20' },
  progressCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  progressNum: { fontSize: fontSizes.xs, fontWeight: '800', color: colors.textMuted },
  progressNumActive: { color: colors.white },
  progressLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  progressLineDone: { backgroundColor: colors.success },
  progressText: { flex: 1, paddingBottom: spacing.md, paddingTop: 4 },
  progressLabel: { fontSize: fontSizes.sm, color: colors.textMuted },
  progressLabelActive: { color: colors.secondary, fontWeight: '700' },
  progressLabelDone: { color: colors.text, fontWeight: '600' },
  progressSublabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2, lineHeight: 16 },

  codeRevealCard: {
    backgroundColor: colors.success + '15',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.success,
    gap: spacing.sm,
  },
  codeRevealLabel: { fontSize: fontSizes.md, fontWeight: '700', color: colors.success },
  codeRevealCode: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.text, letterSpacing: 3, fontVariant: ['tabular-nums'] },
  codeRevealSub: { fontSize: fontSizes.xs, color: colors.textMuted },

  timelineCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  timelineTitle: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary, marginTop: 5 },
  timelineLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text },
  timelineTime: { fontSize: fontSizes.xs, color: colors.textMuted },

  actionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.secondary,
  },
  actionTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.text },
  actionSub: { fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },

  codeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.bgLight,
    fontFamily: 'monospace',
  },

  primaryBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.sm },

  cancelLink: { color: colors.textMuted, fontSize: fontSizes.sm, textAlign: 'center', marginTop: 4 },

  disputeBtn: {
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },
  disputeBtnText: { color: colors.error, fontWeight: '700', fontSize: fontSizes.sm },

  disputeCard: {
    backgroundColor: colors.error + '10',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.sm,
  },
  disputeTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.error },
  disputeReason: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text },
  disputeDesc: { fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic' },
  disputeWaiting: { fontSize: fontSizes.xs, color: colors.error, lineHeight: 18 },
  disputeResponse: { backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  disputeResponseLabel: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.textMuted },
  disputeResponseText: { fontSize: fontSizes.sm, color: colors.text },

  autoCapture: {
    backgroundColor: '#FFF3CD',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  autoCaptureText: { fontSize: fontSizes.xs, color: '#B8860B', lineHeight: 18 },

  errorText: { color: colors.error, fontSize: fontSizes.md, marginBottom: spacing.md },
  backBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtnText: { color: colors.white, fontWeight: '700' },
});
