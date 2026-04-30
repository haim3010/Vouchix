import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from './translations';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'he',
      isRTL: true,
      setLanguage: (language: Language) => {
        set({ language, isRTL: language === 'he' });
      },
      t: (key: TranslationKey) => {
        const lang = get().language;
        return (translations[lang] as Record<string, string>)[key] ?? (translations['en'] as Record<string, string>)[key] ?? key;
      },
    }),
    {
      name: 'vouchix-language',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist t() function
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isRTL = state.language === 'he';
        }
      },
    }
  )
);

// Convenience hook — returns just the translator
export function useT() {
  return useLanguageStore((s) => s.t);
}
