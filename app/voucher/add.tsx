import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import { POPULAR_BRANDS, BrandInfo } from '@/lib/constants/brands';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import {
  VoucherClassification,
  VoucherCategory,
  VoucherType,
  CLASSIFICATION_LABELS,
  CATEGORY_LABELS,
} from '@/types';

const CLASSIFICATIONS: VoucherClassification[] = ['credit', 'regular_voucher', 'gift_card', 'voucher_group'];
const CATEGORIES: VoucherCategory[] = ['shopping', 'food_and_beverage', 'restaurants', 'culture_and_leisure', 'sports', 'other'];

export default function AddVoucherScreen() {
  const { user } = useAuthStore();
  const { addVoucher, updateVoucher, vouchers } = useWalletStore();
  const { editId } = useLocalSearchParams<{ editId?: string }>();

  const isEdit = !!editId;
  const existing = isEdit ? vouchers.find((v) => v.id === editId) : null;

  const [classification, setClassification] = useState<VoucherClassification | null>(
    existing?.classification ?? null
  );
  const [category, setCategory] = useState<VoucherCategory | null>(existing?.category ?? null);
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [originalValue, setOriginalValue] = useState(existing?.original_value?.toString() ?? '');
  const [remainingValue, setRemainingValue] = useState(existing?.remaining_value?.toString() ?? '');
  // Track whether user has manually edited remaining — if not, keep it in sync with original
  const [remainingEdited, setRemainingEdited] = useState(isEdit);
  const [voucherType, setVoucherType] = useState<VoucherType | null>(existing?.voucher_type ?? null);
  const [voucherCode, setVoucherCode] = useState(existing?.voucher_code ?? '');
  const [pinCode, setPinCode] = useState(existing?.pin_code ?? '');
  const [imageUri, setImageUri] = useState<string | null>(existing?.image_url ?? null);
  const [barcodeNumber, setBarcodeNumber] = useState(existing?.barcode_data ?? '');
  const [expiresAt, setExpiresAt] = useState<Date | null>(
    existing?.expires_at ? new Date(existing.expires_at) : null
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [brandPickerVisible, setBrandPickerVisible] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const now = new Date();
  const [pickYear, setPickYear] = useState(expiresAt?.getFullYear() ?? now.getFullYear());
  const [pickMonth, setPickMonth] = useState((expiresAt?.getMonth() ?? now.getMonth()) + 1);
  const [pickDay, setPickDay] = useState(expiresAt?.getDate() ?? now.getDate());

  const isVoucherGroup = classification === 'voucher_group';
  const filteredBrands = POPULAR_BRANDS.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  function selectBrand(b: BrandInfo) {
    setBrand(b.name);
    setBrandPickerVisible(false);
    setBrandSearch('');
  }

  function openDatePicker() {
    if (expiresAt) {
      setPickYear(expiresAt.getFullYear());
      setPickMonth(expiresAt.getMonth() + 1);
      setPickDay(expiresAt.getDate());
    }
    setDatePickerVisible(true);
  }

  function confirmDate() {
    const daysInMonth = new Date(pickYear, pickMonth, 0).getDate();
    const safeDay = Math.min(pickDay, daysInMonth);
    setExpiresAt(new Date(pickYear, pickMonth - 1, safeDay));
    setDatePickerVisible(false);
  }

  function clearDate() {
    setExpiresAt(null);
    setDatePickerVisible(false);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    setSaveError('');

    if (!classification) {
      setSaveError('Please select a classification');
      return;
    }
    if (!isVoucherGroup && !category) {
      setSaveError('Please select a category');
      return;
    }
    if (!isVoucherGroup && !brand.trim()) {
      setSaveError('Please enter a brand name');
      return;
    }
    if (!isVoucherGroup && !originalValue) {
      setSaveError('Please enter the original value');
      return;
    }
    if (!user?.id) {
      setSaveError('Not logged in — please restart the app');
      return;
    }

    const orig = parseFloat(originalValue);
    const rem = remainingValue ? parseFloat(remainingValue) : orig;

    if (!isVoucherGroup && (isNaN(orig) || orig <= 0)) {
      setSaveError('Invalid original value');
      return;
    }
    if (!isVoucherGroup && rem > orig) {
      setSaveError('Remaining value cannot be higher than the original value');
      return;
    }
    if (voucherType === 'digital' && !voucherCode.trim()) {
      setSaveError('Voucher Code is required for Digital Code type');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        owner_id: user.id,
        brand: brand.trim() || 'Group',
        brand_logo_url: null,
        original_value: isVoucherGroup ? 0 : orig,
        remaining_value: isVoucherGroup ? 0 : rem,
        currency: 'ILS',
        barcode_data: barcodeNumber || null,
        barcode_format: null,
        voucher_code: voucherCode || null,
        pin_code: pinCode || null,
        image_url: imageUri || null,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        notes: notes || null,
        is_listed: false,
        listing_price: null,
        status: 'active' as const,
        classification,
        category: isVoucherGroup ? null : category,
        voucher_type: voucherType,
      };

      if (isEdit && editId) {
        await updateVoucher(editId, payload);
      } else {
        await addVoucher(payload);
      }
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(msg);
    } finally {
      setLoading(false);
    }
  }

  const formDisabled = isVoucherGroup;

  function renderClassificationSection() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Classification *</Text>
        <View style={styles.chipRow}>
          {CLASSIFICATIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, classification === c && styles.chipSelected]}
              onPress={() => setClassification(c)}
            >
              <Text style={[styles.chipText, classification === c && styles.chipTextSelected]}>
                {CLASSIFICATION_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {isVoucherGroup && (
          <View style={styles.groupNote}>
            <Text style={styles.groupNoteText}>
              Voucher Group: Only a link can be added below. All other fields are disabled.
            </Text>
          </View>
        )}
      </View>
    );
  }

  function renderCategorySection() {
    return (
      <View style={[styles.section, formDisabled && styles.sectionDisabled]}>
        <Text style={[styles.sectionTitle, formDisabled && styles.labelDisabled]}>Category *</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipSelected, formDisabled && styles.chipDisabled]}
              onPress={() => !formDisabled && setCategory(c)}
              disabled={formDisabled}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextSelected, formDisabled && styles.chipTextDisabled]}>
                {CATEGORY_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  function renderBrandSection() {
    return (
      <View style={[styles.section, formDisabled && styles.sectionDisabled]}>
        <Text style={[styles.sectionTitle, formDisabled && styles.labelDisabled]}>Brand *</Text>
        <View style={styles.brandRow}>
          <TextInput
            style={[styles.input, styles.brandInput, formDisabled && styles.inputDisabled]}
            placeholder="Type brand name..."
            placeholderTextColor={colors.textMuted}
            value={brand}
            onChangeText={setBrand}
            editable={!formDisabled}
          />
          <TouchableOpacity
            style={[styles.brandPickerBtn, formDisabled && styles.chipDisabled]}
            onPress={() => !formDisabled && setBrandPickerVisible(true)}
            disabled={formDisabled}
          >
            <Text style={[styles.brandPickerBtnText, formDisabled && styles.chipTextDisabled]}>Browse</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderValuesSection() {
    return (
      <View style={[styles.section, formDisabled && styles.sectionDisabled]}>
        <Text style={[styles.sectionTitle, formDisabled && styles.labelDisabled]}>Value</Text>
        <View style={styles.twoCol}>
          <View style={styles.colItem}>
            <Text style={[styles.label, formDisabled && styles.labelDisabled]}>Original (₪) *</Text>
            <TextInput
              style={[styles.input, formDisabled && styles.inputDisabled]}
              placeholder="500.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={originalValue}
              onChangeText={(v) => {
                setOriginalValue(v);
                if (!remainingEdited) setRemainingValue(v);
              }}
              editable={!formDisabled}
            />
          </View>
          <View style={styles.colItem}>
            <Text style={[styles.label, formDisabled && styles.labelDisabled]}>Remaining (₪)</Text>
            <TextInput
              style={[
                styles.input,
                formDisabled && styles.inputDisabled,
                remainingEdited && remainingValue && parseFloat(remainingValue) > parseFloat(originalValue || '0')
                  ? styles.inputError : null,
              ]}
              placeholder="Same as original"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={remainingValue}
              onChangeText={(v) => { setRemainingValue(v); setRemainingEdited(true); }}
              editable={!formDisabled}
            />
            {remainingEdited && remainingValue && parseFloat(remainingValue) > parseFloat(originalValue || '0') ? (
              <Text style={styles.fieldError}>Cannot exceed original value</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  function renderDateSection() {
    return (
      <View style={[styles.section, formDisabled && styles.sectionDisabled]}>
        <Text style={[styles.sectionTitle, formDisabled && styles.labelDisabled]}>Expiration Date</Text>
        <TouchableOpacity
          style={[styles.datePicker, formDisabled && styles.inputDisabled]}
          onPress={() => !formDisabled && openDatePicker()}
          disabled={formDisabled}
        >
          <Text style={[styles.datePickerText, !expiresAt && styles.datePickerPlaceholder]}>
            {expiresAt ? expiresAt.toLocaleDateString('en-GB') : 'Select expiration date...'}
          </Text>
          <Text style={styles.datePickerIcon}>📅</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVoucherTypeSection() {
    return (
      <View style={[styles.section, formDisabled && styles.sectionDisabled]}>
        <Text style={[styles.sectionTitle, formDisabled && styles.labelDisabled]}>Voucher Type</Text>
        <View style={styles.typeCardRow}>
          <TouchableOpacity
            style={[
              styles.typeCard,
              voucherType === 'digital' && styles.typeCardSelected,
              formDisabled && styles.typeCardDisabled,
            ]}
            onPress={() => !formDisabled && setVoucherType('digital')}
            disabled={formDisabled}
          >
            <Text style={styles.typeCardEmoji}>💳</Text>
            <Text style={[styles.typeCardTitle, voucherType === 'digital' && styles.typeCardTitleSelected]}>
              Digital Code
            </Text>
            <Text style={[styles.typeCardSub, formDisabled && styles.labelDisabled]}>
              Numeric / alphanumeric code
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeCard,
              voucherType === 'physical' && styles.typeCardSelected,
              formDisabled && styles.typeCardDisabled,
            ]}
            onPress={() => !formDisabled && setVoucherType('physical')}
            disabled={formDisabled}
          >
            <Text style={styles.typeCardEmoji}>🎟️</Text>
            <Text style={[styles.typeCardTitle, voucherType === 'physical' && styles.typeCardTitleSelected]}>
              Physical Voucher
            </Text>
            <Text style={[styles.typeCardSub, formDisabled && styles.labelDisabled]}>
              Paper or QR code
            </Text>
          </TouchableOpacity>
        </View>

        {voucherType === 'digital' && !formDisabled && (
          <View style={styles.typeFields}>
            <View style={[styles.badge, styles.badgeGreen]}>
              <Text style={styles.badgeText}>✓ Instant trading / Auto transfer</Text>
            </View>
            <Text style={styles.label}>Voucher Code <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.codeInput, !voucherCode.trim() ? styles.inputRequired : null]}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={voucherCode}
              onChangeText={setVoucherCode}
            />
            {!voucherCode.trim() && (
              <Text style={styles.fieldHint}>Required for digital vouchers</Text>
            )}
            <Text style={styles.label}>PIN (optional)</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="1234"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={pinCode}
              onChangeText={setPinCode}
            />
            <Text style={styles.label}>Voucher Image *</Text>
            <TouchableOpacity style={styles.imageUploadBtn} onPress={pickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.imageUploadIcon}>📷</Text>
                  <Text style={styles.imageUploadText}>Upload Photo / Take Picture</Text>
                </>
              )}
            </TouchableOpacity>
            {imageUri && (
              <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImageBtn}>
                <Text style={styles.removeImageText}>Remove image</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {voucherType === 'physical' && !formDisabled && (
          <View style={styles.typeFields}>
            <View style={[styles.badge, styles.badgeAmber]}>
              <Text style={styles.badgeText}>⚠ Trading requires coordination / Manual transfer</Text>
            </View>
            <TouchableOpacity style={styles.imageUploadBtn} onPress={pickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.imageUploadIcon}>📷</Text>
                  <Text style={styles.imageUploadText}>Upload Photo / Take Picture</Text>
                </>
              )}
            </TouchableOpacity>
            {imageUri && (
              <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImageBtn}>
                <Text style={styles.removeImageText}>Remove image</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.label}>Barcode Number (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1234567890"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={barcodeNumber}
              onChangeText={setBarcodeNumber}
            />
          </View>
        )}

        {isVoucherGroup && (
          <View style={styles.typeFields}>
            <Text style={styles.label}>Link / Voucher Code</Text>
            <TextInput
              style={styles.input}
              placeholder="https://... or group code"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={voucherCode}
              onChangeText={setVoucherCode}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isEdit ? 'Edit Voucher' : 'Add Voucher'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {saveError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠ {saveError}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {renderClassificationSection()}
        {renderCategorySection()}
        {renderBrandSection()}
        {renderValuesSection()}
        {renderDateSection()}
        {renderVoucherTypeSection()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any additional info..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </ScrollView>

      {/* Brand Picker Modal */}
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

      {/* Date Picker Modal */}
      <Modal visible={datePickerVisible} animationType="fade" transparent>
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalCard}>
            <Text style={styles.dateModalTitle}>Select Date</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <Text style={styles.dateColLabel}>Day</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => setPickDay((d) => Math.max(1, d - 1))}>
                  <Text style={styles.dateArrowText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.dateValue}>{String(pickDay).padStart(2, '0')}</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => setPickDay((d) => Math.min(31, d + 1))}>
                  <Text style={styles.dateArrowText}>▼</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={styles.dateCol}>
                <Text style={styles.dateColLabel}>Month</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => setPickMonth((m) => Math.max(1, m - 1))}>
                  <Text style={styles.dateArrowText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.dateValue}>{String(pickMonth).padStart(2, '0')}</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => setPickMonth((m) => Math.min(12, m + 1))}>
                  <Text style={styles.dateArrowText}>▼</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={styles.dateCol}>
                <Text style={styles.dateColLabel}>Year</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => setPickYear((y) => y - 1)}>
                  <Text style={styles.dateArrowText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.dateValue}>{pickYear}</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => setPickYear((y) => y + 1)}>
                  <Text style={styles.dateArrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.dateModalActions}>
              <TouchableOpacity style={styles.dateClearBtn} onPress={clearDate}>
                <Text style={styles.dateClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateConfirmBtn} onPress={confirmDate}>
                <Text style={styles.dateConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
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
  backButton: { padding: spacing.xs },
  backText: { fontSize: fontSizes.lg, color: colors.textMuted },
  navTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
  saveText: { fontSize: fontSizes.md, fontWeight: '700', color: colors.accent },
  errorBanner: {
    backgroundColor: colors.error + '15',
    borderBottomWidth: 1,
    borderBottomColor: colors.error,
    padding: spacing.md,
  },
  errorBannerText: { color: colors.error, fontSize: fontSizes.sm, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 60 },

  section: {
    marginBottom: spacing.lg,
  },
  sectionDisabled: { opacity: 0.4 },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  labelDisabled: { color: colors.textMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.cardBg,
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: fontSizes.sm, color: colors.textMuted, fontWeight: '500' },
  chipTextSelected: { color: colors.accent, fontWeight: '700' },
  chipTextDisabled: { color: colors.textMuted },

  groupNote: {
    marginTop: spacing.sm,
    backgroundColor: colors.warning + '20',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  groupNoteText: { fontSize: fontSizes.xs, color: colors.warning, lineHeight: 18 },

  brandRow: { flexDirection: 'row', gap: spacing.sm },
  brandInput: { flex: 1 },
  brandPickerBtn: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
  },
  brandPickerBtnText: { color: colors.accent, fontWeight: '700', fontSize: fontSizes.sm },

  twoCol: { flexDirection: 'row', gap: spacing.sm },
  colItem: { flex: 1 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.cardBg,
  },
  inputDisabled: { backgroundColor: colors.gray100, color: colors.textMuted },
  codeInput: { fontFamily: 'monospace', letterSpacing: 2 },
  textArea: { height: 80, textAlignVertical: 'top' },
  inputError: { borderColor: colors.error, backgroundColor: colors.error + '08' },
  inputRequired: { borderColor: colors.warning, borderWidth: 1.5 },
  fieldError: { color: colors.error, fontSize: fontSizes.xs, fontWeight: '600', marginTop: 4 },
  fieldHint: { color: colors.warning, fontSize: fontSizes.xs, fontWeight: '500', marginTop: 4 },
  required: { color: colors.error, fontWeight: '700' },

  datePicker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cardBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: { fontSize: fontSizes.md, color: colors.text },
  datePickerPlaceholder: { color: colors.textMuted },
  datePickerIcon: { fontSize: 18 },

  typeCardRow: { flexDirection: 'row', gap: spacing.sm },
  typeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.cardBg,
  },
  typeCardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
  typeCardDisabled: { opacity: 0.4 },
  typeCardEmoji: { fontSize: 28, marginBottom: spacing.xs },
  typeCardTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.text, textAlign: 'center' },
  typeCardTitleSelected: { color: colors.accent },
  typeCardSub: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', marginTop: 2 },

  typeFields: { marginTop: spacing.md },
  badge: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeGreen: { backgroundColor: '#16C784' + '25', borderWidth: 1, borderColor: '#16C784' },
  badgeAmber: { backgroundColor: '#F5A623' + '25', borderWidth: 1, borderColor: '#F5A623' },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.text },

  imageUploadBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imageUploadIcon: { fontSize: 36, marginBottom: spacing.sm },
  imageUploadText: { fontSize: fontSizes.sm, color: colors.textMuted },
  removeImageBtn: { alignItems: 'center', marginTop: spacing.xs },
  removeImageText: { color: colors.error, fontSize: fontSizes.xs },

  modalContainer: { flex: 1, backgroundColor: colors.bgLight },
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
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
  modalClose: { fontSize: fontSizes.md, color: colors.accent, fontWeight: '600' },
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
  brandDot: { width: 10, height: 10, borderRadius: 5 },
  brandItemEmoji: { fontSize: 20 },
  brandItemName: { flex: 1, fontSize: fontSizes.md, color: colors.text },
  checkmark: { color: colors.accent, fontSize: fontSizes.lg, fontWeight: '700' },

  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dateModalCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
  },
  dateModalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dateCol: { alignItems: 'center', minWidth: 72 },
  dateColLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: '600' },
  dateArrow: { padding: spacing.sm },
  dateArrowText: { fontSize: fontSizes.md, color: colors.accent, fontWeight: '700' },
  dateValue: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.text,
    minWidth: 60,
    textAlign: 'center',
  },
  dateSep: {
    fontSize: fontSizes.xxl,
    fontWeight: '300',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  dateModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dateClearBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dateClearText: { color: colors.textMuted, fontWeight: '600' },
  dateConfirmBtn: {
    flex: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  dateConfirmText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.md },
});
