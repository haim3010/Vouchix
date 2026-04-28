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
  ScrollView,
} from 'react-native';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useMessagesStore, Conversation, ChatMessage } from '@/lib/stores/messagesStore';
import { useMarketplaceStore } from '@/lib/stores/marketplaceStore';
import UserProfileModal from '@/components/UserProfileModal';
import AppHeader from '@/components/AppHeader';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';

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
    sendMessage, subscribeToMessages, updateConversationStatus, updateConversationAmount,
  } = useMessagesStore();
  const { completeOffer, cancelOffer, counterOffer } = useMarketplaceStore();

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');

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
    return () => { unsubRef.current?.(); unsubRef.current = null; };
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
      setDraft(text);
    }
  }

  async function handleComplete() {
    if (!currentConversation) return;
    setActionError('');
    setActionLoading(true);
    try {
      await completeOffer(currentConversation.offer_id);
      updateConversationStatus(currentConversation.offer_id, 'completed');
    } catch {
      setActionError('Failed to mark as completed. Try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!currentConversation) return;
    setActionError('');
    setActionLoading(true);
    try {
      await cancelOffer(currentConversation.offer_id);
      updateConversationStatus(currentConversation.offer_id, 'cancelled');
    } catch {
      setActionError('Failed to cancel offer. Try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCounter() {
    if (!currentConversation) return;
    const amount = parseFloat(counterAmount.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      setActionError('Please enter a valid amount.');
      return;
    }
    setActionError('');
    setActionLoading(true);
    try {
      await counterOffer(currentConversation.offer_id, amount);
      updateConversationAmount(currentConversation.offer_id, amount);
      // Send a chat message so the seller sees the updated price
      await sendMessage(
        currentConversation.offer_id,
        user!.id,
        `💰 Counter offer: ${formatCurrency(amount)} (updated from ${formatCurrency(currentConversation.offer_amount)})`
      );
      setShowCounterInput(false);
      setCounterAmount('');
    } catch {
      setActionError('Failed to send counter offer. Try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleClose() {
    unsubRef.current?.();
    unsubRef.current = null;
    closeConversation();
    setDraft('');
    setSendError('');
    setActionError('');
    setShowCounterInput(false);
    setCounterAmount('');
  }

  // ── Split conversations by role ──────────────────────────────────────────
  const purchases = conversations.filter((c) => !c.is_seller);  // I made the offer
  const sales     = conversations.filter((c) => c.is_seller);   // I received the offer

  // ── Render a single conversation card ────────────────────────────────────
  function renderConversation(item: Conversation) {
    const initials = item.other_user_name.slice(0, 2).toUpperCase();
    const statusColor = STATUS_COLOR[item.offer_status] ?? colors.textMuted;
    return (
      <TouchableOpacity
        key={item.offer_id}
        style={styles.convCard}
        onPress={() => openConversation(item)}
        activeOpacity={0.8}
      >
        <TouchableOpacity
          style={[styles.avatar, { backgroundColor: statusColor + '30' }]}
          onPress={() => setProfileUserId(item.other_user_id)}
        >
          <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
        </TouchableOpacity>
        <View style={styles.convBody}>
          <View style={styles.convTopRow}>
            <TouchableOpacity onPress={() => setProfileUserId(item.other_user_id)}>
              <Text style={styles.convName}>{item.other_user_name}</Text>
            </TouchableOpacity>
            {item.last_message_at && (
              <Text style={styles.convTime}>
                {new Date(item.last_message_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </Text>
            )}
          </View>
          <Text style={styles.convVoucher}>
            {item.voucher_brand} · {formatCurrency(item.voucher_original_value)}
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

  // ── Section with header ────────────────────────────────────────────────────
  function renderSection(title: string, emoji: string, items: Conversation[]) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEmoji}>{emoji}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{items.length}</Text>
          </View>
        </View>
        {items.length === 0 ? (
          <View style={styles.sectionEmpty}>
            <Text style={styles.sectionEmptyText}>No {title.toLowerCase()} yet</Text>
          </View>
        ) : (
          items.map((item) => renderConversation(item))
        )}
      </View>
    );
  }

  // ── Chat bubble ────────────────────────────────────────────────────────────
  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
    const isMine = item.sender_id === user?.id;
    const prevItem = currentMessages[index - 1];
    const showName = !isMine && (!prevItem || prevItem.sender_id !== item.sender_id);
    return (
      <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
        {showName && (
          <Text style={styles.bubbleSenderName}>
            {item.sender?.display_name ?? 'Them'}
          </Text>
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

  // ── Offer summary banner at top of chat ───────────────────────────────────
  function renderChatHeader(conv: Conversation) {
    const statusColor = STATUS_COLOR[conv.offer_status] ?? colors.textMuted;
    // Only the SELLER can complete (they hand over the voucher)
    const canComplete = conv.offer_status === 'accepted' && conv.is_seller;
    // Only the BUYER can counter-offer or cancel on a pending offer
    const canCounter  = conv.offer_status === 'pending' && !conv.is_seller;
    const canCancel   = conv.offer_status === 'pending' && !conv.is_seller;
    const showActions = canComplete || canCounter || canCancel;

    return (
      <View>
        {/* Offer summary card */}
        <View style={styles.offerSummaryCard}>
          <View style={styles.offerSummaryLeft}>
            <Text style={styles.offerSummaryBrand}>{conv.voucher_brand}</Text>
            <Text style={styles.offerSummaryFace}>Face value {formatCurrency(conv.voucher_original_value)}</Text>
            {conv.offer_message ? (
              <Text style={styles.offerSummaryMsg} numberOfLines={2}>{conv.offer_message}</Text>
            ) : null}
          </View>
          <View style={styles.offerSummaryRight}>
            <Text style={styles.offerSummaryAmount}>{formatCurrency(conv.offer_amount)}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {STATUS_LABEL[conv.offer_status]}
              </Text>
            </View>
          </View>
        </View>

        {/* Action error */}
        {actionError.length > 0 && (
          <View style={styles.actionError}>
            <Text style={styles.actionErrorText}>⚠ {actionError}</Text>
          </View>
        )}

        {/* ── Counter-offer input (buyer) ── */}
        {showCounterInput && canCounter && (
          <View style={styles.counterInputWrap}>
            <Text style={styles.counterInputLabel}>Your new offer amount</Text>
            <View style={styles.counterInputRow}>
              <TextInput
                style={styles.counterInput}
                placeholder={`e.g. ${conv.offer_amount}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={counterAmount}
                onChangeText={setCounterAmount}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.counterSendBtn, (!counterAmount.trim() || actionLoading) && styles.sendBtnDisabled]}
                onPress={handleCounter}
                disabled={!counterAmount.trim() || actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.counterSendBtnText}>Send</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.counterCancelBtn}
                onPress={() => { setShowCounterInput(false); setCounterAmount(''); setActionError(''); }}
              >
                <Text style={styles.counterCancelBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Offer actions ── */}
        {showActions && !showCounterInput && (
          <View style={styles.offerActions}>
            {/* SELLER: complete */}
            {canComplete && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnComplete]}
                onPress={handleComplete}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.actionBtnText}>✓ Mark as Completed</Text>}
              </TouchableOpacity>
            )}
            {/* BUYER: counter + cancel */}
            {canCounter && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCounter]}
                onPress={() => {
                  setCounterAmount(String(conv.offer_amount));
                  setShowCounterInput(true);
                  setActionError('');
                }}
                disabled={actionLoading}
              >
                <Text style={styles.actionBtnText}>↩ Counter Offer</Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCancel]}
                onPress={handleCancel}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color={colors.error} size="small" />
                  : <Text style={[styles.actionBtnText, { color: colors.error }]}>✕ Cancel</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Divider */}
        <View style={styles.chatDivider}>
          <View style={styles.chatDividerLine} />
          <Text style={styles.chatDividerText}>Conversation</Text>
          <View style={styles.chatDividerLine} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader subtitle="Your conversations" />
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Messages</Text>
        <Text style={styles.pageSubtitle}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {loadingConversations && conversations.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            When you make or receive an offer, the conversation will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={loadingConversations} onRefresh={refresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderSection('My Purchases', '🛒', purchases)}
          {renderSection('My Sales', '🏷️', sales)}
        </ScrollView>
      )}

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
          >
            {/* Chat header bar */}
            <View style={styles.chatHeaderBar}>
              <TouchableOpacity onPress={handleClose} style={styles.chatBackBtn}>
                <Text style={styles.chatBackText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatHeaderInfo}
                onPress={() => setProfileUserId(currentConversation.other_user_id)}
              >
                <View style={styles.chatHeaderAvatar}>
                  <Text style={styles.chatHeaderAvatarText}>
                    {currentConversation.other_user_name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.chatHeaderName}>{currentConversation.other_user_name}</Text>
                  <Text style={styles.chatHeaderSub}>
                    {currentConversation.is_seller ? 'Buyer' : 'Seller'} · Tap to view profile
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Messages list */}
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
                ListHeaderComponent={renderChatHeader(currentConversation)}
                ListEmptyComponent={
                  <View style={styles.chatEmpty}>
                    <Text style={styles.chatEmptyText}>No messages yet — say hello! 👋</Text>
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

            {/* Input bar — only show if offer is active */}
            {(currentConversation.offer_status === 'pending' ||
              currentConversation.offer_status === 'accepted') && (
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textMuted}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!draft.trim() || sending}
                >
                  {sending
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.sendBtnText}>↑</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Closed offer banner */}
            {(currentConversation.offer_status === 'completed' ||
              currentConversation.offer_status === 'cancelled' ||
              currentConversation.offer_status === 'rejected') && (
              <View style={[
                styles.closedBanner,
                currentConversation.offer_status === 'completed' && { backgroundColor: colors.success + '20' },
                currentConversation.offer_status !== 'completed' && { backgroundColor: colors.error + '15' },
              ]}>
                <Text style={[
                  styles.closedBannerText,
                  { color: currentConversation.offer_status === 'completed' ? colors.success : colors.error },
                ]}>
                  {currentConversation.offer_status === 'completed'
                    ? '✓ This deal is completed'
                    : currentConversation.offer_status === 'cancelled'
                    ? '✕ This offer was cancelled'
                    : '✕ This offer was rejected'}
                </Text>
              </View>
            )}
          </KeyboardAvoidingView>
        )}
      </Modal>

      {/* ══ USER PROFILE MODAL ══ */}
      <UserProfileModal
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
      />
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

  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // ── Sections ──
  section: { marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  sectionBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  sectionEmpty: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionEmptyText: { color: colors.textMuted, fontSize: fontSizes.sm, fontStyle: 'italic' },

  // ── Conversation cards ──
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

  // ── Chat modal ──
  chatContainer: { flex: 1, backgroundColor: colors.bgLight },
  chatHeaderBar: {
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
  chatHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatHeaderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center',
  },
  chatHeaderAvatarText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.sm },
  chatHeaderName: { fontSize: fontSizes.md, fontWeight: '800', color: colors.white },
  chatHeaderSub: { fontSize: fontSizes.xs, color: colors.gray400 },

  chatLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: spacing.md, paddingBottom: spacing.lg },
  chatEmpty: { alignItems: 'center', paddingVertical: spacing.xxl },
  chatEmptyText: { color: colors.textMuted, fontSize: fontSizes.sm, fontStyle: 'italic' },

  // Offer summary inside chat
  offerSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.secondary + '15',
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  offerSummaryLeft: { flex: 1 },
  offerSummaryBrand: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text },
  offerSummaryFace: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  offerSummaryMsg: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic' },
  offerSummaryRight: { alignItems: 'flex-end', gap: 4 },
  offerSummaryAmount: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.secondary },

  // Action buttons
  actionError: {
    backgroundColor: colors.error + '15',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionErrorText: { color: colors.error, fontSize: fontSizes.xs, fontWeight: '600' },
  offerActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnComplete: { backgroundColor: colors.success, borderColor: colors.success },
  actionBtnCancel: { backgroundColor: colors.cardBg, borderColor: colors.error },
  actionBtnCounter: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  actionBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },

  // Counter-offer input
  counterInputWrap: {
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  counterInputLabel: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.secondary },
  counterInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  counterInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.cardBg,
  },
  counterSendBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterSendBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },
  counterCancelBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterCancelBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: fontSizes.sm },

  // Divider
  chatDivider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  chatDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  chatDividerText: { fontSize: fontSizes.xs, color: colors.textMuted },

  // Chat bubbles
  bubbleWrap: { marginBottom: spacing.xs, maxWidth: '80%' },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
  bubbleSenderName: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: 2, marginLeft: spacing.xs },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.gray200 },
  sendBtnText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '800' },

  // Closed offer banner
  closedBanner: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closedBannerText: { fontSize: fontSizes.sm, fontWeight: '700' },
});
