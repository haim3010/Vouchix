import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useMarketplaceStore, OfferWithBuyer } from '@/lib/stores/marketplaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';

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
  const {
    myOffers, incomingOffers,
    fetchMyOffers, fetchIncomingOffers, respondToOffer, fetchListings,
  } = useMarketplaceStore();

  const [tab, setTab] = useState<'incoming' | 'sent'>('incoming');
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function refresh() {
    if (!user?.id) return;
    setLoading(true);
    await fetchListings();
    await Promise.all([fetchMyOffers(user.id), fetchIncomingOffers(user.id)]);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [user?.id]);

  async function handleRespond(offer: OfferWithBuyer, status: 'accepted' | 'rejected') {
    Alert.alert(
      status === 'accepted' ? 'Accept Offer' : 'Reject Offer',
      status === 'accepted'
        ? `Accept ${offer.buyer?.display_name}'s offer of ${formatCurrency(offer.offer_amount)}?`
        : `Reject this offer from ${offer.buyer?.display_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'accepted' ? 'Accept' : 'Reject',
          style: status === 'accepted' ? 'default' : 'destructive',
          onPress: async () => {
            setRespondingId(offer.id);
            try {
              await respondToOffer(offer.id, status);
              Alert.alert(
                status === 'accepted' ? '🎉 Offer Accepted!' : 'Offer Rejected',
                status === 'accepted'
                  ? 'The buyer will be notified. Arrange transfer to complete the sale.'
                  : 'The buyer has been notified.'
              );
            } catch {
              Alert.alert('Error', 'Failed to update offer. Try again.');
            } finally {
              setRespondingId(null);
            }
          },
        },
      ]
    );
  }

  const pendingCount = incomingOffers.filter((o) => o.status === 'pending').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Offers</Text>
        <Text style={styles.subtitle}>Manage your buy & sell offers</Text>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'incoming' && styles.tabActive]}
          onPress={() => setTab('incoming')}
        >
          <Text style={[styles.tabText, tab === 'incoming' && styles.tabTextActive]}>
            Received {pendingCount > 0 ? `(${pendingCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sent' && styles.tabActive]}
          onPress={() => setTab('sent')}
        >
          <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>
            Sent ({myOffers.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      >
        {tab === 'incoming' && (
          incomingOffers.length === 0
            ? <EmptyState emoji="📥" text="No incoming offers yet" sub="When buyers offer on your listings they'll appear here" />
            : incomingOffers.map((offer) => (
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
                      <Text style={styles.priceLabel}>Your listing</Text>
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
            ))
        )}

        {tab === 'sent' && (
          myOffers.length === 0
            ? <EmptyState emoji="📤" text="No offers sent yet" sub="Browse the marketplace and make offers on vouchers you want" />
            : myOffers.map((offer) => (
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
                  Sent {new Date(offer.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({ emoji, text, sub }: { emoji: string; text: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 60,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: fontSizes.sm, color: colors.accent, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.accent },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },
  offerCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  offerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
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
  offerDetails: { marginBottom: spacing.md },
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
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
});
