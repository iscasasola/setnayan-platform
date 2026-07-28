## 2026-07-27 · fix(security): the last six couple/host policies narrowed — guests are out, coordinators stay in

Completes `20271015300000`, which fixed ten of sixteen and pinned six in a shrink-only `KNOWN_BROAD` list because their non-admin call sites made the safe shape unclear.

**Owner rulings, verbatim:**

> *"May a guest see the couple's vendor appointments?"* → **no**
> *"May a guest see or change the couple's song picks?"* → **no**
> *"Who may answer an access request?"* → the owner asked what an access request even is — and on inspection it answers itself (below).

**What unlocked the other four:** reading each table's FULL policy set rather than the one policy in isolation. Every one of these tables **already has** a separate vendor/requester policy, so the couple/host policy never had to carry those roles:

| Table | Already covered by |
|---|---|
| `event_appointments` | `_vendor_read` · `_vendor_update` · `_vendor_insert` |
| `event_song_picks` | `_booked_vendor_read` (the band, from `20271013090000`) |
| `booking_handovers` | `_vendor_read` · `_vendor_insert` |
| `event_access_requests` | `_own_read` · `_own_withdraw` · `_own_insert` (the requester) |

**Which helper, and why.** `current_couple_or_coordinator_event_ids()` — `member_type IN ('couple','coordinator')` — carries the read surfaces. It excludes guests (the ruling) while keeping the invited coordinator, who is a first-class planning role here. `event_appointments_couple_insert` and `_couple_update` already used exactly this helper, so the read now matches its own siblings instead of being **broader than the writes beside it**.

`current_couple_event_ids()` — couple only — carries the two `event_access_requests` policies. **That one answers itself.** The table is a coordinator ASKING the couple to share an area (seat plan, schedule); a row confers no access at all, and the real grant lives in `event_moderators.permissions_json`. The host-side page's own docblock says *"Host-only by RLS"* — but the predicate was member-wide, so in practice **a coordinator could approve their own request**, and any guest could approve it for them. Nobody would design that. The requester keeps their own view via `_own_read` and can still retract via `_own_withdraw`, so narrowing costs the asker nothing.

**`KNOWN_BROAD` is now empty, ceiling 0** — all sixteen closed. New `T7c` asserts directly that no couple/host policy anywhere still resolves through the member-wide function, so the invariant no longer depends on the list being maintained.

**The rulings are proven behaviourally, not assumed.** `T7` uses a THREE-role fixture — a guest sees zero song picks, the **coordinator sees them**, the couple sees them — because a narrowing that also locked out the coordinator would be an over-correction, and asserting only the guest half would not have caught it. `T7b` proves a guest cannot write them either.

Verified: suite 10/10 · full `test:db` **552/552** · exposure baseline regenerated — 6 lines, every one `current_event_ids()` → a strictly narrower helper. ⚠ Production build not run locally (SIGTERM-killed on this machine — 7 GB requested heap vs ~2.5 GB free; a control build of unmodified `main` fails identically), so that check rests on CI.

SPEC IMPACT: Guests lose read access to vendor appointments, song picks and booking handovers, and lose the ability to answer a coordinator's access request — all per the 2026-07-27 owner rulings. Couples and coordinators are unaffected; vendors keep their own policies.
