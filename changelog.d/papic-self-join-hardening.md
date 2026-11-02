## 2026-08-01 · fix(join): a near-miss name must not hand a poster-QR stranger another guest's session

`lib/papic-event-access.ts` held Phase 2 (reunion · celebration · gala_night · Samahan-owned anniversary) behind **"self-join hardening"**, on the reasoning that for group types the entry path is a **QR printed on a poster**, not a host-written roster. On 2026-08-01 the owner widened Papic to all 16 event types, which waived that gate. The hardening it was waiting on did not exist. This is the part of it that the code can prove is wrong.

### What a stranger with the poster QR could do

The join token is 128-bit random (`generate_event_join_token()` = `encode(gen_random_bytes(16),'hex')`), so it is not guessable — but it is **printed on a poster**, so possession is not a secret. What it unlocked:

`app/join/[eventId]/actions.ts` matches the joiner's typed name against the couple's seed rows with `classifyClaimMatch`, whose `CONFIDENT_MATCH` threshold is a **0.86 Levenshtein ratio** — roughly 1.7 character edits on a 12-character name. On a `confident` result the code **bound the caller to that existing row**. On the accountless path (`selfJoinAction` step 4b) the bind is:

```ts
await setGuestSession({ guest_id: match.candidate.guestId, event_id: eventId, qr_token: qr });
```

— i.e. it mints **the matched guest's own `qr_token` session**, the exact credential their *private* personal invitation link mints at `/[slug]/redeem`. That session opens the personal page of a `private` event (`lib/slug-access.ts` `canViewSlugEvent` accepts any guest-session for the event), their Seat Pass, their Papic pool and "photos of you", and it uploads into the shared gallery **as them** (`readGuestSession()` is the sole auth on `/api/papic/guest-capture`).

So typing **"Marla Santos"**, **"Maria Santoz"** or **"Mario Santos"** — each ≥ 0.86 against *Maria Santos*, each a plausibly real and different person — completed an identity transfer. And it left **no trace**: that branch returned before the `scan_events` write, and unlike the no-match branch it does not notify the couple.

### The bar was already decided elsewhere in this codebase

`public_seat_lookup()` — the free public seat finder, where an anonymous visitor types a name into a box — is **EXACT full-name match** after case/whitespace normalization ("no substring, no enumeration" in its own comment), plus a 2-char floor and a rate limit. That surface returns a **table label**. The join surface returns a **session**, and was two orders of magnitude looser.

### The change

New pure predicate `seedBindAllowed(presented, candidate)` — exact equality after `normalizeName` (case · diacritics · punctuation · whitespace folded), or exact equality of the **token multiset** so "Santos, Maria" still binds to "Maria Santos". Zero edit-distance slack. Applied at **both** bind sites: the accountless one above and `joinEventAction`, which silently transferred a **host-assigned ceremonial role** (`principal_sponsor`, …) on the same fuzzy score.

**Nobody is blocked, and no new error path exists.** A near-miss falls through to the *pre-existing* optimistic-admit branch that `none`/`ambiguous` already took: the joiner is admitted under their own `self_added_unlisted` row **and the couple is notified** to Link / Keep / Delete. The 2026-06-25 optimistic-admit decision ("a name isn't a secret") is untouched — only the fuzz band on the identity-transfer step is removed. Net effect on observability is positive: a near-miss now produces a host notification instead of a silent bind.

Second, smaller fix: `recordJoinScan()` is extracted and now also fires on the seed-bind branch (`context: {entry:'self_join_bound_seed'}`), so an accountless bind is no longer forensically invisible. Best-effort and wrapped — a triage record must never block a guest.

`lib/guest-claim.ts` had **no test at all**. Its logic moved to `lib/guest-claim-core.ts` following the shipped `<x>`/`<x>-core` convention (drive-copy, face-match, add-single-guest) so it can carry one; `guest-claim.ts` keeps the `server-only` guard and re-exports verbatim. **21 tests, 0 behavior change in the move.** The load-bearing ones assert the gap directly: each near-miss is first asserted to score ≥ `CONFIDENT_MATCH` *and* classify as `confident`, then asserted to be refused by the gate.

### Verified against prod (`njrupjnvkjkitfctetvi`, SELECT only)

- `anon` reads **0** rows from `guests` and **0** from `event_join_tokens`, where service-role sees **39** and **4** — so those are genuine RLS denials, not empty tables. The roster is not readable directly; the matcher was the only oracle, and all 39 guest rows carry a `qr_token`, i.e. all 39 were bindable targets.
- A signed-in joiner's only `guests` SELECT policy is `guest_reads_own_row`; full-roster read needs couple/coordinator/moderator. Confirms the exposure was the *bind*, not a read policy — no policy is touched here, and the exposure baseline is unchanged.

### Deliberately NOT changed (owner/product calls, evidence in the PR)

- **Join tokens never expire.** `event_join_tokens.expires_at` is nullable and **0 of 4 prod rows set it**; 0 revoked. A poster photographed once is a permanent credential. Retrofitting expiry would lock out live events — a product decision, not a bug fix.
- **No IP rate limit on the join actions.** The obvious guard is unsafe here: a day-of surface sees a whole venue behind one NAT/CGNAT address, so an IP bucket that stops a name spray also stops 200 real guests. Stated rather than shipped half-right.
- **No host-approval step for self-joins on group-class events.** That is the other half of the waived Phase-2 gate and it is a product decision.
- **A seat held by an *accountless* guest is still bindable.** The `claimed` filter only excludes `event_members`-bound rows, and `/[slug]/redeem` leaves no marker on `guests`. Closing it would break the legitimate "same guest, second phone" re-scan.

SPEC IMPACT: None — no SKU, price, entitlement, schema, policy or migration change. Narrows one predicate on an existing flow. Records that the "self-join hardening" precondition named in `lib/papic-event-access.ts` is **partially** addressed: the identity-transfer hole is closed; token expiry, host approval and self-join rate limiting remain open owner items.
