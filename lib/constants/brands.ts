export interface BrandInfo {
  name: string;
  color: string;
  emoji: string;
  category: 'fashion' | 'food' | 'electronics' | 'home' | 'sport' | 'beauty' | 'other';
}

export const POPULAR_BRANDS: BrandInfo[] = [
  // Fashion — Israeli
  { name: 'Castro', color: '#8B0000', emoji: '👔', category: 'fashion' },
  { name: 'Fox', color: '#E8501A', emoji: '🦊', category: 'fashion' },
  { name: 'Golf', color: '#1A5C1A', emoji: '👗', category: 'fashion' },
  { name: 'Renuar', color: '#B8860B', emoji: '👒', category: 'fashion' },
  { name: 'Tav Hazav', color: '#C9A96E', emoji: '✨', category: 'fashion' },
  { name: 'Honigman', color: '#2C2C2C', emoji: '👗', category: 'fashion' },
  { name: 'Polgat', color: '#8B5E3C', emoji: '🧥', category: 'fashion' },
  { name: 'Terminal X', color: '#000000', emoji: '🖤', category: 'fashion' },
  { name: 'Dynamica', color: '#FF6B00', emoji: '🏃', category: 'fashion' },
  { name: 'Shilav', color: '#4A90D9', emoji: '👕', category: 'fashion' },
  // Fashion — Global
  { name: 'Zara', color: '#1A1A1A', emoji: '👗', category: 'fashion' },
  { name: 'H&M', color: '#E40046', emoji: '👕', category: 'fashion' },
  { name: 'Nike', color: '#F97316', emoji: '👟', category: 'fashion' },
  { name: 'Adidas', color: '#000000', emoji: '👟', category: 'fashion' },
  { name: 'Veja', color: '#D4A853', emoji: '👟', category: 'fashion' },
  { name: 'New Balance', color: '#CF4520', emoji: '👟', category: 'fashion' },
  { name: 'Levi\'s', color: '#C41E3A', emoji: '👖', category: 'fashion' },
  { name: 'Mango', color: '#B5651D', emoji: '🥭', category: 'fashion' },
  { name: 'Pull & Bear', color: '#333333', emoji: '🐻', category: 'fashion' },
  { name: 'Bershka', color: '#FF1744', emoji: '🛍️', category: 'fashion' },
  // Beauty
  { name: 'Kiehl\'s', color: '#2E4A1E', emoji: '🌿', category: 'beauty' },
  { name: 'MAC', color: '#1C1C1C', emoji: '💄', category: 'beauty' },
  { name: 'Sephora', color: '#000000', emoji: '💅', category: 'beauty' },
  { name: 'L\'Oréal', color: '#C8A951', emoji: '✨', category: 'beauty' },
  { name: 'Sabon', color: '#8FBC8F', emoji: '🧴', category: 'beauty' },
  // Food & Coffee
  { name: 'Aroma', color: '#6B3A2A', emoji: '☕', category: 'food' },
  { name: 'Kravitz', color: '#8B4513', emoji: '☕', category: 'food' },
  { name: 'Starbucks', color: '#00704A', emoji: '☕', category: 'food' },
  { name: 'McDonalds', color: '#FFC72C', emoji: '🍔', category: 'food' },
  { name: 'Burger King', color: '#D62300', emoji: '🍔', category: 'food' },
  { name: 'Domino\'s', color: '#006491', emoji: '🍕', category: 'food' },
  { name: 'Pizza Hut', color: '#EE3124', emoji: '🍕', category: 'food' },
  { name: 'Shufersal', color: '#E8000D', emoji: '🛒', category: 'food' },
  { name: 'Rami Levy', color: '#1E90FF', emoji: '🛒', category: 'food' },
  { name: 'Victory', color: '#FF6600', emoji: '🛒', category: 'food' },
  // Electronics
  { name: 'Apple', color: '#555555', emoji: '🍎', category: 'electronics' },
  { name: 'Amazon', color: '#FF9900', emoji: '📦', category: 'electronics' },
  { name: 'KSP', color: '#CC0000', emoji: '💻', category: 'electronics' },
  { name: 'iDigital', color: '#0071E3', emoji: '📱', category: 'electronics' },
  { name: 'Ivory', color: '#6C3483', emoji: '🖥️', category: 'electronics' },
  // Home
  { name: 'IKEA', color: '#0058A3', emoji: '🛋️', category: 'home' },
  { name: 'ACE', color: '#D40000', emoji: '🔧', category: 'home' },
  { name: 'Hamashbir', color: '#8B0000', emoji: '🏠', category: 'home' },
  // Books & Culture
  { name: 'Steimatzky', color: '#003087', emoji: '📚', category: 'other' },
  { name: 'Tzomet Sfarim', color: '#1A237E', emoji: '📖', category: 'other' },
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
