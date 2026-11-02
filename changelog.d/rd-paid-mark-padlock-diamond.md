## 2026-09-26 · feat(ui): one paid mark — a padlock while locked, a diamond once owned

Owner, verbatim (2026-09-25): *"for all parts that are Paid to unlock, let us use
the padlock icon. and a diamond icon when unlocked"*.

New `<PaidMark state="locked" | "unlocked" label text? size? tone? />`
(`apps/web/app/_components/paid-mark.tsx`) draws lucide `Lock` / `Gem` in house
tokens (`text-ink/60` locked, `text-terracotta-700` owned; `tone="current"` on
inverted surfaces), on a fixed 12/14/16/20px ladder, `shrink-0` and
`whitespace-nowrap` so it cannot squeeze the text beside it on a phone. Which
state is decided once, in `paidMarkState({ owns, storeShell })`
(`apps/web/lib/paid-mark.ts`): owned → diamond everywhere; not owned → padlock,
or nothing inside the app-store shell (the store-shell rule is unchanged — no
padlock, no purchase hint; an owned diamond may show).

Swapped onto it:

- **Event Hub Maker** — reveal rows (bare "Pro" word → mark, diamond when owned),
  hero photo upload, themed prints (print-ready diamond / padlock on the offer),
  `ProLockPanel`, the transition chips' lock, the Pro CTA card, the draft bar's
  "Apply needs Event Hub Pro", `WebsiteProLock`, scene media slots, the
  editor's-desk heading, Pro invite themes
  (was a text chip), the widgets list "Pro" pill, the editorial `ProChip`
  (gold Sparkles chip → mark that follows `isPro`).
- **Paid products** — the Suite / Studio "Active" pills gain the diamond; Event
  Hub Pro "Unlocked", Setnayan AI "Active", Live Studio's "Preview" chip, its
  preview banner and the venue-screens lock.
- **Everything else** — the generic `LockedState`, the vendor `VendorTierGate` /
  `VendorTierTeaser` (the gate's padlock is now absent in the store shell), the
  vendor add-on cards' plan locks, the call launcher's upgrade nudge.

Guards: `apps/web/lib/maker-pro-controls-wear-the-paid-mark.test.ts` (no bare
"Pro" pill and no hand-drawn lock beside Pro copy in the Maker; every Maker
component that reads `ownsPro` renders the mark) and `apps/web/lib/paid-mark.test.ts`
(state follows the entitlement in both directions, the store shell hides only
the padlock; the themed prints and the editor's desk are painted, not grepped).

Not swapped, on purpose: `HubProOffer` (the launch page's Pro offer) keeps its
Sparkles — it is owner-locked 2026-07-25 "SHOW IT WORKING — do not dim and lock",
held by `hub-pro-offer-renders.test.ts`, which forbids any lock glyph on it; locks that mean something other than "paid" (a fixed
scene, a section with no content yet, private notes, booking locks, "Always on"
widgets), the rail's static ✦ on studio rows (it reads no ownership), and the
launch page's "What runs on the day" rows (Papic is free to start, so a diamond
there would claim a purchase that may not exist).

SPEC IMPACT: None — implements the 2026-09-25 DECISION_LOG row "PAID-TO-UNLOCK
PARTS WEAR A PADLOCK; UNLOCKED ONES WEAR A DIAMOND" as written.
