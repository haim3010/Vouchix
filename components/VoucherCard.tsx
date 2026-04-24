import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Voucher } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import { expiryLabel, expiryUrgency } from '@/lib/utils/expiration';
import { getBrandInfo } from '@/lib/constants/brands';
import { colors, radius, spacing, fontSizes } from '@/lib/constants/theme';

interface Props {
  voucher: Voucher;
}

export default function VoucherCard({ voucher }: Props) {
  const brand = getBrandInfo(voucher.brand);
  const urgency = expiryUrgency(voucher.expires_at);
  const expiryText = expiryLabel(voucher.expires_at);
  const usedPercent = Math.round(
    ((voucher.original_value - voucher.remaining_value) / voucher.original_value) * 100
  );

  const urgencyColor =
    urgency === 'critical' ? colors.error :
    urgency === 'warning' ? colors.warning :
    colors.success;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: brand.color }]}
      onPress={() => router.push(`/voucher/${voucher.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.brandBadge, { backgroundColor: brand.color + '20' }]}>
          <Text style={styles.brandEmoji}>{brand.emoji}</Text>
          <Text style={[styles.brandName, { color: brand.color }]}>{voucher.brand}</Text>
        </View>
        {voucher.is_listed && (
          <View style={styles.listedBadge}>
            <Text style={styles.listedText}>Listed</Text>
          </View>
        )}
      </View>

      <View style={styles.values}>
        <View>
          <Text style={styles.valueLabel}>Remaining</Text>
          <Text style={styles.valueAmount}>{formatCurrency(voucher.remaining_value, voucher.currency)}</Text>
        </View>
        <View style={styles.valueDivider} />
        <View style={styles.originalValue}>
          <Text style={styles.valueLabel}>Original</Text>
          <Text style={styles.originalAmount}>{formatCurrency(voucher.original_value, voucher.currency)}</Text>
        </View>
      </View>

      {usedPercent > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${usedPercent}%`, backgroundColor: brand.color }]} />
          </View>
          <Text style={styles.progressLabel}>{usedPercent}% used</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        {voucher.voucher_code ? (
          <Text style={styles.code} numberOfLines={1}>
            Code: {voucher.voucher_code}
          </Text>
        ) : (
          <Text style={styles.code}>Tap to show barcode</Text>
        )}
        <Text style={[styles.expiry, { color: urgencyColor }]}>{expiryText}</Text>
      </View>
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
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
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
  brandEmoji: {
    fontSize: 16,
  },
  brandName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  listedBadge: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  listedText: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  values: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  valueLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    fontWeight: '500',
  },
  valueAmount: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.text,
  },
  valueDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  originalValue: {},
  originalAmount: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    width: 52,
    textAlign: 'right',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  code: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    flex: 1,
  },
  expiry: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
});
