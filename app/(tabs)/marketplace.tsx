import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEffect, useState, useMemo } from 'react';
import { useMarketplaceStore, ListingWithSeller } from '@/lib/stores/marketplaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWalletStore } from '@/lib/stores/walletStore';
import VoucherListing from '@/components/VoucherListing';
import AppHeader from '@/components/AppHeader';
import { colors, spacing, radius, fontSizes } from '@/lib/constants/theme';
import { formatCurrency } from '@/lib/utils/currency';
import { Voucher, VoucherClassification, CLASSIFICATION_LABELS } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────
type MarketMode = 'global' | 'my';
type ListingType = 'sell' | 'trade' | 'both';
type SortKey = 'discount' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
type ModeFilter = 'all' | 'sell' | 'trade';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'discount', label: '🏷️ Best Discount' },
  { key: 'newest', label: '🆕 Newest First' },
  { key: 'price_asc', label: '💰 Price: Low–High' },
  { key: 'price_desc', label: '💰 Price: High–Low' },
  { key: 'rating', label: '⭐ Seller Rating' },
];

const DISCOUNT_STEPS = [0, 5, 10, 15, 20, 30, 40];
const RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Any' },
  { value: 4, label: '4★+' },
  { value: 4.5, label: '4.5★+' },
  { value: 5, label: '5★ only' },
];

const CLASSIFICATION_OPTIONS: { value: VoucherClassification | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'credit', label: 'Credit' },
  { value: 'regular_voucher', label: 'Voucher' },
  { value: 'gift_card', label: 'Gift Card' },
  { value: 'voucher_group', label: 'Group' },
];

// ─── Helper: expiry check for listing flow ───────────────────────────────────
interface VoucherCheck { level: 'ok' | 'warn' | 'error'; message: string; }

function getExpiryCheck(voucher: Voucher): VoucherCheck {
  if (!voucher.expires_at) return { level: 'ok', message: '✓ No expiry date set' };
  const daysLeft = Math.ceil((new Date(voucher.expires_at).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return { level: 'error', message: 'This voucher has expired and cannot be published.' };
  if (daysLeft < 30) return { level: 'warn', message: `Only ${daysLeft} days until expiry — make sure the buyer is aware.` };
  if (daysLeft < 90) return { level: 'warn', message: `${daysLeft} days until expiry. Buyers may negotiate on this.` };
  return { level: 'ok', message: `✓ ${daysLeft} days until expiry — looks good.` };
}

function getTransferabilityInfo(voucher: Voucher): { label: string; level: 'ok' | 'warn' } {
  if (voucher.voucher_type === 'digital') return { label: '✓ Instant digital transfer', level: 'ok' };
  if (voucher.voucher_type === 'physical') return { label: '⚠ Requires physical handoff', level: 'warn' };
  return { label: '⚠ Verify transferability with the brand', level: 'warn' };
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function MarketplaceScreen() {
  const { user } = useAuthStore();
  const { listings, loading, fetchListings, makeOffer } = useMarketplaceStore();
  const { vouchers, updateVoucher, deleteVoucher, fetchVouchers } = useWalletStore();

  // ── Mode ──
  const [mode, setMode] = useState<MarketMode>('global');

  // ── Global Market filters ──
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeBrands, setActiveBrands] = useState<string[]>([]);
  const [filterClassification, setFilterClassification] = useState<VoucherClassification | 'all'>('all');
  const [filterMode, setFilterMode] = useState<ModeFilter>('all');
  const [filterMinDiscount, setFilterMinDiscount] = useState(0);
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [localSort, setLocalSort] = useState<SortKey>('discount');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // ── My Market ──
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);
  const [delistTarget, setDelistTarget] = useState<Voucher | null>(null);

  // ── Offer modal ──
  const [offerTarget, setOfferTarget] = useState<ListingWithSeller | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState('');

  // ── List voucher modal ──
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listStep, setListStep] = useState<1 | 2 | 3>(1);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [currentBalance, setCurrentBalance] = useState('');
  const [listingType, setListingType] = useState<ListingType>('sell');
  const [listPrice, setListPrice] = useState('');
  const [tradeWanted, setTradeWanted] = useState('');
  const [negotiable, setNegotiable] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  // ── Edit listing modal ──
  const [editTarget, setEditTarget] = useState<Voucher | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => { fetchListings(); }, []);

  // ── Derived: wallet lists ──
  const myListings = vouchers.filter((v) => v.is_listed && v.status === 'active');
  const unlistedVouchers = vouchers.filter((v) => !v.is_listed && v.status === 'active');

  // ── Derived: dynamic brand chips from actual listings ──
  const availableBrands = useMemo(
    () => [...new Set(listings.map((l) => l.brand))].sort(),
    [listings],
  );

  // ── Derived: filtered + sorted global listings ──
  const globalFiltered = useMemo(() => {
    let result = [...listings];

    // Text search
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      result = result.filter(
        (l) =>
          l.brand.toLowerCase().includes(q) ||
          (l.voucher_type ?? '').toLowerCase().includes(q) ||
          (l.classification ?? '').replace(/_/g, ' ').includes(q),
      );
    }

    // Brand chips (multi-select)
    if (activeBrands.length > 0) {
      result = result.filter((l) => activeBrands.includes(l.brand));
    }

    // Voucher classification
    if (filterClassification !== 'all') {
      result = result.filter((l) => l.classification === filterClassification);
    }

    // Transaction mode
    if (filterMode === 'sell') result = result.filter((l) => l.listing_price !== null);
    if (filterMode === 'trade') result = result.filter((l) => l.listing_price === null);

    // Minimum discount
    if (filterMinDiscount > 0) {
      result = result.filter((l) => {
        if (!l.listing_price) return false;
        const disc = ((l.original_value - l.listing_price) / l.original_value) * 100;
        return disc >= filterMinDiscount;
      });
    }

    // Minimum seller rating
    if (filterMinRating > 0) {
      result = result.filter((l) => (l.seller?.rating ?? 0) >= filterMinRating);
    }

    // Sort
    result.sort((a, b) => {
      switch (localSort) {
        case 'discount': {
          const dA = a.listing_price ? (a.original_value - a.listing_price) / a.original_value : 0;
          const dB = b.listing_price ? (b.original_value - b.listing_price) / b.original_value : 0;
          return dB - dA;
        }
        case 'price_asc': return (a.listing_price ?? Infinity) - (b.listing_price ?? Infinity);
        case 'price_desc': return (b.listing_price ?? 0) - (a.listing_price ?? 0);
        case 'rating': return (b.seller?.rating ?? 0) - (a.seller?.rating ?? 0);
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: return 0;
      }
    });

    return result;
  }, [listings, globalSearch, activeBrands, filterClassification, filterMode, filterMinDiscount, filterMinRating, localSort]);

  // ── Active filter count ──
  const activeFilterCount = [
    filterClassification !== 'all',
    filterMode !== 'all',
    filterMinDiscount > 0,
    filterMinRating > 0,
    activeBrands.length > 0,
  ].filter(Boolean).length;

  // ── Reset all global filters ──
  function resetFilters() {
    setGlobalSearch('');
    setActiveBrands([]);
    setFilterClassification('all');
    setFilterMode('all');
    setFilterMinDiscount(0);
    setFilterMinRating(0);
  }

  // ── Listing flow helpers ──
  const expiryCheck = selectedVoucher ? getExpiryCheck(selectedVoucher) : null;
  const balanceNum = currentBalance ? parseFloat(currentBalance) : (selectedVoucher?.remaining_value ?? 0);
  const isLowBalance = selectedVoucher && balanceNum < selectedVoucher.original_value * 0.2;
  const transferInfo = selectedVoucher ? getTransferabilityInfo(selectedVoucher) : null;
  const canProceedFromStep1 = expiryCheck?.level !== 'error' && !!selectedVoucher;

  async function submitOffer() {
    if (!user?.id || !offerTarget) return;
    setOfferError('');
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) { setOfferError('Please enter a valid offer amount'); return; }
    setOfferLoading(true);
    try {
      await makeOffer(offerTarget.id, user.id, amount, offerMessage);
      setOfferTarget(null); setOfferAmount(''); setOfferMessage(''); setOfferError('');
    } catch {
      setOfferError('Failed to send offer. Try again.');
    } finally {
      setOfferLoading(false);
    }
  }

  async function submitListing() {
    if (!selectedVoucher || !user?.id) return;
    setListError('');
    const balance = balanceNum;
    if (listingType !== 'trade') {
      const price = parseFloat(listPrice);
      if (isNaN(price) || price <= 0) { setListError('Please enter a listing price'); return; }
      if (price > balance) { setListError(`Price (${formatCurrency(price)}) exceeds your remaining balance (${formatCurrency(balance)})`); return; }
    }
    if ((listingType === 'trade' || listingType === 'both') && !tradeWanted.trim()) {
      setListError('Please describe what you\'re looking for in return');
      return;
    }
    setListLoading(true);
    try {
      const price = listingType === 'trade' ? null : parseFloat(listPrice);
      const notesContent = [
        tradeWanted ? `Looking for: ${tradeWanted}` : null,
        negotiable ? 'Open to negotiation' : 'Fixed price/terms',
        listingType !== 'sell' ? `Listing type: ${listingType}` : null,
      ].filter(Boolean).join('\n');

      await updateVoucher(selectedVoucher.id, {
        is_listed: true,
        listing_price: price,
        remaining_value: balance,
        notes: notesContent || selectedVoucher.notes,
      });
      await fetchListings();
      await fetchVouchers(user.id);
      setListModalVisible(false);
      resetListModal();
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to list voucher. Try again.');
    } finally {
      setListLoading(false);
    }
  }

  function resetListModal() {
    setListStep(1); setSelectedVoucher(null); setCurrentBalance('');
    setListingType('sell'); setListPrice(''); setTradeWanted(''); setNegotiable(true);
    setListError('');
  }

  async function confirmDelist() {
    if (!delistTarget) return;
    await updateVoucher(delistTarget.id, { is_listed: false, listing_price: null }).catch(() => {});
    await fetchListings().catch(() => {});
    if (user?.id) await fetchVouchers(user.id).catch(() => {});
    setDelistTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteVoucher(deleteTarget.id).catch(() => {});
    await fetchListings().catch(() => {});
    if (user?.id) await fetchVouchers(user.id).catch(() => {});
    setDeleteTarget(null);
  }

  function openEditModal(v: Voucher) {
    setEditTarget(v); setEditPrice(v.listing_price?.toString() ?? ''); setEditNegotiable(true);
  }

  async function saveEditListing() {
    if (!editTarget) return;
    setEditError('');
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) { setEditError('Please enter a valid price'); return; }
    if (price > editTarget.remaining_value) {
      setEditError(`Price cannot exceed remaining balance (${formatCurrency(editTarget.remaining_value)})`);
      return;
    }
    setEditLoading(true);
    try {
      await updateVoucher(editTarget.id, { listing_price: price });
      await fetchListings();
      if (user?.id) await fetchVouchers(user.id);
      setEditTarget(null);
      setEditError('');
    } catch {
      setEditError('Failed to update. Try again.');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Global Market header (search + brands + filters + sort) ─────────────────
  function renderGlobalHeader() {
    const sortLabel = SORT_OPTIONS.find((s) => s.key === localSort)?.label ?? 'Sort';
    return (
      <View style={styles.globalHeader}>
        {/* Brand chips */}
        {availableBrands.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.brandScroll}
            contentContainerStyle={styles.brandScrollContent}
          >
            {availableBrands.map((brand) => {
              const active = activeBrands.includes(brand);
              return (
                <TouchableOpacity
                  key={brand}
                  style={[styles.brandChip, active && styles.brandChipActive]}
                  onPress={() =>
                    setActiveBrands((prev) =>
                      active ? prev.filter((b) => b !== brand) : [...prev, brand],
                    )
                  }
                >
                  <Text style={[styles.brandChipText, active && styles.brandChipTextActive]}>
                    {brand}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Filter bar: Filters button + Sort button */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterBarBtn, activeFilterCount > 0 && styles.filterBarBtnActive]}
            onPress={() => setFilterPanelOpen(true)}
          >
            <Text style={[styles.filterBarBtnText, activeFilterCount > 0 && styles.filterBarBtnTextActive]}>
              ⚙️ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterBarBtn} onPress={() => setSortMenuOpen(true)}>
            <Text style={styles.filterBarBtnText}>↕ {sortLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagScroll}
            contentContainerStyle={styles.tagScrollContent}
          >
            {activeBrands.map((b) => (
              <TouchableOpacity
                key={b}
                style={styles.filterTag}
                onPress={() => setActiveBrands((prev) => prev.filter((x) => x !== b))}
              >
                <Text style={styles.filterTagText}>{b} ✕</Text>
              </TouchableOpacity>
            ))}
            {filterClassification !== 'all' && (
              <TouchableOpacity style={styles.filterTag} onPress={() => setFilterClassification('all')}>
                <Text style={styles.filterTagText}>{CLASSIFICATION_LABELS[filterClassification]} ✕</Text>
              </TouchableOpacity>
            )}
            {filterMode !== 'all' && (
              <TouchableOpacity style={styles.filterTag} onPress={() => setFilterMode('all')}>
                <Text style={styles.filterTagText}>{filterMode === 'sell' ? 'Sale only' : 'Trade only'} ✕</Text>
              </TouchableOpacity>
            )}
            {filterMinDiscount > 0 && (
              <TouchableOpacity style={styles.filterTag} onPress={() => setFilterMinDiscount(0)}>
                <Text style={styles.filterTagText}>{filterMinDiscount}%+ off ✕</Text>
              </TouchableOpacity>
            )}
            {filterMinRating > 0 && (
              <TouchableOpacity style={styles.filterTag} onPress={() => setFilterMinRating(0)}>
                <Text style={styles.filterTagText}>{filterMinRating}★+ ✕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.filterTag, styles.filterTagClear]} onPress={resetFilters}>
              <Text style={[styles.filterTagText, { color: colors.error }]}>Clear all</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Results count */}
        <View style={styles.resultsRow}>
          <Text style={styles.resultsCount}>
            {globalFiltered.length} result{globalFiltered.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader subtitle="Buy, sell & trade vouchers" />

      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
        <Text style={styles.subtitle}>
          {mode === 'global'
            ? `${listings.length} voucher${listings.length !== 1 ? 's' : ''} listed`
            : `${myListings.length} of your listings`}
        </Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggleWrap}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'global' && styles.modeBtnActive]}
            onPress={() => setMode('global')}
          >
            <Text style={[styles.modeBtnText, mode === 'global' && styles.modeBtnTextActive]}>
              🌍 Global Market
            </Text>
            <View style={[styles.modeBadge, mode === 'global' && styles.modeBadgeActive]}>
              <Text style={[styles.modeBadgeText, mode === 'global' && styles.modeBadgeTextActive]}>
                {listings.length}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'my' && styles.modeBtnActive]}
            onPress={() => setMode('my')}
          >
            <Text style={[styles.modeBtnText, mode === 'my' && styles.modeBtnTextActive]}>
              🏷️ My Market
            </Text>
            <View style={[styles.modeBadge, mode === 'my' && styles.modeBadgeActive]}>
              <Text style={[styles.modeBadgeText, mode === 'my' && styles.modeBadgeTextActive]}>
                {myListings.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Global Market search bar — outside FlatList so TextInput keeps focus ── */}
      {mode === 'global' && (
        <View style={styles.searchBarWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchBarInput}
            placeholder="Search brand, voucher type..."
            placeholderTextColor={colors.textMuted}
            value={globalSearch}
            onChangeText={setGlobalSearch}
          />
          {globalSearch.length > 0 && (
            <TouchableOpacity onPress={() => setGlobalSearch('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Global Market ── */}
      {mode === 'global' && (
        <FlatList<ListingWithSeller>
          data={globalFiltered}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => {
            const isOwn = item.owner_id === user?.id;
            return (
              <VoucherListing
                listing={item}
                isOwn={isOwn}
                onPress={() => {
                  if (!isOwn) { setOfferTarget(item); setOfferAmount(String(item.listing_price ?? '')); }
                }}
                onOffer={() => {
                  if (!isOwn) { setOfferTarget(item); setOfferAmount(String(item.listing_price ?? '')); }
                }}
              />
            );
          }}
          ListHeaderComponent={renderGlobalHeader}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>No vouchers found</Text>
                <Text style={styles.emptySubtitle}>
                  No vouchers match your search. Try adjusting the filters.
                </Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity style={styles.clearFiltersBtn} onPress={resetFilters}>
                    <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          contentContainerStyle={globalFiltered.length === 0 ? styles.listEmpty : styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchListings} tintColor={colors.accent} />
          }
        />
      )}

      {/* ── My Market ── */}
      {mode === 'my' && (
        <ScrollView
          style={styles.myScroll}
          contentContainerStyle={styles.myContent}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => { fetchListings(); if (user?.id) fetchVouchers(user.id); }}
              tintColor={colors.accent}
            />
          }
        >
          <TouchableOpacity style={styles.addListingBtn} onPress={() => { resetListModal(); setListModalVisible(true); }}>
            <Text style={styles.addListingBtnText}>+ List a Voucher</Text>
          </TouchableOpacity>

          {myListings.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏷️</Text>
              <Text style={styles.emptyTitle}>No active listings</Text>
              <Text style={styles.emptySubtitle}>Tap "List a Voucher" to start selling</Text>
            </View>
          ) : (
            myListings.map((v) => (
              <View key={v.id} style={styles.myCard}>
                <View style={styles.myCardTop}>
                  <View style={styles.myCardInfo}>
                    <Text style={styles.myCardBrand}>{v.brand}</Text>
                    <Text style={styles.myCardSub}>Face value: {formatCurrency(v.original_value)}</Text>
                    <View style={styles.myCardLiveBadge}>
                      <Text style={styles.myCardLiveDot}>●</Text>
                      <Text style={styles.myCardLiveText}>Live in Global Market</Text>
                    </View>
                  </View>
                  <View style={styles.myCardPriceCol}>
                    <Text style={styles.myCardPrice}>
                      {v.listing_price ? formatCurrency(v.listing_price) : 'Trade only'}
                    </Text>
                    {!!v.listing_price && v.original_value > v.listing_price && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>
                          -{Math.round((1 - v.listing_price / v.original_value) * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.myCardActions}>
                  <TouchableOpacity style={styles.editListingBtn} onPress={() => openEditModal(v)}>
                    <Text style={styles.editListingBtnText}>✏️ Edit Price</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.delistBtn} onPress={() => setDelistTarget(v)}>
                    <Text style={styles.delistBtnText}>📤 Remove from Market</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {loading && listings.length === 0 && mode === 'global' && (
        <ActivityIndicator color={colors.accent} size="large" style={StyleSheet.absoluteFillObject} />
      )}

      {/* ══ FILTER PANEL MODAL ══ */}
      <Modal visible={filterPanelOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFilterPanelOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => { resetFilters(); setFilterPanelOpen(false); }}>
              <Text style={[styles.modalClose, { color: colors.error }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.filterPanelBody}>
            {/* Voucher type */}
            <Text style={styles.filterSectionLabel}>Voucher Type</Text>
            <View style={styles.filterChipRow}>
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.panelChip, filterClassification === opt.value && styles.panelChipActive]}
                  onPress={() => setFilterClassification(opt.value)}
                >
                  <Text style={[styles.panelChipText, filterClassification === opt.value && styles.panelChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Transaction mode */}
            <Text style={styles.filterSectionLabel}>Transaction Mode</Text>
            <View style={styles.filterChipRow}>
              {(['all', 'sell', 'trade'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.panelChip, filterMode === m && styles.panelChipActive]}
                  onPress={() => setFilterMode(m)}
                >
                  <Text style={[styles.panelChipText, filterMode === m && styles.panelChipTextActive]}>
                    {m === 'all' ? 'All' : m === 'sell' ? '💰 Sale' : '🔄 Trade'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Minimum discount */}
            <Text style={styles.filterSectionLabel}>
              Minimum Discount
              {filterMinDiscount > 0 ? (
                <Text style={styles.filterSectionValue}> — {filterMinDiscount}%+</Text>
              ) : (
                <Text style={styles.filterSectionValue}> — Any</Text>
              )}
            </Text>
            <View style={styles.filterChipRow}>
              {DISCOUNT_STEPS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.panelChip, filterMinDiscount === d && styles.panelChipActive]}
                  onPress={() => setFilterMinDiscount(d)}
                >
                  <Text style={[styles.panelChipText, filterMinDiscount === d && styles.panelChipTextActive]}>
                    {d === 0 ? 'Any' : `${d}%+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Minimum seller rating */}
            <Text style={styles.filterSectionLabel}>Minimum Seller Rating</Text>
            <View style={styles.filterChipRow}>
              {RATING_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.panelChip, filterMinRating === r.value && styles.panelChipActive]}
                  onPress={() => setFilterMinRating(r.value)}
                >
                  <Text style={[styles.panelChipText, filterMinRating === r.value && styles.panelChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ══ SORT MENU MODAL ══ */}
      <Modal visible={sortMenuOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.sortOverlay} activeOpacity={1} onPress={() => setSortMenuOpen(false)}>
          <View style={styles.sortMenu}>
            <Text style={styles.sortMenuTitle}>Sort by</Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortMenuItem, localSort === opt.key && styles.sortMenuItemActive]}
                onPress={() => { setLocalSort(opt.key); setSortMenuOpen(false); }}
              >
                <Text style={[styles.sortMenuItemText, localSort === opt.key && styles.sortMenuItemTextActive]}>
                  {opt.label}
                </Text>
                {localSort === opt.key && <Text style={styles.sortMenuCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ══ OFFER MODAL ══ */}
      <Modal visible={!!offerTarget} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setOfferTarget(null); setOfferError(''); }}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Make an Offer</Text>
            <View style={{ width: 56 }} />
          </View>
          {offerTarget && (
            <ScrollView contentContainerStyle={styles.modalBody}>
              {offerError.length > 0 && (
                <View style={styles.inlineError}><Text style={styles.inlineErrorText}>⚠ {offerError}</Text></View>
              )}
              <View style={styles.offerSummary}>
                <Text style={styles.offerBrand}>{offerTarget.brand}</Text>
                <Text style={styles.offerOriginal}>Worth {formatCurrency(offerTarget.original_value)}</Text>
                <Text style={styles.offerListing}>
                  Listed at {formatCurrency(offerTarget.listing_price ?? offerTarget.original_value)}
                </Text>
              </View>
              <Text style={styles.inputLabel}>Your Offer (₪)</Text>
              <TextInput
                style={styles.offerInput}
                placeholder={`e.g. ${Math.round((offerTarget.listing_price ?? offerTarget.original_value) * 0.9)}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={offerAmount}
                onChangeText={setOfferAmount}
                autoFocus
              />
              {offerAmount.length > 0 && !isNaN(parseFloat(offerAmount)) && (
                <Text style={styles.savingsHint}>
                  You save {formatCurrency(offerTarget.original_value - parseFloat(offerAmount))} vs face value
                </Text>
              )}
              <Text style={styles.inputLabel}>Message to seller (optional)</Text>
              <TextInput
                style={[styles.offerInput, styles.messageInput]}
                placeholder="Hi, I'm interested in this voucher..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={offerMessage}
                onChangeText={setOfferMessage}
              />
              <TouchableOpacity
                style={[styles.submitButton, offerLoading && { opacity: 0.7 }]}
                onPress={submitOffer}
                disabled={offerLoading}
              >
                {offerLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.submitText}>Send Offer</Text>}
              </TouchableOpacity>
              <Text style={styles.disclaimer}>Payment only happens after both sides agree.</Text>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ LIST VOUCHER MODAL ══ */}
      <Modal visible={listModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setListModalVisible(false); resetListModal(); }}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {listStep === 1 ? 'Pick Voucher' : listStep === 2 ? 'Listing Type' : 'Set Details'}
            </Text>
            <Text style={styles.stepIndicator}>{listStep}/3</Text>
          </View>

          {listStep === 1 && (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.stepLabel}>Select a voucher from your wallet:</Text>
              {unlistedVouchers.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>👜</Text>
                  <Text style={styles.emptyTitle}>No unlisted vouchers</Text>
                  <Text style={styles.emptySubtitle}>All active vouchers are already listed or your wallet is empty</Text>
                </View>
              ) : (
                unlistedVouchers.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.pickCard, selectedVoucher?.id === v.id && styles.pickCardSelected]}
                    onPress={() => { setSelectedVoucher(v); setCurrentBalance(v.remaining_value.toString()); }}
                  >
                    <View style={styles.pickCardInfo}>
                      <Text style={styles.pickCardBrand}>{v.brand}</Text>
                      <Text style={styles.pickCardVal}>{formatCurrency(v.remaining_value)} remaining</Text>
                    </View>
                    {selectedVoucher?.id === v.id && <Text style={styles.pickCheck}>✓</Text>}
                  </TouchableOpacity>
                ))
              )}

              {selectedVoucher && (
                <View style={styles.checksContainer}>
                  {expiryCheck && (
                    <View style={[
                      styles.checkRow,
                      expiryCheck.level === 'error' && styles.checkError,
                      expiryCheck.level === 'warn' && styles.checkWarn,
                      expiryCheck.level === 'ok' && styles.checkOk,
                    ]}>
                      <Text style={[
                        styles.checkText,
                        expiryCheck.level === 'error' && { color: colors.error },
                        expiryCheck.level === 'warn' && { color: '#B8860B' },
                        expiryCheck.level === 'ok' && { color: colors.success },
                      ]}>
                        {expiryCheck.level === 'error' ? '🚫' : expiryCheck.level === 'warn' ? '⚠️' : '✅'}{' '}
                        {expiryCheck.message}
                      </Text>
                    </View>
                  )}
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Current balance on this voucher (₪)</Text>
                    <TextInput
                      style={styles.balanceInput}
                      placeholder={selectedVoucher.remaining_value.toString()}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      value={currentBalance}
                      onChangeText={setCurrentBalance}
                    />
                    {isLowBalance && (
                      <View style={styles.checkWarn}>
                        <Text style={[styles.checkText, { color: '#B8860B' }]}>
                          ⚠️ Very low balance — consider whether it's worth listing
                        </Text>
                      </View>
                    )}
                  </View>
                  {transferInfo && (
                    <View style={[styles.checkRow, transferInfo.level === 'ok' ? styles.checkOk : styles.checkWarn]}>
                      <Text style={[styles.checkText, { color: transferInfo.level === 'ok' ? colors.success : '#B8860B' }]}>
                        {transferInfo.label}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {selectedVoucher && canProceedFromStep1 && (
                <TouchableOpacity style={styles.submitButton} onPress={() => setListStep(2)}>
                  <Text style={styles.submitText}>Next →</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {listStep === 2 && (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.stepLabel}>How do you want to list?</Text>
              {(['sell', 'trade', 'both'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeOptionCard, listingType === t && styles.typeOptionCardSelected]}
                  onPress={() => setListingType(t)}
                >
                  <Text style={styles.typeOptionEmoji}>{t === 'sell' ? '💰' : t === 'trade' ? '🔄' : '🤝'}</Text>
                  <View style={styles.typeOptionText}>
                    <Text style={[styles.typeOptionTitle, listingType === t && styles.typeOptionTitleSel]}>
                      {t === 'sell' ? 'Sell for Cash' : t === 'trade' ? 'Trade Only' : 'Sell or Trade'}
                    </Text>
                    <Text style={styles.typeOptionSub}>
                      {t === 'sell'
                        ? 'Set a cash price, buyers make offers'
                        : t === 'trade'
                        ? 'Exchange for another voucher — no cash'
                        : 'Open to cash or voucher exchange'}
                    </Text>
                  </View>
                  {listingType === t && <Text style={styles.pickCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.submitButton} onPress={() => setListStep(3)}>
                <Text style={styles.submitText}>Next →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setListStep(1)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {listStep === 3 && selectedVoucher && (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView contentContainerStyle={styles.modalBody}>
                {listError.length > 0 && (
                  <View style={styles.inlineError}><Text style={styles.inlineErrorText}>⚠ {listError}</Text></View>
                )}
                <View style={styles.offerSummary}>
                  <Text style={styles.offerBrand}>{selectedVoucher.brand}</Text>
                  <Text style={styles.offerOriginal}>Balance: {formatCurrency(balanceNum)}</Text>
                </View>

                {(listingType === 'sell' || listingType === 'both') && (
                  <View>
                    <Text style={styles.inputLabel}>Asking Price (₪) *</Text>
                    <TextInput
                      style={styles.offerInput}
                      placeholder={`e.g. ${Math.round(balanceNum * 0.85)}`}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      value={listPrice}
                      onChangeText={setListPrice}
                      autoFocus={listingType === 'sell'}
                    />
                    {listPrice.length > 0 && !isNaN(parseFloat(listPrice)) && parseFloat(listPrice) > 0 && (
                      <>
                        {parseFloat(listPrice) > balanceNum && (
                          <Text style={styles.priceError}>
                            🚫 Price exceeds actual balance — this would be considered fraud
                          </Text>
                        )}
                        {parseFloat(listPrice) <= balanceNum && parseFloat(listPrice) < selectedVoucher.original_value && (
                          <Text style={styles.savingsHint}>
                            ✓ {Math.round((1 - parseFloat(listPrice) / selectedVoucher.original_value) * 100)}% discount for buyers
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}

                {(listingType === 'trade' || listingType === 'both') && (
                  <View>
                    <Text style={styles.inputLabel}>
                      {listingType === 'both' ? 'If trading: what are you looking for? *' : 'What are you looking for in return? *'}
                    </Text>
                    <TextInput
                      style={[styles.offerInput, styles.messageInput]}
                      placeholder="e.g. Wolt voucher ₪150, or any food brand..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={3}
                      value={tradeWanted}
                      onChangeText={setTradeWanted}
                      autoFocus={listingType === 'trade'}
                    />
                  </View>
                )}

                <View style={styles.negotiableRow}>
                  <View>
                    <Text style={styles.inputLabel}>Open to negotiation?</Text>
                    <Text style={styles.negotiableSub}>Allow buyers to propose different terms</Text>
                  </View>
                  <View style={styles.negotiableTogglePair}>
                    <TouchableOpacity
                      style={[styles.negotiableChip, !negotiable && styles.negotiableChipActive]}
                      onPress={() => setNegotiable(false)}
                    >
                      <Text style={[styles.negotiableChipText, !negotiable && styles.negotiableChipTextActive]}>Fixed</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.negotiableChip, negotiable && styles.negotiableChipActive]}
                      onPress={() => setNegotiable(true)}
                    >
                      <Text style={[styles.negotiableChipText, negotiable && styles.negotiableChipTextActive]}>Open ✓</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, listLoading && { opacity: 0.7 }]}
                  onPress={submitListing}
                  disabled={listLoading}
                >
                  {listLoading
                    ? <ActivityIndicator color={colors.white} />
                    : <Text style={styles.submitText}>List Now 🚀</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtn} onPress={() => setListStep(2)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      {/* ══ DELIST CONFIRM ══ */}
      <Modal visible={!!delistTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Remove from Market?</Text>
            <Text style={styles.confirmSub}>
              "{delistTarget?.brand}" will be removed from the marketplace but kept in your wallet.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setDelistTarget(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmActionBtn} onPress={confirmDelist}>
                <Text style={styles.confirmActionText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ DELETE CONFIRM ══ */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Delete Voucher?</Text>
            <Text style={styles.confirmSub}>
              Permanently delete "{deleteTarget?.brand}" from your wallet. This cannot be undone.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmActionBtn, { backgroundColor: colors.error }]}
                onPress={confirmDelete}
              >
                <Text style={styles.confirmActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ EDIT LISTING MODAL ══ */}
      <Modal visible={!!editTarget} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setEditTarget(null); setEditError(''); }}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Listing</Text>
            <View style={{ width: 56 }} />
          </View>
          {editTarget && (
            <ScrollView contentContainerStyle={styles.modalBody}>
              {editError.length > 0 && (
                <View style={styles.inlineError}><Text style={styles.inlineErrorText}>⚠ {editError}</Text></View>
              )}
              <View style={styles.offerSummary}>
                <Text style={styles.offerBrand}>{editTarget.brand}</Text>
                <Text style={styles.offerOriginal}>Balance: {formatCurrency(editTarget.remaining_value)}</Text>
              </View>
              <Text style={styles.inputLabel}>New Listing Price (₪)</Text>
              <TextInput
                style={styles.offerInput}
                placeholder="Enter new price"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={editPrice}
                onChangeText={setEditPrice}
                autoFocus
              />
              {editPrice.length > 0 && !isNaN(parseFloat(editPrice)) && parseFloat(editPrice) < editTarget.original_value && (
                <Text style={styles.savingsHint}>
                  {Math.round((1 - parseFloat(editPrice) / editTarget.original_value) * 100)}% discount for buyers
                </Text>
              )}
              <View style={styles.negotiableRow}>
                <View>
                  <Text style={styles.inputLabel}>Open to negotiation?</Text>
                  <Text style={styles.negotiableSub}>Allow buyers to propose different terms</Text>
                </View>
                <View style={styles.negotiableTogglePair}>
                  <TouchableOpacity
                    style={[styles.negotiableChip, !editNegotiable && styles.negotiableChipActive]}
                    onPress={() => setEditNegotiable(false)}
                  >
                    <Text style={[styles.negotiableChipText, !editNegotiable && styles.negotiableChipTextActive]}>Fixed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.negotiableChip, editNegotiable && styles.negotiableChipActive]}
                    onPress={() => setEditNegotiable(true)}
                  >
                    <Text style={[styles.negotiableChipText, editNegotiable && styles.negotiableChipTextActive]}>Open ✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.submitButton, editLoading && { opacity: 0.7 }]}
                onPress={saveEditListing}
                disabled={editLoading}
              >
                {editLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.submitText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: fontSizes.sm, color: colors.accent, marginTop: 2 },

  // Mode toggle
  modeToggleWrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.secondary + '55',
    borderRadius: radius.lg,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  modeBtnActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  modeBtnText: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.gray400 },
  modeBtnTextActive: { color: colors.white },
  modeBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  modeBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  modeBadgeText: { fontSize: fontSizes.xs, fontWeight: '800', color: colors.gray400 },
  modeBadgeTextActive: { color: colors.white },

  // Global Market header
  globalHeader: {
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },

  // Search bar
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.xs },
  searchBarInput: { flex: 1, fontSize: fontSizes.md, color: colors.text },
  searchClear: { fontSize: 14, color: colors.textMuted, paddingHorizontal: spacing.xs },

  // Brand chips
  brandScroll: { marginBottom: spacing.xs },
  brandScrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgLight,
  },
  brandChipActive: { borderColor: colors.secondary, backgroundColor: colors.secondary + '15' },
  brandChipText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.textMuted },
  brandChipTextActive: { color: colors.secondary, fontWeight: '700' },

  // Filter + sort bar
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgLight,
  },
  filterBarBtnActive: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
  filterBarBtnText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.textMuted },
  filterBarBtnTextActive: { color: colors.accent },

  // Active filter tags
  tagScroll: { marginBottom: spacing.xs },
  tagScrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary + '15',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  filterTagClear: { borderColor: colors.error, backgroundColor: colors.error + '10' },
  filterTagText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.secondary },

  // Results count row
  resultsRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  resultsCount: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: '600' },

  // Filter panel
  filterPanelBody: { padding: spacing.md, gap: spacing.lg, paddingBottom: 48 },
  filterSectionLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterSectionValue: { fontWeight: '400', color: colors.accent, textTransform: 'none' },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  panelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgLight,
  },
  panelChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  panelChipText: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textMuted },
  panelChipTextActive: { color: colors.accent, fontWeight: '700' },

  // Sort menu
  sortOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sortMenu: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: 36,
    gap: spacing.xs,
  },
  sortMenuTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  sortMenuItemActive: { backgroundColor: colors.accent + '15' },
  sortMenuItemText: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text },
  sortMenuItemTextActive: { color: colors.accent, fontWeight: '700' },
  sortMenuCheck: { color: colors.accent, fontWeight: '800', fontSize: fontSizes.md },

  // Empty state
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySubtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  clearFiltersBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  clearFiltersBtnText: { color: colors.accent, fontWeight: '700', fontSize: fontSizes.sm },

  // Lists
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  listEmpty: { flex: 1 },
  myScroll: { flex: 1 },
  myContent: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },

  // My Market card
  addListingBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  addListingBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSizes.md },
  myCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  myCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  myCardInfo: { flex: 1, gap: 4 },
  myCardBrand: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text },
  myCardSub: { fontSize: fontSizes.xs, color: colors.textMuted },
  myCardLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  myCardLiveDot: { fontSize: 8, color: colors.success },
  myCardLiveText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: '600' },
  myCardPriceCol: { alignItems: 'flex-end', gap: 4 },
  myCardPrice: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.accent },
  discountBadge: {
    backgroundColor: colors.success + '20',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  discountText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: '700' },
  myCardActions: { flexDirection: 'row', gap: spacing.sm },
  editListingBtn: {
    flex: 2,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  editListingBtnText: { color: colors.accent, fontWeight: '700', fontSize: fontSizes.sm },
  delistBtn: {
    flex: 2,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  delistBtnText: { color: colors.warning, fontWeight: '700', fontSize: fontSizes.sm },

  // Modals (shared)
  modalContainer: { flex: 1, backgroundColor: colors.bgLight },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalClose: { color: colors.textMuted, fontSize: fontSizes.md },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.text },
  stepIndicator: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  modalBody: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },

  // Offer modal
  offerSummary: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  offerBrand: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.text },
  offerOriginal: { fontSize: fontSizes.md, color: colors.textMuted, marginTop: 4 },
  offerListing: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.accent, marginTop: 4 },
  inputLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text },
  offerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.xl,
    color: colors.text,
    backgroundColor: colors.cardBg,
    fontWeight: '700',
  },
  messageInput: { fontSize: fontSizes.md, fontWeight: '400', height: 80, textAlignVertical: 'top' },
  savingsHint: { color: colors.success, fontSize: fontSizes.sm, fontWeight: '600' },
  priceError: { color: colors.error, fontSize: fontSizes.sm, fontWeight: '600' },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  submitText: { color: colors.white, fontSize: fontSizes.md, fontWeight: '700' },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  inlineError: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inlineErrorText: { color: colors.error, fontSize: fontSizes.sm, fontWeight: '600' },

  // List voucher steps
  stepLabel: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pickCardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
  pickCardInfo: { flex: 1 },
  pickCardBrand: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  pickCardVal: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 2 },
  pickCheck: { color: colors.accent, fontWeight: '700', fontSize: fontSizes.lg },
  checksContainer: { gap: spacing.sm },
  checkRow: { borderRadius: radius.md, padding: spacing.sm },
  checkOk: { backgroundColor: colors.success + '15', borderWidth: 1, borderColor: colors.success },
  checkWarn: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#F5A623' },
  checkError: { backgroundColor: colors.error + '15', borderWidth: 1, borderColor: colors.error },
  checkText: { fontSize: fontSizes.sm, fontWeight: '600', lineHeight: 18 },
  balanceRow: { gap: spacing.xs },
  balanceLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.text },
  balanceInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.lg,
    color: colors.text,
    backgroundColor: colors.cardBg,
    fontWeight: '700',
  },
  typeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
  },
  typeOptionCardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
  typeOptionEmoji: { fontSize: 28 },
  typeOptionText: { flex: 1 },
  typeOptionTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  typeOptionTitleSel: { color: colors.accent },
  typeOptionSub: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  negotiableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  negotiableSub: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  negotiableTogglePair: { flexDirection: 'row', gap: spacing.xs },
  negotiableChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.cardBg,
  },
  negotiableChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  negotiableChipText: { fontSize: fontSizes.sm, color: colors.textMuted, fontWeight: '600' },
  negotiableChipTextActive: { color: colors.accent },
  backBtn: { alignItems: 'center', padding: spacing.sm },
  backBtnText: { color: colors.textMuted, fontSize: fontSizes.md },

  // Confirm modals
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmBox: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  confirmTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  confirmSub: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: spacing.sm },
  confirmCancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  confirmCancelText: { color: colors.textMuted, fontWeight: '600' },
  confirmActionBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warning,
    alignItems: 'center',
  },
  confirmActionText: { color: colors.white, fontWeight: '700' },
});
