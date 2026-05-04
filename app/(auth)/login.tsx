import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleSocial(provider: 'google' | 'apple' | 'facebook') {
    setError('');
    setLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (authError) throw authError;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Social login failed. Make sure the provider is enabled in Supabase Auth.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🎁</Text>
          <Text style={styles.title}>VouchiX</Text>
          <Text style={styles.subtitle}>Your voucher wallet</Text>
        </View>

        <View style={styles.form}>
          {error.length > 0 && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠ {error}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* OR divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
          <TouchableOpacity
            style={[styles.socialBtn, styles.socialGoogle]}
            onPress={() => handleSocial('google')}
            disabled={loading}
          >
            <Text style={styles.socialEmoji}>🔵</Text>
            <Text style={styles.socialText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialBtn, styles.socialApple]}
            onPress={() => handleSocial('apple')}
            disabled={loading}
          >
            <Text style={styles.socialEmoji}>🍎</Text>
            <Text style={[styles.socialText, { color: colors.white }]}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialBtn, styles.socialFacebook]}
            onPress={() => handleSocial('facebook')}
            disabled={loading}
          >
            <Text style={styles.socialEmoji}>📘</Text>
            <Text style={[styles.socialText, { color: colors.white }]}>Continue with Facebook</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xxxl,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  form: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  errorBanner: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.gray100,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
  link: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },

  // Social login
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: fontSizes.xs, fontWeight: '700' },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  socialGoogle: { backgroundColor: colors.white },
  socialApple: { backgroundColor: '#000', borderColor: '#000' },
  socialFacebook: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  socialEmoji: { fontSize: 18 },
  socialText: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
});
