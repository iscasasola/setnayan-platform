## 2026-07-30 · fix(security): "mutual confirmation is consent" is now enforced by the database, not only by a server action

`person_connections` shipped with **one** policy:

```sql
CREATE POLICY person_connections_participant ON public.person_connections
  FOR ALL
  USING      (is_admin() OR I own from_person OR I own to_person)
  WITH CHECK (is_admin() OR I own from_person OR I own to_person);
```

No `TO` clause (so `PUBLIC`), `USING` identical to `WITH CHECK`, no `REVOKE` anywhere — and the load-bearing omission, **no predicate on `status`**.

So the entire legal basis of the family tree lived in `people/actions.ts`. PostgREST is reachable with the publishable key plus any user JWT, which meant a user could `INSERT` a row with `status='confirmed'` directly — **forging a spouse, parent or child edge onto a person who never agreed** — or `UPDATE` their own pending edge straight to confirmed. Since `visible_connection_names()` gates on `status='confirmed'`, that also turned the graph into an email → real-name oracle.

The rule this restores is the one counsel signed off on (`People_Graph_and_Lifelong_Identity_2026-07-04`, and the 2026-07-17 branches-vs-leaves lock): **an edge is personal data of both endpoints. One may propose it; only the other may confirm it.**

### Four policies instead of one

| Command | Who | Predicate |
|---|---|---|
| `SELECT` | either endpoint, or admin | unchanged reach — reading your own pending proposals is how the confirm UI works |
| `INSERT` | the proposer | `status='pending'` **and** `from_person` is yours **and** `from ≠ to`, with both timestamps null |
| `UPDATE` | **the recipient only** | `USING status='pending'` (pre-image) **and** `WITH CHECK status IN ('confirmed','declined')` (post-image) |
| `ALL` | admin | kept explicit so an admin's reach shows in `\dp` rather than hiding in an `OR` leg |

Both halves of the `UPDATE` policy are required: `USING` alone would let the recipient rewrite a settled edge.

Also closed: `REVOKE ALL … FROM anon`. The defining migration never revoked, so `anon` held write privileges on a table of consented relationships by default ACL — and `anon` has no person node and can never legitimately write here.

**No app change was needed.** The policies encode exactly what `people/actions.ts` already does — propose inserts `status:'pending'`, confirm and decline both filter `to_person_id = mine` and `status='pending'`. Choosing the policy split over `SECURITY DEFINER` RPCs also avoided adding new grantable functions, which are themselves an exposure widening (see `20271025100000`).

### Answer timestamps are now stamped server-side

The client sent `confirmed_at` / `declined_at`. Harmless today, but a self-asserted timestamp on a consent record is not evidence. A `BEFORE UPDATE` trigger stamps them. A trigger function takes no arguments and returns `TRIGGER`, so PostgREST cannot publish it — no new surface.

### The regenerated baseline caught a widening in my own migration

The first draft granted `DELETE` to pair with a disconnect policy. The diff:

```
-tpriv public.person_connections|authenticated SIU
+tpriv public.person_connections|authenticated SIUD
```

`authenticated` had **never** held `DELETE` here, nothing in `apps/web` deletes a connection, and disconnect is not built. Granting it "for later" would have made a narrowing PR widen the surface — in a PR whose entire purpose is narrowing. Both the grant and the policy are gone, and a post-condition now **fails the migration** if `authenticated` ever gains `DELETE` here. Disconnect will ship with its own grant, policy and review; the 2026-07-15 lock is mutual *data separation*, which is a larger design than a row delete anyway.

Every remaining added line in the baseline is the other half of a narrowing: `orders`/`payments` `SUD → SU` (the delete lane, from an earlier migration on this branch), `events.honoree_* SIU → IU` (the honoree lock this PR is stacked on), and the four `roles=authenticated` policies replacing one `roles=PUBLIC` `FOR ALL`.

**Stacked on `claude/sec-honoree-deny-and-guard` deliberately** — regenerating the baseline from an older `main` would have re-frozen the exposure that PR just closed, making a future regression invisible.

SPEC IMPACT: None. The connection flow behaves identically; what changes is that the database now refuses what only the server action refused before.
