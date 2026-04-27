import { Image, View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';

interface Props {
  /** Clearbit lookup domain, e.g. "nike.com" */
  domain?: string;
  /** Brand display name — used for initials fallback */
  name: string;
  /** Brand accent colour — used for the fallback avatar background/text */
  color: string;
  /** Rendered size in dp (both width and height). Default: 36 */
  size?: number;
}

/**
 * Tries to load a real brand logo from Clearbit (https://logo.clearbit.com/<domain>).
 * Falls back to a rounded square with coloured initials when:
 *  - no domain is provided
 *  - the network request fails / returns a 404
 */
export default function BrandLogo({ domain, name, color, size = 36 }: Props) {
  const [failed, setFailed] = useState(false);

  // Build 1–2 character initials from the brand name
  const initials = name
    .split(/[\s&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const borderRadius = size * 0.22;

  if (!domain || failed) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: color + '22',
            borderColor: color + '55',
          },
        ]}
      >
        <Text style={[styles.initials, { color, fontSize: size * 0.38 }]}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: `https://logo.clearbit.com/${domain}?size=${size * 3}` }}
      style={{ width: size, height: size, borderRadius }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initials: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
