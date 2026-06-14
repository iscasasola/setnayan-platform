/**
 * Platform-aware pricing — native (iOS/Android) in-app prices carry a markup so
 * the post-store-cut NET ≈ the web price.
 *
 * WHY: Apple App Store / Google Play take up to 30% on in-app purchases of
 * DIGITAL goods (15% under $1M/yr → 30% above; required for in-app digital
 * content). Almost every Setnayan SKU is digital, so a native in-app purchase
 * would hand the store ~30% and gut the ~95-99% margin. To net the same as web
 * we mark the native price UP by `NATIVE_PRICE_MARKUP_PCT`. WEB checkout (Apple
 * Pay / Google Pay on the web = 0% store cut) stays at the base catalog price —
 * the app deep-links there wherever the store rules allow.
 *
 * The base price always lives in the admin catalog (platform_retail_catalog_v2);
 * this is a derived markup, never a second stored price. The charge path
 * (submitOrderAction) and the display readers (lib/v2-catalog.ts) both apply it
 * from the SAME request platform, so what's shown equals what's billed.
 *
 * Tamper note: the platform is read from the request user-agent (the Capacitor
 * shell appends 'SetnayanApp/ios' | 'SetnayanApp/android'). A spoofed UA can only
 * make a native client look like web → it pays the LOWER base price, never less
 * than base. The base catalog price is the floor; we never undercharge.
 */
import { headers } from 'next/headers';

export type AppPlatform = 'web' | 'ios' | 'android';

/**
 * Store-cut markup applied to native in-app prices. 30 = Apple/Google's
 * standard digital-goods commission ceiling. (If the < $1M/yr 15% tier ever
 * applies, drop this to 15 — or move it to platform_settings for admin control,
 * mirroring the Setnayan Pay fee.)
 */
export const NATIVE_PRICE_MARKUP_PCT = 30;

export function isNativePlatform(p: AppPlatform): boolean {
  return p === 'ios' || p === 'android';
}

/**
 * Detect the platform from the request user-agent. The Capacitor native shell
 * appends 'SetnayanApp/ios' | 'SetnayanApp/android' to the WebView UA
 * (apps/mobile/capacitor.config.ts); a bare 'SetnayanApp' falls back to the OS
 * token. Everything else — and any non-request scope (build / cron, where
 * headers() throws) — is 'web'.
 */
export async function getRequestPlatform(): Promise<AppPlatform> {
  let ua = '';
  try {
    const h = await headers();
    ua = h.get('user-agent') ?? '';
  } catch {
    return 'web';
  }
  if (!/SetnayanApp/i.test(ua)) return 'web';
  if (/SetnayanApp\/android/i.test(ua) || /Android/i.test(ua)) return 'android';
  return 'ios';
}

/**
 * Apply the native store markup to a CENTAVOS amount. Web → unchanged. Native →
 * × (1 + markup), rounded to whole pesos so the displayed/charged price is clean
 * (e.g. base ₱3,999 → ₱5,199 on native).
 */
export function applyPlatformMarkupCentavos(
  baseCentavos: number,
  platform: AppPlatform,
): number {
  if (!isNativePlatform(platform)) return Math.round(baseCentavos);
  const marked = baseCentavos * (1 + NATIVE_PRICE_MARKUP_PCT / 100);
  // Round to whole pesos (×100) for a clean charge/display.
  return Math.round(marked / 100) * 100;
}

/** Pesos convenience wrapper around applyPlatformMarkupCentavos. */
export function applyPlatformMarkupPesos(
  basePesos: number,
  platform: AppPlatform,
): number {
  return applyPlatformMarkupCentavos(Math.round(basePesos * 100), platform) / 100;
}
