import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import VoucherCard from '@/components/VoucherCard';
import { colors, spacing, fontSizes, radius } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import { Voucher } from '@/types';

export default function WalletScreen() {
  const { user } = useAuthStore();
  const { vouchers, loading, fetchVouchers } = useWalletStore();

  useEffect(() => {
    if (user?.id) fetchVouchers(user.id);
  }, [user?.id]);

  const totalValue = vouchers
    .filter((v) => v.status === 'active')
    .reduce((sum, v) => sum + v.remaining_value, 0);

  const expiringCount = vouchers.filter((v) => {
    if (!v.expires_at) return false;
    const days = Math.ceil((new Date(v.expires_at).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 7;
  }).length;

  function renderHeader() {
    return (
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
            <Text style={styles.summaryValue}>{vouchers.length}</Text>
            <Text style={styles.summaryLabel}>Vouchers</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, expiringCount > 0 && { color: colors.error }]}>
              {expiringCount}
            </Text>
            <Text style={styles.summaryLabel}>Expiring soon</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>👜</Text>
        <Text style={styles.emptyTitle}>Your wallet is lonely!</Text>
        <Text style={styles.emptySubtitle}>Add your first voucher to get started</Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/voucher/add')}
        >
          <Text style={styles.emptyButtonText}>Add Voucher</Text>
        </TouchableOpacity>
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
      <FlatList<Voucher>
        data={vouchers}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VoucherCard voucher={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={vouchers.length === 0 ? styles.listEmpty : styles.list}
        showsVerticalScrollIndicator={false}
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
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.white,
  },
  addButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addButtonText: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.white,
  },
  summaryLabel: {
    fontSize: fontSizes.xs,
    color: colors.gray400,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.gray600,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  listEmpty: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
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
  emptyButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
});
