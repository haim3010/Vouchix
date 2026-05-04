import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';
import VouchiXSplashScreen from '@/components/SplashScreen';

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
    }).catch(() => {
      setSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      if (event === 'SIGNED_IN') router.replace('/(tabs)/wallet');
      else if (event === 'SIGNED_OUT') router.replace('/(auth)/login');
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="voucher/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="voucher/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="offer/make" options={{ presentation: 'modal' }} />
        <Stack.Screen name="offer/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="dispute/[transactionId]" options={{ presentation: 'modal' }} />
      </Stack>
      {!splashDone && <VouchiXSplashScreen onFinish={() => setSplashDone(true)} />}
    </View>
  );
}
