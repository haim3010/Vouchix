import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        router.replace('/(tabs)/wallet');
      } else {
        router.replace('/(auth)/login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      // Only navigate on actual sign-in/sign-out — NOT on TOKEN_REFRESHED or USER_UPDATED
      if (event === 'SIGNED_IN') {
        router.replace('/(tabs)/wallet');
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="voucher/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="voucher/add" options={{ presentation: 'modal' }} />
      <Stack.Screen name="offer/make" options={{ presentation: 'modal' }} />
      <Stack.Screen name="offer/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="dispute/[transactionId]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
