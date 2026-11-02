## 2026-06-28 · feat(weddings): Chinese tea-ceremony serving-order helper + guest seniority

Added the signature FREE couple tool for Chinese (Tsinoy) weddings: a printable
tea-ceremony (敬茶) serving-order helper, plus the guest seniority data it reads.

- **Migration** `20270309030000_guest_seniority.sql` adds two additive, nullable
  columns to `public.guests`: `seniority_rank int` (within-side serve order;
  lower serves first) + `relation text` (free-text relationship label, no CHECK
  per the categories-are-DB-driven rule). RLS inherited from `guests`
  (Pattern B) — no new policy. No new `guest_role` enum values.
- **New route** `app/dashboard/[eventId]/guests/tea-ceremony/page.tsx` — a
  server component gated on `isChineseWedding` (primary OR secondary `chinese`);
  non-Chinese events `notFound()`. Outputs the serving order GROOM'S SIDE first,
  then BRIDE'S, each sorted by `seniority_rank` (nulls last) → `roleImportanceRank()`
  (reused from `lib/role-groups.ts`) → name. Printable via the shared
  `PrintButton`. Couple-only (RLS on `guests`); never exposed on public/guest
  surfaces.
- **Guest forms** — optional `relation` + `seniority_rank` inputs wired through
  the create (`guests/new`) and edit (`guests/[guestId]`) forms + their server
  actions; added to `GuestRow` + `GUEST_FIELDS` in `lib/guests.ts`.
- **Discovery** — a conditional, FREE (non-paid-catalog) tea-ceremony tile on
  the event Home (`page.tsx`) and in `planning-groups.tsx`, shown only for
  Chinese weddings.
- **Paperwork link** — the Chinese traditions guide on `/paperwork` now links
  its tea-ceremony note to the new helper (Chinese events only).
- **Drift fix** — added `'chinese'` to the second `CeremonyType` union +
  `isCeremonyType()` in `lib/wedding-plan-groups.ts` (PR #2312 only fixed
  `lib/paperwork.ts`), so a Chinese event's planning-group adaptivity no longer
  resolves to null.

SPEC IMPACT: None. Implements the locked PR-F scope from the 2026-06-28 Chinese
(Tsinoy) wedding integration map (overlay model, `isChineseWedding` spine,
seat-plan-stays-free + categories-DB-driven locks). No price, SKU, schema-rename,
or retired-feature decision touched.
