# w5b-door-bill-prose

## 2026-08-24 · docs(guards): the door-card bill's prose counts three again, like its own array

`doors-are-designed.test.ts` opened its exact-match bill with "Eight more pages
carry that identical card … there were nine until Pabati was deleted" while the
array beneath held THREE entries — the nine refusal screens were ported through
`<DoorShell>` (e372a5e0f) and the comment's count was never updated. A doc that
records the truth in one place and contradicts it a line above gets read from
whichever half is wrong (this file's own failure mode, per the corpus). The
prose now describes the bill instead of counting it. Comment-only; the
assertion and the bill are untouched, suite 8/8 green.

SPEC IMPACT: None.
