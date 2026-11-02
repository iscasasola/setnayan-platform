## 2026-08-24 · fix(dashboard): "you have none" now means none, and a guard keeps it that way

Supabase **resolves** with `{ error }` rather than throwing, so a refused read
arrives as `data: null`, `?? []` turns it into an empty list, and a couple's
screen states an absence nobody measured. Eleven reads in the couple tree did
exactly that. Each now binds its error, logs it with
`logQueryError(…, 'graceful_degrade')`, and — where the absence changes what the
screen SAYS — gates the claim on a measured flag and tells the person reading.

What a person was told, and is not told any more:

- **Unlisted guests** — "Nobody to review right now." while people waited to be
  kept or removed, and so never were.
- **Add categories** — every category offered again, including the ones they
  already have. Adding one here **sends a supplier an inquiry**, so this refusal
  cost a message. The list is now held back with a caveat rather than lengthened.
- **Shape your page** — "Your optional sections will appear here." about an
  invitation that is live and has all twelve rows (the migration backfill
  guarantees them, so an empty result here is never the truth).
- **A package booking** — a receipt still showing a price with not one line on
  it, and the "Removed" list gone with it.
- **Save-the-Date** — "0 total · 0 last 7 days · 0 today". Now an em-dash.
- **Studio** — a coordinator's or supplier's suggestion never reaching the
  couple, and the coordinator invited to send it again, breaking this file's own
  promise that a dismissed suggestion is never re-sent.
- **Checklist** — the vendor-progress card vanished silently; its `try/catch`
  could never see a refusal, because Supabase does not throw.

New guard `apps/web/app/dashboard/reads-are-honest.test.ts`, the per-tree twin
of `app/vendor-dashboard/reads-are-honest.test.ts`. It **derives** its subject
list from the tree (a hand-typed list is a list of the files somebody thought
of), **floors** the walk so an empty sweep cannot pass, exempts two SHAPES
rather than any file — the `auth.getUser()` destructure, and a read whose
absence immediately `notFound()`s/`redirect()`s, where failing closed IS the fix
— and carries the rest as a **bill**: `KNOWN_UNBOUND`, keyed by file + variable
+ count so a moved line cannot rot it, checked in BOTH directions so a fixed
read whose line was left behind also fails. Measured: **69 sites on the bill**,
down from 80. It only ever gets shorter.

Also corrected here: the brief said "~30 files, and the couple's supplier page
has 45 unbound reads". Re-measured on `origin/main` — that page has **3**
unbound and 12 already binding, and its three are a documented, deliberate
fail-open behind a flag. Those are logged, not rewritten.

SPEC IMPACT: None.
