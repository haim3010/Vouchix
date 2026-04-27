import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';

interface Profile {
  id: string;
  display_name: string;
  rating: number;
  total_trades: number;
  created_at: string;
  avatar_url?: string | null;
}

interface Props {
  userId: string | null; // null = closed
  onClose: () => void;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array(full).fill(null).map((_, i) => (
        <Text key={`f${i}`} style={starStyles.star}>★</Text>
      ))}
      {half && <Text style={[starStyles.star, starStyles.half]}>★</Text>}
      {Array(empty).fill(null).map((_, i) => (
        <Text key={`e${i}`} style={[starStyles.star, starStyles.empty]}>★</Text>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  star: { fontSize: 20, color: '#F5A623' },
  half: { opacity: 0.5 },
  empty: { color: '#D0D0D0' },
});

export default function UserProfileModal({ userId, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) { setProfile(null); setError(''); return; }
    setLoading(true);
    setError('');
    supabase
      .from('profiles')
      .select('id, display_name, rating, total_trades, created_at, avatar_url')
      .eq('id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Could not load profile');
        else setProfile(data as Profile);
        setLoading(false);
      });
  }, [userId]);

  const initials = profile?.display_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') ?? '?';

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '';

  return (
    <Modal visible={!!userId} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Loading profile…</Text>
            </View>
          )}

          {error.length > 0 && !loading && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          )}

          {profile && !loading && (
            <>
              {/* Avatar */}
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>

              {/* Name */}
              <Text style={styles.name}>{profile.display_name}</Text>

              {/* Rating */}
              <View style={styles.ratingRow}>
                <StarRating rating={profile.rating} />
                <Text style={styles.ratingValue}>{profile.rating.toFixed(1)}</Text>
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.total_trades}</Text>
                  <Text style={styles.statLabel}>Trades</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {profile.total_trades > 20 ? '🏆' : profile.total_trades > 5 ? '⭐' : '🆕'}
                  </Text>
                  <Text style={styles.statLabel}>
                    {profile.total_trades > 20 ? 'Top Seller' : profile.total_trades > 5 ? 'Active' : 'New'}
                  </Text>
                </View>
              </View>

              {/* Member since */}
              <Text style={styles.since}>Member since {memberSince}</Text>

              {/* Trust indicators */}
              <View style={styles.trustRow}>
                {profile.total_trades >= 10 && (
                  <View style={styles.trustBadge}>
                    <Text style={styles.trustBadgeText}>✓ Verified Trader</Text>
                  </View>
                )}
                {profile.rating >= 4.5 && (
                  <View style={[styles.trustBadge, styles.trustBadgeGold]}>
                    <Text style={[styles.trustBadgeText, styles.trustBadgeGoldText]}>★ Top Rated</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: spacing.xs,
  },
  closeBtnText: { fontSize: fontSizes.lg, color: colors.textMuted },

  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: fontSizes.sm },
  errorWrap: { paddingVertical: spacing.lg },
  errorText: { color: colors.error, fontSize: fontSizes.sm },

  avatarWrap: { marginBottom: spacing.md, marginTop: spacing.xs },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.white },

  name: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  ratingValue: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },

  since: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: spacing.md },

  trustRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  trustBadge: {
    backgroundColor: colors.success + '20',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.success,
  },
  trustBadgeText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: '700' },
  trustBadgeGold: { backgroundColor: '#FFF3CD', borderColor: '#F5A623' },
  trustBadgeGoldText: { color: '#B8860B' },
});
