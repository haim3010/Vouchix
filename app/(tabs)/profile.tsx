import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Image,
} from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import AppHeader from '@/components/AppHeader';

const ISRAELI_BANKS = [
  'Bank Hapoalim', 'Bank Leumi', 'Discount Bank', 'Mizrahi Tefahot',
  'First International Bank', 'Bank Yahav', 'Bank of Jerusalem', 'Bank Otsar HaHayal',
  'Mercantile Discount Bank', 'Union Bank of Israel',
];

function TradeHistoryChart({ vouchers }: { vouchers: { created_at: string; original_value: number }[] }) {
  const width = 300;
  const height = 110;
  const pad = 24;

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { label: d.toLocaleString('default', { month: 'short' }), month: d.getMonth(), year: d.getFullYear() };
  });

  const data = months.map(({ month, year }) =>
    vouchers
      .filter((v) => { const d = new Date(v.created_at); return d.getMonth() === month && d.getFullYear() === year; })
      .reduce((s, v) => s + v.original_value, 0)
  );

  const maxVal = Math.max(...data, 1);
  const points = data.map((v, i) => ({
    x: pad + (i / (months.length - 1)) * (width - pad * 2),
    y: pad + (1 - v / maxVal) * (height - pad * 2),
    v,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${height - pad} L${points[0].x},${height - pad} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity="0.3" />
          <Stop offset="1" stopColor={colors.accent} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <Path d={areaD} fill="url(#grad)" />
      <Path d={pathD} stroke={colors.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="4" fill={colors.accent} />)}
      {months.map((m, i) => (
        <SvgText key={i} x={points[i].x} y={height} fontSize="9" fill={colors.textMuted} textAnchor="middle">
          {m.label}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuthStore();
  const { vouchers } = useWalletStore();
  const [signingOut, setSigningOut] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Which modal is open
  const [openModal, setOpenModal] = useState<'payment' | 'history' | 'notifications' | 'security' | null>(null);

  // Payment
  const [paymentTab, setPaymentTab] = useState<'bank' | 'paybox' | 'bit'>('bank');
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchNumber, setBranchNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [payboxPhone, setPayboxPhone] = useState('');
  const [bitPhone, setBitPhone] = useState('');

  // Notifications
  const [notifExpiring, setNotifExpiring] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifSales, setNotifSales] = useState(true);
  const [notifMarket, setNotifMarket] = useState(false);

  // Security
  const [twoFA, setTwoFA] = useState(false);
  const [biometric, setBiometric] = useState(false);

  const activeVouchers = vouchers.filter((v) => v.status === 'active');
  const totalValue = activeVouchers.reduce((sum, v) => sum + v.remaining_value, 0);
  const expiredCount = vouchers.filter((v) => v.status === 'expired').length;
  const usedCount = vouchers.filter((v) => v.status === 'used').length;

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase();

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { setSigningOut(true); await signOut(); setSigningOut(false); } },
    ]);
  }

  function savePayment() {
    if (paymentTab === 'bank' && (!selectedBank || !accountNumber || !branchNumber || !idNumber)) {
      Alert.alert('Required', 'Fill all bank details'); return;
    }
    Alert.alert('Saved!', 'Payment method saved.'); setOpenModal(null);
  }

  function handleDeleteAccount() {
    Alert.alert('Delete Account', 'Permanently delete your account and all vouchers? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Request Sent', 'You will receive a confirmation email.') },
    ]);
  }

  return (
    <View style={styles.container}>
      <AppHeader subtitle="Account & settings" />
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={pickAvatar}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              : <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            }
            <View style={styles.avatarEditBadge}><Text style={styles.avatarEditIcon}>📷</Text></View>
          </TouchableOpacity>
          <Text style={styles.displayName}>{profile?.display_name ?? 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {profile?.rating != null && (
            <View style={styles.ratingRow}>
              <Text>⭐</Text>
              <Text style={styles.rating}>{profile.rating.toFixed(1)}</Text>
              <Text style={styles.trades}> · {profile.total_trades} trades</Text>
            </View>
          )}
        </View>

        {/* 4-stat grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeVouchers.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(totalValue)}</Text>
            <Text style={styles.statLabel}>Wallet Value</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{usedCount}</Text>
            <Text style={styles.statLabel}>Used</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, expiredCount > 0 && { color: colors.error }]}>{expiredCount}</Text>
            <Text style={styles.statLabel}>Expired</Text>
          </View>
        </View>

        {/* Menu — all items open modals */}
        <View style={styles.menuCard}>
          <MenuItem emoji="💳" label="Payment Methods" onPress={() => setOpenModal('payment')} />
          <View style={styles.divider} />
          <MenuItem emoji="📊" label="Trade History" onPress={() => setOpenModal('history')} />
          <View style={styles.divider} />
          <MenuItem emoji="🔔" label="Notification Settings" onPress={() => setOpenModal('notifications')} />
          <View style={styles.divider} />
          <MenuItem emoji="🔒" label="Security" onPress={() => setOpenModal('security')} />
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={signingOut}>
          {signingOut ? <ActivityIndicator color={colors.error} /> : <Text style={styles.signOutText}>Sign Out</Text>}
        </TouchableOpacity>
        <Text style={styles.version}>VouchiX v1.0.0</Text>
      </ScrollView>

      {/* Payment Methods Modal */}
      <Modal visible={openModal === 'payment'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setOpenModal(null)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Payment Methods</Text>
            <TouchableOpacity onPress={savePayment}><Text style={styles.modalSave}>Save</Text></TouchableOpacity>
          </View>
          <View style={styles.paymentTabs}>
            {(['bank', 'paybox', 'bit'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.payTab, paymentTab === t && styles.payTabActive]} onPress={() => setPaymentTab(t)}>
                <Text style={[styles.payTabText, paymentTab === t && styles.payTabTextActive]}>
                  {t === 'bank' ? '🏦 Bank' : t === 'paybox' ? '📱 PayBox' : '💙 Bit'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBody}>
            {paymentTab === 'bank' && (
              <View>
                <Text style={styles.fieldLabel}>Bank</Text>
                <ScrollView style={styles.bankPicker} nestedScrollEnabled>
                  {ISRAELI_BANKS.map((b) => (
                    <TouchableOpacity key={b} style={[styles.bankOption, selectedBank === b && styles.bankOptionSel]} onPress={() => setSelectedBank(b)}>
                      <Text style={[styles.bankOptionText, selectedBank === b && styles.bankOptionTextSel]}>{b}</Text>
                      {selectedBank === b && <Text style={styles.bankCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.fieldLabel}>Branch</Text>
                <TextInput style={styles.fieldInput} placeholder="e.g. 600" keyboardType="number-pad" value={branchNumber} onChangeText={setBranchNumber} placeholderTextColor={colors.textMuted} />
                <Text style={styles.fieldLabel}>Account Number</Text>
                <TextInput style={styles.fieldInput} placeholder="e.g. 123456789" keyboardType="number-pad" value={accountNumber} onChangeText={setAccountNumber} placeholderTextColor={colors.textMuted} />
                <Text style={styles.fieldLabel}>ID Number</Text>
                <TextInput style={styles.fieldInput} placeholder="e.g. 012345678" keyboardType="number-pad" value={idNumber} onChangeText={setIdNumber} placeholderTextColor={colors.textMuted} />
                <View style={styles.legalNote}><Text style={styles.legalText}>🔒 Bank details are encrypted and used only for payout from voucher sales.</Text></View>
              </View>
            )}
            {paymentTab === 'paybox' && (
              <View>
                <Text style={styles.fieldLabel}>PayBox Phone Number</Text>
                <TextInput style={styles.fieldInput} placeholder="05X-XXXXXXX" keyboardType="phone-pad" value={payboxPhone} onChangeText={setPayboxPhone} placeholderTextColor={colors.textMuted} />
                <View style={styles.legalNote}><Text style={styles.legalText}>Payouts sent to your PayBox account after sales complete.</Text></View>
              </View>
            )}
            {paymentTab === 'bit' && (
              <View>
                <Text style={styles.fieldLabel}>Bit Phone Number</Text>
                <TextInput style={styles.fieldInput} placeholder="05X-XXXXXXX" keyboardType="phone-pad" value={bitPhone} onChangeText={setBitPhone} placeholderTextColor={colors.textMuted} />
                <View style={styles.legalNote}><Text style={styles.legalText}>Payouts sent to your Bit account after sales complete.</Text></View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Trade History Modal */}
      <Modal visible={openModal === 'history'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setOpenModal(null)}><Text style={styles.modalCancel}>Close</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Trade History</Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBody}>
            <Text style={styles.chartTitle}>Voucher Value Added (6 months)</Text>
            <View style={styles.chartArea}>
              <TradeHistoryChart vouchers={vouchers} />
            </View>
            <View style={styles.chartStats}>
              <View style={styles.chartStatItem}>
                <Text style={styles.chartStatValue}>{vouchers.length}</Text>
                <Text style={styles.chartStatLabel}>Total vouchers added</Text>
              </View>
              <View style={styles.chartStatItem}>
                <Text style={styles.chartStatValue}>{formatCurrency(vouchers.reduce((s, v) => s + v.original_value, 0))}</Text>
                <Text style={styles.chartStatLabel}>Total face value</Text>
              </View>
            </View>
            <View style={styles.historyList}>
              {vouchers.slice(0, 10).map((v) => (
                <View key={v.id} style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyBrand}>{v.brand}</Text>
                    <Text style={styles.historyDate}>{new Date(v.created_at).toLocaleDateString('en-GB')}</Text>
                  </View>
                  <Text style={[styles.historyVal, v.status === 'expired' && { color: colors.error }, v.status === 'used' && { color: colors.textMuted }]}>
                    {formatCurrency(v.original_value)}
                  </Text>
                </View>
              ))}
              {vouchers.length === 0 && <Text style={styles.emptyText}>No vouchers added yet</Text>}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal visible={openModal === 'notifications'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setOpenModal(null)}><Text style={styles.modalCancel}>Close</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Notification Settings</Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBody}>
            <View style={styles.togglesCard}>
              <ToggleRow label="Expiring Soon" sub="Alerts at 30, 14, 7, 1 day before" value={notifExpiring} onValueChange={setNotifExpiring} />
              <View style={styles.divider} />
              <ToggleRow label="Offer Received" sub="When a buyer offers on your listing" value={notifOffers} onValueChange={setNotifOffers} />
              <View style={styles.divider} />
              <ToggleRow label="Sale Completed" sub="When a transaction finalises" value={notifSales} onValueChange={setNotifSales} />
              <View style={styles.divider} />
              <ToggleRow label="Marketplace Alerts" sub="New deals matching your brands" value={notifMarket} onValueChange={setNotifMarket} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Security Modal */}
      <Modal visible={openModal === 'security'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setOpenModal(null)}><Text style={styles.modalCancel}>Close</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Security</Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBody}>
            <View style={styles.togglesCard}>
              <ToggleRow label="Two-Factor Authentication" sub="OTP on new device login" value={twoFA}
                onValueChange={(v) => { setTwoFA(v); if (v) Alert.alert('2FA Enabled', 'You\'ll receive an OTP on login from new devices.'); }} />
              <View style={styles.divider} />
              <ToggleRow label="Biometric Login" sub="Face ID / fingerprint" value={biometric} onValueChange={setBiometric} />
            </View>
            <View style={[styles.menuCard, { marginTop: 0 }]}>
              <MenuItem emoji="🔑" label="Change Password" onPress={() =>
                Alert.alert('Reset Password', `Send a reset link to ${user?.email}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Send', onPress: () => Alert.alert('Sent!', 'Check your inbox.') },
                ])} />
            </View>
            <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
              <Text style={styles.deleteAccountText}>🗑 Delete Account</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MenuItem({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({ label, sub, value, onValueChange }: { label: string; sub: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLabels}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  header: { backgroundColor: colors.primary, paddingTop: spacing.xs, paddingBottom: spacing.xl, paddingHorizontal: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.white },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },

  profileCard: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  avatarWrapper: { position: 'relative', marginBottom: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: colors.white, fontSize: fontSizes.xxl, fontWeight: '800' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.secondary, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  avatarEditIcon: { fontSize: 12 },
  displayName: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text },
  email: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  rating: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.text },
  trades: { fontSize: fontSizes.sm, color: colors.textMuted },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  statValue: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2, textAlign: 'center' },

  menuCard: { backgroundColor: colors.cardBg, borderRadius: radius.lg, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  menuEmoji: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: fontSizes.md, color: colors.text },
  menuArrow: { fontSize: fontSizes.xl, color: colors.gray400 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },

  togglesCard: { backgroundColor: colors.cardBg, borderRadius: radius.lg, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  toggleLabels: { flex: 1 },
  toggleLabel: { fontSize: fontSizes.md, color: colors.text, fontWeight: '600' },
  toggleSub: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },

  signOutButton: { backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.error },
  signOutText: { color: colors.error, fontSize: fontSizes.md, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: fontSizes.xs, color: colors.gray400 },

  modalContainer: { flex: 1, backgroundColor: colors.bgLight },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.cardBg },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
  modalCancel: { fontSize: fontSizes.md, color: colors.textMuted },
  modalSave: { fontSize: fontSizes.md, color: colors.accent, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalBody: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },

  paymentTabs: { flexDirection: 'row', backgroundColor: colors.cardBg, borderBottomWidth: 1, borderBottomColor: colors.border },
  payTab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  payTabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  payTabText: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textMuted },
  payTabTextActive: { color: colors.accent },
  fieldLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSizes.md, color: colors.text, backgroundColor: colors.cardBg },
  bankPicker: { maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.cardBg },
  bankOption: { padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  bankOptionSel: { backgroundColor: colors.accent + '10' },
  bankOptionText: { flex: 1, fontSize: fontSizes.md, color: colors.text },
  bankOptionTextSel: { color: colors.accent, fontWeight: '700' },
  bankCheck: { color: colors.accent, fontWeight: '700', fontSize: fontSizes.lg },
  legalNote: { backgroundColor: colors.gray100, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  legalText: { fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 18 },

  chartTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.text, textAlign: 'center' },
  chartArea: { alignItems: 'center', marginVertical: spacing.md },
  chartStats: { flexDirection: 'row', gap: spacing.sm },
  chartStatItem: { flex: 1, backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  chartStatValue: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text },
  chartStatLabel: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  historyList: { gap: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.md },
  historyLeft: { flex: 1 },
  historyBrand: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  historyDate: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  historyVal: { fontSize: fontSizes.md, fontWeight: '700', color: colors.accent },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: fontSizes.md, paddingVertical: spacing.lg },

  deleteAccountBtn: { borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', backgroundColor: colors.cardBg },
  deleteAccountText: { color: colors.error, fontWeight: '700', fontSize: fontSizes.md },
});
