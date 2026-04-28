import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import { useMessagesStore } from '@/lib/stores/messagesStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import AppHeader from '@/components/AppHeader';

type Section = 'used' | 'expired' | 'trade' | null;

const DEAL_STATUS_COLOR: Record<string, string> = {
  completed:  colors.success,
  rejected:   colors.error,
  cancelled:  colors.textMuted,
  refunded:   colors.warning,
};
const DEAL_STATUS_LABEL: Record<string, string> = {
  completed:  'Completed ✓',
  rejected:   'Declined',
  cancelled:  'Cancelled',
  refunded:   'Refunded',
};

export default function HistoryScreen() {
  const { user } = useAuthStore();
  const { vouchers, fetchVouchers, deleteVoucher } = useWalletStore();
  const { conversations, fetchConversations } = useMessagesStore();

  const [openSection, setOpenSection] = useState<Section>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; brand: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchVouchers(user.id),
        fetchConversations(user.id),
      ]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchVouchers, fetchConversations]);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Voucher history
  const usedVouchers    = vouchers.filter((v) => v.status === 'used');
  const expiredVouchers = vouchers.filter((v) => v.status === 'expired');
  const usedTotal       = usedVouchers.reduce((s, v) => s + v.original_value, 0);
  const expiredTotal    = expiredVouchers.reduce((s, v) => s + v.original_value, 0);

  // Closed deals — only show finished conversations (not active ones)
  const closedDeals = conversations.filter((c) =>
    ['completed', 'rejected', 'cancelled', 'refunded'].includes(c.offer_status)
  );
  const completedDeals = closedDeals.filter((c) => c.offer_status === 'completed');
  const totalSaved = completedDeals
    .filter((c) => !c.is_seller)
    .reduce((s, c) => s + (c.voucher_original_value - c.offer_amount), 0);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try { await deleteVoucher(deleteTarget.id); }
    finally { setDeleteLoading(false); setDeleteTarget(null); }
  }

  function toggleSection(s: Section) {
    setOpenSection((prev) => (prev === s ? null : s));
  }

  function renderSectionHeader(
    id: Section, emoji: string, label: string, count: number,
    badge?: string, badgeColor?: string,
  ) {
    const isOpen = openSection === id;
    return (
      <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleSection(id)} activeOpacity={0.8}>
        <View style={styles.accordionLeft}>
          <Text style={styles.accordionEmoji}>{emoji}</Text>
          <View>
            <Text style={styles.accordionTitle}>{label}</Text>
            <Text style={styles.accordionCount}>{count} item{count !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={styles.accordionRight}>
          {badge ? (
            <View style={[styles.accordionBadge, { backgroundColor: (badgeColor ?? colors.accent) + '20' }]}>
              <Text style={[styles.accordionBadgeText, { color: badgeColor ?? colors.accent }]}>{badge}</Text>
            </View>
          ) : null}
          <Text style={[styles.accordionChevron, isOpen && styles.accordionChevronOpen]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader subtitle="Your voucher & deal history" />
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {completedDeals.length > 0
            ? `${completedDeals.length} completed deal${completedDeals.length !== 1 ? 's' : ''}${totalSaved > 0 ? ` · saved ${formatCurrency(totalSaved)}` : ''}`
            : 'Your closed deals and used vouchers'}
        </Text>
      </View>

      {loading && conversations.length === 0 && vouchers.length === 0 ? (
        <View style={styles.centerLoading}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
        >
          {/* ── Completed Deals ── */}
          <View style={styles.accordionCard}>
            {renderSectionHeader(
              'trade', '🤝', 'Completed Deals', closedDeals.length,
              completedDeals.length > 0 ? `${completedDeals.length} closed` : undefined,
              colors.success,
            )}
            {openSection === 'trade' && (
              <View style={styles.accordionBody}>
                {closedDeals.length === 0 ? (
                  <EmptyState emoji="🤝" text="No closed deals yet — go to Offers to negotiate!" />
                ) : (
                  closedDeals.map((deal) => {
                    const statusColor = DEAL_STATUS_COLOR[deal.offer_status] ?? colors.textMuted;
                    const statusLabel = DEAL_STATUS_LABEL[deal.offer_status] ?? deal.offer_status;
                    const saved = deal.voucher_original_value - deal.offer_amount;
                    return (
                      <View key={deal.offer_id} style={styles.dealCard}>
                        <View style={styles.dealTop}>
                          <View style={styles.dealInfo}>
                            <Text style={styles.dealBrand}>{deal.voucher_brand}</Text>
                            <Text style={styles.dealRole}>
                              {deal.is_seller ? '🏷 You sold' : '🛒 You bought'} · {deal.other_user_name}
                            </Text>
                          </View>
                          <View style={[styles.dealStatusBadge, { backgroundColor: statusColor + '20' }]}>
                            <Text style={[styles.dealStatusText, { color: statusColor }]}>{statusLabel}</Text>
                          </View>
                        </View>
                        <View style={styles.dealPrices}>
                          <View style={styles.dealPriceItem}>
                            <Text style={styles.dealPriceLabel}>Deal price</Text>
                            <Text style={[styles.dealPriceValue, { color: colors.secondary }]}>
                              {formatCurrency(deal.offer_amount)}
                            </Text>
                          </View>
                          <View style={styles.dealPriceDivider} />
                          <View style={styles.dealPriceItem}>
                            <Text style={styles.dealPriceLabel}>Face value</Text>
                            <Text style={styles.dealPriceOriginal}>
                              {formatCurrency(deal.voucher_original_value)}
                            </Text>
                          </View>
                          {!deal.is_seller && deal.offer_status === 'completed' && saved > 0 && (
                            <>
                              <View style={styles.dealPriceDivider} />
                              <View style={styles.dealPriceItem}>
                                <Text style={styles.dealPriceLabel}>You saved</Text>
                                <Text style={[styles.dealPriceValue, { color: colors.success }]}>
                                  {formatCurrency(saved)}
                                </Text>
                              </View>
                            </>
                          )}
                        </View>
                        <Text style={styles.dealDate}>
                          {new Date(deal.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>

          {/* ── Used Vouchers ── */}
          <View style={styles.accordionCard}>
            {renderSectionHeader('used', '✅', 'Used Vouchers', usedVouchers.length,
              usedVouchers.length > 0 ? formatCurrency(usedTotal) : undefined, colors.success)}
            {openSection === 'used' && (
              <View style={styles.accordionBody}>
                {usedVouchers.length === 0 ? (
                  <EmptyState emoji="✅" text="No used vouchers yet" />
                ) : (
                  usedVouchers.map((v) => (
                    <View key={v.id} style={styles.historyItem}>
                      <View style={styles.historyItemLeft}>
                        <Text style={styles.historyBrand}>{v.brand}</Text>
                        <Text style={styles.historyDate}>
                          {v.updated_at ? new Date(v.updated_at).toLocaleDateString('en-GB') : '—'}
                        </Text>
                      </View>
                      <View style={styles.historyItemRight}>
                        <Text style={[styles.historyValue, { color: colors.success }]}>
                          {formatCurrency(v.original_value)}
                        </Text>
                        <View style={[styles.historyBadge, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.historyBadgeText, { color: colors.success }]}>Used</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setDeleteTarget({ id: v.id, brand: v.brand })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.historyDeleteBtn}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          {/* ── Expired Vouchers ── */}
          <View style={styles.accordionCard}>
            {renderSectionHeader('expired', '⏰', 'Expired Vouchers', expiredVouchers.length,
              expiredVouchers.length > 0 ? formatCurrency(expiredTotal) + ' lost' : undefined, colors.error)}
            {openSection === 'expired' && (
              <View style={styles.accordionBody}>
                {expiredVouchers.length === 0 ? (
                  <EmptyState emoji="🎉" text="No expired vouchers — great job!" />
                ) : (
                  expiredVouchers.map((v) => (
                    <View key={v.id} style={styles.historyItem}>
                      <View style={styles.historyItemLeft}>
                        <Text style={styles.historyBrand}>{v.brand}</Text>
                        <Text style={styles.historyDate}>
                          Expired {v.expires_at ? new Date(v.expires_at).toLocaleDateString('en-GB') : '—'}
                        </Text>
                      </View>
                      <View style={styles.historyItemRight}>
                        <Text style={[styles.historyValue, { color: colors.error }]}>
                          {formatCurrency(v.original_value)}
                        </Text>
                        <View style={[styles.historyBadge, { backgroundColor: colors.error + '20' }]}>
                          <Text style={[styles.historyBadgeText, { color: colors.error }]}>Expired</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setDeleteTarget({ id: v.id, brand: v.brand })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.historyDeleteBtn}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Delete confirmation modal */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Remove from History?</Text>
            <Text style={styles.confirmSub}>
              Permanently delete "{deleteTarget?.brand}" from your history. This cannot be undone.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmAction, { backgroundColor: colors.error }]}
                onPress={confirmDelete}
                disabled={deleteLoading}
              >
                <Text style={styles.confirmActionText}>
                  {deleteLoading ? 'Deleting…' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: fontSizes.sm, color: colors.accent, marginTop: 2 },
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },

  accordionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: spacing.md,
  },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accordionEmoji: { fontSize: 24 },
  accordionTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  accordionCount: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accordionBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  accordionBadgeText: { fontSize: fontSizes.xs, fontWeight: '700' },
  accordionChevron: { fontSize: fontSizes.xxl, color: colors.gray400, transform: [{ rotate: '0deg' }] },
  accordionChevronOpen: { transform: [{ rotate: '90deg' }] },
  accordionBody: {
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, gap: spacing.sm,
  },

  // Completed deal cards
  dealCard: {
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dealTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  dealInfo: { flex: 1 },
  dealBrand: { fontSize: fontSizes.md, fontWeight: '800', color: colors.text },
  dealRole: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  dealStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  dealStatusText: { fontSize: fontSizes.xs, fontWeight: '700' },
  dealPrices: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  dealPriceItem: { flex: 1, alignItems: 'center' },
  dealPriceLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: 2 },
  dealPriceValue: { fontSize: fontSizes.md, fontWeight: '800' },
  dealPriceOriginal: { fontSize: fontSizes.md, color: colors.textMuted, textDecorationLine: 'line-through' },
  dealPriceDivider: { width: 1, height: 32, backgroundColor: colors.border },
  dealDate: { fontSize: fontSizes.xs, color: colors.textMuted },

  // History items
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  historyItemLeft: { flex: 1 },
  historyBrand: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  historyDate: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  historyItemRight: { alignItems: 'flex-end', gap: 4 },
  historyValue: { fontSize: fontSizes.md, fontWeight: '800' },
  historyBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  historyBadgeText: { fontSize: fontSizes.xs, fontWeight: '700' },
  historyDeleteBtn: { fontSize: 14, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: spacing.lg },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center' },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  confirmBox: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 320 },
  confirmTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  confirmSub: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: spacing.sm },
  confirmCancel: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  confirmCancelText: { color: colors.textMuted, fontWeight: '600' },
  confirmAction: { flex: 1, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  confirmActionText: { color: colors.white, fontWeight: '700' },
});
