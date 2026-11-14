/**
 * 🔔 ONE NOTICE SYSTEM — the pure rules (owner approved 14 Nov 2026,
 * corpus `prototypes/notices_system_2026-11-14_fable.html`, DECISION_LOG 2026-11-14).
 *
 * Every added notice is one of FOUR kinds, and the kind decides its close word, where it may sit and when it may come
 * back. Nothing here touches the browser or the database — it is the rule, executed by `notices.test.ts`.
 *
 *   kind     close word   returns                                   place
 *   news     Got it       never (for that key)                       top
 *   todo     Not now      after 7 days, until done (the page stops   top
 *                         registering it). An ASK (turn on alerts…)
 *                         stops for good after its 2nd close.
 *   live     Hide         when the fact changes — the fact is IN     very top
 *                         the key. `closable: false` → no close at
 *                         all (it affects other people).
 *   offer    Not now      after 30 days                              end of the page, one per page
 *
 * At most TWO at the top (1 live + 1 line, or 2 lines); a guest page holds ONE. Priority:
 * live → blocking to-do → news (newest first) → other to-do → asks. An ask never takes the top while anything else is
 * waiting. Whatever does not fit goes behind "N more" (the bell's "Waiting on this page" group, or a guest's
 * "For you" sheet). Nothing here pops up by itself.
 */

export type NoticeKind = 'news' | 'todo' | 'live' | 'offer';
export type NoticeTone = 'info' | 'warning' | 'problem';

/** What a page tells the system about one notice. Content is drawn elsewhere; this is only what the rules read. */
export type NoticeFacts = {
  /** Stable, chosen by the code (e.g. `badge-earned:<shop>:<rung>`). Live notices put their FACT in the key. */
  key: string;
  kind: NoticeKind;
  /** A to-do that blocks money or guests ranks above news. */
  blocking?: boolean;
  /** A to-do that asks for a permission (alerts). Stops after its 2nd close; never takes the top while others wait. */
  ask?: boolean;
  /** Live only — false means no close word at all (it affects other people). Default true. */
  closable?: boolean;
  /** Live only. */
  tone?: NoticeTone;
  /** Epoch ms the news happened, for "newest first". */
  at?: number;
};

/** The memory of one close. */
export type CloseRecord = { closedAt: number; count: number };

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TODO_RETURN_DAYS = 7;
export const OFFER_RETURN_DAYS = 30;
export const ASK_MAX_CLOSES = 2;
export const TOP_MAX = 2;
export const GUEST_TOP_MAX = 1;
export const KEY_MAX = 200;

/** The word on the close button — decided by the kind, never typed per notice. null = no close. */
export function closeWord(n: Pick<NoticeFacts, 'kind' | 'closable'>): string | null {
  switch (n.kind) {
    case 'news':
      return 'Got it';
    case 'todo':
    case 'offer':
      return 'Not now';
    case 'live':
      return n.closable === false ? null : 'Hide';
  }
}

/** Is this notice closed right now, given its memory? */
export function isClosedNow(n: NoticeFacts, rec: CloseRecord | null | undefined, now: number): boolean {
  if (!rec) return false;
  switch (n.kind) {
    case 'news':
      return true;
    case 'live':
      // The fact is in the key, so a close holds until the fact (and so the key) changes.
      return n.closable !== false;
    case 'todo':
      if (n.ask && rec.count >= ASK_MAX_CLOSES) return true;
      return now - rec.closedAt < TODO_RETURN_DAYS * DAY_MS;
    case 'offer':
      return now - rec.closedAt < OFFER_RETURN_DAYS * DAY_MS;
  }
}

/** Lower is earlier. Offers are not ranked for the top; they live at the end. */
export function rank(n: NoticeFacts): number {
  if (n.kind === 'live') return 0;
  if (n.kind === 'todo' && n.blocking) return 1;
  if (n.kind === 'news') return 2;
  if (n.kind === 'todo' && !n.ask) return 3;
  if (n.kind === 'todo') return 4;
  return 5;
}

export type Arranged<T extends NoticeFacts> = {
  /** Drawn in the page's top slot, in order. */
  top: T[];
  /** Drawn at the end of the page (one offer). */
  end: T[];
  /** Behind "N more". */
  more: T[];
};

/**
 * Arrange the OPEN notices of one page. `hasTop` / `hasEnd` say whether the page put a slot there; a page with no
 * slot sends everything to "more" (the bell's tray).
 */
export function arrange<T extends NoticeFacts>(
  open: readonly T[],
  opts: { hasTop: boolean; hasEnd: boolean; guest?: boolean },
): Arranged<T> {
  const lines = open
    .filter((n) => n.kind !== 'offer')
    .slice()
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? (b.at ?? 0) - (a.at ?? 0) : 0));
  const offers = open.filter((n) => n.kind === 'offer');

  const max = opts.guest ? GUEST_TOP_MAX : TOP_MAX;
  const top: T[] = [];
  const more: T[] = [];
  const othersWaiting = lines.some((n) => !(n.kind === 'todo' && n.ask));
  let liveTaken = false;
  for (const n of lines) {
    const isAsk = n.kind === 'todo' && n.ask;
    const fits =
      opts.hasTop &&
      top.length < max &&
      !(isAsk && othersWaiting) &&
      !(n.kind === 'live' && liveTaken);
    if (fits) {
      top.push(n);
      if (n.kind === 'live') liveTaken = true;
    } else more.push(n);
  }

  const end: T[] = [];
  for (const o of offers) {
    if (opts.hasEnd && end.length === 0) end.push(o);
    else more.push(o);
  }
  return { top, end, more };
}

/** A key the table will take: trimmed to the column's 200 characters. */
export function safeKey(key: string): string {
  return key.slice(0, KEY_MAX);
}
