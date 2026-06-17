/**
 * Vendor push notification initialisation — Capacitor native shell.
 *
 * Wires @capacitor/push-notifications so the native app can receive FCM
 * (Android) and APNs (iOS) push tokens. The token is forwarded to the
 * Setnayan backend via the `registerToken` callback supplied by the
 * web-side caller (apps/web PushNotificationRegistrar or a future native
 * bridge).
 *
 * OWNER ACTION REQUIRED:
 *   1. Run `npm install` in apps/mobile to install @capacitor/push-notifications.
 *   2. Run `npx cap sync` to copy the plugin into the iOS/Android projects.
 *   3. Android: add the Firebase google-services.json to apps/mobile/android/app/.
 *   4. iOS: enable the "Push Notifications" capability in Xcode + add
 *            APNs keys in App Store Connect.
 *   5. Wire /api/notify to forward to FCM (android) and APNs (ios) using
 *      the TODO stubs already in apps/web/app/api/notify/route.ts.
 *
 * Capacitor plugin docs:
 *   https://capacitorjs.com/docs/apis/push-notifications
 */

// requires @capacitor/push-notifications + native setup (owner action: npx cap sync)
import { PushNotifications } from '@capacitor/push-notifications';

type NativePlatform = 'android' | 'ios';

/**
 * Detect the native platform from the Capacitor runtime.
 * Falls back to 'android' when the platform string is unexpected — FCM
 * serves both Android and some Capacitor-on-web scenarios.
 */
function getNativePlatform(): NativePlatform {
  const platform =
    (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor
      ?.getPlatform?.() ?? '';
  return platform === 'ios' ? 'ios' : 'android';
}

/**
 * Initialise vendor push notifications in the Capacitor native shell.
 *
 * Call once after the app shell mounts for a vendor-authenticated session.
 * The `registerToken` callback bridges the native token back to the web layer
 * (typically the server action `registerPushToken` in
 * apps/web/app/vendor-dashboard/actions/push-tokens.ts).
 *
 * @param registerToken  Async callback that persists the device token to the
 *                       Setnayan backend. Receives the raw FCM/APNs token
 *                       string and the platform identifier.
 *
 * @example
 * // Inside a Capacitor-detected useEffect in the vendor dashboard:
 * import { initVendorPushNotifications } from '@setnayan/mobile/src/push';
 * await initVendorPushNotifications(async (token, platform) => {
 *   await registerPushToken(token, platform); // server action
 * });
 */
export async function initVendorPushNotifications(
  registerToken: (token: string, platform: NativePlatform) => Promise<void>,
): Promise<void> {
  // 1. Request permission — resolves to { receive: 'granted' | 'denied' | 'prompt' }.
  const result = await PushNotifications.requestPermissions();
  if (result.receive !== 'granted') {
    // Vendor declined or the permission is already denied. No-op — the in-app
    // notification feed + email still fire.
    return;
  }

  // 2. Register with FCM / APNs. This is async and fires the 'registration'
  //    listener below when the OS returns the device token.
  await PushNotifications.register();

  // 3. Persist the token as soon as it's returned.
  PushNotifications.addListener('registration', async ({ value: token }) => {
    const platform = getNativePlatform();
    try {
      await registerToken(token, platform);
    } catch (err) {
      // Non-fatal — in-app notifications + email still work without push.
      console.warn('[push] registerToken failed', err);
    }
  });

  // 4. In-app foreground handling — the /api/notify route suppresses push
  //    delivery when Supabase Realtime is active, so this listener only fires
  //    in edge cases (Realtime socket closed, background→foreground race).
  //    We log for now; a future iteration can show an in-app toast.
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // In-app: show in-app toast; push is suppressed by /api/notify when Realtime is active
    console.log('[push] Push received in foreground:', notification);
  });

  // 5. Registration errors — non-fatal, logged for Sentry.
  PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] Push registration error:', err.error);
  });
}
