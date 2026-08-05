## 2026-08-05 · feat(vendor): a shop can finally say which weddings it takes

`vendor_profiles.compatible_venue_settings` and `compatible_ceremony_types` have
had a reader, an Explore filter, a server-side validator and a public badge since
iteration 0043 — and **no writer**. The only form that ever posted them was the
full profile editor, retired 2026-07-05; its action (`saveVendorProfile`) has had
no caller since, and the inline editor that replaced it never carried the fields.

So every shop matched on whatever its seed row held. Both live profiles carry the
identical array `["banquet_hall","garden","heritage"]` and one is literally named
"(FIXTURE)". **The marketplace's venue matching was running on a fixture nobody
chose and nobody could change.** A restaurant could never say "yes, I do wedding
receptions" — the fourth instance in one week of a column with a reader and no
writer (`live_media_public`, `papic_face_mode`, the admin venue-type picker).

**Built:** My Shop → Business Profile → **"Weddings you're a fit for"** — two
checkbox groups (8 venues · 18 ceremonies) with their own server action.

- **Its own action, not an `INLINE_PROFILE_FIELDS` key.** Every key that editor
  accepts is either locked-identity (refused outright once a shop is verified —
  corrections go through an admin) or an allowlisted gallery field. Venue fit is
  neither: a verified studio that starts taking beach weddings must be able to
  say so without filing a correction ticket. Mirrors `updateServiceRadius`, which
  answers the same question from the other side — reach is HOW FAR, this is WHAT
  KIND.
- **Deliberately NOT a checklist item.** Adding it to `businessProfileChecklist()`
  would drop every already-published shop below 100% overnight and re-open the
  verify teaser on profiles finished months ago, for a field that did not exist
  when they filled the form in. Undeclared is a valid state.
- 🔑 **"Nothing ticked" and "everything ticked" mean the same thing to the
  marketplace and the opposite thing on screen.** A NULL column matches every
  couple; an empty array matches nobody. So the card says out loud that ticking
  narrows rather than reveals — without that sentence a shop owner who ticked
  nothing would reasonably believe they had switched themselves off.

**Two live label defects the new control would otherwise have exposed.** The
public vendor page kept its own hand-typed label maps under a comment saying they
"mirror the vendor-dashboard editor labels" — a mirror nothing enforced. The venue
map never gained `restaurant`; the ceremony map was missing `chinese`, `jewish`
and `born_again`, three of the eighteen values the server has accepted since the
faith worldwide expansion. The fallback prints the raw database word, so a couple
would have read **"born_again"** on a public page. Nothing errored, nothing
logged, and nobody could tick the affected boxes — **the defect was waiting for
the writer to exist.** Both maps now derive from `lib/vendor-compatibility.ts`,
the one vocabulary the picker, the server allowlist and the badge all read.

🚨 **A latent wipe closed.** `saveVendorProfile` builds a FULL payload and
`parseCompatibility` maps "absent" to NULL, so the day that orphaned action is
wired to any form lacking these checkboxes it would not clear a shop's answer — it
would silently replace it with "we take every venue and every ceremony", reporting
success. It now writes those two columns only when the form posts an explicit
`compatible_fields_present` marker. 🔑 **The marker is deliberate, not
`formData.has()` on the checkboxes**: an unticked checkbox posts nothing, so
"cleared every tick" and "never rendered the boxes" are the identical FormData —
keying on them would have made *clearing* impossible instead, equally quietly.

🪤 **One guard shipped as decoration and was caught by mutation-testing it.**
`/compatible_fields_present/` matched the explanatory COMMENT above the guard, so
replacing the whole condition with `true` left the test green. It now matches the
conditional spread itself. **A name appearing is not a name being used.** All
three new guards were re-checked against deliberate sabotage and go red.

**Verified:** 6729 unit tests green under `Asia/Manila`; all 12 `lint-*.mjs`
scripts clean; `next lint` clean on the new files; scoped `tsc` clean (the full
typecheck cannot run locally — 7 GB heap, CI is the detector).

SPEC IMPACT: `DECISION_LOG.md` — closes the 2026-08-05 row "A VENDOR CANNOT SET
WHICH VENUES THEY MATCH", which specced this build and flagged the wipe hazard.
