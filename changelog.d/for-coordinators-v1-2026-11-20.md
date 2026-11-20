## 2026-11-20 · feat(for-coordinators): build the approved 20 Nov drawing — one screen, the day, your shop, invite the suppliers you trust

`/for-coordinators` is rebuilt from the owner-approved drawing `prototypes/for_coordinators_2026-11-20/` (specs;
DECISION_LOG "FRONT PAGE, FOR SUPPLIERS AND FOR COORDINATORS APPROVED: BUILD"). It replaces the 6 Nov page: hero with
the approved personal lines · "We know running other people's days is hard." · One screen for every client's event ·
You can't be left out · On the day, you move the show forward · Bring your clients · Your shop · Invite the suppliers
you trust. Discover's look (`fd-sechead`, `fd-chip(s)`, `fd-btn-terra`), app tokens only, no script of its own — every
ⓘ is a server-rendered `<details>` (`_fc-info.tsx`, InfoTip's classes).

Every line is gated to what is LIVE, never "Coming": the coordinator whisper section and chip are left out (whisper is
the hosts' own today); the free-booking rule shows today's version ("Bring them yourself, and they book you free" +
"Clients who found you outside Setnayan never carry a fee"); "Trusted partners" stays "preferred supplier" / "Trusted
by"; an invite counts after the first COMPLETED booking (`INVITE_INFO`); plans read the catalogue, the fee the live
schedule, the reach `reachLadderSentence()` (reach-free-of-plan is #8014, not live). "Invite a supplier" and the
Invites badge are live and shown with no count and no peso.

Removed: `_fc-client.tsx`, `_badges.generated.ts`. Guards moved, not loosened: `for-coordinators-says-what-ships`
rewritten to the new words (same rules + whisper / "Trusted partner" / "first paid booking" / "Refer a supplier" /
Patiktok pinned shut); `there-is-one-info-dot` SITES re-pointed to `_fc-info.tsx`; `the-sample-is-the-real-page`
drops the /for-coordinators sample-shop case (the drawing removed that section). `port-control-baseline.json`
regenerated (also picks up an unrelated `GearUp` block already on main).

SPEC IMPACT: None — builds an approved drawing; no ruling changed.
