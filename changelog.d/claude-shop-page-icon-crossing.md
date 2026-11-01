## 2026-11-01 · fix(supplier,maker): three server pages handed ActionButton an icon component

The supplier Shop page was down on live ("Your shop console is temporarily unavailable", digest 2080562659), and the same error hit a couple's `/dashboard/[eventId]/launch`. Each server file passed `<ActionButton icon={X}>` a lucide component, a function, which React Server Components refuse. Fixed in `vendor-dashboard/shop/page.tsx`, `launch/_components/guests-view-door.tsx` and `vendor-dashboard/website/_components/badge-tracker.tsx` by passing the element (`icon={<X aria-hidden="true" strokeWidth={1.9} />}`, the look ActionButton gives a component). New guard `lib/a-server-file-hands-action-button-an-element.test.ts` covers every server file in `app/` and `components/`; it fails on all three with the fix reverted.

SPEC IMPACT: None
