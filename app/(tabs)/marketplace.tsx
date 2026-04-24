import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useMarketplaceStore, ListingWithSeller } from '@/lib/stores/marketplaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import VoucherListing from '@/components/VoucherListing';
import { POPULAR_BRANDS } from '@/lib/constants/brands';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';

const SORT_OPTIONS = [
  { key: 'discount', label: 'Best Discount' },
  { key: 'price_asc', label: 'Price: Low–High' },
  { key: 'price_desc', label: 'Price: High–Low' },
  { key: 'newest', label: 'Newest' },
] as const;

export default function MarketplaceScreen() {
  const { user } = useAuthStore();
  const {
    listings, loading, brandFilter, sortBy,
    fetchListings, makeOffer, setBrandFilter, setSortBy,
  } = useMarketplaceStore();

  const [offerTarget, setOfferTarget] = useState<ListingWithSeller | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [offerLoading, setOfferLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => { fetchListings(); }, [brandFilter, sortBy]);

  const filtered = searchText
    ? listings.filter((l) => l.brand.toLowerCase().includes(searchText.toLowerCase()))
    : listings;

  async function submitOffer() {
    if (!user?.id || !offerTarget) return;
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Enter a valid offer amount');
      return;
    }
    if (amount >= offerTarget.original_value) {
      Alert.alert('Tip', 'Your offer is higher than the listing price — just buy at listing price!');
    }
    setOfferLoading(true);
    try {
      await makeOffer(offerTarget.id, user.id, amount, offerMessage);
      Alert.alert('Offer Sent! 🎉', `Your offer of ${formatCurrency(amount)} has been sent to the seller.`);
      setOfferTarget(null);
      setOfferAmount('');
      setOfferMessage('');
    } catch {
      Alert.alert('Error', 'Failed to send offer. Try again.');
    } finally {
      setOfferLoading(false);
    }
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.subtitle}>{listings.length} vouchers available</Text>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search brands..."
              placeholderTextColor={colors.gray400}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, !brandFilter && styles.filterChipActive]}
            onPress={() => setBrandFilter(null)}
          >
            <Text style={[styles.filterChipText, !brandFilter && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {POPULAR_BRANDS.filter((b) => b.name !== 'Other').slice(0, 15).map((b) => (
            <TouchableOpacity
              key={b.name}
              style={[styles.filterChip, brandFilter === b.name && styles.filterChipActive]}
              onPress={() => setBrandFilter(brandFilter === b.name ? null : b.name)}
            >
              <Text style={styles.filterEmoji}>{b.emoji}</Text>
              <Text style={[styles.filterChipText, brandFilter === b.name && styles.filterChipTextActive]}>
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sortRow}
          contentContainerStyle={styles.filterContent}
        >
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
              onPress={() => setSortBy(opt.key)}
            >
              <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🏪</Text>
        <Text style={styles.emptyTitle}>No listings yet</Text>
        <Text style={styles.emptySubtitle}>
          {brandFilter ? `No ${brandFilter} vouchers listed right now` : 'Check back soon for great deals'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList<ListingWithSeller>
        data={filtered}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <VoucherListing
            listing={item}
            onPress={() => setOfferTarget(item)}
            onOffer={() => { setOfferTarget(item); setOfferAmount(String(item.listing_price ?? '')); }}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading ? null : renderEmpty}
        contentContainerStyle={filtered.length === 0 ? styles.listEmpty : styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchListings} tintColor={colors.accent} />
        }
      />

      {loading && listings.length === 0 && (
        <ActivityIndicator
          color={colors.accent}
          size="large"
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Offer Modal */}
      <Modal visible={!!offerTarget} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setOfferTarget(null)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Make an Offer</Text>
            <View style={{ width: 56 }} />
          </View>

          {offerTarget && (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.offerSummary}>
                <Text style={styles.offerBrand}>{offerTarget.brand}</Text>
                <Text style={styles.offerOriginal}>
                  Worth {formatCurrency(offerTarget.original_value)}
                </Text>
                <Text style={styles.offerListing}>
                  Listed at {formatCurrency(offerTarget.listing_price ?? offerTarget.original_value)}
                </Text>
              </View>

              <Text style={styles.inputLabel}>Your Offer (₪)</Text>
              <TextInput
                style={styles.offerInput}
                placeholder={`e.g. ${Math.round((offerTarget.listing_price ?? offerTarget.original_value) * 0.9)}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={offerAmount}
                onChangeText={setOfferAmount}
                autoFocus
              />

              {offerAmount && !isNaN(parseFloat(offerAmount)) && (
                <Text style={styles.savingsHint}>
                  You save {formatCurrency(offerTarget.original_value - parseFloat(offerAmount))} vs face value
                </Text>
              )}

              <Text style={styles.inputLabel}>Message to seller (optional)</Text>
              <TextInput
                style={[styles.offerInput, styles.messageInput]}
                placeholder="Hi, I'm interested in this voucher..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={offerMessage}
                onChangeText={setOfferMessage}
              />

              <TouchableOpacity
                style={[styles.submitButton, offerLoading && { opacity: 0.7 }]}
                onPress={submitOffer}
                disabled={offerLoading}
              >
                {offerLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.submitText}>Send Offer</Text>
                }
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                The seller will accept or counter your offer. Payment only happens after both sides agree.
              </Text>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
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
  subtitle: { fontSize: fontSizes.sm, color: colors.accent, marginTop: 2, marginBottom: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: fontSizes.md,
    paddingVertical: spacing.sm,
  },
  filterRow: { backgroundColor: colors.primary, paddingBottom: spacing.sm },
  sortRow: { backgroundColor: colors.bgLight, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    gap: 4,
  },
  filterChipActive: { backgroundColor: colors.accent },
  filterEmoji: { fontSize: 13 },
  filterChipText: { color: colors.gray400, fontSize: fontSizes.xs, fontWeight: '600' },
  filterChipTextActive: { color: colors.white },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  sortChipActive: { backgroundColor: colors.primary },
  sortChipText: { color: colors.textMuted, fontSize: fontSizes.xs, fontWeight: '600' },
  sortChipTextActive: { color: colors.white },
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  listEmpty: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  modalContainer: { flex: 1, backgroundColor: colors.bgLight },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: spacing.sm },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalClose: { color: colors.textMuted, fontSize: fontSizes.md },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
  modalBody: { padding: spacing.md, paddingBottom: 48 },
  offerSummary: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  offerBrand: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.text },
  offerOriginal: { fontSize: fontSizes.md, color: colors.textMuted, marginTop: 4 },
  offerListing: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.accent, marginTop: 4 },
  inputLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  offerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.xl,
    color: colors.text,
    backgroundColor: colors.cardBg,
    fontWeight: '700',
  },
  messageInput: { fontSize: fontSizes.md, fontWeight: '400', height: 80, textAlignVertical: 'top' },
  savingsHint: { color: colors.success, fontSize: fontSizes.sm, fontWeight: '600', marginTop: spacing.xs },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitText: { color: colors.white, fontSize: fontSizes.md, fontWeight: '700' },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
});
