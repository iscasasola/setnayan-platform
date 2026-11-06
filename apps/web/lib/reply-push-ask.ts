/**
 * reply-push-ask.ts — WHEN GUESTS › LIST MAY ASK "GET A NOTICE ON THIS PHONE WHEN
 * GUESTS REPLY?", AND HOW IT REMEMBERS THE ANSWER.
 *
 * Owner, 2026-10-31: replies move from email to the phone ("The notification on
 * the phone not on the app"). Prod held ZERO push subscriptions, because the only
 * way to say yes was a switch buried in the profile. This is the one moment worth
 * asking: the host has a reply, and is looking at their guest list.
 *
 * The rules, each a branch below and each held by `reply-push-ask.test.ts`:
 *   · only once there is a reply to be told about (never on an empty list);
 *   · inside the iPhone app it is the NATIVE ask (APNs) — only on a build with the
 *     push plugin, and only while iOS has not been answered;
 *   · an answer — Yes OR Not now — is remembered, and asked again at most after
 *     30 days (no server field exists for it, so it is kept per device);
 *   · a device already subscribed, or one that has blocked notifications (which
 *     no code can re-open), is never asked;
 *   · iPhone Safari outside the Home Screen has no Web Push at all, so it is not
 *     asked Yes — it is told, once, how to get these;
 *   · any other browser without Web Push is not asked.
 * The delay (never on first paint) and the press-only permission prompt live in
 * the component; this decides only WHETHER.
 *
 * Pure: no window, no storage — the component hands in what it read.
 */

/** Same key shape as the guest seat ask (`setnayan_guest_push_asked_v1`), its own name. */
export const REPLY_ASK_KEY = 'setnayan_reply_push_ask_v1';

/** An answered ask may come back once this long has passed. Owner brief: "at most after 30 days". */
export const REPLY_ASK_REASK_MS = 30 * 24 * 60 * 60 * 1000;

/** Never on first paint: the sheet rises this long after Guests settles. */
export const REPLY_ASK_DELAY_MS = 2500;

/** 'native' = the same ask inside the iPhone app, whose Yes registers with APNs (lib/native-push.ts). */
export type ReplyAskMode = 'ask' | 'native' | 'ios-home-screen' | null;

export type ReplyAskInput = {
  /** Guests who have replied (attending + not attending), from the counts the list already draws. */
  replied: number;
  /** Inside the App Store / Play Store shell (`isStoreShellInBrowser`). */
  storeShell: boolean;
  /**
   * The iPhone app's own push permission (`nativePushPermission()`), or
   * 'unavailable' — the web, or an app build without the push plugin.
   */
  native: 'granted' | 'denied' | 'prompt' | 'unavailable';
  /** `webPushSupported()` — service worker, PushManager, Notification, a VAPID key. */
  supported: boolean;
  /** iPhone / iPad Safari in a tab, not opened from the Home Screen. */
  iosOutsideHomeScreen: boolean;
  /** `Notification.permission`, or 'unsupported' where the API is absent. */
  permission: 'default' | 'granted' | 'denied' | 'unsupported';
  /** This device already holds a push subscription. */
  subscribed: boolean;
  /** When this device last answered the ask (epoch ms), or null. */
  lastAnsweredAtMs: number | null;
  nowMs: number;
};

export function replyAskMode(i: ReplyAskInput): ReplyAskMode {
  if (i.replied <= 0) return null;
  if (i.lastAnsweredAtMs !== null && i.nowMs - i.lastAnsweredAtMs < REPLY_ASK_REASK_MS) return null;
  // Inside the app: Web Push does not exist there, so the ask is the NATIVE one —
  // only when the build carries the plugin and iOS has not been answered yet.
  if (i.storeShell) return i.native === 'prompt' ? 'native' : null;
  if (i.iosOutsideHomeScreen) return 'ios-home-screen';
  if (!i.supported) return null;
  if (i.permission === 'denied' || i.permission === 'unsupported') return null;
  if (i.subscribed) return null;
  return 'ask';
}

/** Reads the remembered answer. A blocked or private storage reads as "never answered". */
export function readLastAnswer(storage: Pick<Storage, 'getItem'> | null): number | null {
  try {
    const raw = storage?.getItem(REPLY_ASK_KEY) ?? null;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Remembers an answer (Yes, Not now, or Got it). A blocked storage is shrugged off. */
export function rememberAnswer(storage: Pick<Storage, 'setItem'> | null, nowMs: number): void {
  try {
    storage?.setItem(REPLY_ASK_KEY, String(nowMs));
  } catch {
    /* private browsing — worst case the ask may come back next visit, still once */
  }
}

/** The words, in one place so the screenshot, the test and the sheet agree. */
export const REPLY_ASK_COPY = {
  title: 'Get a notice on this phone when guests reply?',
  line: 'Each new reply replaces the last notice.',
  info: 'Only this phone, never an email. Each new reply replaces the last notice and counts who is new since you last looked — “Maria + 2 others replied”. Turn it off any time in Profile › Push notifications.',
  /** The visible line on iPhone Safari (owner brief, verbatim); the how is in the ⓘ. */
  iosLine: 'On iPhone, add Setnayan to your Home Screen to get these',
  /** The how, in one line, so the ⓘ fits above a bottom sheet. */
  iosHow: 'In Safari tap Share › Add to Home Screen, then open Setnayan from the new icon.',
  yes: 'Yes',
  notNow: 'Not now',
  gotIt: 'Got it',
} as const;
