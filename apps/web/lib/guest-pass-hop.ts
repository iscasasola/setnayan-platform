/**
 * lib/guest-pass-hop.ts — THE REQUESTS THAT WRITE OR CLEAR THE GUEST PASS.
 *
 * The guest pass (`setnayan_guest_session`, lib/guest-session.ts) has exactly
 * one job on these requests: become what the guest just did. A personal link
 * (`/{slug}?invite=<token>` → `/{slug}/redeem`) REPLACES whatever pass the
 * phone held; a seat claim, a Papic hand-off and a sign-out write or clear it.
 *
 * 🔴 WHY THIS EXISTS (owner's live iPhone test, 2026-10-02, build 5666406): on
 * ONE phone — the host's own, used for weeks — a guest's personal link landed
 * on the Event Hub's "Get inside" instead of that guest's invitation, signed in
 * AND signed out, while the same link worked on another phone. The server hop
 * itself is deterministic (`app/[slug]/page.tsx` → `redeem/route.ts` sets the
 * pass → `invite/enter`), so what differs is the PHONE'S state, and two pieces
 * of it sat on that hop as second writers / interceptors:
 *
 *   1. `middleware.ts`'s sliding refresh re-signs whatever pass the REQUEST
 *      carried — signature only, no database check, so a rotated or replaced
 *      pass is re-signed too — and adds its Set-Cookie to the SAME response
 *      on which the redeem writes the new pass. Two writers of one cookie in
 *      one response, and which one the phone keeps is header order, not a
 *      decision.
 *   2. `public/sw.js` took the tokened navigation (`/{slug}?invite=…` is a
 *      bare guest slug to it) into its network-first handler, so the first hop
 *      ran through a service worker that only long-used phones have installed,
 *      with an offline fallback in front of it.
 *
 * ⚠ NEITHER IS PROVEN TO BE THAT PHONE'S CAUSE — the phone was not inspected
 * (no cookie dump, no service-worker state). They are the two device-dependent
 * things the trace found on the hop, so both are taken off it.
 *
 * 🔑 THE RULE NOW: on these requests nothing but the route itself touches the
 * pass, and the service worker leaves the navigation to the browser. One
 * writer per hop, the same on every phone.
 *
 * ⚠ `public/sw.js` cannot import this module (it is served as a plain file), so
 * it carries a copy of the same predicate; `guest-pass-hop.test.ts` runs BOTH
 * over one table of URLs and fails if they ever disagree.
 *
 * Pure. No I/O.
 */

/** The second path segment, under `/{slug}/…`, of a route that writes or clears the pass. */
const SLUG_PASS_ROUTES: ReadonlySet<string> = new Set(['redeem', 'sign-out']);

export function isGuestPassHop(pathname: string, search: string | URLSearchParams): boolean {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  // A personal link, before it has been redeemed — whatever path it rides on.
  if ((params.get('invite') ?? '').trim()) return true;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (pathname === '/auth/sign-out') return true;
  // /papic/me/<token>/session — the Papic hand-off mints the pass.
  if (segments[0] === 'papic' && segments[1] === 'me' && segments[3] === 'session') return true;
  if (segments.length >= 2 && SLUG_PASS_ROUTES.has(segments[1]!)) return true;
  // /{slug}/seat/claim — the seat QR mints the pass.
  if (segments[1] === 'seat' && segments[2] === 'claim') return true;
  return false;
}

/**
 * May the middleware slide the pass's expiry forward on this request? Only on
 * a plain read (GET / HEAD) that is not a pass hop. A POST is a Server Action —
 * the join door, the plus-one welcome and the QR rotation all write the pass
 * from one — and a refresh there is a second writer racing the action's own.
 */
export function mayRefreshGuestPass(method: string, pathname: string, search: string | URLSearchParams): boolean {
  const m = method.toUpperCase();
  if (m !== 'GET' && m !== 'HEAD') return false;
  return !isGuestPassHop(pathname, search);
}

/* ══ 2026-10-04 · THE CAUSE THAT WAS FOUND (I4) — A LINK PREVIEW DROPS THE TOKEN ══

   Measured against production (839e898) with curl, on maria-and-jose's test
   guest: a link-preview fetcher (Messenger / Facebook / iMessage — UA
   `facebookexternalhit`) that opens a personal link `/{slug}?invite=<token>`
   followed our 307s and ENDED somewhere without the token —

     · with no cookie jar: `/{slug}` (the Event Hub) — og:url `/{slug}`;
     · with a cookie jar:  `/{slug}/invite/enter` — og:url the site root.

   The preview card a chat app draws, and the address it opens when the card is
   tapped, are built from that final address / og:url. So the card under a
   personal link in Messenger pointed at the Event Hub with NO token, and a guest
   who tapped the card (not the blue text) met "Get inside" — signed in or out,
   on one phone and not on the phone that tapped the text. The fetcher also
   REDEEMED the guest's link on the way: a pass minted for a robot and a
   scan-trail row saying the guest opened it.

   🔑 THE RULE NOW: a personal link answers a link-preview fetcher in place — a
   200 whose og:url IS the personal link, no redirect, no redeem
   (`app/[slug]/page.tsx`). A person is never treated as a fetcher: the list
   below names only crawler agents that no person's browser sends — an in-app
   browser (FBAN/FB_IAB/Messenger/Instagram/Line/Viber) is NOT on it, and the
   table test in guest-pass-hop.test.ts holds real in-app UAs to `false`. */
/* + 2026-10-04 (train-g review): the chat apps big in the Philippines, each
   from a PUBLISHED string, never a guess —
     · Viber's link-sharing fetcher (Viber support, quoted on the Netlify forum
       thread "Prerendering: Viber support"): `Mozilla/5.0 (Macintosh; Intel Mac
       OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.6.0
       Chrome/45.0.2454.101 Safari/537.36 Viber` — a QtWebEngine agent ENDING in
       a bare "Viber", never the in-app browser's `… Viber/22.0.0.0`; and
       `ViberBot` (crawler lists: plainsignal.com/agents/viber-bot);
     · LINE's preview poker (udger.com "line-poker"):
       `facebookexternalhit/1.1;line-poker/1.0` — named on its own too;
     · Signal sends `WhatsApp/2` for its previews (Signal-Android
       LinkPreviewRepository), already caught by `WhatsApp\/`.
   Zalo is NOT listed: no published string could be found, and a guessed one
   could catch a person. */
const LINK_PREVIEW_FETCHER =
  /facebookexternalhit|\bFacebot\b|meta-externalagent|Twitterbot|WhatsApp\/|TelegramBot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|redditbot|Pinterestbot|Embedly|Googlebot|bingbot|Applebot|line-poker|\bViberBot\b|QtWebEngine\/[\d.]+ .*\bViber$/i;

export function isLinkPreviewFetch(userAgent: string | null | undefined): boolean {
  return LINK_PREVIEW_FETCHER.test(userAgent ?? '');
}

/** A personal-link token or a re-entry code as it may appear in a URL — and nothing else. */
const URL_SECRET_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;
export function isUrlSecretShaped(value: string | null | undefined): value is string {
  return URL_SECRET_SHAPE.test(value ?? '');
}

/* ══ RE-ENTRY CODES (I9 + the in-app "Open in Safari" hop) ════════════════════
   See supabase/migrations/20271263854263_a_guest_re_entry_code_is_single_use.sql.
   The code rides in the URL as `?k=`; the exchange is `/{slug}/redeem?k=` (a
   pass hop: the service worker and the middleware step aside, as for a token). */
export const REENTRY_PARAM = 'k' as const;
export type ReentryPurpose = 'landing' | 'tile';
/** How long a code lives. The landing code covers "Open in Safari" from a chat
 *  app's own menu (minutes); the tile code covers Add to Home Screen → first
 *  open of the tile (a day). After that one exchange the tile holds its own
 *  60-day pass, so the code is never needed again. */
export const REENTRY_TTL_SECONDS: Record<ReentryPurpose, number> = {
  landing: 30 * 60,
  tile: 24 * 60 * 60,
};
/** Where a successful exchange opens: the landing (from the landing), the reply's questions (from the
 *  landing's Reply — `replyEntry` below) or the Event Hub (the tile). */
export type ReentryDestination = 'landing' | 'reply' | 'hub';
export function reentryDestinationOf(raw: string | null | undefined): ReentryDestination {
  return raw === 'landing' || raw === 'reply' ? raw : 'hub';
}
/** The address a destination opens — built from the slug the DATABASE returned, never from input. */
export function reentryDestinationPath(slug: string, to: ReentryDestination): string {
  if (to === 'landing') return `/${slug}/invite/enter`;
  if (to === 'reply') return `/${slug}/invite/reply`;
  return `/${slug}`;
}
export function reentryRedeemPath(slug: string, code: string, to: ReentryDestination): string {
  const q = new URLSearchParams({ slug, [REENTRY_PARAM]: code, to });
  return `/${slug}/redeem?${q.toString()}`;
}

/* ══ THE REPLY CARRIES THE LANDING'S CODE (2026-10-12, live fault on d2e38b7) ══

   The owner opened a guest's personal link SIGNED OUT on maria-and-jose (dated,
   Invitation stage), saw the landing, pressed "Reply to the invitation" — and met
   the stranger door ("Get inside · Upload your QR · Sign in"). No questions.
   Production: the landing rendered WITH the pass (its re-entry code was never
   spent), the pass card read it a second later, and 13 s after that the Reply's
   request reached `invite/reply` with NO pass for this event, so the page's
   `redirect(/{slug})` sent the guest to the door. (Not reproduced in Chromium on
   the same guest; the browser was desktop Safari. The pass is ONE cookie per
   browser — any other pass write replaces it — so it can go missing between two
   pages. Why it did that day is not known.)

   The landing ALREADY holds the tool made for exactly this: its own single-use
   re-entry code (`?k=`, minted by the redeem). The Reply link dropped it, and the
   reply page had no fallback — the landing has one. THE RULE NOW: the Reply
   carries the landing's code, and the reply page, finding no pass, spends it at
   the redeem and comes back to the questions. Owner: "you can still reply
   without an account" — no sign-in and no account on this path, ever.
   A code is spent only when the pass is missing; a stranger with no code still
   meets the door. 🛡 app/[slug]/invite/reply/a-guest-without-the-pass-still-replies.test.ts */

/** The Reply's address: the questions, carrying the landing's own code when it has one. */
export function replyHrefCarrying(slug: string, code: string | null | undefined): string {
  const base = `/${slug}/invite/reply`;
  return isUrlSecretShaped(code) ? `${base}?${new URLSearchParams({ [REENTRY_PARAM]: code })}` : base;
}

/* 🧾 EVIDENCE (2026-10-12): a `rekey` or a `door` here writes ONE Problems-log row —
   `reply:rekey` / `reply:door` with what the browser held (`passHeldKind`: none = pass
   missing · other-event = a pass for another event · revoked = a pass that is unusable)
   and how many passes its pass book held — so the next occurrence says whether the
   pass was GONE or REPLACED (app/[slug]/invite/reply/page.tsx). */
export type ReplyEntry = { kind: 'ask' } | { kind: 'rekey'; href: string } | { kind: 'door'; href: string };
/** Who the reply page asks: the guest it holds a pass for; else, carrying a code, the guest that code
 *  re-keys (back to these questions); else nobody — the event's own door. */
export function replyEntry(input: { slug: string; hasPass: boolean; code: string | null | undefined }): ReplyEntry {
  if (input.hasPass) return { kind: 'ask' };
  if (isUrlSecretShaped(input.code)) return { kind: 'rekey', href: reentryRedeemPath(input.slug, input.code, 'reply') };
  return { kind: 'door', href: `/${input.slug}` };
}

/* ══ EVIDENCE — WHEN A PERSONAL-LINK VISIT DOES NOT END ON THE LANDING ════════
   One Problems-log row (`recordFault` → `app_fault_issues`), grouped per RULE,
   so the owner's rerun either proves the hop or catches the phone that breaks
   it. 🔒 NO TOKENS, NO CODES, NO NAMES: only the rule, the path TEMPLATE, the
   hop steps (route names), the UA FAMILY, what the phone held (a kind, never a
   value) and the service-worker rule for these steps. */
export type PassHopMissRule =
  | 'enter:no-key'
  | 'enter:guest-gone'
  | 'redeem:missing'
  | 'redeem:unknown-token'
  | 'reentry:refused'
  /** The Reply found no pass for this event and spent the landing's code (`replyEntry` → rekey). */
  | 'reply:rekey'
  /** The Reply found no pass for this event and no code: the event's own door. */
  | 'reply:door';

export type PassHopHeld = 'none' | 'other-event' | 'revoked' | 'this-event';

/**
 * What the phone held, as a KIND — the ONE answer both the redeem and the
 * landing log. 🔴 2026-10-04 (train-g audit): the redeem's `reentry:refused`
 * logged `other-event` whenever the phone held ANY pass, so a pass for THIS
 * event and another guest (the host's own phone) read as a different event.
 *
 *   · no cookie at all → `none`;
 *   · a cookie that does not verify (expired, rotated, forged) → `revoked`;
 *   · a pass for this event (any guest of it) → `this-event`;
 *   · a pass for another event → `other-event`.
 */
export function passHeldKind(input: {
  cookiePresent: boolean;
  pass: { event_id: string } | null | undefined;
  eventId: string;
}): PassHopHeld {
  if (!input.cookiePresent) return 'none';
  if (!input.pass) return 'revoked';
  return input.pass.event_id === input.eventId ? 'this-event' : 'other-event';
}

export function uaFamily(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  if (!ua) return 'none';
  if (isLinkPreviewFetch(ua)) return 'link-preview';
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : /Macintosh|Windows|Linux|CrOS/i.test(ua) ? 'desktop' : 'other';
  const app =
    /SetnayanApp/.test(ua) ? 'setnayan-app'
    : /Messenger|FBAN\/Messenger|MessengerForiOS|\bOrca-Android/i.test(ua) ? 'messenger'
    : /Instagram/i.test(ua) ? 'instagram'
    : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) ? 'facebook'
    : /\bLine\//i.test(ua) ? 'line'
    : /Viber/i.test(ua) ? 'viber'
    : /MicroMessenger/i.test(ua) ? 'wechat'
    : /CriOS|Chrome\//i.test(ua) && !/Edg\//i.test(ua) ? 'chrome'
    : /FxiOS|Firefox\//i.test(ua) ? 'firefox'
    : /Edg(iOS|A)?\//i.test(ua) ? 'edge'
    : /Version\/[\d.]+.*Safari\//i.test(ua) ? 'safari'
    // An iOS WebKit page with no "Safari/" token is a web view: a home-screen
    // web app, or an app's own browser.
    : os === 'ios' && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) ? 'ios-webview'
    : 'other';
  return `${os}/${app}`;
}

export type PassHopMiss = {
  rule: PassHopMissRule;
  /** Route names only — e.g. ['link', 'redeem', 'enter']. */
  steps: readonly string[];
  userAgent: string | null | undefined;
  held: PassHopHeld;
  /** Whether a re-entry code rode the URL (never its value). */
  carriedCode: boolean;
  /** For `reentry:refused`: why (expired · used · unknown · wrong-event · guest-gone). */
  reason?: string;
  /** How many passes the browser's pass book held (lib/guest-pass-book.ts) — a COUNT, never a value. */
  bookPasses?: number;
};

const MISS_PATH: Record<PassHopMissRule, string> = {
  'enter:no-key': '/[slug]/invite/enter',
  'enter:guest-gone': '/[slug]/invite/enter',
  'redeem:missing': '/[slug]/redeem',
  'redeem:unknown-token': '/[slug]/redeem',
  'reentry:refused': '/[slug]/redeem',
  'reply:rekey': '/[slug]/invite/reply',
  'reply:door': '/[slug]/invite/reply',
};

/** The `recordFault` input for one miss — pure, so the test can read exactly what is stored. */
export function passHopMissFault(miss: PassHopMiss) {
  return {
    kind: 'DEAD_END' as const,
    action: `guest-pass-hop#${miss.rule}`,
    message: miss.rule.startsWith('reply:')
      ? `The Reply found no pass for this event (${miss.rule}, held ${miss.held})`
      : `A personal-link visit did not land on the invitation (${miss.rule}${miss.reason ? `: ${miss.reason}` : ''})`,
    filePath: MISS_PATH[miss.rule],
    trace: {
      rule: miss.rule,
      path: MISS_PATH[miss.rule],
      steps: miss.steps.slice(0, 8).join('>'),
      ua: uaFamily(miss.userAgent),
      held: miss.held,
      code: miss.carriedCode ? 'carried' : 'none',
      ...(miss.reason ? { why: miss.reason } : {}),
      ...(typeof miss.bookPasses === 'number' ? { book: miss.bookPasses } : {}),
      // The service worker is not on these steps BY RULE (isGuestPassHop above;
      // `/{slug}/invite/enter` is not a day-of navigation in public/sw.js), so
      // it cannot have answered them — the server cannot observe the worker
      // itself, and says so rather than guess.
      sw: 'off-hop-by-rule',
    },
  };
}
