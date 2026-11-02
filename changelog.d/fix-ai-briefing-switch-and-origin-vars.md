## 2026-08-06 · fix(ai,urls): connect the AI briefing kill switch, and collapse four site-address variables into one

The last two findings from the audit. Both are **levers that were connected at
neither end.**

### 1 · The AI briefing switch gated nothing

`lib/setnayan-ai-cockpit-flag.ts` exported `cockpitEnabled()` whose own docblock
read:

> "The cockpit renders ONLY when this returns true. Default OFF, so prod today
> keeps the R3 status board byte-for-byte."

**Every word false.** The function had **zero importers**, so it neither held the
surface back nor could take it down. The real and only gate is the AI
entitlement in `event-dashboard.tsx` (`aiActive = aiEntitled || suriPreview`),
which shipped without ever consulting it.

🚨 **A correction to what was reported to the owner.** The audit said the
briefing "is showing to couples right now" and that claim was repeated without
checking. **Verified against prod: 5 events, `setnayan_ai_active IS TRUE` on 0,
`planning_mode = 'assisted'` on 0, and zero AI orders.** Nobody sees it today.
Which made the decision easy — nobody gains or loses in either position.

**Now a KILL SWITCH, not a rollout switch. Default ON:**

| `NEXT_PUBLIC_SETNAYAN_AI_COCKPIT` | effect |
|---|---|
| unset / anything but `'0'` | briefing renders — today's behaviour, unchanged |
| `'0'` | hidden everywhere, entitlement or not |

Why not the default-OFF the old docblock claimed: that described a pre-launch
rollout gate for a surface that has since shipped. Re-wiring it default-OFF would
add a SECOND undocumented condition, so turning the AI product on for an event
would silently produce no briefing and the next person would hunt a bug that was
a hidden env var — precisely the "gate with no handle" failure this codebase has
already paid for twice. It ANDs in last and can only ever REMOVE the surface.

### 2 · Four variables answering one question

`NEXT_PUBLIC_APP_URL` (101 reads, the only documented one) ·
`NEXT_PUBLIC_SITE_URL` (3) · `SITE_URL` · `NEXT_PUBLIC_SETNAYAN_BASE_URL` (1 —
the Maya payment success/failure return URL).

In production all four end at the same hardcoded `https://www.setnayan.com`, so
nothing looked broken — **which is exactly why it survived**. The damage is off
production: on a Vercel PREVIEW deploy only `NEXT_PUBLIC_APP_URL` is set, so
Samahan invite links, host-accept links, social card URLs and the payment return
URL **all silently pointed at PRODUCTION.** Testing an invite on a preview sent
the tester to the live site.

One resolver now — `lib/site-origin.ts` — preferring the documented name, then
each legacy name in turn, then the same final fallback all four already had. It
also strips trailing slashes, which two call sites concatenated without.

**Purely additive:** any deploy setting a legacy name still resolves to that
value when `APP_URL` is unset. Production is unchanged.

Safe to touch the payment URL today: **every `setnayan_pay_methods` row is
`is_active = false`** — the gateway is dormant and charges nothing in V1.
`lib/social/urls.ts`'s `siteUrl()` is kept as a delegating re-export so its four
existing importers are untouched.

### The guard

`gates-have-handles.test.ts` already enforced this class **for database columns
with no writer** — it caught `papic_face_mode` (7 weeks storing nothing) and
`live_media_public` (every uninvited viewer denied the livestream). A gate
FUNCTION with no caller is the same bug one level up: the existing tests trace
the WRITE, the new one traces the CALL.

⚠ **An allowlist, not a ban.** Four flag modules are legitimately parked ahead of
their consumers, with accurate docblocks — and three of those were among the
claims an earlier audit pass *refuted*, precisely because their notes were
honest. Each is named with a reason, so a NEW inert flag fails while parked work
does not. Adding to the list puts it in the diff where a reviewer can disagree.

**Sabotage-verified:** removing the import I just added makes the guard name
`setnayan-ai-cockpit-flag` and fail; restoring it passes.

### Verification

`tsc --noEmit` exit 0 · all 14 lint scripts pass · **6,678 lib tests pass**
(6,629 before + the new guard's siblings).

Baseline regenerated: `actions` 514 → 515 and four new files — **none of it
mine.** That is `sendStageNoteFromEvent` and friends from #4177
(doorways-before-the-day), which merged without regenerating. Named rather than
swallowed, since one readable line per change is the whole point of that guard.

SPEC IMPACT: None — no schema, pricing or product decision changed. The briefing
renders for exactly the same events as before; the owner simply now has a switch
that works.
