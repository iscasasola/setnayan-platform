## 2026-09-27 · fix(numbers): every number a person reads carries its thousands commas

Owner, on the event Overview's Papic tile reading "100050 shots ready": *"numbers with comma"* ·
*"all across the website. all needs to have a ','"* (DECISION_LOG: "EVERY NUMBER ON THE WEBSITE
CARRIES THOUSANDS COMMAS").

- **One plain-number formatter:** `apps/web/lib/format-number.ts#formatCount` (`en-PH` grouping,
  fractions kept but never padded, `—` for absent). Money keeps going through `lib/php.ts`
  (`formatPhp` / `formatCentavosPhp`) — no second money formatter.
- **`CountUp` groups every frame** (`app/_components/count-up.tsx`): the server render and each
  animation frame go through `formatCount`, so the Papic tile reads "100,050" and ticks with
  commas. A new `format` prop takes `formatPhp` for money. The two local count-ups (onboarding,
  supplier My Performance) now use the same formatter.
- **Sweep:** raw quantity renders across couple, guest, supplier, admin, API/OG text, print and
  PDF routes now go through `formatCount` (≈930 call sites in ≈390 files); five hand-spelled
  `₱${n}` money figures now go through `formatPhp` (booking-fee form minimum, discount badge,
  booking-fee credit note, budget reconcile message, Maya checkout line items). Identifiers
  (years, ids, reference/phone numbers, times, table numbers) are untouched. A typed
  delete-confirmation keeps its raw digits on purpose.
- **Guard:** `apps/web/lib/numbers-carry-commas.test.ts` renders `CountUp` and asserts "100,050",
  runs the detector (`lib/raw-number-scan.ts`) over fixtures, and sweeps `app/ lib/ components/`
  for a raw number by NAME (count/total/shots/photos/credits/guests/…), by the NOUN after it
  (`{n} guests`, `{a} of {b}`), or after a hand-typed `₱`. True exceptions live in
  `lib/numbers-carry-commas.allowlist.txt`, each tagged TEXT / IDENTIFIER / BOUNDED with a reason;
  a stale row fails.

SPEC IMPACT: None — the decision is already recorded in `DECISION_LOG.md`; this implements it.
