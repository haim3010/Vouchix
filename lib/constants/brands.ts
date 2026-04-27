export interface BrandInfo {
  name: string;
  color: string;
  emoji: string;
  domain?: string; // used for Clearbit logo lookup
  category: 'fashion' | 'food' | 'electronics' | 'home' | 'sport' | 'beauty' | 'other';
}

export const POPULAR_BRANDS: BrandInfo[] = [
  // Fashion — Israeli
  { name: 'Castro', color: '#8B0000', emoji: '👔', domain: 'castro.co.il', category: 'fashion' },
  { name: 'Fox', color: '#E8501A', emoji: '🦊', domain: 'fox.co.il', category: 'fashion' },
  { name: 'Golf', color: '#1A5C1A', emoji: '👗', domain: 'golf.co.il', category: 'fashion' },
  { name: 'Renuar', color: '#B8860B', emoji: '👒', domain: 'renuar.co.il', category: 'fashion' },
  { name: 'Tav Hazav', color: '#C9A96E', emoji: '✨', domain: 'tavhazav.co.il', category: 'fashion' },
  { name: 'Honigman', color: '#2C2C2C', emoji: '👗', domain: 'honigman.co.il', category: 'fashion' },
  { name: 'Polgat', color: '#8B5E3C', emoji: '🧥', domain: 'polgat.co.il', category: 'fashion' },
  { name: 'Terminal X', color: '#000000', emoji: '🖤', domain: 'terminalx.com', category: 'fashion' },
  { name: 'Dynamica', color: '#FF6B00', emoji: '🏃', domain: 'dynamica.co.il', category: 'fashion' },
  { name: 'Shilav', color: '#4A90D9', emoji: '👕', domain: 'shilav.co.il', category: 'fashion' },
  // Fashion — Global
  { name: 'Zara', color: '#1A1A1A', emoji: '👗', domain: 'zara.com', category: 'fashion' },
  { name: 'H&M', color: '#E40046', emoji: '👕', domain: 'hm.com', category: 'fashion' },
  { name: 'Nike', color: '#F97316', emoji: '👟', domain: 'nike.com', category: 'fashion' },
  { name: 'Adidas', color: '#000000', emoji: '👟', domain: 'adidas.com', category: 'fashion' },
  { name: 'Veja', color: '#D4A853', emoji: '👟', domain: 'veja-store.com', category: 'fashion' },
  { name: 'New Balance', color: '#CF4520', emoji: '👟', domain: 'newbalance.com', category: 'fashion' },
  { name: 'Levi\'s', color: '#C41E3A', emoji: '👖', domain: 'levi.com', category: 'fashion' },
  { name: 'Mango', color: '#B5651D', emoji: '🥭', domain: 'mango.com', category: 'fashion' },
  { name: 'Pull & Bear', color: '#333333', emoji: '🐻', domain: 'pullandbear.com', category: 'fashion' },
  { name: 'Bershka', color: '#FF1744', emoji: '🛍️', domain: 'bershka.com', category: 'fashion' },
  // Beauty
  { name: 'Kiehl\'s', color: '#2E4A1E', emoji: '🌿', domain: 'kiehls.com', category: 'beauty' },
  { name: 'MAC', color: '#1C1C1C', emoji: '💄', domain: 'maccosmetics.com', category: 'beauty' },
  { name: 'Sephora', color: '#000000', emoji: '💅', domain: 'sephora.com', category: 'beauty' },
  { name: 'L\'Oréal', color: '#C8A951', emoji: '✨', domain: 'loreal.com', category: 'beauty' },
  { name: 'Sabon', color: '#8FBC8F', emoji: '🧴', domain: 'sabon.com', category: 'beauty' },
  // Food & Coffee
  { name: 'Aroma', color: '#6B3A2A', emoji: '☕', domain: 'aroma.co.il', category: 'food' },
  { name: 'Kravitz', color: '#8B4513', emoji: '☕', category: 'food' },
  { name: 'Starbucks', color: '#00704A', emoji: '☕', domain: 'starbucks.com', category: 'food' },
  { name: 'McDonalds', color: '#FFC72C', emoji: '🍔', domain: 'mcdonalds.com', category: 'food' },
  { name: 'Burger King', color: '#D62300', emoji: '🍔', domain: 'burgerking.com', category: 'food' },
  { name: 'Domino\'s', color: '#006491', emoji: '🍕', domain: 'dominos.com', category: 'food' },
  { name: 'Pizza Hut', color: '#EE3124', emoji: '🍕', domain: 'pizzahut.com', category: 'food' },
  { name: 'Shufersal', color: '#E8000D', emoji: '🛒', domain: 'shufersal.co.il', category: 'food' },
  { name: 'Rami Levy', color: '#1E90FF', emoji: '🛒', domain: 'rami-levy.co.il', category: 'food' },
  { name: 'Victory', color: '#FF6600', emoji: '🛒', domain: 'victory.co.il', category: 'food' },
  // Electronics
  { name: 'Apple', color: '#555555', emoji: '🍎', domain: 'apple.com', category: 'electronics' },
  { name: 'Amazon', color: '#FF9900', emoji: '📦', domain: 'amazon.com', category: 'electronics' },
  { name: 'KSP', color: '#CC0000', emoji: '💻', domain: 'ksp.co.il', category: 'electronics' },
  { name: 'iDigital', color: '#0071E3', emoji: '📱', domain: 'idigital.co.il', category: 'electronics' },
  { name: 'Ivory', color: '#6C3483', emoji: '🖥️', domain: 'ivory.co.il', category: 'electronics' },
  // Home
  { name: 'IKEA', color: '#0058A3', emoji: '🛋️', domain: 'ikea.com', category: 'home' },
  { name: 'ACE', color: '#D40000', emoji: '🔧', domain: 'ace.co.il', category: 'home' },
  { name: 'Hamashbir', color: '#8B0000', emoji: '🏠', domain: 'hamashbir.co.il', category: 'home' },
  // Books & Culture
  { name: 'Steimatzky', color: '#003087', emoji: '📚', domain: 'steimatzky.co.il', category: 'other' },
  { name: 'Tzomet Sfarim', color: '#1A237E', emoji: '📖', domain: 'tzomet.co.il', category: 'other' },
  // Other
  { name: 'Other', color: '#6B7280', emoji: '🎁', category: 'other' },
];

export const BRAND_CATEGORIES = ['fashion', 'food', 'electronics', 'home', 'beauty', 'other'] as const;

export function getBrandInfo(name: string): BrandInfo {
  return POPULAR_BRANDS.find((b) => b.name.toLowerCase() === name.toLowerCase()) ?? {
    name,
    color: '#6B7280',
    emoji: '🎁',
    category: 'other',
  };
}
