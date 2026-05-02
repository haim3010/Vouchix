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
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useMessagesStore, Conversation, ChatMessage } from '@/lib/stores/messagesStore';
import { useMarketplaceStore } from '@/lib/stores/marketplaceStore';
import UserProfileModal from '@/components/UserProfileModal';
import RatingModal from '@/components/RatingModal';
import AppHeader from '@/components/AppHeader';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import { useT } from '@/lib/i18n';
import { sendTestBuyerReply, getTestBuyerId } from '@/lib/utils/testBuyer';

const STATUS_COLOR: Record<string, string> = {
  pending:   colors.warning,
  accepted:  colors.success,
  rejected:  colors.error,
  cancelled: colors.textMuted,
  completed: colors.secondary,
};

export default function MessagesScreen() {
  const { user } = useAuthStore();
  const {
    conversations, currentMessages, currentConversation,
    loadingConversations, loadingMessages, sending,
    fetchConversations, openConversation, closeConversation,
    sendMessage, subscribeToMessages, subscribeToOffers,
    updateConversationStatus, updateConversationAmount, deleteConversation,
  } = useMessagesStore();
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const { completeOffer, cancelOffer, counterOffer, respondToOffer } = useMarketplaceStore();

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterRole, setCounterRole] = useState<'buyer' | 'seller'>('buyer');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ userId: string; name: string } | null>(null);
  const t = useT();
  const statusLabel: Record<string, string> = {
    pending: t('statusPending'),
    accepted: t('statusAccepted'),
    rejected: t('statusRejected'),
    cancelled: t('statusCancelled'),
    completed: t('statusCompleted'),
  };

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => {
    if (user?.id) fetchConversations(user.id);
  }, [user?.id, fetchConversations]);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Realtime: auto-refresh conversations when any offer changes
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToOffers(user.id);
    return unsub;
  }, [user?.id]);

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
      // If the other party is the test buyer, schedule an auto-reply
      const tbId = await getTestBuyerId();
      if (tbId && tbId === currentConversation.other_user_id) {
        const offerId = currentConversation.offer_id;
        setTimeout(() => { sendTestBuyerReply(offerId).catch(() => {}); }, 1500);
      }
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
      setShowCompleteConfirm(false);
      // Trigger rating modal — seller rates the buyer
      setRatingTarget({
        userId: currentConversation.other_user_id,
        name:   currentConversation.other_user_name,
      });
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

  async function handleAccept() {
    if (!currentConversation) return;
    setActionError('');
    setActionLoading(true);
    try {
      await respondToOffer(currentConversation.offer_id, 'accepted');
      updateConversationStatus(currentConversation.offer_id, 'accepted');
      // Send a system message so the buyer sees the good news
      await sendMessage(
        currentConversation.offer_id,
        user!.id,
        `✅ Offer accepted! Payment of ${formatCurrency(currentConversation.offer_amount)} has been agreed. Proceed to payment to complete the deal.`
      );
    } catch {
      setActionError('Failed to accept offer. Try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!currentConversation) return;
    setActionError('');
    setActionLoading(true);
    try {
      await respondToOffer(currentConversation.offer_id, 'rejected');
      updateConversationStatus(currentConversation.offer_id, 'rejected');
      await sendMessage(
        currentConversation.offer_id,
        user!.id,
        `❌ Offer declined. Feel free to send a new offer if you'd like to negotiate.`
      );
    } catch {
      setActionError('Failed to reject offer. Try again.');
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
      const prevAmount = formatCurrency(currentConversation.offer_amount);
      const label = counterRole === 'seller'
        ? `💰 Counter from seller: I'd accept ${formatCurrency(amount)} (was ${prevAmount})`
        : `💰 Counter offer: ${formatCurrency(amount)} (updated from ${prevAmount})`;
      await sendMessage(currentConversation.offer_id, user!.id, label);
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
    setCounterRole('buyer');
    setShowCompleteConfirm(false);
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
              {item.last_message ?? item.offer_message ?? t('noMessagesYet')}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {statusLabel[item.offer_status] ?? item.offer_status}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); setDeleteTarget(item); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Text style={{ fontSize: 18 }}>🗑</Text>
        </TouchableOpacity>
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
    const isPending   = conv.offer_status === 'pending';
    const isAccepted  = conv.offer_status === 'accepted';
    // What each role can do while pending
    const sellerCanAct  = isPending && conv.is_seller;   // accept, counter, decline
    const buyerCanAct   = isPending && !conv.is_seller;  // counter, cancel
    const canComplete   = isAccepted && conv.is_seller;
    const showActions   = sellerCanAct || buyerCanAct || canComplete;

    return (
      <View>
        {/* Offer summary card */}
        <View style={styles.offerSummaryCard}>
          <View style={styles.offerSummaryLeft}>
            <Text style={styles.offerSummaryBrand}>{conv.voucher_brand}</Text>
            <Text style={styles.offerSummaryFace}>Face value {formatCurrency(conv.voucher_original_value)}</Text>
            {/* Cash component */}
            {conv.offer_amount > 0 && (
              <Text style={styles.offerSummaryAmount}>💰 {formatCurrency(conv.offer_amount)}</Text>
            )}
            {/* Trade component */}
            {conv.trade_brand && (
              <View style={styles.tradePillInChat}>
                <Text style={styles.tradePillInChatText}>
                  🔄 Trade: {conv.trade_brand} ({formatCurrency(conv.trade_value ?? 0)} value)
                </Text>
              </View>
            )}
            {conv.offer_message ? (
              <Text style={styles.offerSummaryMsg} numberOfLines={2}>{conv.offer_message}</Text>
            ) : null}
          </View>
          <View style={styles.offerSummaryRight}>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {statusLabel[conv.offer_status]}
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

        {/* ── Counter-offer input (buyer OR seller) ── */}
        {showCounterInput && (
          <View style={styles.counterInputWrap}>
            <Text style={styles.counterInputLabel}>
              {counterRole === 'seller' ? '↩ Your counter price' : '↩ Your new offer amount'}
            </Text>
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

        {/* ── Complete confirmation card (low-price warning) ── */}
        {showCompleteConfirm && canComplete && (
          <View style={styles.completeConfirmCard}>
            {conv.offer_amount < conv.voucher_original_value && (
              <View style={styles.lowPriceWarning}>
                <Text style={styles.lowPriceWarningText}>
                  ⚠ This offer ({formatCurrency(conv.offer_amount)}) is below the face value
                  ({formatCurrency(conv.voucher_original_value)}).
                  Make sure you've received your payment before completing.
                </Text>
              </View>
            )}
            <Text style={styles.completeConfirmTitle}>Complete this deal?</Text>
            <Text style={styles.completeConfirmSub}>
              Final amount: <Text style={{ fontWeight: '800', color: colors.success }}>{formatCurrency(conv.offer_amount)}</Text>
              {conv.trade_brand ? ` + 🔄 ${conv.trade_brand}` : ''}
            </Text>
            <View style={styles.offerActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderColor: colors.border, flex: 0.8 }]}
                onPress={() => setShowCompleteConfirm(false)}
              >
                <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnComplete, { flex: 1.2 }]}
                onPress={handleComplete}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.actionBtnText}>✓ Yes, Complete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Offer actions ── */}
        {showActions && !showCounterInput && !showCompleteConfirm && (
          <View>
            {/* ── SELLER: pending offer ── */}
            {sellerCanAct && (
              <View style={styles.sellerPendingBanner}>
                <Text style={styles.sellerPendingTitle}>📨 New offer received</Text>
                <Text style={styles.sellerPendingSubtitle}>
                  <Text style={{ fontWeight: '700' }}>{conv.other_user_name}</Text> offered{' '}
                  <Text style={{ fontWeight: '700', color: colors.success }}>{formatCurrency(conv.offer_amount)}</Text>
                  {conv.trade_brand ? ` + 🔄 ${conv.trade_brand}` : ''} for your{' '}
                  <Text style={{ fontWeight: '700' }}>{conv.voucher_brand}</Text> voucher.{'\n'}
                  Chat to negotiate, then close the deal below.
                </Text>
                <View style={styles.offerActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnComplete, { flex: 1.2 }]}
                    onPress={handleAccept}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? <ActivityIndicator color={colors.white} size="small" />
                      : <Text style={styles.actionBtnText}>✓ Accept</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnCounter, { flex: 1.2 }]}
                    onPress={() => {
                      setCounterRole('seller');
                      setCounterAmount(String(conv.offer_amount));
                      setShowCounterInput(true);
                      setActionError('');
                    }}
                    disabled={actionLoading}
                  >
                    <Text style={styles.actionBtnText}>↩ Counter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnCancel, { flex: 0.8 }]}
                    onPress={handleReject}
                    disabled={actionLoading}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── SELLER: accepted — mark complete ── */}
            {canComplete && (
              <View style={styles.offerActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnComplete, { flex: 1 }]}
                  onPress={() => { setActionError(''); setShowCompleteConfirm(true); }}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionBtnText}>✓ Mark as Completed</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── BUYER: pending ── */}
            {buyerCanAct && (
              <View style={styles.offerActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnCounter, { flex: 1.3 }]}
                  onPress={() => {
                    setCounterRole('buyer');
                    setCounterAmount(String(conv.offer_amount));
                    setShowCounterInput(true);
                    setActionError('');
                  }}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionBtnText}>↩ Update My Offer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnCancel, { flex: 0.9 }]}
                  onPress={handleCancel}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? <ActivityIndicator color={colors.error} size="small" />
                    : <Text style={[styles.actionBtnText, { color: colors.error }]}>✕ Cancel</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── PAY NOW button (buyer, accepted offer, no active transaction) ── */}
        {conv.offer_status === 'accepted' && !conv.is_seller && (
          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={() => router.push(`/offer/make?offerId=${conv.offer_id}`)}
          >
            <Text style={styles.payNowBtnText}>💳 Pay Now — Complete the Deal</Text>
          </TouchableOpacity>
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
      <AppHeader subtitle={t('offersSubtitle')} />
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('offersTitle')}</Text>
        <Text style={styles.pageSubtitle}>
          {conversations.length} {conversations.length === 1 ? t('activeDealLabel') : t('activeDealsLabel')}
        </Text>
      </View>

      {loadingConversations && conversations.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.emptyTitle}>No active offers</Text>
          <Text style={styles.emptySubtitle}>
            Make an offer on the Market, or list a voucher to receive offers here.
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
          {renderSection(t('myPurchases'), '🛒', purchases)}
          {renderSection(t('mySales'), '🏷️', sales)}
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

      {/* ══ RATING MODAL — opens after deal completion ══ */}
      <RatingModal
        visible={!!ratingTarget}
        partnerUserId={ratingTarget?.userId ?? ''}
        partnerName={ratingTarget?.name ?? ''}
        onClose={() => setRatingTarget(null)}
      />

      {/* ══ DELETE CONVERSATION CONFIRM ══ */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmCardTitle}>{t('removeFromHistory')}</Text>
            <Text style={styles.confirmCardSub}>
              {deleteTarget?.other_user_name} · {deleteTarget?.voucher_brand}
            </Text>
            <View style={styles.confirmCardBtns}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setDeleteTarget(null)}
                disabled={deletingConv}
              >
                <Text style={styles.confirmCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={async () => {
                  if (!deleteTarget) return;
                  setDeletingConv(true);
                  try {
                    await deleteConversation(deleteTarget.offer_id);
                    setDeleteTarget(null);
                  } catch (e) {
                    setActionError(e instanceof Error ? e.message : 'Delete failed');
                  } finally {
                    setDeletingConv(false);
                  }
                }}
                disabled={deletingConv}
              >
                <Text style={styles.confirmDeleteText}>
                  {deletingConv ? t('deleting') : t('delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  confirmCard: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 320 },
  confirmCardTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  confirmCardSub: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  confirmCardBtns: { flexDirection: 'row', gap: spacing.sm },
  confirmCancelBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  confirmCancelText: { color: colors.textMuted, fontWeight: '600' },
  confirmDeleteBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.error, alignItems: 'center' },
  confirmDeleteText: { color: colors.white, fontWeight: '700' },

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
  offerSummaryAmount: { fontSize: fontSizes.md, fontWeight: '800', color: colors.secondary, marginTop: 4 },
  tradePillInChat: {
    marginTop: 4,
    backgroundColor: '#FFF3CD',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  tradePillInChatText: { fontSize: fontSizes.xs, fontWeight: '700', color: '#B8860B' },

  // Seller pending offer banner
  sellerPendingBanner: {
    backgroundColor: colors.warning + '18',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sellerPendingTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.text },
  sellerPendingSubtitle: { fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },

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

  // Complete confirmation
  completeConfirmCard: {
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  completeConfirmTitle: { fontSize: fontSizes.md, fontWeight: '800', color: colors.text },
  completeConfirmSub: { fontSize: fontSizes.sm, color: colors.textMuted },
  lowPriceWarning: {
    backgroundColor: colors.error + '15',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  lowPriceWarningText: { color: colors.error, fontSize: fontSizes.xs, fontWeight: '600', lineHeight: 18 },

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

  // Pay Now button
  payNowBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  payNowBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },

  // Closed offer banner
  closedBanner: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closedBannerText: { fontSize: fontSizes.sm, fontWeight: '700' },
});
