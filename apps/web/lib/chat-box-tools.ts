/**
 * THE CHAT BOX'S OWN AFFORDANCES — the two tools that live ON the box rather
 * than in a list beside it, named once, derived from the one tool registry.
 *
 * ── WHY THIS FILE EXISTS (owner, 2026-09-18) ────────────────────────────────
 * The conversation used to be one of seven stacked cards; the call row and the
 * "+ Deal or meeting" pill were two of the others, each spending the phone's
 * height that the conversation needed. Measured on production: the message
 * list had 32px of visible height against 498px of content.
 *
 * In the approved layout ("One Chat Box", 2026-09-18) they are icons on the
 * composer row — attach · message · 🧾 deal · 📞 call · send — and the panels
 * they open are closed `<details>` that take no space until asked for, exactly
 * the mechanism the supplier's rail already used for its nine tools
 * (`lib/vendor-thread-tools.ts` + `revealThreadTool`).
 *
 * 🔑 NOTHING HERE IS A SECOND SPELLING. The panel ids and the reveal targets
 * are looked up in `VENDOR_THREAD_PANELS` / `VENDOR_THREAD_TOOLS` at module
 * load, and a key that is not there THROWS — so the couple's page cannot mount
 * a panel the supplier's list does not know, and a composer icon cannot point
 * at an id nothing renders. `lib/one-chat-box-like-messenger.test.ts` executes
 * these lookups rather than grepping for them.
 */

import {
  VENDOR_THREAD_PANELS,
  VENDOR_THREAD_TOOLS,
  type VendorThreadPanel,
} from './vendor-thread-tools';

/**
 * The panels BOTH sides mount. The supplier mounts all of
 * `VENDOR_THREAD_PANELS`; the couple mounts exactly these two, because they are
 * the only tools a couple has on a conversation.
 */
export const SHARED_THREAD_PANEL_IDS = ['deal-or-meeting', 'thread-call'] as const;
export type SharedThreadPanelId = (typeof SHARED_THREAD_PANEL_IDS)[number];

function panelById(id: string): VendorThreadPanel {
  const panel = VENDOR_THREAD_PANELS.find((p) => p.id === id);
  if (!panel) {
    throw new Error(`chat-box-tools: panel "${id}" is not in VENDOR_THREAD_PANELS`);
  }
  return panel;
}

/** The couple's panel list — the shared two, in the shared order, same objects. */
export const COUPLE_THREAD_PANELS: readonly VendorThreadPanel[] =
  SHARED_THREAD_PANEL_IDS.map(panelById);

/**
 * The composer-row icons. `toolKey` names an entry of `VENDOR_THREAD_TOOLS`,
 * whose `reveal` list is the ordered set of ids to open — `voice-call` reveals
 * the Voice button inside the call panel and falls back to the panel itself
 * when a locked plan renders no button. Neither icon dials or sends anything:
 * an affordance opens a panel, the panel is where the act happens.
 */
export type ChatBoxAffordanceKey = 'deal' | 'call';

export const CHAT_BOX_AFFORDANCES: Readonly<
  Record<ChatBoxAffordanceKey, { toolKey: string; label: string }>
> = {
  deal: { toolKey: 'deal-or-meeting', label: 'Deal or meeting' },
  call: { toolKey: 'voice-call', label: 'Voice or video call' },
};

/** The ids an affordance opens, first present wins. Throws on a bad key. */
export function affordanceReveal(key: ChatBoxAffordanceKey): readonly string[] {
  const { toolKey } = CHAT_BOX_AFFORDANCES[key];
  const tool = VENDOR_THREAD_TOOLS.find((t) => t.key === toolKey);
  if (!tool) throw new Error(`chat-box-tools: no tool "${toolKey}" for affordance "${key}"`);
  if (!tool.reveal) {
    throw new Error(`chat-box-tools: tool "${toolKey}" leaves the page; an affordance must reveal`);
  }
  return tool.reveal;
}

/**
 * Which panel an affordance ends up opening — the LAST reveal candidate, which
 * by the registry's convention is the panel itself (finer targets come first).
 */
export function affordancePanelId(key: ChatBoxAffordanceKey): string {
  const reveal = affordanceReveal(key);
  return reveal[reveal.length - 1]!;
}
