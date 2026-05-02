import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Voucher } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import { daysUntilExpiry, expiryUrgency } from '@/lib/utils/expiration';
import { getBrandInfo } from '@/lib/constants/brands';
import { colors, radius, spacing, fontSizes } from '@/lib/constants/theme';
import BrandLogo from '@/components/BrandLogo';
import { useT } from '@/lib/i18n';

interface Props {
  voucher: Voucher;
  onDelete?: () => void;
}

export default function VoucherCard({ voucher, onDelete }: Props) {
  const t = useT();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const brand = getBrandInfo(voucher.brand);
  const urgency = expiryUrgency(voucher.expires_at);
  const usedPercent = Math.round(
    ((voucher.original_value - voucher.remaining_value) / voucher.original_value) * 100
  );

  const urgencyColor =
    urgency === 'critical' ? colors.error :
    urgency === 'warning' ? colors.warning :
    colors.success;

  const days = daysUntilExpiry(voucher.expires_at);
  const expiryText =
    days === null ? t('noExpiry') :
    days < 0 ? t('expired') :
    days === 0 ? t('expiresToday') :
    days === 1 ? t('expiresTomorrow') :
    `${days} ${t('daysLeft')}`;

  const categoryLabels: Record<string, string> = {
    shopping: t('catShopping'), food_and_beverage: t('catFood'),
    restaurants: t('catRestaurants'), culture_and_leisure: t('catCulture'),
    sports: t('catSports'), other: t('catOther'),
  };
  const categoryLabel = voucher.category ? categoryLabels[voucher.category] : null;

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: brand.color }]}
        onPress={() => router.push(`/voucher/${voucher.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.brandRow}>
            <View style={[styles.brandBadge, { backgroundColor: brand.color + '15' }]}>
              <BrandLogo domain={brand.domain} name={voucher.brand} color={brand.color} size={22} />
              <Text style={[styles.brandName, { color: brand.color }]}>{voucher.brand}</Text>
            </View>
            {categoryLabel && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{categoryLabel}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardHeaderRight}>
            {voucher.is_listed && (
              <View style={styles.listedBadge}>
                <Text style={styles.listedText}>{t('listedBadge')}</Text>
              </View>
            )}
            {onDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setConfirmVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      <View style={styles.values}>
        <View>
          <Text style={styles.valueLabel}>{t('remaining')}</Text>
          <Text style={styles.valueAmount}>{formatCurrency(voucher.remaining_value, voucher.currency)}</Text>
        </View>
        <View style={styles.valueDivider} />
        <View style={styles.originalValue}>
          <Text style={styles.valueLabel}>{t('original')}</Text>
          <Text style={styles.originalAmount}>{formatCurrency(voucher.original_value, voucher.currency)}</Text>
        </View>
      </View>

      {usedPercent > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${usedPercent}%`, backgroundColor: brand.color }]} />
          </View>
          <Text style={styles.progressLabel}>{usedPercent}{t('percentUsed')}</Text>
        </View>
      )}

        <View style={styles.cardFooter}>
          {voucher.voucher_code ? (
            <Text style={styles.code} numberOfLines={1}>{t('codePrefix')} {voucher.voucher_code}</Text>
          ) : (
            <Text style={styles.code}>{t('tapToView')}</Text>
          )}
          <Text style={[styles.expiry, { color: urgencyColor }]}>{expiryText}</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{t('deleteVoucherTitle')}</Text>
            <Text style={styles.confirmSub}>{voucher.brand} — {t('deleteVoucherMsg')}</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => { setConfirmVisible(false); onDelete?.(); }}
              >
                <Text style={styles.confirmDeleteText}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
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
  categoryBadge: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  categoryText: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: '500' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  listedBadge: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  listedText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  confirmBox: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 320 },
  confirmTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  confirmSub: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  confirmBtns: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { color: colors.textMuted, fontWeight: '600' },
  confirmDeleteBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.error, alignItems: 'center' },
  confirmDeleteText: { color: colors.white, fontWeight: '700' },
  values: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  valueLabel: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: '500' },
  valueAmount: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.text },
  valueDivider: { width: 1, height: 36, backgroundColor: colors.border, marginHorizontal: spacing.md },
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
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: fontSizes.xs, color: colors.textMuted, width: 52, textAlign: 'right' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: fontSizes.xs, color: colors.textMuted, flex: 1 },
  expiry: { fontSize: fontSizes.xs, fontWeight: '600' },
});
