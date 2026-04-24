import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ListingWithSeller } from '@/lib/stores/marketplaceStore';
import { getBrandInfo } from '@/lib/constants/brands';
import { formatCurrency, discountPercent } from '@/lib/utils/currency';
import { expiryLabel, expiryUrgency } from '@/lib/utils/expiration';
import { colors, radius, spacing, fontSizes } from '@/lib/constants/theme';

interface Props {
  listing: ListingWithSeller;
  onPress: () => void;
  onOffer: () => void;
}

export default function VoucherListing({ listing, onPress, onOffer }: Props) {
  const brand = getBrandInfo(listing.brand);
  const discount = listing.listing_price
    ? discountPercent(listing.original_value, listing.listing_price)
    : 0;
  const savings = listing.original_value - (listing.listing_price ?? listing.original_value);
  const urgency = expiryUrgency(listing.expires_at);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.topRow}>
        <View style={[styles.brandBadge, { backgroundColor: brand.color + '18' }]}>
          <Text style={styles.brandEmoji}>{brand.emoji}</Text>
          <Text style={[styles.brandName, { color: brand.color }]}>{listing.brand}</Text>
        </View>
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}% OFF</Text>
          </View>
        )}
      </View>

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.listingPrice}>
            {formatCurrency(listing.listing_price ?? listing.original_value)}
          </Text>
          <Text style={styles.originalPrice}>
            {formatCurrency(listing.original_value)}
          </Text>
        </View>
        {savings > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save {formatCurrency(savings)}</Text>
          </View>
        )}
      </View>

      <View style={styles.sellerRow}>
        <View style={styles.sellerAvatar}>
          <Text style={styles.sellerInitial}>
            {listing.seller?.display_name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.sellerInfo}>
          <Text style={styles.sellerName}>{listing.seller?.display_name ?? 'Seller'}</Text>
          <Text style={styles.sellerRating}>
            ⭐ {(listing.seller?.rating ?? 5).toFixed(1)} · {listing.seller?.total_trades ?? 0} trades
          </Text>
        </View>
        {listing.expires_at && (
          <Text style={[
            styles.expiry,
            { color: urgency === 'critical' ? colors.error : urgency === 'warning' ? colors.warning : colors.textMuted }
          ]}>
            {expiryLabel(listing.expires_at)}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.offerButton, { backgroundColor: brand.color }]}
        onPress={(e) => { e.stopPropagation(); onOffer(); }}
      >
        <Text style={styles.offerButtonText}>Make Offer</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    gap: 4,
  },
  brandEmoji: { fontSize: 16 },
  brandName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  discountBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  discountText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  listingPrice: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.text,
  },
  originalPrice: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  savingsBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  savingsText: {
    color: colors.success,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sellerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitial: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  sellerInfo: { flex: 1 },
  sellerName: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  sellerRating: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  expiry: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  offerButton: {
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  offerButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
});
