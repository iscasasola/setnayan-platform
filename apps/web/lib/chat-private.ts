/**
 * 🔒 A PRIVATE MESSAGE INSIDE THE SHARED CHAT (DECISION_LOG 2026-11-09 🔒 — owner: *"when they press a specific icon on
 * the who is on, will send a specific message just for them. like a private message"*, then *"Inside the shared
 * chat"*, then *"need to make it evident a private message"*).
 *
 * A message with a recipient is seen by its sender and that ONE person only — enforced by RLS on `chat_messages`
 * (Lane B's migration: the recipient column + the SELECT rule; NULL = everyone in the thread), never by hiding it in the
 * UI. WORDS ONLY (owner correction, 9 Nov: *"private messages are just words. everything else is public."*): no photo,
 * no file, no card — quotes, payments, changes, forms, decisions and booking cards always go through the shared chat
 * (💬 8 Nov). So while the private chip is on the composer hides the ＋ and every attach (paperclip · camera · photo), and
 * the server refuses a private message that carries a file.
 *
 * PURE — no React, no I/O. 🔒 lib/a-private-message-looks-private.test.ts
 */

/**
 * The recipient column on `chat_messages`. ⚠ Lane B's migration owns the column; this is the ONE place its name is
 * written in the app, so a rename is one line. TODO(Build 3 · Lane B): confirm the name against the merged migration.
 */
export const CHAT_PRIVATE_RECIPIENT_COLUMN = 'recipient_user_id' as const;

/** The form field the composer posts the recipient in (never the column name — the server maps it). */
export const CHAT_PRIVATE_FIELD = 'private_to' as const;

/** The one refusal a private message with a file gets — the composer's line and the server's net say the same words. */
export const PRIVATE_WORDS_ONLY_MESSAGE = 'A private message is words only — send the file to everyone instead.';

/**
 * 🔒 PRIVATE IS SKY BLUE (owner, 9 Nov: "why red? use sky blue" — corpus 48503b43, 701b38a3). Its own token family in
 * globals.css, `--color-private` (#0284C7 · dark #38BDF8), `--color-private-text` (#0369A1 · dark #38BDF8) and
 * `--color-private-tint` (#E0F2FE · dark #263638) — never `--color-info`'s slate, never the brand. ONE colour for the
 * whole private composer (box, its focus ring, 🔒, ×, Send), the private bubble and its strip. No normal bubble uses it.
 * MEASURED (WCAG relative luminance):
 *   light · ink #2C2A29 on the tint 12.45 · label #0369A1 on the tint 5.17, on white 5.93 · #0284C7 on white 4.10 (UI)
 *   dark  · ink #FBFAF7 on the tint 12.07 · #38BDF8 on the tint 5.88, on the page 8.46, on the card 7.59
 */
export const PRIVATE_BUBBLE_FILL = 'bg-[rgb(var(--color-private-tint))] text-ink ring-1 ring-inset ring-[rgb(var(--color-private)/0.45)]';
/** The private strip's words ("🔒 Private · only you and Jose") — the private TEXT token (≥ 4.5 on the tint). */
export const PRIVATE_STRIP_TEXT = 'text-[rgb(var(--color-private-text))]';
/** The private marks that are not words — the box's 🔒, its ×, Send, the time row's lock (UI contrast ≥ 3). */
export const PRIVATE_MARK = 'text-[rgb(var(--color-private))]';
/** The message box in private mode — the private OUTLINE (owner, 9 Nov: inside the box, no extra row). */
/** The private box's fill (v8.3): the sky tint, its placeholder in the sky label ink (5.17:1 on the tint, light). */
export const PRIVATE_BOX_FILL = 'bg-[rgb(var(--color-private-tint))] placeholder:text-[rgb(var(--color-private-text))]';
export const PRIVATE_BOX_OUTLINE = 'ring-2 ring-inset ring-[rgb(var(--color-private))]';
/** …and its focus ring — sky blue, never the brand's (owner, 9 Nov: the brand ring showed inside the private box). */
export const PRIVATE_FOCUS_RING = 'focus:ring-2 focus:ring-[rgb(var(--color-private)/0.35)]';

/** The person a private chip is addressed to. */
export type PrivateTo = { userId: string; name: string };

/**
 * 🔒 SEVERAL PEOPLE (DECISION_LOG 2026-11-12 "PRIVATE MESSAGES — TWO DOORS, SEVERAL PEOPLE"): a private line may go to
 * several people — the column is `recipient_user_ids` (migration 20271340374819; `recipient_user_id` stays its first
 * entry, so every "IS NULL = shared" test keeps its meaning). The composer posts one `private_to` field per person.
 */
export const CHAT_PRIVATE_RECIPIENTS_COLUMN = 'recipient_user_ids' as const;

/** "Ana" · "Ana and Miguel" · "Ana, Miguel and Tita Lu" — the house's list words (never an Oxford comma). */
export function joinNames(names: readonly string[]): string {
  const list = names.filter((n) => n.trim().length > 0);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

const asList = (names: string | readonly string[]): readonly string[] => (typeof names === 'string' ? [names] : names);

/**
 * The strip on top of every private bubble — the same words on the sender's side and every recipient's. Each reader sees
 * the OTHER people (their own name never appears): "Private · only you and Jose" · "Private · only you, Ana and Miguel".
 */
export function privateStripLabel(names: string | readonly string[]): string {
  const list = asList(names);
  return list.length > 1 ? `Private · only you, ${joinNames(list)}` : `Private · only you and ${joinNames(list)}`;
}

/**
 * The EMPTY message box in private mode (owner, 9 Nov: private messaging happens INSIDE the message box — no chip row,
 * no "Message privately | Cancel" row; a 🔒 at its left, an × inside at its right, back to "Message" for everyone).
 * Replaces the earlier "Messaging [name] privately ×" chip.
 */
export function privateBoxPlaceholder(names: string | readonly string[]): string {
  return `Private message to ${joinNames(asList(names))}`;
}

/**
 * The OTHER person in a private message, as this viewer sees it: the recipient when you sent it, the sender when it was
 * sent to you. `null` = not a private message (everyone in the thread sees it).
 */
export function privateOtherId(
  m: { sender_user_id: string | null; recipient_user_id?: string | null },
  viewerUserId: string,
): string | null {
  const to = m.recipient_user_id ?? null;
  if (!to) return null;
  return m.sender_user_id === viewerUserId ? to : m.sender_user_id ?? to;
}

/** The row shape a private line is judged from (both columns optional: an older read selects only the first). */
type PrivateRow = { sender_user_id: string | null; recipient_user_id?: string | null; recipient_user_ids?: readonly string[] | null };

/** Everyone a private line is to — the list, or (an older read) its one recipient. `[]` = a line to everyone. */
export function privateRecipientIds(m: PrivateRow): string[] {
  if (m.recipient_user_ids && m.recipient_user_ids.length > 0) return [...m.recipient_user_ids];
  return m.recipient_user_id ? [m.recipient_user_id] : [];
}

/**
 * The OTHER people in a private line, as this viewer sees it: the sender and every recipient, the viewer left out.
 * `[]` = not a private message. A recipient sees the sender first, then the rest.
 */
export function privateOtherIds(m: PrivateRow, viewerUserId: string): string[] {
  const to = privateRecipientIds(m);
  if (to.length === 0) return [];
  const all = m.sender_user_id && m.sender_user_id !== viewerUserId ? [m.sender_user_id, ...to] : to;
  return [...new Set(all)].filter((id) => id !== viewerUserId);
}

/**
 * 🔁 A REPLY GOES TO THE SAME PEOPLE (owner, 12 Nov, "EVENT GROUP CHATS APPROVED AS DRAWN" (3)): who a reply to this
 * private line is private to — its sender and its other recipients, never yourself. The same list as
 * `privateOtherIds`; named for what the composer does with it.
 */
export const privateReplyIds = privateOtherIds;

/**
 * The latest private line written TO this viewer by someone else — the one the 🔒 pre-ticks for a reply. `null` when the
 * newest private line in view is the viewer's own (they already chose) or there is none.
 */
export function latestPrivateReply<T extends PrivateRow>(messages: readonly T[], viewerUserId: string): string[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (privateRecipientIds(m).length === 0) continue;
    if (m.sender_user_id === viewerUserId) return null;
    return privateReplyIds(m, viewerUserId);
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The posted recipient, or null — a missing, blank or malformed value is a message to everyone, and so is yourself. */
export function privateToFromForm(raw: FormDataEntryValue | null, senderUserId: string | null): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!UUID.test(v)) return null;
  return v === senderUserId ? null : v;
}

/**
 * Every posted recipient (`formData.getAll('private_to')`), de-duplicated, malformed values and yourself dropped. `[]` =
 * a message to everyone. At most 50 — the database's own ceiling (CHECK chat_messages_recipients_agree).
 */
export function privateToListFromForm(raws: readonly FormDataEntryValue[], senderUserId: string | null): string[] {
  const out: string[] = [];
  for (const raw of raws) {
    const v = privateToFromForm(raw, senderUserId);
    if (v && !out.includes(v)) out.push(v);
    if (out.length === 50) break;
  }
  return out;
}
