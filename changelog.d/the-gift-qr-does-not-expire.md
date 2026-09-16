## 2026-09-16 · fix(pabuya): the gift QR stops expiring, and the page stops calling a published event private

Two defects on `/dashboard/[eventId]/pabuya`, both reported by the owner on
2026-09-16 and both measured against production before being touched.

**1 · The QR expired after 24 hours.** Every Pabuya e-gift QR was handed to the
browser as an R2 presigned GET (`displayUrlForStoredAsset` → `presignDisplayUrl`,
default TTL 86 400 s). A wedding gift page is published once and read for
months, so an expiring URL is wrong in kind: a page regenerated more than a day
later, a tab left open overnight, or a saved link all render a broken image —
and a broken QR on a gift page reads as *the couple's payment details are
wrong*. `pabuya-card-list.tsx` already carried the workaround in a comment
("next/image would cache an expired URL").

🔑 **Raising the TTL cannot fix this — SigV4 caps a presigned URL at seven
days.** "No expiration" is a different mechanism, not a bigger number. Added
`GET /api/pabuya/qr/[publicId]`, which streams the object from R2 at a stable
path; `lib/egift.ts` now returns that path (built by the shared
`lib/pabuya-qr-url.ts`, imported by both sides so they cannot disagree). The
route also drops an N-per-render round trip to R2.

The id in the path is **not** the access control. A host of the event
(`userHostsEvent`) may fetch any of their own methods including a **disabled**
one, because the dashboard's edit thumbnail must render a destination hidden
from guests; everyone else must clear **both** `is_enabled` **and**
`canViewSlugEvent` — the same gate `/[slug]/pabuya` applies. The `is_enabled`
half is load-bearing: hiding a destination is how a couple retires an account,
and the row keeps the old bank details.

**2 · A refused read was rendering as "your page is private".** Migration
`20271230123132` added `events.pabuya_message` and granted `SELECT` to
`authenticated` only. `events` is per-column allowlisted, so any render that
runs as `anon` gets the **whole** query refused — reproduced byte-for-byte
against production:

```
42501: permission denied for table events
HINT:  Grant the required privileges to the current role with: GRANT SELECT ON public.events TO anon;
```

Logged in prod 2026-09-16 12:26Z on event `044f7e64…`, twice. The read is
`graceful_degrade`, so `event` fell to null and the manager's
`const isPrivate = (visibility ?? 'private') === 'private'` turned *"I could not
read this"* into *"Your event page is private — launch it to make this live for
guests."* That event's real `landing_page_visibility` is `public`.

🔑 **Fail-closed is right for a GATE and wrong for a SENTENCE.** The same
`?? 'private'` literal appears on the public guest pages, where defaulting to
private on a failed read hides the page and is correct; the website editor has
it too and is safe because it `redirect`s before rendering. This site neither
gated nor redirected — it only reported, so the default became a false claim.
`isPrivate` is now conjoined with a required `eventWasRead` prop, the unread
state gets its own sentence evaluated **above** both real readings, and the
couple is told plainly that the details could not be loaded. A log line never
changed a pixel.

⚠ **The grant itself is not changed here.** A true `anon` caller gets no row
from RLS either way, so granting the column would widen exposure for no gain;
what was wrong is that the page was willing to invent an answer when any read
fails, for any reason. Why those two renders ran as `anon` rather than
`authenticated` is **not** established — a signed-in load works. The www/apex
theory was checked and ruled out (`setnayan.com` 307s → `www.setnayan.com`, so
www is canonical and holds the cookie).

Guarded by `apps/web/lib/the-gift-qr-does-not-expire.test.ts` (8 assertions).
The path builder is pure and is **executed**; the two decisions inside a
`server-only` module and a JSX client component are source-checked, which is
the weaker half — each anchors on a symbol that cannot be renamed without
breaking the build, and the sentence ordering is asserted by byte position
rather than presence, since both sentences exist in either version.

SPEC IMPACT: None.
