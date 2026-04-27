import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useMessagesStore, Conversation, ChatMessage } from '@/lib/stores/messagesStore';
import AppHeader from '@/components/AppHeader';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import { useState } from 'react';

const STATUS_COLOR: Record<string, string> = {
  pending:   colors.warning,
  accepted:  colors.success,
  rejected:  colors.error,
  cancelled: colors.textMuted,
  completed: colors.secondary,
};
const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  accepted:  'Accepted ✓',
  rejected:  'Rejected',
  cancelled: 'Cancelled',
  completed: 'Completed ✓',
};

export default function MessagesScreen() {
  const { user } = useAuthStore();
  const {
    conversations, currentMessages, currentConversation,
    loadingConversations, loadingMessages, sending,
    fetchConversations, openConversation, closeConversation,
    sendMessage, subscribeToMessages,
  } = useMessagesStore();

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => {
    if (user?.id) fetchConversations(user.id);
  }, [user?.id, fetchConversations]);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Subscribe to real-time messages when a conversation is open
  useEffect(() => {
    if (currentConversation) {
      unsubRef.current = subscribeToMessages(currentConversation.offer_id);
    }
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [currentConversation?.offer_id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (currentMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [currentMessages.length]);

  async function handleSend() {
    if (!draft.trim() || !user?.id || !currentConversation) return;
    setSendError('');
    const text = draft.trim();
    setDraft('');
    try {
      await sendMessage(currentConversation.offer_id, user.id, text);
    } catch {
      setSendError('Failed to send. Try again.');
      setDraft(text); // restore
    }
  }

  function handleOpen(conv: Conversation) {
    openConversation(conv);
  }

  function handleClose() {
    unsubRef.current?.();
    unsubRef.current = null;
    closeConversation();
    setDraft('');
    setSendError('');
  }

  // ── Render conversation list item ──────────────────────────────────────────
  function renderConversation({ item }: { item: Conversation }) {
    const initials = item.other_user_name.slice(0, 2).toUpperCase();
    const statusColor = STATUS_COLOR[item.offer_status] ?? colors.textMuted;
    return (
      <TouchableOpacity style={styles.convCard} onPress={() => handleOpen(item)} activeOpacity={0.8}>
        <View style={[styles.avatar, { backgroundColor: statusColor + '30' }]}>
          <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
        </View>
        <View style={styles.convBody}>
          <View style={styles.convTopRow}>
            <Text style={styles.convName}>{item.other_user_name}</Text>
            {item.last_message_at && (
              <Text style={styles.convTime}>
                {new Date(item.last_message_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </Text>
            )}
          </View>
          <Text style={styles.convVoucher}>
            {item.voucher_brand} · {formatCurrency(item.voucher_original_value)}
            {item.is_seller ? ' · You are selling' : ' · You are buying'}
          </Text>
          <View style={styles.convBottomRow}>
            <Text style={styles.convPreview} numberOfLines={1}>
              {item.last_message ?? item.offer_message ?? 'No messages yet'}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {STATUS_LABEL[item.offer_status] ?? item.offer_status}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render a single chat bubble ────────────────────────────────────────────
  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
    const isMine = item.sender_id === user?.id;
    const senderName = item.sender?.display_name ?? (isMine ? 'You' : 'Them');
    const prevItem = currentMessages[index - 1];
    const showName = !isMine && (!prevItem || prevItem.sender_id !== item.sender_id);

    return (
      <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
        {showName && (
          <Text style={styles.bubbleSenderName}>{senderName}</Text>
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
          <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
            {new Date(item.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  // ── Initial offer message shown as first bubble ────────────────────────────
  function renderOfferBubble(conv: Conversation) {
    if (!conv.offer_message) return null;
    return (
      <View style={styles.offerBubbleWrap}>
        <View style={styles.offerBubble}>
          <Text style={styles.offerBubbleLabel}>
            {conv.is_seller ? '📥 Offer received' : '📤 Your offer'}
          </Text>
          <Text style={styles.offerBubbleAmount}>{formatCurrency(conv.offer_amount)}</Text>
          <Text style={styles.offerBubbleMsg}>{conv.offer_message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader subtitle="Your conversations" />
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Messages</Text>
        <Text style={styles.pageSubtitle}>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList<Conversation>
        data={conversations}
        keyExtractor={(c) => c.offer_id}
        renderItem={renderConversation}
        contentContainerStyle={conversations.length === 0 ? styles.listEmpty : styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loadingConversations} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loadingConversations ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                When you make or receive an offer, the conversation will appear here.
              </Text>
            </View>
          )
        }
      />

      {/* ══ CHAT MODAL ══ */}
      <Modal
        visible={!!currentConversation}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        {currentConversation && (
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {/* Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={handleClose} style={styles.chatBackBtn}>
                <Text style={styles.chatBackText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>{currentConversation.other_user_name}</Text>
                <Text style={styles.chatHeaderSub}>
                  {currentConversation.voucher_brand} · {formatCurrency(currentConversation.voucher_original_value)}
                  {' · '}
                  <Text style={{ color: STATUS_COLOR[currentConversation.offer_status] }}>
                    {STATUS_LABEL[currentConversation.offer_status]}
                  </Text>
                </Text>
              </View>
              <View style={styles.chatHeaderOffer}>
                <Text style={styles.chatOfferAmount}>{formatCurrency(currentConversation.offer_amount)}</Text>
                <Text style={styles.chatOfferLabel}>offer</Text>
              </View>
            </View>

            {/* Messages */}
            {loadingMessages ? (
              <View style={styles.chatLoading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <FlatList<ChatMessage>
                ref={flatListRef}
                data={currentMessages}
                keyExtractor={(m) => m.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={renderOfferBubble(currentConversation)}
                ListEmptyComponent={
                  <View style={styles.chatEmpty}>
                    <Text style={styles.chatEmptyText}>
                      No messages yet — say hello! 👋
                    </Text>
                  </View>
                }
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: false })
                }
              />
            )}

            {/* Send error */}
            {sendError.length > 0 && (
              <View style={styles.sendError}>
                <Text style={styles.sendErrorText}>⚠ {sendError}</Text>
              </View>
            )}

            {/* Input bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={500}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!draft.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.sendBtnText}>↑</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },

  pageHeader: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: colors.white },
  pageSubtitle: { fontSize: fontSizes.sm, color: colors.accent, marginTop: 2 },

  list: { paddingVertical: spacing.sm },
  listEmpty: { flex: 1 },

  // Conversation cards
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: fontSizes.md, fontWeight: '800' },
  convBody: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  convTime: { fontSize: fontSizes.xs, color: colors.textMuted },
  convVoucher: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 1 },
  convBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  convPreview: { fontSize: fontSizes.sm, color: colors.textMuted, flex: 1, marginRight: spacing.sm },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },

  // Chat modal
  chatContainer: { flex: 1, backgroundColor: colors.bgLight },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  chatBackBtn: { padding: spacing.xs },
  chatBackText: { fontSize: fontSizes.lg, color: colors.white },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: fontSizes.md, fontWeight: '800', color: colors.white },
  chatHeaderSub: { fontSize: fontSizes.xs, color: colors.gray400, marginTop: 2 },
  chatHeaderOffer: { alignItems: 'flex-end' },
  chatOfferAmount: { fontSize: fontSizes.md, fontWeight: '800', color: colors.accent },
  chatOfferLabel: { fontSize: fontSizes.xs, color: colors.gray400 },

  chatLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: spacing.md, paddingBottom: spacing.lg },
  chatEmpty: { alignItems: 'center', paddingVertical: spacing.xxl },
  chatEmptyText: { color: colors.textMuted, fontSize: fontSizes.sm, fontStyle: 'italic' },

  // Initial offer card at top of chat
  offerBubbleWrap: { marginBottom: spacing.md },
  offerBubble: {
    backgroundColor: colors.secondary + '15',
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  offerBubbleLabel: { fontSize: fontSizes.xs, color: colors.secondary, fontWeight: '700', marginBottom: 4 },
  offerBubbleAmount: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.secondary },
  offerBubbleMsg: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },

  // Chat bubbles
  bubbleWrap: { marginBottom: spacing.xs, maxWidth: '80%' },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
  bubbleSenderName: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: 2, marginLeft: spacing.xs },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: { backgroundColor: colors.accent },
  bubbleTheirs: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  bubbleTimeMine: { color: colors.white + 'AA' },

  // Input bar
  sendError: {
    backgroundColor: colors.error + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.error,
  },
  sendErrorText: { color: colors.error, fontSize: fontSizes.xs, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.bgLight,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.gray200 },
  sendBtnText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '800' },
});
