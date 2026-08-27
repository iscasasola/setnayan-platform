## 2026-08-28 · fix(event hub): two more routes told crawlers a missing event was found

`/{slug}/find-my-table` and `/{slug}/welcome` answered **HTTP 200** for an event
that has never existed. Both now answer 404.

**Found by verifying something else on the live site.** After the seat-room gate
shipped, a check of the refused routes showed `find-seat` and `venue` returning
404 and `find-my-table` returning **200** — while serving the not-found UI. A
status code is not a page, and here the page was right and the status was wrong.

**Cause: the documented one, in two more places.** Both routes carried a
route-level `loading.tsx`. A loading file makes the streaming shell commit the
status before the body runs, so every `notFound()` in the body renders the 404
UI under a 200. This is the exact bug `04c03063d` deleted a loading file to fix
on the bare-root route, and that `v/[slug]` fixed again on 2026-08-08.

**🚨 THE PART WORTH KEEPING: THE GUARD ALREADY NAMED BOTH ROUTES — TO EXEMPT
THEM.** `first-byte.test.ts` looped over exactly `['welcome', 'find-my-table']`
and its body was `assert.ok(true)`, justified by a comment reading *"these routes
resolve no slug-vs-vendor dispatch and cannot soft-404."* **That reason is
false**, and the slug dispatch was never what caused the bug — a `notFound()`
anywhere in the body is enough. The exemption could never fail, so it protected
the defect it was written beside.

Measured in prod 2026-08-28, not reasoned about:

| URL | before |
|---|---|
| `/definitely-not-a-real-event-xyz/find-my-table` | **200** |
| `/definitely-not-a-real-event-xyz/welcome` | **200** |
| `/definitely-not-a-real-event-xyz/find-seat` | 404 (no loading.tsx) |
| `/definitely-not-a-real-event-xyz/print` | 404 (no loading.tsx) |

The exemption is now a real assertion: both files must be absent, and the guard
carries the measurement that proves the claim rather than asserting it.

**What it costs:** a skeleton on two fast lookups. Neither does an R2 presign —
those round-trips are why the invitation page needed streaming at all. If either
needs a boundary back, it goes INSIDE `page.tsx` after the routing decisions,
which is what that file's own docblock has always said.

Invisible to a person either way — both already showed a correct-looking 404
page. Only a crawler could tell, which is why it survived.

SPEC IMPACT: None.
