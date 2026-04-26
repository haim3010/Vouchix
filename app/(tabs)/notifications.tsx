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
import { useMarketplaceStore, OfferWithBuyer } from '@/lib/stores/marketplaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import AppHeader from '@/components/AppHeader';

type Section = 'used' | 'expired' | 'trade' | 'offers' | null;
type TradeFilter = 'all' | 'sales' | 'purchases';

const STATUS_COLORS: Record<string, string> = {
  pending:   colors.warning,
  accepted:  colors.success,
  rejected:  colors.error,
  cancelled: colors.textMuted,
  completed: colors.secondary,
};

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  accepted:  'Accepted ✓',
  rejected:  'Rejected',
  cancelled: 'Cancelled',
  completed: 'Completed ✓',
};

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const { vouchers, fetchVouchers } = useWalletStore();
  const {
    myOffers, incomingOffers,
    fetchMyOffers, fetchIncomingOffers, respondToOffer, fetchListings,
  } = useMarketplaceStore();

  const [openSection, setOpenSection] = useState<Section>(null);
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Accept/Reject confirmation modal (replaces Alert.alert which doesn't work)
  const [respondTarget, setRespondTarget] = useState<{ offer: OfferWithBuyer; status: 'accepted' | 'rejected' } | null>(null);

  // Memoised refresh so both useEffect and useFocusEffect use the same stable reference
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const uid = user.id;
    setLoading(true);
    try {
      await Promise.all([
        fetchVouchers(uid),
        fetchListings(),
        fetchMyOffers(uid),
        fetchIncomingOffers(uid),
      ]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchVouchers, fetchListings, fetchMyOffers, fetchIncomingOffers]);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-fetch every time this tab comes into focus (catches changes made on other tabs)
  useFocusEffect(refresh);

  function handleRespond(offer: OfferWithBuyer, status: 'accepted' | 'rejected') {
    setRespondTarget({ offer, status });
  }

  async function confirmRespond() {
    if (!respondTarget) return;
    const { offer, status } = respondTarget;
    setRespondingId(offer.id);
    setRespondTarget(null);
    try {
      await respondToOffer(offer.id, status);
    } catch {
      // error handled silently; list will refresh
    } finally {
      setRespondingId(null);
      refresh();
    }
  }

  const usedVouchers = vouchers.filter((v) => v.status === 'used');
  const expiredVouchers = vouchers.filter((v) => v.status === 'expired');
  const pendingCount = incomingOffers.filter((o) => o.status === 'pending').length;

  const usedTotal = usedVouchers.reduce((s, v) => s + v.original_value, 0);
  const expiredTotal = expiredVouchers.reduce((s, v) => s + v.original_value, 0);
  const allOffers = [...incomingOffers, ...myOffers];

  function toggleSection(s: Section) {
    setOpenSection((prev) => (prev === s ? null : s));
  }

  function renderSectionHeader(
    id: Section,
    emoji: string,
    label: string,
    count: number,
    badge?: string,
    badgeColor?: string,
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
      <AppHeader subtitle="Your offers & trade history" />
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Track all your voucher activity</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      >

        {/* Used Vouchers */}
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
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Expired Vouchers */}
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
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Sales & Purchases */}
        <View style={styles.accordionCard}>
          {renderSectionHeader('trade', '🤝', 'Sales & Purchases', 0, undefined)}
          {openSection === 'trade' && (
            <View style={styles.accordionBody}>
              <View style={styles.subFilter}>
                {(['all', 'sales', 'purchases'] as TradeFilter[]).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.subFilterChip, tradeFilter === f && styles.subFilterChipActive]}
                    onPress={() => setTradeFilter(f)}
                  >
                    <Text style={[styles.subFilterText, tradeFilter === f && styles.subFilterTextActive]}>
                      {f === 'all' ? 'All' : f === 'sales' ? 'My Sales' : 'My Purchases'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <EmptyState emoji="🤝" text="No completed trades yet" />
            </View>
          )}
        </View>

        {/* Offers */}
        <View style={styles.accordionCard}>
          {renderSectionHeader(
            'offers', '📨', 'Offers',
            allOffers.length,
            pendingCount > 0 ? `${pendingCount} pending` : undefined,
            colors.warning,
          )}
          {openSection === 'offers' && (
            <View style={styles.accordionBody}>
              {/* Sub-tabs */}
              <View style={styles.offerTabs}>
                <Text style={styles.offerTabLabel}>Received ({incomingOffers.length})</Text>
                <Text style={styles.offerTabLabel}>Sent ({myOffers.length})</Text>
              </View>

              {/* Incoming */}
              {incomingOffers.length > 0 && (
                <View>
                  <Text style={styles.offerGroupTitle}>Received</Text>
                  {incomingOffers.map((offer) => (
                    <View key={offer.id} style={styles.offerCard}>
                      <View style={styles.offerTop}>
                        <View style={styles.buyerAvatar}>
                          <Text style={styles.buyerInitial}>
                            {offer.buyer?.display_name?.[0]?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                        <View style={styles.offerMeta}>
                          <Text style={styles.offerBuyer}>{offer.buyer?.display_name ?? 'Buyer'}</Text>
                          <Text style={styles.offerRating}>
                            ⭐ {(offer.buyer?.rating ?? 5).toFixed(1)} · {offer.buyer?.total_trades ?? 0} trades
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[offer.status] + '20' }]}>
                          <Text style={[styles.statusText, { color: STATUS_COLORS[offer.status] }]}>
                            {STATUS_LABEL[offer.status]}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.offerDetails}>
                        <Text style={styles.offerBrand}>{offer.voucher?.brand}</Text>
                        <View style={styles.priceRow}>
                          <View style={styles.priceItem}>
                            <Text style={styles.priceLabel}>Their offer</Text>
                            <Text style={styles.offerPrice}>{formatCurrency(offer.offer_amount)}</Text>
                          </View>
                          <View style={styles.priceDivider} />
                          <View style={styles.priceItem}>
                            <Text style={styles.priceLabel}>Listed at</Text>
                            <Text style={styles.listingPrice}>
                              {formatCurrency(offer.voucher?.listing_price ?? offer.voucher?.original_value ?? 0)}
                            </Text>
                          </View>
                          <View style={styles.priceDivider} />
                          <View style={styles.priceItem}>
                            <Text style={styles.priceLabel}>Face value</Text>
                            <Text style={styles.faceValue}>
                              {formatCurrency(offer.voucher?.original_value ?? 0)}
                            </Text>
                          </View>
                        </View>
                        {offer.message && (
                          <View style={styles.messageBox}>
                            <Text style={styles.messageText}>"{offer.message}"</Text>
                          </View>
                        )}
                      </View>
                      {offer.status === 'pending' && (
                        <View style={styles.actions}>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleRespond(offer, 'rejected')}
                            disabled={respondingId === offer.id}
                          >
                            {respondingId === offer.id
                              ? <ActivityIndicator color={colors.error} size="small" />
                              : <Text style={styles.rejectText}>Reject</Text>
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleRespond(offer, 'accepted')}
                            disabled={respondingId === offer.id}
                          >
                            {respondingId === offer.id
                              ? <ActivityIndicator color={colors.white} size="small" />
                              : <Text style={styles.acceptText}>Accept ✓</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Sent */}
              {myOffers.length > 0 && (
                <View>
                  <Text style={styles.offerGroupTitle}>Sent</Text>
                  {myOffers.map((offer) => (
                    <View key={offer.id} style={styles.offerCard}>
                      <View style={styles.offerTop}>
                        <Text style={styles.offerBrandBig}>{offer.voucher?.brand ?? 'Voucher'}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[offer.status] + '20' }]}>
                          <Text style={[styles.statusText, { color: STATUS_COLORS[offer.status] }]}>
                            {STATUS_LABEL[offer.status]}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.priceRow}>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Your offer</Text>
                          <Text style={styles.offerPrice}>{formatCurrency(offer.offer_amount)}</Text>
                        </View>
                        <View style={styles.priceDivider} />
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Listed at</Text>
                          <Text style={styles.listingPrice}>
                            {formatCurrency(offer.voucher?.listing_price ?? offer.voucher?.original_value ?? 0)}
                          </Text>
                        </View>
                        <View style={styles.priceDivider} />
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Face value</Text>
                          <Text style={styles.faceValue}>
                            {formatCurrency(offer.voucher?.original_value ?? 0)}
                          </Text>
                        </View>
                      </View>
                      {offer.message && (
                        <View style={styles.messageBox}>
                          <Text style={styles.messageText}>"{offer.message}"</Text>
                        </View>
                      )}
                      <Text style={styles.offerDate}>
                        Sent {new Date(offer.created_at).toLocaleDateString('en-GB')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {allOffers.length === 0 && (
                <EmptyState emoji="📨" text="No offers yet" />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Accept / Reject confirmation (replaces Alert.alert) */}
      <Modal visible={!!respondTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>
              {respondTarget?.status === 'accepted' ? 'Accept Offer?' : 'Reject Offer?'}
            </Text>
            <Text style={styles.confirmSub}>
              {respondTarget?.status === 'accepted'
                ? `Accept ${respondTarget.offer.buyer?.display_name}'s offer of ${formatCurrency(respondTarget.offer.offer_amount)}? You'll need to arrange the transfer.`
                : `Reject the offer from ${respondTarget?.offer.buyer?.display_name}? They will be notified.`}
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setRespondTarget(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmAction, respondTarget?.status === 'accepted' ? styles.confirmAccept : styles.confirmReject]}
                onPress={confirmRespond}
              >
                <Text style={styles.confirmActionText}>
                  {respondTarget?.status === 'accepted' ? 'Accept ✓' : 'Reject'}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
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
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },

  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  historyItemLeft: { flex: 1 },
  historyBrand: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  historyDate: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  historyItemRight: { alignItems: 'flex-end', gap: 4 },
  historyValue: { fontSize: fontSizes.md, fontWeight: '800' },
  historyBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  historyBadgeText: { fontSize: fontSizes.xs, fontWeight: '700' },

  subFilter: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  subFilterChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.bgLight,
  },
  subFilterChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  subFilterText: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: '500' },
  subFilterTextActive: { color: colors.accent, fontWeight: '700' },

  offerTabs: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm },
  offerTabLabel: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: '600' },
  offerGroupTitle: {
    fontSize: fontSizes.sm, fontWeight: '800', color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  offerCard: {
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  offerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  buyerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center',
  },
  buyerInitial: { color: colors.white, fontWeight: '700', fontSize: fontSizes.md },
  offerMeta: { flex: 1 },
  offerBuyer: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  offerRating: { fontSize: fontSizes.xs, color: colors.textMuted },
  offerBrandBig: { flex: 1, fontSize: fontSizes.lg, fontWeight: '800', color: colors.text },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  statusText: { fontSize: fontSizes.xs, fontWeight: '700' },
  offerDetails: { marginBottom: spacing.sm },
  offerBrand: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceItem: { flex: 1, alignItems: 'center' },
  priceLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: 2 },
  offerPrice: { fontSize: fontSizes.md, fontWeight: '800', color: colors.accent },
  listingPrice: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text },
  faceValue: { fontSize: fontSizes.md, color: colors.textMuted, textDecorationLine: 'line-through' },
  priceDivider: { width: 1, height: 32, backgroundColor: colors.border },
  messageBox: {
    backgroundColor: colors.gray100, borderRadius: radius.md,
    padding: spacing.sm, marginTop: spacing.sm,
  },
  messageText: { fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic' },
  offerDate: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.error,
    borderRadius: radius.md, padding: spacing.sm, alignItems: 'center',
  },
  rejectText: { color: colors.error, fontWeight: '700', fontSize: fontSizes.sm },
  acceptBtn: {
    flex: 2, backgroundColor: colors.success,
    borderRadius: radius.md, padding: spacing.sm, alignItems: 'center',
  },
  acceptText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },

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
  confirmAccept: { backgroundColor: colors.success },
  confirmReject: { backgroundColor: colors.error },
  confirmActionText: { color: colors.white, fontWeight: '700' },
});
