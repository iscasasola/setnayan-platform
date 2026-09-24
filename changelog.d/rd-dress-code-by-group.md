## 2026-09-24 · feat(dress-code): one line dresses a whole group, and it says who will ignore it

The dress-code editor has had a per-role tier since 2026-09-20 — style, note and call time for
`principal_sponsor_ninang`, for `groomsman`, for each one. This adds the **coarse tier above it**:
one line for Principal Sponsors, one for Secondary Sponsors, one for the Bridesmaids.

**Measured against production, not against the plan.** The build brief said 35 roles fold into 12
groups. 35 is the *vocabulary*, and the shipped editor never offered it — `role-attire-field.tsx`
already narrows to the roles on that event's guest list, because, in its own words, *a form with
thirty rows is a form nobody finishes*. The busiest live event has **15 distinct roles across 83
people**, and those fold into **six** groups of two or three roles each:

```
select event_id, count(distinct role) filter (where role <> 'guest')
from guests where role is not null group by event_id order by 2 desc;
```

Fifteen sentences become six. The ninongs and ninangs alone are 39 people wearing two things.

🔑 **The finer rule wins, and `resolveAttireFor` is the only place that decides.** A couple who
wrote something for one ninang specifically meant it; a group value silently overwriting a
months-old role value puts her in the wrong clothes with nothing red anywhere.

🛑 **And precedence is never silent — on either side.** Applied quietly, "finer wins" manufactures a
new failure of exactly this codebase's signature shape: the couple types "barong, ecru" on Principal
Sponsors, saves, ninang does not move, nothing says why, and they report the feature as broken.
So every group row names, **before** the typing and by the labels a person recognises, which of its
roles hold their own line. `groupOverrides()` lives in the contract rather than in the panel, so any
later surface that edits a group inherits the warning instead of rediscovering the bug.

🔴 **The read side was the actual defect.** `dress-code-widget.tsx` knew only the role tier, so a
couple who dressed "Principal Sponsors" in one line and never wrote a word for ninang left her page
**empty** — the answer sat in `dress_code_config` and no pixel carried it. It now resolves through
the same ranking, and when the answer comes from the group it says so: *"From your hosts' note for
Principal Sponsors."* A silent provenance is a silent override seen from the guest's side.

📐 **Both tiers are stored; neither is derived.** A group edit leaves `roles` untouched, and the
editor's group list is **derived from `eventRoles`** rather than passed as a new prop — the call
site that forgets a prop renders an empty panel indistinguishable from an event with no sponsors.

⚠ No migration. `dress_code_config` is JSONB and `sanitizeGroupAttire` drops any key that is not one
of the twelve, so a group retired later stops being offered and stops being read on the same deploy.
**+0 exported server actions** — `updateDressCode` is extended, not joined by a sibling, which
matters while the route budget is tight.

Checks: 10 unit tests (one of them pins the 15→6 fold so the comment cannot rot alone, and the
resolver was sabotaged to confirm they can fail) · `tsc --noEmit` clean · `npm run lint` 0 errors ·
all 26 CI guards pass locally.

SPEC IMPACT: None. The dress-code section's contract with the guest is unchanged — a reader still
gets at most one line for who they are; there is simply a second, coarser way for the couple to
author it.
