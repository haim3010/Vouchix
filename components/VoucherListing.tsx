import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ListingWithSeller } from '@/lib/stores/marketplaceStore';
import { getBrandInfo } from '@/lib/constants/brands';
import { formatCurrency, discountPercent } from '@/lib/utils/currency';
import { expiryLabel, expiryUrgency } from '@/lib/utils/expiration';
import { colors, radius, spacing, fontSizes } from '@/lib/constants/theme';
import { CLASSIFICATION_LABELS } from '@/types';
import BrandLogo from '@/components/BrandLogo';

interface Props {
  listing: ListingWithSeller;
  onPress: () => void;
  onOffer: () => void;
  isOwn?: boolean;
}

export default function VoucherListing({ listing, onPress, onOffer, isOwn = false }: Props) {
  const brand = getBrandInfo(listing.brand);
  const isTrade = listing.listing_price === null;
  const discount = !isTrade && listing.listing_price
    ? discountPercent(listing.original_value, listing.listing_price)
    : 0;
  const savings = listing.original_value - (listing.listing_price ?? listing.original_value);
  const urgency = expiryUrgency(listing.expires_at);

  const daysLeft = listing.expires_at
    ? Math.ceil((new Date(listing.expires_at).getTime() - Date.now()) / 86400000)
    : null;

  const isDigital = listing.voucher_type === 'digital';
  const classLabel = listing.classification ? CLASSIFICATION_LABELS[listing.classification] : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Top row: brand badge + badges */}
      <View style={styles.topRow}>
        <View style={[styles.brandBadge, { backgroundColor: brand.color + '15' }]}>
          <BrandLogo domain={brand.domain} name={listing.brand} color={brand.color} size={24} />
          <Text style={[styles.brandName, { color: brand.color }]}>{listing.brand}</Text>
        </View>
        <View style={styles.badgeRow}>
          {/* Sale / Trade badge */}
          <View style={[styles.badge, isTrade ? styles.tradeBadge : styles.saleBadge]}>
            <Text style={[styles.badgeText, isTrade ? styles.tradeBadgeText : styles.saleBadgeText]}>
              {isTrade ? '🔄 Trade' : '💰 Sale'}
            </Text>
          </View>
          {/* Discount badge */}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% OFF</Text>
            </View>
          )}
        </View>
      </View>

      {/* Meta badges row: type + transfer */}
      <View style={styles.metaRow}>
        {classLabel && (
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{classLabel}</Text>
          </View>
        )}
        <View style={[styles.metaBadge, isDigital ? styles.metaBadgeBlue : styles.metaBadgeAmber]}>
          <Text style={[styles.metaBadgeText, isDigital ? styles.metaBadgeBlueText : styles.metaBadgeAmberText]}>
            {isDigital ? '⚡ Digital transfer' : '🤝 Coordination required'}
          </Text>
        </View>
      </View>

      {/* Price row */}
      <View style={styles.priceRow}>
        <View>
          {isTrade ? (
            <>
              <Text style={styles.tradeLabel}>Trade</Text>
              <Text style={styles.originalPrice}>{formatCurrency(listing.original_value)} face value</Text>
            </>
          ) : (
            <>
              <Text style={styles.listingPrice}>
                {formatCurrency(listing.listing_price ?? listing.original_value)}
              </Text>
              <Text style={styles.originalPrice}>
                {formatCurrency(listing.original_value)}
              </Text>
            </>
          )}
        </View>
        {!isTrade && savings > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save {formatCurrency(savings)}</Text>
          </View>
        )}
      </View>

      {/* Seller + expiry row */}
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
        {daysLeft !== null && (
          <Text style={[
            styles.expiry,
            daysLeft < 30 ? { color: colors.error } :
            daysLeft < 90 ? { color: colors.warning } :
            { color: colors.textMuted },
          ]}>
            {daysLeft < 0 ? 'Expired' : `${daysLeft}d left`}
          </Text>
        )}
      </View>

      {/* CTA */}
      {isOwn ? (
        <View style={styles.ownBadge}>
          <Text style={styles.ownBadgeText}>🏷️ Your Listing</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.offerButton, { backgroundColor: brand.color }]}
          onPress={(e) => { e.stopPropagation(); onOffer(); }}
        >
          <Text style={styles.offerButtonText}>{isTrade ? 'Propose Trade' : 'Make Offer'}</Text>
        </TouchableOpacity>
      )}
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
    gap: spacing.sm,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    gap: 4,
  },
  brandEmoji: { fontSize: 16 }, // kept for reference, replaced by BrandLogo
  brandName: { fontSize: fontSizes.sm, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },

  // Sale / Trade badge
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  saleBadge: { backgroundColor: colors.success + '20' },
  tradeBadge: { backgroundColor: '#FFF3CD' },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '700' },
  saleBadgeText: { color: colors.success },
  tradeBadgeText: { color: '#B8860B' },

  // Discount badge
  discountBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  discountText: { color: colors.white, fontSize: fontSizes.xs, fontWeight: '800', letterSpacing: 0.5 },

  // Meta badges
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaBadgeBlue: { backgroundColor: colors.secondary + '15', borderColor: colors.secondary },
  metaBadgeAmber: { backgroundColor: '#FFF3CD', borderColor: '#F5A623' },
  metaBadgeText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  metaBadgeBlueText: { color: colors.secondary },
  metaBadgeAmberText: { color: '#B8860B' },

  // Price row
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listingPrice: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.secondary },
  tradeLabel: { fontSize: fontSizes.xxl, fontWeight: '800', color: '#B8860B' },
  originalPrice: { fontSize: fontSizes.sm, color: colors.textMuted, textDecorationLine: 'line-through' },
  savingsBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  savingsText: { color: colors.success, fontSize: fontSizes.sm, fontWeight: '700' },

  // Seller row
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sellerInitial: { color: colors.white, fontSize: fontSizes.sm, fontWeight: '700' },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text },
  sellerRating: { fontSize: fontSizes.xs, color: colors.textMuted },
  expiry: { fontSize: fontSizes.xs, fontWeight: '700' },

  // CTA
  offerButton: {
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  offerButtonText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },
  ownBadge: {
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.secondary + '20',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  ownBadgeText: { color: colors.secondary, fontWeight: '700', fontSize: fontSizes.sm },
});
