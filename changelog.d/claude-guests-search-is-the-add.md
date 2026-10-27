## 2026-10-27 · fix(guests): "Add with details" and "Paste many names" leave Guests — the search is the add

Owner, verbatim: *"We do not need this on guests since our search bar provides the same feature"*. The ways to add
(typed results, the ≡ menu, the desktop icons and the phone ⋯ rows — one list, `ADD_WAYS` / `AddDoors`) are now From
your people · Import a file. Typing in the search adds; the new guest's card takes the details. The `/guests/quick`
page still resolves for old links. Guards updated: `search-or-add.test.ts` (asserts the two are gone),
`the-empty-list-has-one-door.test.ts`, `the-phone-guest-list-is-frame-2.test.ts`. Port baseline regenerated.

SPEC IMPACT: DECISION_LOG row "GUESTS: SEARCH IS THE ADD — DETAILS AND PASTE GO".
