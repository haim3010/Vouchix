import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuthStore();
  const { vouchers } = useWalletStore();
  const [signingOut, setSigningOut] = useState(false);

  const totalValue = vouchers
    .filter((v) => v.status === 'active')
    .reduce((sum, v) => sum + v.remaining_value, 0);

  const expiredCount = vouchers.filter((v) => v.status === 'expired').length;

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
        },
      },
    ]);
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{profile?.display_name ?? 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {profile?.rating != null && (
            <View style={styles.ratingRow}>
              <Text style={styles.star}>⭐</Text>
              <Text style={styles.rating}>{profile.rating.toFixed(1)}</Text>
              <Text style={styles.trades}> · {profile.total_trades} trades</Text>
            </View>
          )}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{vouchers.length}</Text>
            <Text style={styles.statLabel}>Total Vouchers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCurrency(totalValue)}</Text>
            <Text style={styles.statLabel}>Wallet Value</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{expiredCount}</Text>
            <Text style={styles.statLabel}>Expired</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          <MenuItem emoji="💳" label="Payment Methods" onPress={() => Alert.alert('Coming Soon', 'Phase 2')} />
          <View style={styles.menuDivider} />
          <MenuItem emoji="📊" label="Trade History" onPress={() => Alert.alert('Coming Soon', 'Phase 2')} />
          <View style={styles.menuDivider} />
          <MenuItem emoji="🔔" label="Notification Settings" onPress={() => Alert.alert('Coming Soon')} />
          <View style={styles.menuDivider} />
          <MenuItem emoji="🔒" label="Security" onPress={() => Alert.alert('Coming Soon')} />
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>VouchiX v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  profileCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: fontSizes.xxl,
    fontWeight: '800',
  },
  displayName: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  email: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  star: {
    fontSize: 14,
  },
  rating: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  trades: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  statsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  menuCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  menuEmoji: {
    fontSize: 20,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  menuArrow: {
    fontSize: fontSizes.xl,
    color: colors.gray400,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 52,
  },
  signOutButton: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: spacing.md,
  },
  signOutText: {
    color: colors.error,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: fontSizes.xs,
    color: colors.gray400,
  },
});
