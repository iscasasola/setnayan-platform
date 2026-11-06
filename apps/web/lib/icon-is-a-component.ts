/**
 * 🧩 IS THIS `icon` A COMPONENT TO DRAW, OR A NODE ALREADY DRAWN?
 *
 * A button's `icon` is either a component (a lucide icon: a `forwardRef` object, or a plain function) that the button
 * draws as `<Icon aria-hidden strokeWidth={1.9} />`, or a ready node (`<PaidMark …/>`) that it draws as it is.
 *
 * 🔴 LIVE CRASH, 2026-10-15 (the owner's Maker would not open: "Something on our end didn't work", React #306 in the
 * browser, "Element type is invalid … got: object" on the server). `maker-prints.tsx` is a SERVER module and handed the
 * pass-card zip row `icon: <PaidMark state="unlocked" …/>` — PaidMark is a server component. In a PRODUCTION build
 * the RSC payload delivers a server component's element inside a prop as a React LAZY reference (`$$typeof:
 * react.lazy`), not as an element. `ActionButton` asked `isValidElement(icon)` — false for a lazy — and so drew the
 * lazy as a component TYPE, which resolved to an element: #306. Dev mode delivered a plain element, so every lab walk
 * (all in dev) passed. Only an internal account (Studio) on an event whose zip is unlocked took that branch.
 *
 * THE RULE, NOW: only a function, or a `forwardRef` / `memo` object, is a component. ANYTHING ELSE — an element, a
 * lazy, a string — is a node and is drawn as one (React resolves a lazy CHILD itself). Asking "is it a component?"
 * instead of "is it an element?" means a new node shape can never again be mistaken for a type.
 *
 * Held by `lib/an-icon-node-is-never-drawn-as-a-type.test.ts` (it feeds the exact lazy shape the live page received).
 */
const FORWARD_REF = Symbol.for('react.forward_ref');
const MEMO = Symbol.for('react.memo');

export function iconIsAComponent(icon: unknown): boolean {
  if (typeof icon === 'function') return true;
  if (!icon || typeof icon !== 'object') return false;
  const t = (icon as { $$typeof?: unknown }).$$typeof;
  return t === FORWARD_REF || t === MEMO;
}
