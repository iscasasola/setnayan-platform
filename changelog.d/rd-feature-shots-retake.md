## 2026-10-18 · feat(features): real phone pictures for eight more /features pages + event-hub retake

PR #6640 left 15 feature pages with no picture ("the lab would not open the item at 375"). The lab does open them:
the Studio pages in `/dev/maker-lab?studio=1` have no URL and are reached by tapping the **Studio pages ▾** menu, and
the print previews need a stand-in for the `/api/hub-print/*` routes (they answer 401 with no session). With the
54321 stub, the no-database lab env and the prints fixture server (the same layout/render code the routes call),
every Studio page draws at 375 px on Maria & Jose's fixtures.

New 460×972 captures in `public/feature-shots/` (24–37 KB, same frame as the existing ones):
logo-maker, mood-board, dress-code (Mood Board & Dress Code › Attire with a filipiniana and a barong picked),
e-gifts (the guest's wish list + ways to give), prints (the invitation set), papic (a guest's own shots on the Event
Hub, `/dev/home-lab`), 3d-plan (the live public demo's sample room, read-only, no sign-in), real-stories (the
in-code sample editorial, marked "Sample story — not a real couple"). event-hub-0 retaken on today's Maker, plus
event-hub-1 (the Invitation's Story with the love story's own photos).

Still without a picture (no shipped screen reachable without a sign-in or the database): live-watch, patiktok,
setnayan-ai, music-maker, groups, alaala, marketplace (the live marketplace has no open shop yet), compare.

SPEC IMPACT: None — words unchanged; pictures only.
