import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Pressable,
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

interface Review {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  reviewer: { display_name: string; avatar_url: string | null } | null;
}

export default function UserProfileModal({ userId, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) { setProfile(null); setReviews([]); setError(''); return; }
    setLoading(true);
    setError('');
    (async () => {
      // Profile
      const { data: profileData, error: pErr } = await supabase
        .from('profiles')
        .select('id, display_name, rating, total_trades, created_at, avatar_url')
        .eq('id', userId)
        .single();
      if (pErr || !profileData) setError('Could not load profile');
      else setProfile(profileData as Profile);

      // Reviews (no FK embed — fetch reviewers separately for robustness)
      const { data: reviewRows, error: rErr } = await supabase
        .from('reviews')
        .select('id, stars, comment, created_at, reviewer_id')
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      console.log('[UserProfileModal] reviews query:', { userId, reviewRows, rErr });

      if (reviewRows && reviewRows.length > 0) {
        const reviewerIds = [...new Set(reviewRows.map((r) => r.reviewer_id).filter(Boolean))];
        const { data: reviewers } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', reviewerIds);
        const byId = new Map((reviewers ?? []).map((r) => [r.id, r]));
        setReviews(reviewRows.map((r) => ({
          id: r.id,
          stars: r.stars,
          comment: r.comment,
          created_at: r.created_at,
          reviewer: byId.get(r.reviewer_id) ?? null,
        })) as Review[]);
      } else {
        setReviews([]);
      }
      setLoading(false);
    })();
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
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          {/* Close */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              {/* Avatar */}
              <View style={styles.avatarWrap}>
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
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

              {/* Reviews */}
              <View style={styles.reviewsSection}>
                <Text style={styles.reviewsTitle}>
                  Reviews ({reviews.length})
                </Text>
                {reviews.length === 0 ? (
                  <Text style={styles.noReviews}>No reviews yet</Text>
                ) : (
                  reviews.map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewName}>
                          {r.reviewer?.display_name ?? 'Anonymous'}
                        </Text>
                        <View style={{ flexDirection: 'row' }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Text key={i} style={[
                              styles.reviewStar,
                              i < r.stars && styles.reviewStarOn,
                            ]}>★</Text>
                          ))}
                        </View>
                      </View>
                      {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                      <Text style={styles.reviewDate}>
                        {new Date(r.created_at).toLocaleDateString('en-GB')}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
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
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.sm,
    zIndex: 10,
    elevation: 10,
  },
  closeBtnText: { fontSize: fontSizes.xl, color: colors.textMuted, fontWeight: '700' },

  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: fontSizes.sm },
  errorWrap: { paddingVertical: spacing.lg },
  errorText: { color: colors.error, fontSize: fontSizes.sm },

  avatarWrap: { marginBottom: spacing.md, marginTop: spacing.xs, alignItems: 'center' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
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

  reviewsSection: { width: '100%', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  reviewsTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  noReviews: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  reviewCard: {
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  reviewName: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.text },
  reviewStar: { fontSize: 14, color: colors.gray200, marginLeft: 1 },
  reviewStarOn: { color: '#F5A623' },
  reviewComment: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 18, marginBottom: 4 },
  reviewDate: { fontSize: 10, color: colors.textMuted },
});
