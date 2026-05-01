import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Image,
  TextInput,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useWalletStore } from '@/lib/stores/walletStore';
import { getBrandInfo } from '@/lib/constants/brands';
import { formatCurrency } from '@/lib/utils/currency';
import { expiryLabel, expiryUrgency } from '@/lib/utils/expiration';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { CLASSIFICATION_LABELS, CATEGORY_LABELS } from '@/types';

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vouchers, deleteVoucher, updateVoucher } = useWalletStore();

  const [usedModalVisible, setUsedModalVisible] = useState(false);
  const [usedType, setUsedType] = useState<'full' | 'partial' | null>(null);
  const [usedAmount, setUsedAmount] = useState('');
  const [saving, setSaving] = useState(false);

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
            try {
              await deleteVoucher(voucher.id);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete voucher');
            }
          },
        },
      ]
    );
  }

  function handleEdit() {
    router.push(`/voucher/add?editId=${voucher.id}`);
  }

  function openUsedModal() {
    setUsedType(null);
    setUsedAmount('');
    setUsedModalVisible(true);
  }

  async function confirmMarkUsed() {
    if (!usedType) return;
    setSaving(true);
    try {
      if (usedType === 'full') {
        await updateVoucher(voucher.id, { remaining_value: 0, status: 'used' });
        setUsedModalVisible(false);
        router.back();
      } else {
        const amountUsed = parseFloat(usedAmount);
        if (isNaN(amountUsed) || amountUsed <= 0) {
          Alert.alert('Invalid', 'Please enter a valid amount');
          return;
        }
        if (amountUsed > voucher.remaining_value) {
          Alert.alert('Invalid', 'Amount used cannot exceed remaining balance');
          return;
        }
        const newRemaining = Math.round((voucher.remaining_value - amountUsed) * 100) / 100;
        if (newRemaining <= 0) {
          // Partial use fully depleted the voucher — mark as used and move to history
          await updateVoucher(voucher.id, { remaining_value: 0, status: 'used' });
          setUsedModalVisible(false);
          router.back();
        } else {
          await updateVoucher(voucher.id, { remaining_value: newRemaining });
          setUsedModalVisible(false);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to update voucher');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { backgroundColor: brand.color }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
        <Text style={styles.heroEmoji}>{brand.emoji}</Text>
        <Text style={styles.heroTitle}>{voucher.brand}</Text>
        <Text style={styles.heroValue}>{formatCurrency(voucher.remaining_value, voucher.currency)}</Text>
        <Text style={styles.heroSubtitle}>remaining balance</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Classification & Category badges */}
        {(voucher.classification || voucher.category) && (
          <View style={styles.badgeRow}>
            {voucher.classification && (
              <View style={styles.classificationBadge}>
                <Text style={styles.classificationText}>
                  {CLASSIFICATION_LABELS[voucher.classification]}
                </Text>
              </View>
            )}
            {voucher.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {CATEGORY_LABELS[voucher.category]}
                </Text>
              </View>
            )}
          </View>
        )}

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
          {voucher.pin_code && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>PIN</Text>
                <Text style={[styles.rowValue, styles.code]}>{voucher.pin_code}</Text>
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

        {/* Voucher image */}
        {voucher.image_url && (
          <View style={styles.imageCard}>
            <Text style={styles.imageLabel}>Voucher Image</Text>
            <Image
              source={{ uri: voucher.image_url }}
              style={styles.voucherImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Mark as used */}
        {voucher.status === 'active' && (
          <TouchableOpacity
            style={[styles.markUsedButton, { backgroundColor: brand.color }]}
            onPress={openUsedModal}
          >
            <Text style={styles.markUsedText}>✓ Mark as Used</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Voucher</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Mark as Used Modal */}
      <Modal visible={usedModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.usedModal}>
          <View style={styles.usedModalHeader}>
            <Text style={styles.usedModalTitle}>Mark as Used</Text>
            <TouchableOpacity onPress={() => setUsedModalVisible(false)}>
              <Text style={styles.usedModalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.usedModalBody}>
            <Text style={styles.usedModalSub}>
              Current balance: {formatCurrency(voucher.remaining_value, voucher.currency)}
            </Text>

            <TouchableOpacity
              style={[styles.usedOption, usedType === 'full' && styles.usedOptionSelected]}
              onPress={() => setUsedType('full')}
            >
              <View style={styles.usedOptionHeader}>
                <Text style={styles.usedOptionTitle}>Used in full</Text>
                {usedType === 'full' && <Text style={styles.usedOptionCheck}>✓</Text>}
              </View>
              <Text style={styles.usedOptionSub}>
                The voucher has been fully redeemed ({formatCurrency(voucher.remaining_value, voucher.currency)})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.usedOption, usedType === 'partial' && styles.usedOptionSelected]}
              onPress={() => setUsedType('partial')}
            >
              <View style={styles.usedOptionHeader}>
                <Text style={styles.usedOptionTitle}>Used partially</Text>
                {usedType === 'partial' && <Text style={styles.usedOptionCheck}>✓</Text>}
              </View>
              <Text style={styles.usedOptionSub}>Enter how much was spent</Text>
            </TouchableOpacity>

            {usedType === 'partial' && (
              <View style={styles.amountInputRow}>
                <Text style={styles.amountCurrency}>₪</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Amount used"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={usedAmount}
                  onChangeText={setUsedAmount}
                  autoFocus
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmUsedBtn, !usedType && styles.confirmUsedBtnDisabled]}
              onPress={confirmMarkUsed}
              disabled={!usedType || saving}
            >
              <Text style={styles.confirmUsedText}>
                {saving ? 'Saving...' : 'Confirm'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: fontSizes.lg, color: colors.textMuted },
  backLink: { color: colors.accent, marginTop: spacing.md, fontSize: fontSizes.md },
  hero: {
    paddingTop: 56,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  backButton: { position: 'absolute', top: 56, left: spacing.md, padding: spacing.sm },
  backIcon: { fontSize: fontSizes.xl, color: 'rgba(255,255,255,0.8)' },
  editButton: { position: 'absolute', top: 56, right: spacing.md, padding: spacing.sm },
  editIcon: { fontSize: 22 },
  heroEmoji: { fontSize: 48, marginBottom: spacing.xs },
  heroTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.white },
  heroValue: { fontSize: fontSizes.xxxl, fontWeight: '800', color: colors.white, marginTop: spacing.sm },
  heroSubtitle: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 48 },

  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  classificationBadge: {
    backgroundColor: colors.secondary + '20',
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  classificationText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.secondary },
  categoryBadge: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  categoryText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.textMuted },

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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  rowColumn: { paddingVertical: spacing.sm },
  rowLabel: { fontSize: fontSizes.sm, color: colors.textMuted },
  rowValue: { fontSize: fontSizes.md, color: colors.text },
  code: { fontFamily: 'monospace', letterSpacing: 1 },
  notes: { fontSize: fontSizes.sm, color: colors.text, marginTop: spacing.xs, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.border },

  imageCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  imageLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
  voucherImage: { width: '100%', height: 200, borderRadius: radius.md },

  markUsedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  markUsedText: { color: colors.white, fontSize: fontSizes.md, fontWeight: '700' },

  deleteButton: { alignItems: 'center', padding: spacing.md },
  deleteText: { color: colors.error, fontSize: fontSizes.sm, fontWeight: '500' },

  usedModal: { flex: 1, backgroundColor: colors.bgLight },
  usedModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  usedModalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
  usedModalClose: { fontSize: fontSizes.md, color: colors.accent, fontWeight: '600' },
  usedModalBody: { padding: spacing.md },
  usedModalSub: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.md },

  usedOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.cardBg,
  },
  usedOptionSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
  usedOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usedOptionTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  usedOptionCheck: { color: colors.accent, fontSize: fontSizes.lg, fontWeight: '700' },
  usedOptionSub: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },

  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBg,
    marginBottom: spacing.md,
    height: 52,
  },
  amountCurrency: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textMuted, marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: fontSizes.lg, color: colors.text },

  confirmUsedBtn: {
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmUsedBtnDisabled: { opacity: 0.4 },
  confirmUsedText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.md },
});
