## 2026-08-18 · fix(public): twenty reads whose absence rendered as data

S3 lane C — the scattered rest. Supabase **resolves with `{ error }`** rather than
throwing, so a refused read arrives as `data: null`, `?? []` makes it empty, and
the page states the absence as fact. **Half this lane is public or reached by a
link**, so the reader is a stranger or a couple deciding what to buy.

Independently re-measured before starting: **20 unbound reads across 9 files**,
matching the brief exactly. Each classified on one question — **does an absence
RENDER AS DATA, or does it DENY?**

**16 rendered · 4 deny (left alone).**

### The four that deny — deliberately not touched

- `v/[slug]/page.tsx` · `profile` → `return isAdminProfile(profile)`. Null → false
  → denied. **File not modified at all.**
- `v/[slug]/page.tsx` · `exp` → already captures inside its soft-probe.
- `(shell)/explore` · `viewerProfile` → null → `isAdminProfile(null)` false → demo
  mode stays **off**. The failure withholds a capability rather than granting one.
  Documented in place so the next pass does not "fix" it.

### 🔑 The insight that made most of the rest fixable

An RLS denial and a refused read are **not** the same value after all — with
`maybeSingle()`, RLS filtering returns `{ data: null, error: null }` while a
*rejected* query sets `error`. Four surfaces answered both with the same 404:

- **`proposals/[publicId]`** — a quote reached by a link somebody sent. Told the
  recipient it does not exist.
- **`papic/order/[token]`** — a guest's own order behind a token. Same.
- **`v/[slug]/booth`** — a real, verified supplier's booth, answered exactly like
  "this shop is not public."
- **`panood/control/[eventId]`** — a host mid-event told their own control room
  does not exist.

Each now separates "not yours / no such thing" (404, unchanged) from "we could not
read it" (an honest failure that says nothing was cancelled or withdrawn).

### The rest

- **`explore` · `ev`** — 🚨 the **"match my event" toggle renders from the URL but
  only filters if this read landed.** Refused, the couple saw an unfiltered
  marketplace with the toggle still showing as on — *a filter that claims to be
  applied and is not*, on a public browse page. Now says so.
- **`explore` · `follows` + `saved`** — the couple's own saves and follows read
  back as never taken. Now says the list is safe and simply unreadable.
- **`chat-message-stream`** (×3) — a quote or appointment **card vanishing from a
  live conversation** where the other party is waiting on exactly that card, plus
  an amendment total. The thread now says the cards are missing, not withdrawn.
- **`panood/control` · `zoneRows`** — the operator saw "No cameras yet. Add your
  first in Setup" **mid-event, with cameras already set up**. Corrected *in place*
  rather than with a banner: this shell is the owner-locked scroll-free controller
  ("nothing under and above it"), and the lie was always that sentence.
- **`panood/control` · `grantRaw`** — read as "YouTube not connected", inviting an
  operator to reconnect a channel that is connected.
- **`tour/gallery` + `tour/seating`** — 🔑 **on a demo, empty is always wrong.**
  The tour runs on ONE pinned sample event chosen because it *has* guests and
  photos, so there is no legitimate zero — an empty seat-finder shows a
  prospective customer a flagship feature that appears to do nothing. Worth
  binding even though no real person's data is involved: the false statement is
  about the **product**.

### Deliberate swallows KEPT, with the reason no longer swallowed

`explore`'s card-enrichment block states a reasoned fail-soft policy (a badge is
not worth taking a public marketplace down for) and `panood`'s manual on-air read
states another. **Both trades stand** — the error is captured so the reason reaches
the logs, exactly as intended, instead of a UI banner disproportionate to a missing
badge.

🪤 `nameData`'s fallback is `'Your vendor'`, which is **already** the legitimate
value for a shop with no business_name — so the swallow was ambiguous with a real
value, not merely quiet.

### Verification

⚠ Test-proved and measured, **not observed**.

- 8,633 unit tests pass. Typecheck clean. Port lint, colour, contrast,
  stored-asset, masthead, engineering-notes, server-only and pinned-bars lints all
  pass. **No control lost — `port-control-baseline.json` untouched.**
- Every treated read verified twice: **bound** at the read, and each user-facing
  flag **reaches the JSX**. Binding alone was not accepted — logging never changed
  the render.

SPEC IMPACT: None.
