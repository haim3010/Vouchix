import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useT } from '@/lib/i18n';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';

interface Props {
  visible: boolean;
  partnerUserId: string;
  partnerName: string;
  onClose: () => void;
}

const STARS = [1, 2, 3, 4, 5];

export default function RatingModal({ visible, partnerUserId, partnerName, onClose }: Props) {
  const t = useT();
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (stars === 0) return;
    setLoading(true);
    try {
      // Fetch current rating and total_trades
      const { data: profile } = await supabase
        .from('profiles')
        .select('rating, total_trades')
        .eq('id', partnerUserId)
        .single();

      if (profile) {
        const prevRating    = profile.rating ?? 5;
        const prevTrades    = profile.total_trades ?? 0;
        const newTrades     = prevTrades + 1;
        // Weighted average: (prevRating * prevTrades + newStars) / newTrades
        const newRating     = Math.round(((prevRating * prevTrades + stars) / newTrades) * 100) / 100;

        await supabase
          .from('profiles')
          .update({ rating: newRating, total_trades: newTrades })
          .eq('id', partnerUserId);
      }

      // Optionally save raw review text to a notifications entry for the partner
      if (review.trim()) {
        await supabase.from('notifications').insert({
          user_id:  partnerUserId,
          type:     'offer_received',
          title:    `⭐ ${stars}/5 — ביקורת חדשה`,
          body:     review.trim(),
          data:     { stars, reviewer: 'me' },
        });
      }

      setDone(true);
    } catch {
      // Non-critical — close silently
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setStars(0);
    setReview('');
    setDone(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {done ? (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>🎉</Text>
              <Text style={styles.doneTitle}>{t('ratingSubmitted')}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <Text style={styles.closeBtnText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{t('rateYourPartner')}</Text>
              <Text style={styles.subtitle}>
                {t('rateSubtitle')} <Text style={styles.partnerName}>{partnerName}</Text>?
              </Text>

              {/* Stars */}
              <View style={styles.starsRow}>
                {STARS.map((s) => (
                  <TouchableOpacity key={s} onPress={() => setStars(s)} style={styles.starBtn}>
                    <Text style={[styles.star, s <= stars && styles.starActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {stars > 0 && (
                <Text style={styles.starsLabel}>
                  {stars === 1 ? '😞 גרוע' : stars === 2 ? '😕 לא נהדר' : stars === 3 ? '😐 סביר' : stars === 4 ? '😊 טוב' : '🤩 מצוין!'}
                </Text>
              )}

              {/* Review text */}
              <Text style={styles.reviewLabel}>{t('yourReview')}</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder={t('reviewPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={review}
                onChangeText={setReview}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />

              {/* Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.skipBtn} onPress={handleClose}>
                  <Text style={styles.skipText}>{t('skipRating')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, stars === 0 && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={stars === 0 || loading}
                >
                  {loading
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.submitText}>{t('submitRating')}</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  partnerName: {
    fontWeight: '700',
    color: colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  starBtn: { padding: 4 },
  star: {
    fontSize: 40,
    color: colors.gray200,
  },
  starActive: {
    color: '#F5A623',
  },
  starsLabel: {
    textAlign: 'center',
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '600',
    marginTop: -spacing.sm,
  },
  reviewLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.bgLight,
    minHeight: 90,
    maxHeight: 140,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  skipText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: fontSizes.md,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.gray200,
  },
  submitText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: fontSizes.md,
  },
  doneWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  doneEmoji: { fontSize: 56 },
  doneTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.success,
    textAlign: 'center',
  },
  closeBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  closeBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: fontSizes.md,
  },
});
