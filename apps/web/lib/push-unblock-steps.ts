/**
 * What to actually DO when a device has already blocked notifications.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * `PushToggle` asks the browser for permission the moment somebody flips the
 * switch on. That works — ONCE. After a person (or their browser, silently, on
 * a repeat dismissal) says no, `Notification.requestPermission()` resolves to
 * `'denied'` immediately and **shows no prompt ever again**. There is no API
 * that re-opens it; only the person can, in browser settings.
 *
 * The toggle used to meet that state with one sentence — *"Blocked in your
 * browser settings. Re-enable notifications for this site to turn them on."* —
 * which is true, and is not a way out. The owner hit exactly this on 2026-08-26
 * and had to ask how. 🔑 **Telling somebody they are blocked is not unblocking
 * them.** The steps differ per browser and per OS, so the screen has to know
 * which one it is looking at.
 *
 * ─── IT IS A HINT, NOT A DETECTION ────────────────────────────────────────
 * User-agent sniffing is unreliable by design and this deliberately does not
 * pretend otherwise: every branch falls back to `GENERIC`, which is correct
 * everywhere even when it is not the shortest path. A wrong-but-plausible
 * instruction is worse than a general one, so the branches only fire on
 * markers that are hard to mistake.
 *
 * Pure and side-effect free so it can be tested without a browser — the whole
 * reason it is not inlined in the component.
 */

export type UnblockGuide = {
  /** Which device family this is written for — shown so a person can tell at a
   *  glance whether the steps match what is in front of them. */
  platform: string;
  steps: string[];
  /** A second gate that swallows notifications AFTER the site is allowed.
   *  Silent, and the commonest reason "I allowed it and nothing happens". */
  systemNote?: string;
};

const GENERIC: UnblockGuide = {
  platform: 'this browser',
  steps: [
    'Open your browser settings and find the notifications or site-permissions section.',
    'Find setnayan.com in the blocked list and allow it.',
    'Come back to this page — the switch turns on by itself.',
  ],
};

const MAC_SYSTEM_NOTE =
  'On a Mac there is a second gate: open System Settings → Notifications and make sure your browser is allowed there too. If the site says yes and the Mac says no, you get silence with nothing explaining why.';

export function unblockSteps(input: {
  userAgent: string;
  /** True when running as an installed app rather than a browser tab. */
  standalone?: boolean;
}): UnblockGuide {
  const ua = (input.userAgent || '').toLowerCase();
  if (!ua) return GENERIC;

  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isMac = /macintosh|mac os x/.test(ua) && !isIOS;
  // Order matters: Edge and Opera both carry "chrome", and every iOS browser
  // carries "safari". Test the more specific marker first.
  const isEdge = /\bedg\//.test(ua);
  const isFirefox = /firefox|fxios/.test(ua);
  const isChrome = !isEdge && /chrome|crios/.test(ua);
  const isSafari = !isChrome && !isEdge && !isFirefox && /safari/.test(ua);

  if (isIOS) {
    // On iOS, web push exists ONLY inside an installed Home Screen app, and the
    // switch lives in iOS Settings — not in Safari.
    return input.standalone
      ? {
          platform: 'iPhone or iPad',
          steps: [
            'Open the iPhone Settings app.',
            'Tap Notifications, then find Setnayan in the list.',
            'Turn Allow Notifications on.',
            'Reopen Setnayan from your Home Screen.',
          ],
        }
      : {
          platform: 'iPhone or iPad',
          steps: [
            'Tap the Share button in Safari, then Add to Home Screen.',
            'Open Setnayan from the Home Screen icon — not from Safari.',
            'Turn this switch on there, and allow notifications when asked.',
          ],
        };
  }

  if (isAndroid) {
    return {
      platform: 'Android',
      steps: [
        'Tap the icon just left of the web address at the top.',
        'Tap Permissions, then Notifications.',
        'Switch it to Allow, then reload this page.',
      ],
    };
  }

  if (isFirefox) {
    return {
      platform: 'Firefox',
      steps: [
        'Click the icon just left of the web address.',
        'Find Notifications and clear the Blocked setting.',
        'Reload this page.',
      ],
      ...(isMac ? { systemNote: MAC_SYSTEM_NOTE } : {}),
    };
  }

  if (isSafari) {
    return {
      platform: 'Safari on Mac',
      steps: [
        'In the menu bar choose Safari, then Settings.',
        'Open the Websites tab, then Notifications in the sidebar.',
        'Find setnayan.com and set it to Allow.',
        'Reload this page.',
      ],
      systemNote: MAC_SYSTEM_NOTE,
    };
  }

  if (isChrome || isEdge) {
    return {
      platform: isEdge ? 'Edge' : 'Chrome',
      steps: [
        'Click the icon just left of the web address — it looks like sliders, or a lock.',
        'Find Notifications and set it to Allow.',
        'Reload this page.',
      ],
      ...(isMac ? { systemNote: MAC_SYSTEM_NOTE } : {}),
    };
  }

  return isMac ? { ...GENERIC, systemNote: MAC_SYSTEM_NOTE } : GENERIC;
}
