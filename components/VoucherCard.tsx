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
    colors.accent;

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
        style={styles.card}
        onPress={() => router.push(`/voucher/${voucher.id}`)}
        activeOpacity={0.88}
      >
        {/* Navy header strip with brand + delete */}
        <View style={styles.header}>
          <View style={[styles.brandBadge, { backgroundColor: brand.color + '25' }]}>
            <BrandLogo domain={brand.domain} name={voucher.brand} color={brand.color} size={20} />
            <Text style={[styles.brandName, { color: brand.color }]}>{voucher.brand}</Text>
          </View>

          <View style={styles.headerRight}>
            {voucher.is_listed && (
              <View style={styles.listedBadge}>
                <Text style={styles.listedText}>{t('listedBadge')}</Text>
              </View>
            )}
            {categoryLabel && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{categoryLabel}</Text>
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

        {/* Value section */}
        <View style={styles.valueSection}>
          <View>
            <Text style={styles.valueLabel}>{t('remaining')}</Text>
            <Text style={styles.valueAmount}>{formatCurrency(voucher.remaining_value, voucher.currency)}</Text>
          </View>
          {voucher.original_value !== voucher.remaining_value && (
            <View style={styles.originalBlock}>
              <Text style={styles.originalLabel}>{t('original')}</Text>
              <Text style={styles.originalAmount}>{formatCurrency(voucher.original_value, voucher.currency)}</Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        {usedPercent > 0 && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${usedPercent}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{usedPercent}{t('percentUsed')}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.codeText} numberOfLines={1}>
            {voucher.voucher_code ? `${t('codePrefix')} ${voucher.voucher_code}` : t('tapToView')}
          </Text>
          <View style={[styles.expiryBadge, { backgroundColor: urgencyColor + '18' }]}>
            <Text style={[styles.expiryText, { color: urgencyColor }]}>{expiryText}</Text>
          </View>
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
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 6,
  },
  brandName: { fontSize: fontSizes.sm, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  listedBadge: {
    backgroundColor: colors.accent + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  listedText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '700' },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  categoryText: { fontSize: fontSizes.xs, color: colors.gray400, fontWeight: '500' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },

  valueSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  valueLabel: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: '500', marginBottom: 2 },
  valueAmount: { fontSize: fontSizes.xxxl, fontWeight: '900', color: colors.gold, letterSpacing: -0.5 },
  originalBlock: { alignItems: 'flex-end' },
  originalLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: 2 },
  originalAmount: { fontSize: fontSizes.md, fontWeight: '600', color: colors.textMuted, textDecorationLine: 'line-through' },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  progressLabel: { fontSize: fontSizes.xs, color: colors.textMuted, width: 48, textAlign: 'right' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  codeText: { fontSize: fontSizes.xs, color: colors.textMuted, flex: 1 },
  expiryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  expiryText: { fontSize: fontSizes.xs, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  confirmBox: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 320 },
  confirmTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  confirmSub: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  confirmBtns: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { color: colors.textMuted, fontWeight: '600' },
  confirmDeleteBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.error, alignItems: 'center' },
  confirmDeleteText: { color: colors.white, fontWeight: '700' },
});
