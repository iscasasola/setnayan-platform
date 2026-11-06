/**
 * 🪟 OPEN THE COUPLE'S PUBLIC EVENT HUB WITHOUT LOSING THE APP (owner, 24 Oct 2026).
 *
 * "View Event Hub" — and every other link to the couple's PUBLIC page — opens:
 *
 *   · in the iOS / Android app → an IN-APP browser sheet over the app
 *     (SFSafariViewController on iOS, Custom Tabs on Android) through the
 *     `@capacitor/browser` plugin. "Done" closes the sheet and the couple is
 *     back on Home, exactly where they were. The app's own web view never
 *     navigates away, and the person is never thrown out to Safari / Chrome.
 *   · on the web (and the desktop app) → a new tab.
 *   · in an OLDER app build that predates the plugin → the same web view, as a
 *     normal navigation. Never a dead button, never an error.
 *
 * Nothing heavy is imported: the plugin is read from the runtime-injected
 * `window.Capacitor` (the native shell injects `Capacitor.Plugins.Browser`
 * only when the build carries it — `JSExport.exportJS` in @capacitor/ios), the
 * same way `app/_components/native-bridge.tsx` and `nfc-runtime.ts` read theirs.
 * `apps/web` keeps ZERO `@capacitor/*` dependencies.
 *
 * 🔒 PUBLIC PAGES ONLY. The in-app sheet is its own browser with its OWN
 * cookies — it does not carry the couple's signed-in session. A draft preview
 * (`?preview=draft`, host-verified on the page) would open signed-out there.
 * The Maker's previews keep `PreviewStageLink` (same view + "Back to the
 * Maker"); this helper is for the live, public Event Hub.
 *
 * Call it from a click handler and keep the `href` on the anchor, so a
 * long-press / middle-click still has a real link:
 *
 *   <a href={hubUrl} onClick={(e) => { e.preventDefault(); openEventHub(hubUrl); }}>
 *
 * The web branch runs synchronously inside the click, so no popup blocker
 * mistakes the new tab for an unrequested window.
 */

/** How the page was opened — returned for the caller and the tests. */
export type OpenEventHubWay = 'in-app-browser' | 'new-tab' | 'same-view';

type BrowserPlugin = { open: (opts: { url: string }) => Promise<void> | void };
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: { Browser?: BrowserPlugin };
};

/** The slice of `window` this helper touches — injectable for the tests. */
export type OpenEventHubWindow = {
  Capacitor?: CapacitorGlobal;
  location: { href: string; assign: (url: string) => void };
  open: (url: string, target: string, features: string) => unknown;
};

/** The in-app browser plugin, only inside the native shell AND a build that carries it. */
function inAppBrowser(win: OpenEventHubWindow): BrowserPlugin | null {
  const cap = win.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable('Browser')) return null;
  const browser = cap.Plugins?.Browser;
  return browser && typeof browser.open === 'function' ? browser : null;
}

/**
 * Open the couple's public Event Hub at `url` (absolute, or a path like
 * `/<slug>`) — in-app browser sheet in the app, new tab on the web, same view
 * in an app build without the plugin.
 */
export function openEventHub(
  url: string,
  win: OpenEventHubWindow = window as unknown as OpenEventHubWindow,
): OpenEventHubWay {
  // SFSafariViewController / Custom Tabs need an absolute http(s) URL.
  let absolute: string;
  try {
    absolute = new URL(url, win.location.href).href;
  } catch {
    absolute = url;
  }

  const isNative = Boolean(win.Capacitor?.isNativePlatform?.());
  if (isNative) {
    const browser = inAppBrowser(win);
    if (browser && /^https?:/i.test(absolute)) {
      const sameView = () => win.location.assign(absolute);
      try {
        // The native bridge answers with a Promise; a rejection (sheet could
        // not present) still gets the couple to the page, in the same view.
        Promise.resolve(browser.open({ url: absolute })).catch(sameView);
      } catch {
        sameView();
        return 'same-view';
      }
      return 'in-app-browser';
    }
    // An app build from before the plugin: a normal navigation in this web view.
    win.location.assign(absolute);
    return 'same-view';
  }

  win.open(absolute, '_blank', 'noopener');
  return 'new-tab';
}
