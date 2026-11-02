## 2026-08-13 · fix(alaala): every lens gets its own budget — a display cap was emptying Attended and With me

Follow-up to #4395, from an adversarial pass over that PR's own diff (6 lenses, 2 skeptics per finding, each told to refute). Five findings survived; **one of them reintroduced, through a display cap, the exact harm #4395 was written to end.**

### 🚨 The one that mattered — measured against the shipped code, not reasoned about

`getAlaalaWall` capped the **merged** owned+attended wall at the 48 newest frames and only *then* filtered per lens. Run against the real exported core, a couple with **60 frames from their own wedding last month** and **24 they are tagged in from a friend's wedding two years ago**:

```
refs in : 84   after cap : 48
recent   shipped= 48   truth= 84
owned    shipped= 48   truth= 60
attended shipped=  0   truth= 24
with_me  shipped=  0   truth= 24
lensCounts shipped: {"recent":48,"owned":48,"attended":0,"with_me":0}
```

Attended and With me rendered **empty over twenty-four photographs that had been read successfully and then thrown away** — and the page then printed *"No events attended yet"*, a false statement about somebody's life, with a **measured `0`** on the chip that defeats `lensCounts`' own not-measured contract.

🔑 **A GLOBAL CAP OVER A FILTERED VIEW IS A SILENT FILTER OF ITS OWN.** Raising 48 does not fix it; it only moves the wedding size at which it bites. Every frame lens now gets its **own** budget (`surfaceBudget`), and `totals` are measured on the **uncapped** read (`lensTotals`) — never on `items`, which is a display budget. Latent in production today (14 frames, 0 guest memberships); it fires on the first real wedding.

Two consequences fixed with it: the footer printed a **fetch ceiling as a total** under a header promising *"Every photo, video and story you're part of"* — it now says `N+` when a source hit its ceiling, and the chips do too.

### The other four

- **"No events attended yet" was a claim about MEMBERSHIPS made from an absence of PHOTOS.** Every guest is in that state until the photographers work through the album — so somebody who joined a friend's wedding by QR yesterday was told they had attended nothing. The sentence now branches on `hasAttendedEvents`, measured from the event list. Moved into `lib/alaala-wall.ts` as `lensEmptyLine` for the same reason `lifeFlashSummaryLine` lives there: **a sentence inside an async JSX file cannot be imported by the unit runner, so it cannot be checked.**
- **A refused ATTENDED read was reported as `unreadable: false`.** The membership read discarded `.error`, so a broken gate was indistinguishable from "not a guest". Now checked and propagated. ⚠ **Deliberately NOT** mapping `getGuestLiveGallery`'s `null` to `unreadable`: it returns null for a failed read **and** for the ordinary no-tags-yet case, so doing the obvious thing would raise *"could not be loaded"* at the entire guest population. Splitting those needs that function's return contract to change — **named as follow-up, not botched here.**
- **A frame read but not resolvable to a fetchable URL** was silently dropped, serving a quietly shorter wall. Now raises `unreadable`.
- **The People door** was recorded as REMOVED from `/dashboard/library` in the port baseline, because that scanner records controls per route directory and does not follow into app-root `_components` — so deleting it would have fired nothing. The guard now asserts it directly.

### 🪤 The guards were the story again

**The hand-typed lens map was decoration, and the mutation proved it.** Rewriting one entry to `owned: <AlaalaLensBody lens="recent" …>` left **17/17 tests green** — the guard matched the record KEY, which that mutation preserves, and `Record<K, ReactNode>` gives no key↔prop link. The Owned chip would have quietly shown the Recent wall. The map is now **derived** from `ALAALA_LENSES`, which makes the class of bug unexpressible; that beats any guard over hand-typed pairs.

**And one sabotage escaped the first re-run:** replacing `surfaceBudget(ordered, …)` with `ordered.slice(0, …)` in the data layer left everything green, because the new tests exercise the pure core directly and **nothing watched the file where the bug actually lived**. 🔑 *Testing the primitive is not testing the caller.* A source assertion now holds the call site — and it is itself mutation-proved.

**16 sabotages, each occurrence-counted before → after, all 16 caught** (was 13/16 before these two repairs; two further mutations had gone stale against a refactor and were reporting ANCHOR NOT FOUND rather than passing — an unrun mutation proves nothing either).

### Dropped after verification, so nobody re-audits them

Presign volume (SigV4 is local HMAC — no network, no billing, and the new path *adds* an event cap the old one lacked) · the moment-graph fetch on the library page (concurrent, one extra round trip, zero while the flag is off) · the People lens's `member_type='couple'` scope (an explicit counsel gate, pre-existing, `do not widen this filter`) · the unsatisfiable `'Someone'` filter (inherited verbatim from the base tile) · the anniversary email's `?tab=photos` landing (the card is one click away under *Albums by event*; prod has 0 anniversary emails and the earliest possible is 2027-08-01).

Also verified clean: **all 34 columns** named by the new selects exist in prod and carry `SELECT` for `authenticated`.

Full suite: **7,774 unit tests green**, typecheck clean, all 21 `lint-*.mjs` guards + `lint:dup-rule` green.

SPEC IMPACT: None — no SKU, price, schema or migration.
