/**
 * event-settings-record.ts — ONE HOME PER SETTING: the port-control map of every settings row and the one menu it
 * lives on (`SETTINGS_ROWS`).
 *
 * Owner, 2026-10-26: *"each menu has their own settings. Keep it on their respective menus… Make sure it is for them,
 * it is correct and it is clustured and arranged properly"*; approved 2026-10-27 (DECISION_LOG "APPROVED — SETTINGS
 * PER MENU, ALL SIX CALLS AS RECOMMENDED"; `prototypes/settings_per_menu_2026-10-26/` PLAN.md § 2 · § 7, INVENTORY.md
 * § B). Each row names its menu, its cluster in that menu's sheet, and its one writer — so "no setting lives in two
 * places" is a test (`one-home-per-setting.test.ts`), not a promise.
 *
 * Rows join this map in the PR that moves them home (PLAN § 5, A → F): B moved Guests' rows here.
 *
 * Keys are the rows' own `data-setup-row` hooks where the row already had one, so `?settings=1&row=<key>` lands on
 * the drawn row with nothing translated.
 *
 * Neutral module (no I/O): the pages, the redirects and the guards read it.
 */
import type { SettingsMenu } from './menu-settings';

export type SettingsRow = {
  menu: SettingsMenu;
  /** The cluster head the row sits under in its menu's sheet. */
  cluster: string;
  /** The one writer — a server action's name, or the page a row opens (`/…`) when the row is a door to a list. */
  writer: string;
};

/** Guests ⚙ — the three clusters, in order (prototype § 4). */
export const GUESTS_SETTINGS_CLUSTERS = ['Getting in', 'Replies', 'Closing the list'] as const;

export const SETTINGS_ROWS = {
  /* ── Guests ⚙ (PR B) ── */
  'get-in': { menu: 'guests', cluster: 'Getting in', writer: 'hubDraftAction' },
  invitations: { menu: 'guests', cluster: 'Getting in', writer: '/guests/send' },
  'one-link': { menu: 'guests', cluster: 'Getting in', writer: 'readOneLink' },
  asks: { menu: 'guests', cluster: 'Replies', writer: 'hubDraftAction' },
  /**
   * 📅 ONE DATE, ONE ROW. Event Details drew `guests.guest_list_edit_deadline` twice — "Reply by" (How it works) and
   * "Guest list closes" (Guests & money) — two names over ONE column and one writer (`updatePaxSettings`), and since
   * the owner's 2026-09-30 ruling no date closes the list (only Finalize does, `lib/guest-list-closed.ts`). So the
   * plan's "Guest list closes ›" row is this row: Reply by, in Replies. "Closing the list" holds Finalize.
   */
  'reply-by': { menu: 'guests', cluster: 'Replies', writer: 'updatePaxSettings' },
  requests: { menu: 'guests', cluster: 'Replies', writer: '/guests/claims' },
  finalize: { menu: 'guests', cluster: 'Closing the list', writer: 'setGuestListFinalized' },
} as const satisfies Record<string, SettingsRow>;

export type SettingsRowKey = keyof typeof SETTINGS_ROWS;

export function isSettingsRowKey(v: unknown): v is SettingsRowKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SETTINGS_ROWS, v);
}

/** The rows of one menu, in map order. */
export function settingsRowsOf(menu: SettingsMenu): SettingsRowKey[] {
  return (Object.keys(SETTINGS_ROWS) as SettingsRowKey[]).filter((k) => SETTINGS_ROWS[k].menu === menu);
}

/** Guests ⚙, open — and, with a row, scrolled to it. The ⚙ press opens it in place; this is for links. */
export function guestsSettingsHref(eventId: string, row?: SettingsRowKey): string {
  return `/dashboard/${eventId}/guests?settings=1${row ? `&row=${row}` : ''}`;
}

/**
 * Event Details rows that LEFT for Guests ⚙ (PR B) → the row they are now. `/details/field/<old>` forwards there
 * (`lib/legacy-redirects.ts`) — digest emails, bookmarks and old tours still land on the control.
 */
export const DETAILS_ROWS_MOVED_TO_GUESTS = {
  'guests-get-in': 'get-in',
  'rsvp-questions': 'asks',
  'reply-by': 'reply-by',
  'list-closes': 'reply-by',
} as const satisfies Record<string, SettingsRowKey>;
