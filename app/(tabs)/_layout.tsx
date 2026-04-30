import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/constants/theme';
import { useMessagesStore } from '@/lib/stores/messagesStore';
import { useT } from '@/lib/i18n';

function TabIcon({ emoji, label, focused, badge }: { emoji: string; label: string; focused: boolean; badge?: number }) {
  return (
    <View style={styles.tabItem}>
      <View>
        <Text style={styles.emoji}>{emoji}</Text>
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const conversations = useMessagesStore((s) => s.conversations);
  const t = useT();
  const pendingConvs = conversations.filter((c) => c.offer_status === 'pending' && c.is_seller).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="wallet"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👜" label={t('wallet')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" label={t('market')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              emoji="🤝"
              label={t('offers')}
              focused={focused}
              badge={pendingConvs > 0 ? pendingConvs : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🕐" label={t('history')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label={t('profile')} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.primary,
    borderTopWidth: 0,
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  emoji: { fontSize: 22 },
  tabLabel: { fontSize: 10, color: colors.gray400, fontWeight: '500' },
  tabLabelActive: { color: colors.accent },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
});
