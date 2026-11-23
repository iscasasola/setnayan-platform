/**
 * 🧰 "SHARE FROM YOUR TOOLS" — the words of the five tool cards a supplier shares into a chat (DECISION_LOG 2026-11-23
 * "SPECIALIZED TOOLS WORK ON THEIR OWN AND SHARE INTO CHAT", specs dee66686; drawing
 * `prototypes/supplier_store_graphs_badges_2026-11-23` frame 7: Add to chat · The picker · What the couple sees).
 *
 *   · ONE ＋ row, "Share from your tools", in the supplier's tray (`lib/chat-plus.ts`). Its picker lists ONLY the tools the
 *     shop has (free and added, or bought / with its plan / in its trial) — `lib/chat-tool-share-held.ts`, read from the
 *     Store's own facts (`lib/supplier-store.server.ts`), never from the layout alone.
 *   · Five shareable tools, the planning ones: Cake Maker · 3D plan · Run of show · Emcee script · Song bank. The
 *     event-day tools (Scanner · Headcount · Live Watch · Floor Command + March · Song Desk) and the Papic challenge
 *     NEVER appear in chat.
 *   · A share is a chat line in EXACT words (the chat's own way: `lib/chat-card-lines.ts` reads cards by their words), sent
 *     through the shipped send (`sendChatMessage` → `sendChatMessageCore`, which refuses a tool the shop does not hold).
 *     The stream draws it as a card with Open and Approve. Approve is the hosts' own line, in exact words too; the share
 *     reads "Approved" from the first later approval of its kind — the database is never asked to remember a state.
 *   · The couple NEVER sees a price or a lock: only the supplier buys a tool. Nothing here knows a price.
 *
 * NO IMPORTS ON PURPOSE: the message stream asks `toolShareFromLine` for every line, so this rides in the chat's first
 * load, like `chat-card-lines.ts`. 🔒 lib/chat-tool-share.test.ts
 */

/** The five tools a supplier may share into a chat, in the picker's order (the drawing's). */
export const SHAREABLE_TOOLS = ['cake_tool', 'plan_3d', 'run_of_show', 'emcee_script', 'song_bank'] as const;
export type ShareableTool = (typeof SHAREABLE_TOOLS)[number];

export function isShareableTool(k: unknown): k is ShareableTool {
  return typeof k === 'string' && (SHAREABLE_TOOLS as readonly string[]).includes(k);
}

export type ToolShareWords = {
  /** The tool's name, as the Store names it. */
  tool: string;
  /** The picker's second line. */
  pickLine: string;
  /** What the card holds — its eyebrow ("Cake design"), and the word its approval names. */
  kind: string;
  /** The card's title. */
  title: string;
  /** Where it was made, under the title. */
  from: string;
};

/** The drawing's words (frame 7). The card titles there are sample; these are the tools' own plain words. */
export const TOOL_SHARE_WORDS: Readonly<Record<ShareableTool, ToolShareWords>> = {
  cake_tool: { tool: 'Cake Maker', pickLine: 'A cake design to look at and approve', kind: 'Cake design', title: 'Your cake, in 3D', from: 'Made in the Cake Maker' },
  plan_3d: { tool: '3D plan', pickLine: 'The layout of the room', kind: 'Layout', title: 'The layout of the room', from: 'Made in the 3D plan' },
  run_of_show: { tool: 'Run of show', pickLine: 'The timeline of the day', kind: 'Timeline', title: 'The timeline of the day', from: 'From the Run of show' },
  emcee_script: { tool: 'Emcee script', pickLine: 'The host’s script', kind: 'Script', title: 'The host’s script', from: 'From the Emcee script' },
  song_bank: { tool: 'Song bank', pickLine: 'A playlist to hear and approve', kind: 'Playlist', title: 'A playlist to hear and approve', from: 'From the Song bank' },
};

/** The ＋ row (frame 7, "Add to chat"). */
export const SHARE_ROW_LABEL = 'Share from your tools';
export const SHARE_ROW_LINE = 'A cake, a layout, a timeline, a script, a playlist';
/** The picker's honest states. */
export const SHARE_NONE_YET = 'None of your tools can be shared yet. Add Run of show or Emcee script in your Store, or get a paid tool there.';
export const SHARE_READ_FAILED = 'Couldn’t load your tools. Try again.';
export const SHARE_SEND_FAILED = 'Couldn’t share that. Try again.';
export const APPROVE_SEND_FAILED = 'Couldn’t send your OK. Try again.';

/** The server's refusals (`sendChatMessageCore`) — words the supplier can act on. */
export const SHARE_NOT_HELD = 'That tool isn’t in your shop yet. Get it in the Store first.';
export const SHARE_NOT_CHECKED = 'Couldn’t check your tools just now. Nothing was sent — try again.';

const HEAD = '🧰 ';
const SHARE_TAIL = ' · Open it here, then tap Approve.';
const APPROVED_HEAD = '✓ Approved · ';

/** The exact line a share posts: "🧰 Cake design · Made in the Cake Maker · Open it here, then tap Approve." */
export function toolShareBody(tool: ShareableTool): string {
  const w = TOOL_SHARE_WORDS[tool];
  return `${HEAD}${w.kind} · ${w.from}${SHARE_TAIL}`;
}

/** The exact line the hosts' Approve posts: "✓ Approved · Cake design". */
export function toolApprovalBody(tool: ShareableTool): string {
  return `${APPROVED_HEAD}${TOOL_SHARE_WORDS[tool].kind}`;
}

/** A share line → its tool, or null. Exact words, never guessed. */
export function toolShareFromLine(body: string | null | undefined): ShareableTool | null {
  const b = (body ?? '').trim();
  if (!b.startsWith(HEAD)) return null;
  for (const t of SHAREABLE_TOOLS) if (b === toolShareBody(t)) return t;
  return null;
}

/** An approval line → its tool, or null. Exact words, never guessed. */
export function toolApprovalFromLine(body: string | null | undefined): ShareableTool | null {
  const b = (body ?? '').trim();
  if (!b.startsWith(APPROVED_HEAD)) return null;
  for (const t of SHAREABLE_TOOLS) if (b === toolApprovalBody(t)) return t;
  return null;
}

/**
 * Which shares the hosts have approved: each share (the SHOP's line) → approved by the first later approval of its
 * tool from the HOSTS' side (`sender_role` 'couple' or 'coordinator' — a shop or a system line typing "Approved"
 * approves nothing). Rows in
 * stream order. A share not in the set still waits for its OK.
 */
export function approvedToolShares(
  rows: ReadonlyArray<{ id: string; body: string | null | undefined; senderRole?: string | null }>,
): Set<string> {
  const approved = new Set<string>();
  const open = new Map<ShareableTool, string[]>();
  for (const r of rows) {
    if (r.senderRole === 'vendor') {
      const t = toolShareFromLine(r.body);
      if (t) open.set(t, [...(open.get(t) ?? []), r.id]);
      continue;
    }
    if (r.senderRole !== 'couple' && r.senderRole !== 'coordinator') continue;
    const a = toolApprovalFromLine(r.body);
    if (!a) continue;
    for (const id of open.get(a) ?? []) approved.add(id);
    open.set(a, []);
  }
  return approved;
}

/** Who looks at a share card and what they may do. */
export type ToolShareViewer = 'couple' | 'vendor';

/**
 * The words on a share card for whoever is looking. The couple's face has Open and Approve; the shop's says whether
 * they answered. No price, no lock, no "buy" on either face — the couple never pays to view a shared card.
 */
export function toolShareFace(tool: ShareableTool, viewer: ToolShareViewer, approved: boolean): {
  kicker: string;
  title: string;
  from: string;
  open: string | null;
  approve: string | null;
  status: string | null;
} {
  const w = TOOL_SHARE_WORDS[tool];
  if (viewer === 'couple') {
    return { kicker: w.kind, title: w.title, from: w.from, open: 'Open', approve: approved ? null : 'Approve', status: approved ? 'You approved this' : null };
  }
  return { kicker: w.kind, title: w.title, from: w.from, open: null, approve: null, status: approved ? 'Approved by your client' : 'Waiting for their OK' };
}
