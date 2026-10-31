/**
 * rsvp-push-grouping.ts — ONE PUSH PER HOST PER EVENT, AT MOST EVERY 20 MINUTES.
 *
 * Owner, 2026-10-31, verbatim: *"I keep getting email notifications everytime a
 * person confirms rsvp. How much does that cost us?"* → *"Can we make the
 * notification instead like facebook even if on website and app?"* → *"Yes. The
 * notification on the phone not on the app."*
 *
 * So a reply no longer EMAILS the hosts (`rsvp_received` left
 * `EMAIL_ENABLED_TYPES`) — it reaches the phone's lock screen, the way Facebook
 * says *"Maria and 2 others reacted"*: the first reply after a quiet stretch goes
 * out at once, and every reply after it inside the window waits and is folded
 * into ONE later notice, *"Maria + 2 others replied"*.
 *
 * 🔑 THE BELL IS UNCHANGED: one row per reply, as it always was. Only the phone
 * notice is grouped — and it is grouped from those same rows (their
 * `pushed_at`), so the tray and the phone can never disagree about who replied.
 *
 * ⚠ PURE ON PURPOSE. `rsvp-push.server.ts` imports 'server-only', so a
 * `tsx --test` file cannot reach it. Every decision that can be got wrong — is it
 * time, which rows go, what the notice says — lives HERE, where a test runs it.
 * 🔒 `lib/rsvp-push-grouping.test.ts`
 */

/** At most one phone notice per host per event inside this window. Owner: "15–30 minutes". */
export const RSVP_PUSH_WINDOW_MS = 20 * 60 * 1000;

/**
 * A reply older than this is never pushed — the bell has it. Stops the first
 * flush after deploy from summarising a month of replies nobody marked, and stops
 * a quiet event from receiving a notice about something from yesterday.
 */
export const RSVP_PUSH_HORIZON_MS = 2 * 60 * 60 * 1000;

/** How often the cron-free flush may look for replies left waiting at the end of a burst. */
export const RSVP_PUSH_FLUSH_GAP_MS = 5 * 60 * 1000;

/** One `notifications` row of type `rsvp_received`, as the grouping reads it. */
export type RsvpNoticeRow = {
  notification_id: string;
  title: string;
  body?: string | null;
  related_url: string | null;
  created_at: string;
  pushed_at: string | null;
  read_at: string | null;
};

export type GroupedPushDecision =
  | { send: true; ids: string[] }
  | { send: false; reason: 'nothing-waiting' | 'inside-window'; nextAtMs?: number };

function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Is it time to push, and which replies go in it?
 *
 *   · WAITING = not yet pushed, not yet seen in the app (a reply the host already
 *     opened in the bell is not news), and inside the horizon.
 *   · Nothing waiting → no notice.
 *   · The last notice went out less than a window ago → hold; the next reply
 *     after the window, or the flush, carries these.
 *   · Otherwise → push every waiting reply as ONE notice.
 */
export function decideGroupedPush(rows: readonly RsvpNoticeRow[], nowMs: number): GroupedPushDecision {
  let lastPush: number | null = null;
  for (const r of rows) {
    const p = ms(r.pushed_at);
    if (p !== null && (lastPush === null || p > lastPush)) lastPush = p;
  }
  const waiting = rows
    .filter((r) => r.pushed_at === null && r.read_at === null)
    .filter((r) => {
      const c = ms(r.created_at);
      return c !== null && nowMs - c <= RSVP_PUSH_HORIZON_MS;
    })
    .sort((a, b) => (ms(a.created_at) ?? 0) - (ms(b.created_at) ?? 0));
  if (waiting.length === 0) return { send: false, reason: 'nothing-waiting' };
  if (lastPush !== null && nowMs - lastPush < RSVP_PUSH_WINDOW_MS) {
    return { send: false, reason: 'inside-window', nextAtMs: lastPush + RSVP_PUSH_WINDOW_MS };
  }
  return { send: true, ids: waiting.map((r) => r.notification_id) };
}

/**
 * The guest's name, from the title `app/[slug]/actions.ts` writes — "Maria RSVP'd:
 * attending" or "Maria updated their details". Those are the only two shapes, and
 * `rsvp-push-grouping.test.ts` reads the emit site to hold them. Anything else →
 * "A guest", never a half-sentence.
 */
export function guestNameFromRsvpTitle(title: string): string {
  const t = title.trim();
  const m = /^(.+?) (?:RSVP'd: .+|updated their details)$/.exec(t);
  const name = m?.[1]?.trim();
  return name && name.length > 0 ? name : 'A guest';
}

export type GroupedPushText = { title: string; body: string | null; url: string; tag: string };

/**
 * What the phone says. One reply → that reply's own title, body and card. Several
 * → *"Maria + 2 others replied"* (the latest guest named; the others counted by
 * GUEST, so one guest who answered and then changed their meal is one person), and
 * a tap opens the guest list.
 *
 * `tag` is per event: on the device a newer notice REPLACES the older one for the
 * same event instead of stacking beside it.
 */
export function groupedPushText(rows: readonly RsvpNoticeRow[], eventId: string): GroupedPushText {
  const sorted = [...rows].sort((a, b) => (ms(a.created_at) ?? 0) - (ms(b.created_at) ?? 0));
  const latest = sorted[sorted.length - 1];
  const list = `/dashboard/${eventId}/guests`;
  const tag = `rsvp-${eventId}`;
  if (!latest) return { title: 'A guest replied', body: null, url: list, tag };
  const guests = new Set(sorted.map((r) => r.related_url ?? r.notification_id));
  const others = guests.size - 1;
  if (sorted.length === 1 || others === 0) {
    return { title: latest.title, body: latest.body ?? null, url: latest.related_url ?? list, tag };
  }
  const name = guestNameFromRsvpTitle(latest.title);
  return {
    title: `${name} + ${others} ${others === 1 ? 'other' : 'others'} replied`,
    body: 'Tap to see who is coming.',
    url: list,
    tag,
  };
}
