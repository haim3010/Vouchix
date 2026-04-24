import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import { POPULAR_BRANDS, BrandInfo } from '@/lib/constants/brands';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';

export default function AddVoucherScreen() {
  const { user } = useAuthStore();
  const { addVoucher } = useWalletStore();

  const [brand, setBrand] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [remainingValue, setRemainingValue] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [brandPickerVisible, setBrandPickerVisible] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  const filteredBrands = POPULAR_BRANDS.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  function selectBrand(b: BrandInfo) {
    setBrand(b.name);
    setBrandPickerVisible(false);
    setBrandSearch('');
  }

  async function handleSave() {
    if (!brand || !originalValue) {
      Alert.alert('Error', 'Brand and original value are required');
      return;
    }
    if (!user?.id) return;

    const orig = parseFloat(originalValue);
    const rem = remainingValue ? parseFloat(remainingValue) : orig;

    if (isNaN(orig) || orig <= 0) {
      Alert.alert('Error', 'Invalid value amount');
      return;
    }

    setLoading(true);
    try {
      await addVoucher({
        owner_id: user.id,
        brand,
        brand_logo_url: null,
        original_value: orig,
        remaining_value: rem,
        currency: 'ILS',
        barcode_data: null,
        barcode_format: null,
        voucher_code: voucherCode || null,
        image_url: null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        notes: notes || null,
        is_listed: false,
        listing_price: null,
        status: 'active',
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save voucher');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Add Voucher</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Brand *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setBrandPickerVisible(true)}
        >
          <Text style={brand ? styles.pickerValue : styles.pickerPlaceholder}>
            {brand || 'Select a brand...'}
          </Text>
          <Text>▾</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Original Value (₪) *</Text>
        <TextInput
          style={styles.input}
          placeholder="500.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={originalValue}
          onChangeText={(v) => {
            setOriginalValue(v);
            if (!remainingValue) setRemainingValue(v);
          }}
        />

        <Text style={styles.label}>Remaining Balance (₪)</Text>
        <TextInput
          style={styles.input}
          placeholder="Same as original if unused"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={remainingValue}
          onChangeText={setRemainingValue}
        />

        <Text style={styles.label}>Voucher Code</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. NIKE-ABC123"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          value={voucherCode}
          onChangeText={setVoucherCode}
        />

        <Text style={styles.label}>Expiration Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          value={expiresAt}
          onChangeText={setExpiresAt}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any additional info..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />
      </ScrollView>

      <Modal visible={brandPickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Brand</Text>
            <TouchableOpacity onPress={() => setBrandPickerVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search brands..."
            placeholderTextColor={colors.textMuted}
            value={brandSearch}
            onChangeText={setBrandSearch}
          />
          <FlatList
            data={filteredBrands}
            keyExtractor={(b) => b.name}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.brandItem} onPress={() => selectBrand(item)}>
                <View style={[styles.brandDot, { backgroundColor: item.color }]} />
                <Text style={styles.brandItemEmoji}>{item.emoji}</Text>
                <Text style={styles.brandItemName}>{item.name}</Text>
                {brand === item.name && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
          />
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
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backText: {
    fontSize: fontSizes.lg,
    color: colors.textMuted,
  },
  navTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  saveText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.accent,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.cardBg,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cardBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerValue: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  pickerPlaceholder: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    fontSize: fontSizes.md,
    color: colors.accent,
    fontWeight: '600',
  },
  searchInput: {
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.cardBg,
  },
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    backgroundColor: colors.cardBg,
    gap: spacing.sm,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brandItemEmoji: {
    fontSize: 20,
  },
  brandItemName: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  checkmark: {
    color: colors.accent,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
});
