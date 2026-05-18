import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import enStrings from './dashboard.en.json';
import tlStrings from './dashboard.tl.json';

/**
 * Iteration 0025 — runtime EN/TL locale toggle.
 *
 * V1 ships a server-side runtime helper rather than Next 15 i18n routing, so
 * existing routes don't churn. Reads the signed-in user's `users.locale`
 * column and returns translated strings for the dashboard chrome only.
 *
 * Scope: nav labels, common CTAs, status pills, headings. Guest-entered or
 * vendor-entered content is NEVER translated.
 *
 * Locales: 'en' (default) and 'tl'. The `users.locale` column is a Postgres
 * enum that also includes 'ceb' for future use — we currently fall back to
 * English for anything other than 'tl'.
 */

export type Locale = 'en' | 'tl';

export type TranslationKey = keyof typeof enStrings;

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en: enStrings,
  tl: tlStrings,
};

function normalizeLocale(raw: unknown): Locale {
  return raw === 'tl' ? 'tl' : 'en';
}

/**
 * Server helper — reads the signed-in user's `users.locale` and returns
 * 'en' or 'tl'. Anything other than 'tl' (including 'ceb', null, or an
 * unauthenticated request) collapses to 'en'.
 *
 * Wrapped in React `cache()` and routed through `getCurrentUser` so the
 * /dashboard/[eventId] layout and its page (both of which need the
 * translator) share one users.locale read per request instead of two
 * auth+SELECT round-trips.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const user = await getCurrentUser();
    if (!user) return 'en';
    const supabase = await createClient();
    const { data } = await supabase
      .from('users')
      .select('locale')
      .eq('user_id', user.id)
      .maybeSingle();
    return normalizeLocale(data?.locale);
  } catch {
    return 'en';
  }
});

/**
 * Translate a key into the requested locale. If `locale` is omitted, returns
 * the English string (cheap for static call-sites that don't need the user's
 * preference). If the key is missing in the target locale, falls back to
 * English; if missing there too, returns the key itself so the gap is
 * visible in dev.
 */
export function t(key: TranslationKey, locale: Locale = 'en'): string {
  const dict = DICTIONARIES[locale];
  if (dict && key in dict) return dict[key]!;
  const fallback = DICTIONARIES.en[key];
  return fallback ?? key;
}

/**
 * Build a translator bound to a locale, for components that need many lookups
 * with the same preference.
 */
export function makeT(locale: Locale): (key: TranslationKey) => string {
  return (key) => t(key, locale);
}
