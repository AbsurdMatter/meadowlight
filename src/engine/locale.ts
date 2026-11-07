/**
 * Session 10 P4 (issue #19): the locale store — ONE source for the active
 * locale. Selectable (manual toggle in the corner) AND persisted (save v10
 * additive field `locale`); default per browser locale. Every copy surface
 * reads UI_COPY[locale] / the *_COPY tables from src/data/i18n.ts.
 */
import { create } from 'zustand';
import { UI_COPY, LOCALES, DEFAULT_LOCALE, localeFromBrowser, type Locale, type UiCopy } from '../data/i18n';

const LOCALE_STORAGE_KEY = 'meadowlight.locale';

function readPersisted(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return v === 'en' || v === 'sl' ? v : null;
  } catch {
    return null;
  }
}

function persist(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // storage unavailable: the choice lives for the session only
  }
}

export const useLocale = create<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: () => UiCopy;
}>((set, get) => ({
  locale: readPersisted() ?? localeFromBrowser(typeof navigator !== 'undefined' ? navigator : { language: undefined }),
  setLocale: (l) => {
    if (!LOCALES.includes(l)) return;
    persist(l);
    set({ locale: l });
  },
  t: () => UI_COPY[get().locale] ?? UI_COPY[DEFAULT_LOCALE],
}));
