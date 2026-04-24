import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  StatusBar,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useWalletStore } from '@/lib/stores/walletStore';
import { getBrandInfo } from '@/lib/constants/brands';
import { formatCurrency } from '@/lib/utils/currency';
import { expiryLabel, expiryUrgency } from '@/lib/utils/expiration';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vouchers, deleteVoucher } = useWalletStore();
  const [barcodeVisible, setBarcodeVisible] = useState(false);

  const voucher = vouchers.find((v) => v.id === id);

  if (!voucher) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Voucher not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const brand = getBrandInfo(voucher.brand);
  const urgency = expiryUrgency(voucher.expires_at);
  const urgencyColor =
    urgency === 'critical' ? colors.error :
    urgency === 'warning' ? colors.warning :
    colors.success;

  const barcodeValue = voucher.barcode_data ?? voucher.voucher_code ?? voucher.id;

  async function handleDelete() {
    Alert.alert(
      'Delete Voucher',
      'Are you sure you want to remove this voucher from your wallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteVoucher(voucher.id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { backgroundColor: brand.color }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.heroEmoji}>{brand.emoji}</Text>
        <Text style={styles.heroTitle}>{voucher.brand}</Text>
        <Text style={styles.heroValue}>{formatCurrency(voucher.remaining_value, voucher.currency)}</Text>
        <Text style={styles.heroSubtitle}>remaining balance</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Original Value</Text>
            <Text style={styles.rowValue}>{formatCurrency(voucher.original_value, voucher.currency)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Remaining</Text>
            <Text style={[styles.rowValue, { color: brand.color, fontWeight: '700' }]}>
              {formatCurrency(voucher.remaining_value, voucher.currency)}
            </Text>
          </View>
          {voucher.expires_at && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Expires</Text>
                <Text style={[styles.rowValue, { color: urgencyColor }]}>
                  {new Date(voucher.expires_at).toLocaleDateString()} · {expiryLabel(voucher.expires_at)}
                </Text>
              </View>
            </>
          )}
          {voucher.voucher_code && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Code</Text>
                <Text style={[styles.rowValue, styles.code]}>{voucher.voucher_code}</Text>
              </View>
            </>
          )}
          {voucher.notes && (
            <>
              <View style={styles.divider} />
              <View style={styles.rowColumn}>
                <Text style={styles.rowLabel}>Notes</Text>
                <Text style={styles.notes}>{voucher.notes}</Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.barcodeButton, { backgroundColor: brand.color }]}
          onPress={() => setBarcodeVisible(true)}
        >
          <Text style={styles.barcodeButtonIcon}>📲</Text>
          <Text style={styles.barcodeButtonText}>Show Barcode / QR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Voucher</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={barcodeVisible} animationType="slide" presentationStyle="fullScreen">
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <View style={styles.barcodeModal}>
          <TouchableOpacity
            style={styles.closeBarcode}
            onPress={() => setBarcodeVisible(false)}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.barcodeTitle}>{voucher.brand}</Text>
          <Text style={styles.barcodeSubtitle}>{formatCurrency(voucher.remaining_value)}</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={barcodeValue}
              size={240}
              color={colors.primary}
              backgroundColor={colors.white}
            />
          </View>

          {voucher.voucher_code && (
            <Text style={styles.codeDisplay}>{voucher.voucher_code}</Text>
          )}

          <Text style={styles.barcodeHint}>Show this at the checkout counter</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontSize: fontSizes.lg,
    color: colors.textMuted,
  },
  backLink: {
    color: colors.accent,
    marginTop: spacing.md,
    fontSize: fontSizes.md,
  },
  hero: {
    paddingTop: 56,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: spacing.md,
    padding: spacing.sm,
  },
  backIcon: {
    fontSize: fontSizes.xl,
    color: 'rgba(255,255,255,0.8)',
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.white,
  },
  heroValue: {
    fontSize: fontSizes.xxxl,
    fontWeight: '800',
    color: colors.white,
    marginTop: spacing.sm,
  },
  heroSubtitle: {
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowColumn: {
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  code: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  notes: {
    fontSize: fontSizes.sm,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  barcodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  barcodeButtonIcon: {
    fontSize: 20,
  },
  barcodeButtonText: {
    color: colors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  deleteText: {
    color: colors.error,
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
  barcodeModal: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  closeBarcode: {
    position: 'absolute',
    top: 56,
    right: spacing.md,
    padding: spacing.sm,
  },
  closeIcon: {
    fontSize: fontSizes.xl,
    color: 'rgba(255,255,255,0.6)',
  },
  barcodeTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  barcodeSubtitle: {
    fontSize: fontSizes.xl,
    color: colors.accent,
    fontWeight: '700',
    marginBottom: spacing.xl,
  },
  qrContainer: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: spacing.lg,
  },
  codeDisplay: {
    color: colors.gray200,
    fontSize: fontSizes.lg,
    fontFamily: 'monospace',
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  barcodeHint: {
    color: colors.gray400,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
});
