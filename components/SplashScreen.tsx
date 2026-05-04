import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '@/lib/constants/theme';

const TEAL = '#20C5C8';
const TEAL_DARK = '#17A0A3';
const NAVY = '#001A2E';
const GOLD = '#FFD700';

interface Props {
  onFinish?: () => void;
  /** Minimum time the splash stays visible, ms. */
  minDuration?: number;
}

export default function VouchiXSplashScreen({ onFinish, minDuration = 2000 }: Props) {
  const fade = useRef(new Animated.Value(0)).current;       // overall enter
  const pulse = useRef(new Animated.Value(1)).current;      // logo pulse
  const progress = useRef(new Animated.Value(0)).current;   // 0..1 loading bar
  const fadeOut = useRef(new Animated.Value(1)).current;    // exit
  const dot0 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    // Enter
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    // Pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Bouncing dots
    const bouncer = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: -8, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      );
    bouncer(dot0, 0).start();
    bouncer(dot1, 200).start();
    bouncer(dot2, 400).start();

    // Loading bar
    let pct = 0;
    const interval = setInterval(() => {
      pct = Math.min(100, pct + Math.random() * 25 + 8);
      setPercent(Math.round(pct));
      Animated.timing(progress, { toValue: pct / 100, duration: 250, useNativeDriver: false }).start();
      if (pct >= 100) clearInterval(interval);
    }, 250);

    // Auto-fade-out
    const exitTimer = setTimeout(() => {
      Animated.timing(fadeOut, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
        onFinish?.();
      });
    }, minDuration);

    return () => { clearInterval(interval); clearTimeout(exitTimer); };
  }, [fade, pulse, progress, fadeOut, dot0, dot1, dot2, minDuration, onFinish]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[styles.root, { opacity: fadeOut }]}>
      {/* Background layers (faux gradient: solid teal + radial-ish overlay) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: TEAL }]} />
      <View style={[StyleSheet.absoluteFill, styles.bgOverlay]} />

      {/* Floating circles */}
      <View style={[styles.circle, { top: -100, left: -100, backgroundColor: 'rgba(0,26,46,0.10)' }]} />
      <View style={[styles.circle, { bottom: -50, right: -50, width: 200, height: 200, backgroundColor: 'rgba(255,215,0,0.08)' }]} />

      {/* Center column */}
      <Animated.View style={[styles.center, { opacity: fade }]}>
        <Animated.View style={[styles.logoBox, { transform: [{ scale: pulse }] }]}>
          <Image source={require('@/assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        <Text style={styles.appName}>
          <Text style={{ color: TEAL }}>V</Text>
          <Text>ouchiX</Text>
        </Text>
        <Text style={styles.tagline}>VOUCHER MANAGEMENT &amp; TRADING</Text>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: barWidth }]} />
        </View>
        <Text style={styles.percent}>{percent}%</Text>
      </Animated.View>

      {/* Bouncing dots */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot0 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  bgOverlay: {
    backgroundColor: TEAL_DARK,
    opacity: 0.35,
  },
  circle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  center: { alignItems: 'center' },
  logoBox: {
    width: 120,
    height: 120,
    borderRadius: 25,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  logoImage: { width: 86, height: 86 },
  appName: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 36,
  },
  barTrack: {
    width: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  percent: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 10,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
