'use client';

/**
 * native-push.ts — THE IPHONE APP'S PUSH, FROM THE WEB PAGE IT WRAPS.
 *
 * Owner, 2026-10-31: "The notification on the phone not on the app." Web Push does
 * not reach inside the app's WKWebView, so the app carries `@capacitor/push-
 * notifications` and this file talks to it through the Capacitor bridge
 * (`window.Capacitor`), the same way `lib/iap/native-store.ts` reaches StoreKit:
 *
 *   · `nativePushAvailable()` — only an iOS build that carries the plugin AND says
 *     so in its user-agent (`SetnayanPush/1`, apps/mobile/capacitor.config.ts). An
 *     older build has neither, so it is never shown an ask with nothing behind it.
 *   · `registerNativePush()` — the Yes: iOS's own permission prompt, then APNs
 *     registration, then the device token saved as a push subscription of kind
 *     'apns' (`savePushSubscription`).
 *   · `refreshNativePushToken()` — on every launch where permission is already
 *     granted, re-register (Apple can rotate a token) without asking anything.
 *   · `onNativePushTap()` — a tapped notification opens its own screen.
 */
import { savePushSubscription } from '@/lib/push-actions';

export const NATIVE_PUSH_UA_MARKER = 'SetnayanPush/1';
const PLUGIN = 'PushNotifications';

type ListenerHandle = { remove: () => void | Promise<void> };
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: (plugin: string, method: string, options?: Record<string, unknown>) => Promise<unknown>;
  Plugins?: Record<string, { addListener?: (e: string, cb: (d: unknown) => void) => ListenerHandle | Promise<ListenerHandle> } | undefined>;
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== 'ios' || typeof cap.nativePromise !== 'function') return null;
  return new RegExp(`\\b${NATIVE_PUSH_UA_MARKER.replace('/', '\\/')}\\b`).test(navigator.userAgent) ? cap : null;
}

/** Is native push here at all? (The iPhone app, a build that carries the plugin.) */
export function nativePushAvailable(): boolean {
  return capacitor() !== null;
}

export type NativePushPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

export async function nativePushPermission(): Promise<NativePushPermission> {
  const cap = capacitor();
  if (!cap?.nativePromise) return 'unavailable';
  try {
    const r = (await cap.nativePromise(PLUGIN, 'checkPermissions')) as { receive?: string };
    return r.receive === 'granted' ? 'granted' : r.receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unavailable';
  }
}

async function listen(cap: CapacitorGlobal, event: string, cb: (d: unknown) => void): Promise<ListenerHandle | null> {
  const add = cap.Plugins?.[PLUGIN]?.addListener;
  if (!add) return null;
  return await add(event, cb);
}

/** Register with APNs and save the token. Resolves 'on' only once the server holds the row. */
async function registerAndSave(cap: CapacitorGlobal): Promise<'on' | 'off'> {
  let done: (v: 'on' | 'off') => void = () => {};
  const result = new Promise<'on' | 'off'>((resolve) => {
    done = resolve;
  });
  const handles = await Promise.all([
    listen(cap, 'registration', (d) => {
      const token = (d as { value?: string } | null)?.value ?? '';
      void savePushSubscription({ apnsToken: token }).then((r) => done(r.ok ? 'on' : 'off'), () => done('off'));
    }),
    listen(cap, 'registrationError', () => done('off')),
  ]);
  const timer = window.setTimeout(() => done('off'), 15_000);
  try {
    await cap.nativePromise!(PLUGIN, 'register');
    return await result;
  } catch {
    return 'off';
  } finally {
    window.clearTimeout(timer);
    for (const h of handles) void h?.remove();
  }
}

/** The Yes inside the app: iOS's prompt, then APNs, then the saved token. */
export async function registerNativePush(): Promise<'on' | 'denied' | 'off'> {
  const cap = capacitor();
  if (!cap?.nativePromise) return 'off';
  try {
    const r = (await cap.nativePromise(PLUGIN, 'requestPermissions')) as { receive?: string };
    if (r.receive !== 'granted') return r.receive === 'denied' ? 'denied' : 'off';
    return await registerAndSave(cap);
  } catch {
    return 'off';
  }
}

/** On launch: already allowed → re-register quietly (tokens can rotate). Never prompts. */
export async function refreshNativePushToken(): Promise<void> {
  const cap = capacitor();
  if (!cap) return;
  if ((await nativePushPermission()) !== 'granted') return;
  await registerAndSave(cap).catch(() => 'off');
}

/** A tapped notification → its own screen (the template's `url`, same-origin paths only). */
export async function onNativePushTap(go: (path: string) => void): Promise<() => void> {
  const cap = capacitor();
  if (!cap) return () => {};
  const h = await listen(cap, 'pushNotificationActionPerformed', (d) => {
    const url = (d as { notification?: { data?: { url?: unknown } } } | null)?.notification?.data?.url;
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) go(url);
  });
  return () => void h?.remove();
}
