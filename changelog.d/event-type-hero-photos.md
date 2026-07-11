## 2026-07-11 · feat(create-event): hero photos for the four newly-enabled event types

Add Recraft-generated hero photos for **Anniversary, Graduation, Reunion, and Gala Night** at `apps/web/public/event-types/{key}.webp` — the four types enabled to couples in PR #3127 that previously had no asset.

The picker (PR #3128) already resolves `/event-types/{key}.webp` automatically, so dropping these files in swaps each type's branded-gradient placeholder for a real photo with no code change. All 14 couple-facing types now have a hero image.

Grade-matched to the existing set: warm cinematic editorial 4:5, Filipino/Asian subjects, evening-light substyle. Compressed to 32–48 KB (cwebp q78, 900px wide) — in line with the existing 40–120 KB assets.

SPEC IMPACT: None (marketing assets only; no schema, pricing, or roster change).
