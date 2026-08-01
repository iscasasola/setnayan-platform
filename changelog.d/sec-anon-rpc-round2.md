## 2026-08-01 · sec(rpc): round two — rewriting any vendor's prices, forging reviews, and breaking a live event's cameras were all one default grant away

Pass one read the 33 anon-callable SECURITY DEFINER functions whose bodies matched a sensitive-table regex and closed 7. This closes what pass two found in the **178 the regex excluded** — where the filter was wrong about roughly a quarter, and **12 findings survived adversarial refutation**.

### The root cause is one line

`pg_default_acl` grants EXECUTE on new functions in `public` to `anon` **and** `authenticated` automatically. **203 of 204 SECURITY DEFINER functions carry that grant and no migration ever asked for it.** Every finding below is a symptom of it.

This is the same default-ACL class already fixed for **tables** (`REVOKE ALL` in every migration). Nobody was doing the equivalent for functions. §4 stops it for everything created from here on — explicit over implicit, and it fails **closed**: a forgotten grant surfaces immediately in testing, whereas a forgotten revoke has been shipping silently for months.

### What each one actually allowed

| function | what an anonymous caller could do |
|---|---|
| `save_vendor_service` | **Rewrite any vendor's published prices**, discounts, payment schedules and inclusions. The vendor id is a parameter and is trusted; the price-history row records the change with **no actor at all** |
| `admin_override_publish_review` | **Publish a forged review signed by a fake admin** — the admin id is a *parameter*, written to `override_admin_id` and never compared to anything. It lands in the public reviews table and folds into the rating average |
| `papic_reserve/release_event_points` | **Exhaust a live event's Papic pool** so every guest camera returns 409 mid-reception — or refund your own capture cost and shoot unlimited. Input is an event id, which sits in every guest's URL |
| `vendor_block_booked_date` | **Mark any vendor booked, permanently.** The vendor's own Remove button filters on a different `block_source`, matches zero rows, and reports success |
| `ensure_papic_auto_missions` | The guard **failed open** — see below |
| `record_std_view` · `next_screen_name_id` · `count_vendor_disputes_30d` | Falsify a displayed counter, permanently skew the public vendor-name sequence, and read a per-vendor dispute leaderboard |

### The guard that failed open

```sql
IF auth.uid() IS NOT NULL AND NOT is_admin() AND NOT EXISTS (member) THEN RAISE
```

With no session `auth.uid()` is NULL, the first conjunct is false, the whole condition is false, and execution falls through to the INSERT. **A logged-in stranger was refused; an anonymous one was not** — anon was strictly *more* privileged than an authenticated non-member. An authorization inversion, not a missing check. Fixed by requiring a session first; body otherwise reproduced verbatim.

### Why revoking is safe — verified per function

Every caller located by its actual `.rpc()` call site. **Four have no caller at all.** Three are service-role only. `ensure_papic_auto_missions` keeps `authenticated`.

`save_vendor_service` was the one session caller, and its action is switched to the admin client in this same PR. The app already resolved the vendor from the session via `ensureProfile()` — **the ownership answer doesn't change, it just stops being a parameter the database was willing to believe.**

### ⚠ On method, because this audit went wrong first

The first attempt at pass two passed a **hand-written list of function names** into the workflow. Fourteen of sixteen sampled didn't exist, the list arrived empty through a separate bug, zero agents ran — and the summarising agent produced *"All 189 were correctly filtered. Zero exceptions."*

A confident clean bill of health for an audit that examined nothing. It was caught by the agent counter (1 agent, 0 tool calls), not by reading the prose.

The rerun derives its work-list from `pg_proc` inside each agent, requires every agent to report what it actually examined, and **aborts rather than summarise an empty result**. It then examined 178 bodies across 54 agents and found the above.

Same discipline here: signatures were verified against `pg_get_function_identity_arguments` before writing. The first draft guessed them and got `admin_override_publish_review` wrong — **it takes nine arguments, not three** — which would have failed the entire migration.

Verified: migration guard green (1021) · **full DB suite 720/720** · `tsc --noEmit` clean · the anon-surface guard confirms all nine are closed in the replay. The baseline drops 9 lines; **181 remain unreviewed** and that number is still a debt figure.

SPEC IMPACT: None — access hardening plus one authorization fix. No intended product behaviour changes.
