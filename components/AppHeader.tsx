import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '@/lib/constants/theme';

interface Props {
  subtitle?: string;
}

export default function AppHeader({ subtitle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.logoMark}>
          <Text style={styles.bagEmoji}>🛍️</Text>
          <View style={styles.coin}>
            <Text style={styles.coinSymbol}>$</Text>
          </View>
        </View>
        <Text style={styles.name}>
          Vouchi<Text style={styles.nameAccent}>X</Text>
        </Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 52,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bagEmoji: { fontSize: 22 },
  coin: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  coinSymbol: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
  },
  name: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  nameAccent: {
    color: colors.accent,
  },
  subtitle: {
    fontSize: fontSizes.xs,
    color: colors.gray400,
    marginTop: 2,
  },
});
