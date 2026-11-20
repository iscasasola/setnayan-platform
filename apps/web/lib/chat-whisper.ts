/**
 * 🤫 MESSAGE ⇄ WHISPER (DECISION_LOG 2026-11-19 — "MESSAGE ⇄ WHISPER APPROVED" (drawing v15/v16), "MIS-SEND REMINDER +
 * WHISPER TYPING", "WHISPER UN-PARKED"; drawing `prototypes/chat_send_to_private_2026-11-19.html`).
 *
 * A host drags the message box right → the next lines are WHISPERS: read by the co-hosts in this chat only, never by
 * the supplier. It stays on until the box is dragged again, and the switch itself never sends.
 *
 * 🔑 NO NEW COLUMN. A whisper IS the shipped private line (`lib/chat-private.ts`, migration 20271340374819): a
 * `chat_messages` row whose recipient list is the co-hosts. Who can read it is the database's RESTRICTIVE
 * policy `chat_messages_private_reaches_its_people`, and every other read path (notices, pings, previews, exports)
 * already treats a private line as private. What whisper adds is WHO DECIDES THE LIST: the server does
 * (`whisperRecipients` below, read in `sendChatMessageCore`), never the browser — so a whisper can not be addressed to
 * the shop, and a whisper with nobody to hear it is REFUSED, never sent to everyone.
 *
 * PURE — no React, no I/O. 🔒 lib/a-whisper-never-reaches-the-supplier.test.ts
 */
import { privateRecipientIds } from './chat-private';
import { MOVE_MS, QUICK_MS, RISE_MS_STANDARD, TAP_MS } from './motion-table';

/** The form field the host's composer posts while whisper is on. Its VALUE is never read as a list of people. */
export const CHAT_WHISPER_FIELD = 'whisper' as const;

/** The two placeholders of the one box (owner: *"or just Message and Whisper"*). */
export const MESSAGE_PLACEHOLDER = 'Message';
export const WHISPER_PLACEHOLDER = 'Whisper';

/** The strip on top of a whispered line — the same words for its sender and every co-host. No lock: it is a whisper. */
export const WHISPER_STRIP = 'Whisper · co-hosts only';
/** The line over the box while whisper is on / right after it goes off with an empty box. */
export const WHISPER_ON_LINE = 'Whispering · co-hosts only · swipe to end';
export const WHISPER_OFF_LINE = 'Back to everyone';

/** The mis-send reminder: the line over the box once you are back on Message with words still typed… */
export function everyoneWillSeeLine(supplierName: string): string {
  return `Everyone will see this, including ${supplierName}.`;
}
/** …and the ONE ask on the first Send after that. */
export const LEFT_WHISPER_ASK = 'You left Whisper. Send to everyone?';
export function leftWhisperAskBody(supplierName: string): string {
  // The team's box names the other side in lower case ("the hosts") — a sentence still starts with a capital.
  return `${supplierName.charAt(0).toUpperCase()}${supplierName.slice(1)} will see it.`;
}

/** A whisper is words only, like every private line (owner, 9 Nov) — the composer's line and the server's say the same. */
export const WHISPER_WORDS_ONLY_MESSAGE = 'A whisper is words only — send the file to everyone instead.';
/** Nobody to whisper to. Said in words; the line is NOT sent (never to everyone). */
export const WHISPER_NO_COHOSTS_MESSAGE = 'No co-host is in this chat to whisper to — your whisper was not sent.';
/** Only a host in this chat, or the event's coordinator, whispers on the hosts' side. */
export const WHISPER_HOSTS_ONLY_MESSAGE = 'Only a host in this chat or the event’s coordinator can whisper — your whisper was not sent.';
/** The box's own line when a drag finds nobody to whisper to. */
export const WHISPER_NOBODY_LINE = 'No co-host is in this chat yet. Add one to whisper.';

/**
 * ⚠ THE READ FAILED — said as a failure, never as "nobody is here". A failed read of who is in the chat used to come
 * back as an empty list, and the box and the send core then told a host with co-hosts that there were none: a failure
 * rendered identically to emptiness. These words are distinct from the two above, so the two cases can never be
 * mistaken for each other. 🔒 lib/a-failed-whisper-read-is-not-nobody.test.ts
 */
export const WHISPER_UNREAD_MESSAGE = "Couldn't check who is in this chat — your whisper was not sent. Try again.";
export const WHISPER_UNREAD_LINE = "Couldn't load the co-hosts in this chat. Try again in a moment.";

/** What the box says when a drag cannot turn whisper on — `null` when it can. The failed read wins over the count. */
export function whisperBlockedLine(w: { coHosts: number; unread?: boolean; side?: 'hosts' | 'team' }): string | null {
  if (w.unread) return w.side === 'team' ? WHISPER_TEAM_UNREAD_LINE : WHISPER_UNREAD_LINE;
  if (w.coHosts <= 0) return w.side === 'team' ? WHISPER_NO_TEAM_LINE : WHISPER_NOBODY_LINE;
  return null;
}

/** "Maria is whispering…" — to the co-hosts only; the supplier is sent nothing at all. */
export function whisperingLine(name: string): string {
  return `${name} is whispering`;
}

/** True when the posted field says whisper. Anything else — absent, blank, a list of ids — is a normal message. */
export function whisperFromForm(raw: FormDataEntryValue | null): boolean {
  return raw === '1';
}

/**
 * 🔒 WHO HEARS A WHISPER — decided on the server from the thread's own rows, never from the browser:
 * the hosts in this chat now (`chat_thread_members`, `left_at IS NULL`) AND the event's coordinators (owner, 20 Nov:
 * *"host and coordinator can whisper to each other"* — `coordinatorIds`), the sender left out, and ANYONE ON THE SHOP'S
 * SIDE left out (one login can be a host AND the shop's owner or team member — that login is the supplier here).
 * `[]` = nobody to hear it → the caller refuses the send.
 */
export function whisperRecipients(input: {
  hostMemberIds: readonly string[];
  coordinatorIds?: readonly string[];
  shopUserIds: readonly string[];
  senderUserId: string;
}): string[] {
  const shop = new Set(input.shopUserIds);
  const out: string[] = [];
  for (const id of [...input.hostMemberIds, ...(input.coordinatorIds ?? [])]) {
    if (!id || id === input.senderUserId || shop.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

// ── TWO SIDES (Unichat part E, owner 19–20 Nov) ─────────────────────────────────────────────────────────────────────
/**
 * Which side a whisper is on — STORED with the line (`chat_messages.whisper_side`, migration 20271354185201), so its
 * label never drops off (safety review, 19 Nov). The database re-judges the sender and every recipient against it and
 * reads the line only to someone on that side NOW (a removed co-host, coordinator or team member reads nothing).
 *   hosts  the hosts in the chat + the event's coordinators — never the shop.
 *   team   the shop's own people (owner + live team members) — never a host or a coordinator.
 */
export type WhisperSide = 'hosts' | 'team';
export const CHAT_WHISPER_SIDE_COLUMN = 'whisper_side' as const;

/** The stored side, read safely: anything else is "not a whisper". */
export function whisperSideOf(raw: unknown): WhisperSide | null {
  return raw === 'hosts' || raw === 'team' ? raw : null;
}

/**
 * 🔒 WHO HEARS A TEAM WHISPER — the shop's people who may chat here (`readShopChatPeople`: the owner, owner/admin
 * members, a member below admin on an event their service serves; a deactivated member never), the sender left out.
 * A login that is ALSO a host is still on the shop's side here, so it stays on the list. `[]` → refused.
 */
export function teamWhisperRecipients(input: { teamUserIds: readonly string[]; senderUserId: string }): string[] {
  const out: string[] = [];
  for (const id of input.teamUserIds) {
    if (!id || id === input.senderUserId || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/** Only the people on the shop's side whisper to the team. */
export const WHISPER_TEAM_ONLY_MESSAGE = 'Only the shop’s own team can whisper here — your whisper was not sent.';
/** Nobody else on the team is in this chat. Refused, never sent to everyone. */
export const WHISPER_NO_TEAM_MESSAGE = 'No one else on your team is in this chat — your whisper was not sent.';
export const WHISPER_NO_TEAM_LINE = 'No one else on your team is in this chat yet.';
export const WHISPER_TEAM_UNREAD_LINE = "Couldn't load your team for this chat. Try again in a moment.";

/** The team whisper reaches — the composer's line (the prototype's words). */
export const WHISPER_TEAM_REACH = 'Only your team';
/**
 * 🛡 What the ⓘ beside the line says (safety review F7, 19 Nov): staff can read a private line inside an open dispute,
 * so "only" must say so — the database's own arm (`chat_private_in_dispute`).
 */
export const WHISPER_DISPUTE_NOTE = 'Setnayan staff can read it only while a dispute about this booking is open.';

/**
 * "Only you, Ana and your coordinator" — who a hosts' whisper reaches, said to the person about to whisper. `names` =
 * the OTHER hosts in this chat by first name; `coordinators` = how many coordinators (other than the viewer) hear it.
 * A coordinator whispering sees the hosts by name. Nobody → `null` (the box says so in its own words).
 */
/** The coordinator's line, word for word from the drawing (UNICHAT-LIVE 20 Nov; controller under owner delegation 20 Nov). */
export const WHISPER_COORDINATOR_REACH = 'You and the hosts';

export function hostsWhisperReach(input: {
  names: readonly string[];
  coordinators: number;
  /** The writer IS a coordinator: the drawing's line, "You and the hosts" — never names, never "your coordinator". */
  viewerIsCoordinator?: boolean;
}): string | null {
  const parts = input.names.filter((n) => n.trim().length > 0);
  // Nobody to hear it is still nobody, for a coordinator too (the box then says so — never "the hosts").
  if (input.viewerIsCoordinator) return parts.length + input.coordinators > 0 ? WHISPER_COORDINATOR_REACH : null;
  if (input.coordinators === 1) parts.push('your coordinator');
  else if (input.coordinators > 1) parts.push('your coordinators');
  if (parts.length === 0) return null;
  return parts.length === 1 ? `Only you and ${parts[0]}` : `Only you, ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The strip across a whispered bubble, by side. The hosts' names the supplier who cannot see it. */
export function whisperStrip(side: WhisperSide, supplierName: string): string {
  return side === 'team' ? 'Whisper · your team only' : `Whisper · ${supplierName} can’t see`;
}

/**
 * Is this line a whisper, as THIS viewer reads it? The stored side decides (`whisper_side`); a line written before the
 * column falls back to the 19 Nov inference (`isWhisperLine` — the hosts' side only, exactly the co-hosts).
 */
export function whisperSideOfLine(
  m: Parameters<typeof privateRecipientIds>[0] & { sender_role?: string | null; whisper_side?: string | null },
  legacy: { viewerRole: 'couple' | 'vendor'; coHostIds: readonly string[] | null | undefined; viewerUserId: string },
): WhisperSide | null {
  const stored = whisperSideOf(m.whisper_side);
  if (stored) return stored;
  if (legacy.viewerRole === 'couple' && isWhisperLine(m, legacy.coHostIds, legacy.viewerUserId)) return 'hosts';
  return null;
}

/**
 * Is this private line a WHISPER, as a host reads it? Its people (sender + recipients) are exactly the co-hosts in the
 * chat — every one of them, and nobody else. (No column says so: a private line to every co-host IS a whisper.)
 * `coHostIds` = the OTHER hosts in this chat (the viewer left out). Empty → never a whisper.
 */
export function isWhisperLine(
  m: Parameters<typeof privateRecipientIds>[0] & { sender_role?: string | null },
  coHostIds: readonly string[] | null | undefined,
  viewerUserId: string,
): boolean {
  if (!coHostIds || coHostIds.length === 0 || !m.sender_user_id) return false;
  if (m.sender_role != null && m.sender_role !== 'couple') return false;
  const to = privateRecipientIds(m);
  if (to.length === 0) return false;
  const people = new Set<string>([m.sender_user_id, ...to]);
  const hosts = new Set<string>([viewerUserId, ...coHostIds]);
  if (people.size !== hosts.size) return false;
  for (const id of people) if (!hosts.has(id)) return false;
  return true;
}

// ── THE DRAG ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** How far right (px) the box must be dragged before letting go switches Message ⇄ Whisper. */
export const WHISPER_DRAG_PX = 40;
/** A drag is sideways only when it has moved this far and more across than down. */
export const WHISPER_DRAG_SLOP_PX = 8;
/** The box follows the thumb at a quarter of its travel, to at most this (the drawing's 8 px slide). */
export const WHISPER_DRAG_FOLLOW = 0.25;
export const WHISPER_DRAG_MAX_PX = 12;

export type DragVerdict = 'none' | 'sideways' | 'vertical';
/** What a pointer move means so far: nothing yet, a sideways drag (ours), or an up/down one (the page's, the field's). */
export function dragVerdict(dx: number, dy: number): DragVerdict {
  if (Math.abs(dx) < WHISPER_DRAG_SLOP_PX && Math.abs(dy) < WHISPER_DRAG_SLOP_PX) return 'none';
  return Math.abs(dx) > Math.abs(dy) * 1.5 ? 'sideways' : 'vertical';
}
/** Where the box sits under the thumb — rightward only, never past the cap. */
export function dragFollowPx(dx: number): number {
  return Math.max(0, Math.min(WHISPER_DRAG_MAX_PX, dx * WHISPER_DRAG_FOLLOW));
}
/** Letting go switches only after a real drag to the RIGHT. */
export function dragSwitches(dx: number): boolean {
  return dx >= WHISPER_DRAG_PX;
}

// ── THE ONE SEND ICON: PLANE ⇄ WHISPER BUBBLE (the drawing's own paths, never redrawn) ──────────────────────────────
/** The plane's body — a triangle with soft corners. Same commands, same order as `BUBBLE_D`, so the two morph. */
export const PLANE_D = 'M4.6 4.48L19.9 11.72Q20.5 12 19.9 12.28L4.6 19.52Q4 19.8 4.19 19.23L6.41 12.57Q6.6 12 6.41 11.43L4.19 4.77Q4 4.2 4.6 4.48Z';
/** The whisper bubble's body — a rounded rectangle. */
export const BUBBLE_D = 'M7.5 4.5L16.5 4.5Q20 4.5 20 8L20 12.5Q20 16 16.5 16L7.5 16Q4 16 4 12.5L4 8Q4 4.5 7.5 4.5Z';
/** The plane's small line; swung down it is the bubble's chat tip. */
export const CREASE_D = 'M6.6 12H13';
export const CREASE_ORIGIN = { x: 6.6, y: 12 } as const;
/** The tip's pose (the drawing's `s-crease`): translate(1.4px,4px) rotate(113deg) scale(.6,1). */
export const CREASE_TIP = { tx: 1.4, ty: 4, rotate: 113, sx: 0.6 } as const;
/** The three dots, left to right. */
export const WHISPER_DOTS = [
  { cx: 8.5, cy: 10.25 },
  { cx: 12, cy: 10.25 },
  { cx: 15.5, cy: 10.25 },
] as const;
export const WHISPER_DOT_R = 1.05;
/** Each dot breaks into three specks that drift this way (the drawing's `s-speck1/2/3`) as it goes. */
export const WHISPER_SPECKS = [
  { dx: -1.7, dy: -2.1 },
  { dx: 2.1, dy: -1.4 },
  { dx: 0.3, dy: 2.3 },
] as const;
export const WHISPER_SPECK_R = 0.55;

const NUM = /-?\d*\.?\d+/g;
const PLANE_N = PLANE_D.match(NUM)!.map(Number);
const BUBBLE_N = BUBBLE_D.match(NUM)!.map(Number);
const SHAPE_TEMPLATE = PLANE_D.split(NUM);

/** The body's outline `k` of the way from the plane's triangle (0) to the bubble's rounded rectangle (1). */
export function shapeAt(k: number): string {
  if (k <= 0) return PLANE_D;
  if (k >= 1) return BUBBLE_D;
  let out = SHAPE_TEMPLATE[0] ?? '';
  for (let i = 0; i < PLANE_N.length; i++) {
    const v = PLANE_N[i]! + (BUBBLE_N[i]! - PLANE_N[i]!) * k;
    out += `${Math.round(v * 1000) / 1000}${SHAPE_TEMPLATE[i + 1] ?? ''}`;
  }
  return out;
}

/** The line's SVG transform `k` of the way from the plane's crease (0) to the chat tip (1). */
export function creaseAt(k: number): string {
  const c = Math.max(0, Math.min(1, k));
  const { x, y } = CREASE_ORIGIN;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return `translate(${r(CREASE_TIP.tx * c + x)} ${r(CREASE_TIP.ty * c + y)}) rotate(${r(CREASE_TIP.rotate * c)}) scale(${r(1 + (CREASE_TIP.sx - 1) * c)} 1) translate(${-x} ${-y})`;
}

/** How visible a speck is `k` of the way through its drift: it flashes in, then thins out. Nothing at either end. */
export function speckOpacity(k: number): number {
  if (k <= 0 || k >= 1) return 0;
  return k < 0.15 ? (0.9 * k) / 0.15 : 0.9 * (1 - (k - 0.15) / 0.85);
}

/** One moving part of the icon: where it ends, when it starts, how long it takes, and how it eases. */
export type WhisperTrack = { key: string; to: number; delay: number; dur: number; ease: 'both' | 'settle' };

/**
 * ⏱ THE ORDER, FROM THE MOTION TABLE (the drawing's 6 s loop, 1 % = 60 ms, set on the standard's speeds — no number
 * here is typed by hand):
 *
 *   ON   the triangle → the rounded square (Move) · then the line swings down to the chat tip (starts a Quick in, Move)
 *        · then the dots, one by one (the first two Quicks in, 0.8 Tap apart, a Move each).
 *   OFF  the dots go, last first (0.4 Tap apart, half a Tap each) and break into specks (1.2 Quick) · then the square →
 *        the triangle (starts 1.2 Tap in, Move) · then the line swings back and completes the plane (starts a Move in).
 *
 * Each step starts before the one before it ends; the body and the line ease at BOTH ends; nothing bounces.
 */
export function whisperTracks(on: boolean): WhisperTrack[] {
  if (on) {
    const first = QUICK_MS * 2;
    const gap = TAP_MS * 0.8;
    return [
      { key: 'shape', to: 1, delay: 0, dur: MOVE_MS, ease: 'both' },
      { key: 'crease', to: 1, delay: QUICK_MS, dur: MOVE_MS, ease: 'both' },
      { key: 'dot0', to: 1, delay: first, dur: MOVE_MS, ease: 'settle' },
      { key: 'dot1', to: 1, delay: first + gap, dur: MOVE_MS, ease: 'settle' },
      { key: 'dot2', to: 1, delay: first + gap * 2, dur: MOVE_MS, ease: 'settle' },
    ];
  }
  const gap = TAP_MS * 0.4;
  const go = TAP_MS * 0.5;
  return [
    { key: 'dot2', to: 0, delay: 0, dur: go, ease: 'both' },
    { key: 'dot1', to: 0, delay: gap, dur: go, ease: 'both' },
    { key: 'dot0', to: 0, delay: gap * 2, dur: go, ease: 'both' },
    { key: 'speck', to: 1, delay: 0, dur: QUICK_MS * 1.2, ease: 'settle' },
    { key: 'shape', to: 0, delay: TAP_MS * 1.2, dur: MOVE_MS, ease: 'both' },
    { key: 'crease', to: 0, delay: MOVE_MS, dur: MOVE_MS, ease: 'both' },
  ];
}

/** How long the whole change takes (the last track's end). */
export function whisperChangeMs(on: boolean): number {
  return Math.max(...whisperTracks(on).map((t) => t.delay + t.dur));
}
/** How long "Back to everyone" stays before it goes. */
export const WHISPER_OFF_LINE_STAY_MS = RISE_MS_STANDARD * 2;

/** A cubic-bezier's y for a time x (both 0…1), solved by bisection — steady in every engine. */
function bezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}
/** The two curves of the drawing: `both` eases at both ends (.45,0,.2,1); `settle` is the house Settle (.2,.8,.2,1). */
export function whisperEase(kind: WhisperTrack['ease'], x: number): number {
  return kind === 'both' ? bezier(0.45, 0, 0.2, 1, x) : bezier(0.2, 0.8, 0.2, 1, x);
}

// ── TYPING, WHISPERED ───────────────────────────────────────────────────────────────────────────────────────────────
/** The broadcast event a whispering host's typing rides on — on the event TEAM's private channel, never the chat's. */
export const WHISPER_TYPING_EVENT = 'chat-whisper-typing';
/** The window event the team channel hands a received whisper-typing to (the stream of that thread listens). */
export const WHISPER_TYPING_WINDOW_EVENT = 'chat-whisper:typing';
export type WhisperTyping = { threadId: string; userId: string; typing: boolean };

/** Read a received payload; anything malformed is nothing. */
export function whisperTypingFrom(raw: unknown): WhisperTyping | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.threadId !== 'string' || typeof o.userId !== 'string' || typeof o.typing !== 'boolean') return null;
  return { threadId: o.threadId, userId: o.userId, typing: o.typing };
}
