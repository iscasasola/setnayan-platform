## 2026-08-05 · fix(guest-site): no more blank white screen while the invitation loads

**SPEC IMPACT:** None.

There was **no loading or streaming boundary anywhere under `app/[slug]`** — no
root `loading.tsx`, no ancestor one, and zero `Suspense` in the whole tree —
while the page runs a dozen-plus sequential awaits, several of them R2 presign
round-trips, before it can render. With no boundary the entire page is React's
shell, so **not one byte flushes until the last await resolves.**

A guest scanning the QR on a crowded venue network got a blank white screen: no
monogram, no couple's name, not even a spinner, for as long as the server took.
Most people tap again, or decide the link is broken. This is the first thing the
product does at a wedding, and it did nothing at all.

⛔ **The fix is NOT a `loading.tsx`.** A route-level loading file makes the
streaming shell commit HTTP 200 *before* the body runs, so a `notFound()` thrown
in the body renders the 404 UI with a 200 status — every junk top-level URL an
indexable soft-404. One existed here and was deliberately deleted (`04c03063d`,
"real 404s on unknown slugs").

So the boundary goes **inside `page.tsx`, after every `notFound()`/`redirect()`**,
where the HTTP status is already settled before the first flush. The body work
moved into `InvitationBody` — the same code, one function deeper, not a line
changed.

🔑 **The fallback shows the couple's name, not a spinner.** The name and monogram
come from the event row the page has *already* read to make its routing
decision, so they cost nothing — and they are what tells a guest standing at a
venue that they are in the right place. A spinner says "wait"; a name says "you
found it".

Also fixed a comment in `loaders.ts` that said *"this route has a loading.tsx"*.
It does not — the file was deleted months ago — so the sentence sat there
describing the opposite of what the code does. The rule it protects is real and
still binding, and now says so.

`first-byte.test.ts`, mutation-verified — including a check that fails if a
`loading.tsx` reappears at `[slug]/` or `[slug]/hub/`, and one that fails if a
status-setting call drifts below the boundary.
