/**
 * 🪞 THE HOST'S PICKED SUPPLIER — its page menu (Supplier Build 3 · Lane A, 9 Nov 2026; re-ordered 11 Nov 2026).
 *
 * Owner, 8 Nov (DECISION_LOG 🪞): *"The chat of the hosts should adapt the same way the suppliers chat box. but instead of
 * different events, they see their different suppliers handling on their event."* ⇒ a picked supplier opens the SAME
 * shape as the supplier's picked client.
 *
 * 🧭 THE ORDER MIRRORS THE SUPPLIER'S (owner 11 Nov 2026 — *"Clients side is not fixed also. There is also no report."*;
 * the supplier's side was re-ordered the same day, PR #7483, DECISION_LOG "THE PICKED-CLIENT MENU AND THE CHAT (+)
 * FOLLOW ONE ORDER"): **Chat · Details · Quotation · Payment · Forms · Schedule · Files · Inspiration · Report**.
 * Inspiration sits where the supplier has Hub (the host has no Hub door per supplier — the Event Hub is the host's own,
 * not this supplier's; Inspiration is the host's per-supplier page the prototype drew). **Report** is the host's
 * shipped "Report a problem" (the Disputes flow, `disputes/_components/new-flag-form.tsx`) pinned to this supplier.
 * `the-picked-supplier-has-nine-pages.test.ts` reads the supplier's menu and holds the two in the same order.
 *
 * Every page is a body the workspace ALREADY drew (Rule 0) — relocated, never redrawn; Chat is the shipped thread page
 * itself (`CoupleThreadBody`).
 *
 * `pickedSupplierPageOf` turns every `?tab=` a door has ever written into the page it means — the workspace's own words
 * (`quote` · `payments` · `files` · `schedule` · `details` · `chat`), `call` → Chat (the chat has no calls), the
 * prototype's words (`quotation` · `payment` · `form`) — and anything unknown or missing → null: the menu's FIRST page,
 * which is Chat when there is a conversation and Details otherwise (a Chat that can only be blank is not offered).
 */

export const PICKED_SUPPLIER_PAGE_IDS = ['chat', 'details', 'quote', 'payments', 'forms', 'schedule', 'files', 'inspiration', 'report'] as const;
export type PickedSupplierPage = (typeof PICKED_SUPPLIER_PAGE_IDS)[number];

export type PickedSupplierMenuEntry = { id: PickedSupplierPage; label: string };

export const PICKED_SUPPLIER_PAGES: readonly PickedSupplierMenuEntry[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'details', label: 'Details' },
  { id: 'quote', label: 'Quotation' },
  { id: 'payments', label: 'Payment' },
  { id: 'forms', label: 'Forms' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'files', label: 'Files' },
  { id: 'inspiration', label: 'Inspiration' },
  { id: 'report', label: 'Report' },
] as const;

const ALIASES: Readonly<Record<string, PickedSupplierPage>> = {
  call: 'chat',
  quotation: 'quote',
  payment: 'payments',
  form: 'forms',
  documents: 'files',
  overview: 'details',
  problem: 'report',
  dispute: 'report',
  disputes: 'report',
};

/** The page that is always offered — the default when there is no conversation (Chat is then not in the menu). */
export const ALWAYS_PICKED_SUPPLIER_PAGE: PickedSupplierPage = 'details';

/** The page a raw `?tab=` names, or null when it names none (missing or unknown — the menu's first page opens). */
export function pickedSupplierPageOf(rawTab: string | null | undefined): PickedSupplierPage | null {
  if (!rawTab) return null;
  const t = rawTab.trim().toLowerCase();
  if ((PICKED_SUPPLIER_PAGE_IDS as readonly string[]).includes(t)) return t as PickedSupplierPage;
  return ALIASES[t] ?? null;
}

/** The page a door that names none opens: the menu's first — Chat when there is a conversation, else Details. */
export function defaultPickedSupplierPage(menu: readonly PickedSupplierMenuEntry[]): PickedSupplierPage {
  return menu[0]?.id ?? ALWAYS_PICKED_SUPPLIER_PAGE;
}

/**
 * The menu this supplier shows: a page whose body would only ever be blank is not offered (the workspace's rule since
 * 2026-09-20 — "A TAB THAT CAN ONLY EVER BE BLANK IS NOT OFFERED"): no Quotation for a supplier the host added
 * themselves (nobody to send one), no Chat without a conversation.
 */
export function pickedSupplierMenuFor(has: { quote: boolean; chat: boolean }): PickedSupplierMenuEntry[] {
  return PICKED_SUPPLIER_PAGES.filter((p) => (p.id === 'quote' ? has.quote : p.id === 'chat' ? has.chat : true));
}

/** The page drawn: the asked page if this menu has it, else the menu's first (Chat, or Details without a chat). */
export function visiblePickedSupplierPage(rawTab: string | null | undefined, menu: readonly PickedSupplierMenuEntry[]): PickedSupplierPage {
  const p = pickedSupplierPageOf(rawTab);
  return p && menu.some((m) => m.id === p) ? p : defaultPickedSupplierPage(menu);
}

/** The lists the picked supplier opens OVER — the host's Chats (the top-right chat icon). */
export function pickedSupplierLists(eventId: string): string[] {
  return [`/dashboard/${eventId}/messages`];
}
