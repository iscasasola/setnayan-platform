## 2026-09-18 · fix(tests): event-words-mounted covers the guest-page-borrowed surfaces

`event-words-mounted.test.ts`'s `CONSUMERS` list only scanned the 5 fixed
client components that call `useEventWords() ?? WORDS_AS_SHIPPED`. It missed
`vendor-doorway.tsx` and `supplier-desk.tsx`, which get the same resolved
words a different way: `site-body.tsx` passes them the server-resolved
`clientWords` as a typed `words: ClientEventWords` prop instead of reading
context. The words were already threaded correctly — this was a coverage
gap, not a live defect.

Added a `PROP_CONSUMERS` list for these two: the existing hardcoded-"the
couple" regression check now scans them too, plus a new assertion that each
declares the typed prop and that it's actually forwarded/read
(`vendor-doorway.tsx` → `supplier-desk.tsx` → `words.TheOrganizer` etc.).
Proved the widened check catches a regression by temporarily hardcoding "The
couple" into `supplier-desk.tsx` locally, confirming the test failed, then
reverting.

SPEC IMPACT: None.
