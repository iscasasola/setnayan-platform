## 2026-08-02 · fix(event-types): a Simple Event host could never launch their website

Owner: *"the host of the event cannot launch his on the day website."*

`simple_event` enabled `day_of` and `gallery` but **not** `website`. Those are not
independent switches — `day_of` and `gallery` RENDER ON the public event site, and
`website` is the surface that makes that site editable and carries the **only**
"go live" control in the product.

There are exactly two launch buttons, and both sit behind a surface check: the
Save-the-Date studio (needs `save_the_date`) and the website editor (needs
`website`). A simple-event host had **neither**, so both redirected them back to
the dashboard and their site stayed **private forever** — which also took the
guest camera, the personal QR and the gallery, since all three live on that site.

🪤 **Every individual gate was correct.** The redirect was right, and the lean
surface list was a deliberate scope choice. What nothing checked was whether the
combination left a way IN. Same shape as the circular buy gate closed earlier
today: correct logic, and nothing beside it asking whether the door could open.

**Fixed in both halves.** `resolveProfile` prefers `event_type_profiles.enabled_surfaces`
and only falls back to the hardcoded profile when no row exists, so fixing the
TypeScript alone would have left the seeded row — the one prod reads — broken.

The migration is written as *"whoever has day_of or gallery and lacks website"*
rather than *"simple_event"*, so a type added later with the same combination is
repaired by the rule instead of reintroducing the dead end. Idempotent.

⚠ Simple events still get **no** Save-the-Date, RSVP or budget — the original
scope choice was right about those; only the website half was a dead end. Pinned
by a test, so the fix cannot drift into handing them the whole wedding stack.

SPEC IMPACT: `DECISION_LOG.md` — an event type with `day_of` or `gallery` must
also carry `website`, since that surface owns the only launch control.
