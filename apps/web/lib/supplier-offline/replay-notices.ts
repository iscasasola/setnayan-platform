// 📶 A PHONE CATCHING UP RINGS EACH PERSON ONCE (controller review #2 item 16; owner 2026-11-24, DECISION_LOG "The
// supplier dashboard works offline and catches up when back online").
//
// A supplier who worked an expo with no signal comes back online and their phone sends, say, ten queued actions one
// after another. Each one is replayed through the SHIPPED action (`engine.server.ts`), and each shipped action tells
// whoever it concerns — so the couple's phone would ring ten times in a minute for one afternoon's work. So while the
// engine replays a queued action, a notice the recipient is ALREADY holding unread — the same kind, about the same
// place, from the last 30 minutes — is not sent again (no second bell row, no second email, no second phone notice).
// The first one already takes them there, and a message written offline says so on itself ("written 2:14 PM
// (offline)"). Outside a replay nothing changes. No new notice or email type.
//
//   · THE REPLAY IS A SCOPE, NOT A FLAG: `runAsOfflineReplay` wraps exactly the replay (Node's AsyncLocalStorage), so a
//     notice sent by anything else in the same server — another request, the same request after the replay — is not
//     touched.
//   · FAILS TOWARD RINGING: a refused or unreadable read of the standing notices sends the notice (the samahan rule,
//     `lib/samahan-notice-rules.ts`): a duplicate is noise, a lost notice is the defect.
//   · A WINDOW, NOT "ANY UNREAD": a notice from last week that was never marked read must not silence today's.
import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

export type OfflineReplay = { member: string; shop: string; phoneTime: string };

const replays = new AsyncLocalStorage<OfflineReplay>();

/** Run one queued action's replay; every notice it sends is grouped per recipient (`alreadyRangForReplay`). */
export function runAsOfflineReplay<T>(replay: OfflineReplay, fn: () => Promise<T>): Promise<T> {
  return replays.run(replay, fn);
}

/** The replay this code is running inside, or null (an ordinary request). */
export function offlineReplayNow(): OfflineReplay | null {
  return replays.getStore() ?? null;
}

/** How long a standing unread notice groups a phone's catch-up behind it. */
export const REPLAY_GROUP_WINDOW_MS = 30 * 60 * 1000;

/**
 * Is the recipient already holding this notice? `standing` = the created_at of their unread notices of this kind about
 * this place; `null` = the read was refused or unreadable → false (ring). An unreadable time never mutes anybody.
 */
export function alreadyRangForReplay(standing: readonly string[] | null, now: number = Date.now()): boolean {
  if (!standing) return false;
  return standing.some((at) => {
    const t = Date.parse(at);
    return Number.isFinite(t) && now - t >= 0 && now - t < REPLAY_GROUP_WINDOW_MS;
  });
}
