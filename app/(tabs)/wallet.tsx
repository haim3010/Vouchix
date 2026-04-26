import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import VoucherCard from '@/components/VoucherCard';
import AppHeader from '@/components/AppHeader';
import { colors, spacing, fontSizes, radius } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import {
  Voucher,
  VoucherClassification,
  VoucherCategory,
  CLASSIFICATION_LABELS,
  CATEGORY_LABELS,
} from '@/types';

const FILTER_CATEGORIES: (VoucherCategory | 'all')[] = [
  'all', 'shopping', 'food_and_beverage', 'restaurants', 'culture_and_leisure', 'sports', 'other',
];

const CLASSIFICATION_ORDER: VoucherClassification[] = ['credit', 'regular_voucher', 'gift_card', 'voucher_group'];

export default function WalletScreen() {
  const { user } = useAuthStore();
  const { vouchers, loading, fetchVouchers, deleteVoucher } = useWalletStore();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<VoucherCategory | 'all'>('all');

  const refresh = useCallback(() => {
    if (user?.id) fetchVouchers(user.id);
  }, [user?.id, fetchVouchers]);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-fetch every time the screen comes into focus (e.g. after adding a voucher)
  useFocusEffect(refresh);

  const activeVouchers = vouchers.filter((v) => v.status === 'active');

  const totalValue = activeVouchers.reduce((sum, v) => sum + v.remaining_value, 0);

  const expiringCount = activeVouchers.filter((v) => {
    if (!v.expires_at) return false;
    const days = Math.ceil((new Date(v.expires_at).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;

  const expiringValue = activeVouchers
    .filter((v) => {
      if (!v.expires_at) return false;
      const days = Math.ceil((new Date(v.expires_at).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 30;
    })
    .reduce((sum, v) => sum + v.remaining_value, 0);

  const filteredVouchers = useMemo(() => {
    return activeVouchers.filter((v) => {
      const matchesSearch =
        !search ||
        v.brand.toLowerCase().includes(search.toLowerCase()) ||
        (v.voucher_code ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (v.notes ?? '').toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        activeCategory === 'all' || v.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [activeVouchers, search, activeCategory]);

  const sections = useMemo(() => {
    const grouped: Record<string, Voucher[]> = {};
    for (const v of filteredVouchers) {
      const key = v.classification ?? 'regular_voucher';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(v);
    }
    return CLASSIFICATION_ORDER
      .filter((c) => grouped[c] && grouped[c].length > 0)
      .map((c) => ({
        title: CLASSIFICATION_LABELS[c],
        key: c,
        data: grouped[c],
      }));
  }, [filteredVouchers]);

  function renderHeader() {
    return (
      <View>
        <AppHeader subtitle="Your voucher wallet" />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.greeting}>My Wallet</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/voucher/add')}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
              <Text style={styles.summaryLabel}>Total value</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeVouchers.length}</Text>
              <Text style={styles.summaryLabel}>Vouchers</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, expiringCount > 0 && { color: colors.warning }]}>
                {formatCurrency(expiringValue)}
              </Text>
              <Text style={[styles.summaryLabel, expiringCount > 0 && { color: colors.warning }]}>
                Expiring soon ({expiringCount})
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search vouchers..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            {FILTER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, activeCategory === cat && styles.filterChipActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.filterChipText, activeCategory === cat && styles.filterChipTextActive]}>
                  {cat === 'all' ? 'All' : CATEGORY_LABELS[cat as VoucherCategory]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  function renderSectionHeader({ section }: { section: { title: string } }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>👜</Text>
        <Text style={styles.emptyTitle}>
          {search || activeCategory !== 'all' ? 'No matching vouchers' : 'Your wallet is lonely!'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {search || activeCategory !== 'all'
            ? 'Try adjusting your search or filters'
            : 'Add your first voucher to get started'}
        </Text>
        {!search && activeCategory === 'all' && (
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/voucher/add')}
          >
            <Text style={styles.emptyButtonText}>Add Voucher</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading && vouchers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        {renderHeader()}
        <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList<Voucher, { title: string; key: string; data: Voucher[] }>
        sections={sections}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VoucherCard
            voucher={item}
            onDelete={() => deleteVoucher(item.id).catch(() => {})}
          />
        )}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={sections.length === 0 ? styles.listEmpty : styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => user?.id && fetchVouchers(user.id)}
            tintColor={colors.accent}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  loadingContainer: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greeting: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.white },
  addButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addButtonText: { color: colors.white, fontSize: fontSizes.sm, fontWeight: '700' },
  summaryCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: fontSizes.md, fontWeight: '800', color: colors.white },
  summaryLabel: { fontSize: fontSizes.xs, color: colors.gray400, marginTop: 2, textAlign: 'center' },
  summaryDivider: { width: 1, height: 32, backgroundColor: colors.gray600 },

  searchContainer: {
    backgroundColor: colors.cardBg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgLight,
    height: 44,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.xs },
  searchInput: { flex: 1, fontSize: fontSizes.md, color: colors.text },
  searchClear: { fontSize: 14, color: colors.textMuted, padding: spacing.xs },

  filterScroll: { marginTop: spacing.sm },
  filterContent: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgLight,
  },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  filterChipText: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: '500' },
  filterChipTextActive: { color: colors.accent, fontWeight: '700' },

  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  list: { paddingBottom: spacing.xxl },
  listEmpty: { flex: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: { fontSize: 72, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySubtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyButtonText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.md },
});
