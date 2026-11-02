## 2026-08-02 · feat(papic): a live pool opens the guest camera — and the duplicate poster door is retired

Owner: *"isn't our papic app embedded on the run of day website?"* → **yes, and
more completely than what I had built.** Then, on the fork this exposed: **"A"**
— free guests can shoot.

## ① The free tier had shots almost nobody could spend

`eventPapicGuestActive` required a **purchase**. The free 50-point pool did not
count. So on a free event the guest site showed *"Show my QR"* and *"Photos of
you"* and **no Camera** — the only people who could shoot were whoever had been
handed one of the three claim links.

Now a live pool opens it, paid or free. **Paying buys more SHOTS, not more
PEOPLE**, which costs nothing to give away: the bound was never the number of
cameras, it is the purse, and `papic_reserve_event_points_for_seat` already fails
closed at zero.

⚠ Keyed on `applies`, deliberately **not** `remaining > 0`. An empty pool must
still open the camera — the capture screen explains "out of shots" far better
than a missing button does, and closing the door at zero would strand a guest who
scanned seconds earlier.

All five consumers were checked before widening (guest-site loaders, the hub bar,
the couple's moderation surface, the Kwento decorator, the guest camera itself).
Every one asks the same question — *is the guest camera open?* — so the widening
is coherent at each.

## ② The poster QR I shipped yesterday was a second door

It minted a bespoke `events.papic_pool_token` and pointed at a standalone
`/papic/pool/[token]` camera. **`/{slug}/invite` already existed** — the shared
join link the couple already hands out, already rotatable and revocable, already
feeding the guest list's self-join reconcile queue. RULE 0 exists to prevent
exactly this, and I skipped it.

Pointing the poster at the event site is also **strictly better for the person
scanning it**. The standalone camera let them SHOOT and nothing else; the guest
site gives them a camera, their own QR so others can tag them, and a gallery of
photos they appear in. A poster scanner could previously shoot all night and
receive nothing.

**Deleted:** the route, its action, `lib/papic-pool-join.ts`, its tests, and the
column (migration `20271101093040`). Measured before dropping — **0 tokens ever
minted, 0 poster seats ever created**; the column was deliberately never
backfilled, so "never opened the page" and "no token" are the same state.

`/papic/pool` — the pool GALLERY — is a different surface and stays.

SPEC IMPACT: `DECISION_LOG.md` — free-tier guests may shoot from the shared pool
(owner 2026-08-02, option A); the poster QR encodes the event site's join link.
