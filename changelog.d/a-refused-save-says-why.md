## 2026-09-08 · fix(vendor): a save that wrote nothing must not say "saved"; showcase media becomes a gallery

Two changes to the service-card editor, found while trying to price a real card
on production.

### 1 · `?saved=1` is now earned

`updateVendorService` checked only `error` and then redirected to `?saved=1`.
**PostgREST returns `error: null` for an update that matched ZERO rows**, so
"wrote the card" and "wrote nothing" were the same value and both ended at the
success message. The update now `.select()`s the rows it changed and refuses
before the success redirect when none came back.

Both ways to match nothing are live and ordinary: a stale or wrong
`vendor_service_id` in a long-lived form, and an RLS `USING` clause that excludes
the row — `vendor_services_manage` resolves through `current_vendor_profile_ids()`,
so a lost team membership is enough.

🔑 **The absence of an error is not the presence of a write.** Same disease as the
refused reads catalogued across this codebase (`data ?? []` turning a 42501 into
"no rows"), pointed the other way: a write nobody made, reported as one that
happened.

The message names only the fact — *nothing changed* — and deliberately does not
guess a cause, because from inside the action a wrong id and a refused row are
indistinguishable. `apps/web/lib/a-save-must-prove-it-wrote.test.ts` holds the
`.select()`, holds the zero-row check ahead of the redirect, and fails if the
message starts claiming a diagnosis. Mutation-tested three ways.

### 2 · showcase photos and video render as a gallery

Owner, looking at three uploaded showcase photos rendered as filename rows:
*"we want gallery type icon and same to video."* A supplier at that moment is
asking whether the right shot went up and whether the crop works, and a filename
answers neither. Photos and video now render as image/poster tiles.

⚠ **This reverses a decision recorded in `file-upload.tsx`** — *"`!multiple`
because a gallery needs a scannable list, not N hero images"* — which held while
every multi-file field was an evidence lane. Reversed on the owner's instruction,
and scoped so it applies to nothing else.

`FileUpload` is shared by ~20 surfaces including government-ID and dispute
evidence, where the filename IS the subject and a square crop would hide the
corner of a document that carries the seal. So this is a third `variant`
(`'gallery'`), opted into by the two showcase fields only — a variant rather than
a second boolean for the reason that file already gives about `roundPreview`: two
flags describing one picture drift into disagreeing.

`apps/web/lib/the-showcase-is-a-gallery.test.ts` asserts both directions — the two
showcase fields opted in, and **no other `.tsx` under `app/` did** — plus that the
tile renders a real `<img>`/`<video>`, that the row layout survives for every other
variant, and that the remove control is not hover-revealed (this field is used on
phones, which have no hover). Mutation-tested four ways.

SPEC IMPACT: None.
