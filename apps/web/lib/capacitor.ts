/**
 * Capacitor detection utility.
 *
 * Capacitor injects `window.Capacitor` at runtime inside the native shell.
 * This is the single check point — import `isNativeApp` anywhere (client
 * components only; always call inside useEffect / after mount so SSR never
 * tries to access `window`).
 *
 * WHY: Setnayan ships a Capacitor remote-URL shell wrapping the hosted
 * Next.js site. On mobile the store-channel SRP prices are shown (higher
 * due to store fees). A "Buy on web for less" banner guides vendors to the
 * web checkout where the canonical DB prices apply.
 *
 * Reference: project_setnayan_native_shell_capacitor memory entry.
 */

// Returns true when running inside the Capacitor native shell.
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}
