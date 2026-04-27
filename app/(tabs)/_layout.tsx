import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/constants/theme';
import { useMarketplaceStore } from '@/lib/stores/marketplaceStore';
import { useMessagesStore } from '@/lib/stores/messagesStore';

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
  const incomingOffers = useMarketplaceStore((s) => s.incomingOffers);
  const pendingCount = incomingOffers.filter((o) => o.status === 'pending').length;
  const conversations = useMessagesStore((s) => s.conversations);
  // Badge = conversations that have an offer message but no chat messages yet (unread)
  const unreadCount = 0; // extend later with read-tracking

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
          tabBarIcon: ({ focused }) => <TabIcon emoji="👜" label="Wallet" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" label="Market" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💬" label="Messages" focused={focused} badge={conversations.length > 0 ? conversations.length : undefined} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🕐" label="History" focused={focused} badge={pendingCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
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
