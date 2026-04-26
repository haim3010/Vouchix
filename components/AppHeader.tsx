import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '@/lib/constants/theme';

interface Props {
  subtitle?: string;
}

export default function AppHeader({ subtitle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.icon}>🎁</Text>
        <Text style={styles.name}>VouchiX</Text>
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
  icon: { fontSize: 22 },
  name: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSizes.xs,
    color: colors.gray400,
    marginTop: 2,
  },
});
