/**
 * 🪞 THE HOST'S PICKED SUPPLIER — its page menu (Supplier Build 3 · Lane A, 9 Nov 2026).
 *
 * Owner, 8 Nov (DECISION_LOG 🪞): *"The chat of the hosts should adapt the same way the suppliers chat box. but instead of
 * different events, they see their different suppliers handling on their event."* ⇒ a picked supplier opens the SAME
 * shape as the supplier's picked client — tabs **Details · Chat · Schedule · Quotation · Payment · Forms**, plus the
 * prototype's **Inspiration** (`prototypes/supplier_build_3_2026-11-08`, the host's tab row). **Files** stays: it is the
 * workspace's shipped Files tab (contracts and documents), as the supplier's client keeps Files — dropping it would hide
 * a shipped section (Rule 0).
 *
 * Every page is a body the workspace ALREADY drew as a tab (`RelationshipTabShell`, now the ONE picked shell) — relocated,
 * never redrawn; Chat is the shipped thread page itself (`CoupleThreadBody`).
 *
 * `pickedSupplierPageOf` turns every `?tab=` a door has ever written into the page it means — the workspace's own words
 * (`quote` · `payments` · `files` · `schedule` · `details` · `chat`), `call` → Chat (the chat has no calls), the
 * prototype's words (`quotation` · `payment` · `form`) — and anything unknown or missing → Details (Suppliers list doors
 * open on Details; a Chats row names `?tab=chat`).
 */

export const PICKED_SUPPLIER_PAGE_IDS = ['details', 'chat', 'schedule', 'quote', 'payments', 'forms', 'files', 'inspiration'] as const;
export type PickedSupplierPage = (typeof PICKED_SUPPLIER_PAGE_IDS)[number];

export type PickedSupplierMenuEntry = { id: PickedSupplierPage; label: string };

export const PICKED_SUPPLIER_PAGES: readonly PickedSupplierMenuEntry[] = [
  { id: 'details', label: 'Details' },
  { id: 'chat', label: 'Chat' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'quote', label: 'Quotation' },
  { id: 'payments', label: 'Payment' },
  { id: 'forms', label: 'Forms' },
  { id: 'files', label: 'Files' },
  { id: 'inspiration', label: 'Inspiration' },
] as const;

const ALIASES: Readonly<Record<string, PickedSupplierPage>> = {
  call: 'chat',
  quotation: 'quote',
  payment: 'payments',
  form: 'forms',
  documents: 'files',
  overview: 'details',
};

export const DEFAULT_PICKED_SUPPLIER_PAGE: PickedSupplierPage = 'details';

/** The page a raw `?tab=` opens. Pure, total: every string resolves. */
export function pickedSupplierPageOf(rawTab: string | null | undefined): PickedSupplierPage {
  if (!rawTab) return DEFAULT_PICKED_SUPPLIER_PAGE;
  const t = rawTab.trim().toLowerCase();
  if ((PICKED_SUPPLIER_PAGE_IDS as readonly string[]).includes(t)) return t as PickedSupplierPage;
  return ALIASES[t] ?? DEFAULT_PICKED_SUPPLIER_PAGE;
}

/**
 * The menu this supplier shows: a page whose body would only ever be blank is not offered (the workspace's rule since
 * 2026-09-20 — "A TAB THAT CAN ONLY EVER BE BLANK IS NOT OFFERED"): no Quotation for a supplier the host added
 * themselves (nobody to send one), no Chat without a conversation.
 */
export function pickedSupplierMenuFor(has: { quote: boolean; chat: boolean }): PickedSupplierMenuEntry[] {
  return PICKED_SUPPLIER_PAGES.filter((p) => (p.id === 'quote' ? has.quote : p.id === 'chat' ? has.chat : true));
}

/** The page drawn: the asked page if this menu has it, else Details. */
export function visiblePickedSupplierPage(rawTab: string | null | undefined, menu: readonly PickedSupplierMenuEntry[]): PickedSupplierPage {
  const p = pickedSupplierPageOf(rawTab);
  return menu.some((m) => m.id === p) ? p : DEFAULT_PICKED_SUPPLIER_PAGE;
}

/** The lists the picked supplier opens OVER — the host's Chats (the top-right chat icon). */
export function pickedSupplierLists(eventId: string): string[] {
  return [`/dashboard/${eventId}/messages`];
}
