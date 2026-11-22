## 2026-11-22 · fix(copy): words that contradicted current rulings — supplier plan names, retired Music Maker, Editorial PRO, Seat plan

Words only. One cloud sweep of user-visible copy against the DECISION_LOG; files owned by open PRs were left alone and are listed in the PR body.

- **Supplier plan names** (2026-11-14 "NAMED PLUS · PRO · ULTRA (NO "SUPPLIER")" and 2026-11-22 "THE SHARED BRAIN" (5): suppliers **Free · Plus · Pro · Ultra**, Verified is part of Free): "Supplier Plus / Pro / Ultra" → "Plus / Pro / Ultra" on the supplier-plans feature page (EN + TL, now "four plans", Verified inside Free), the story's shared-album scene, the album-share switch, Today's wrap-up lock, the album-share refusal, Creators, Payment options, Branches, the help topic, the admin verify page, the admin request card and the Ugat surface label.
- **Music Maker retired** (2026-11-20 "PATIKTOK AND MUSIC MAKER RETIRED"): the privacy page's Suno line no longer names Music Maker; the admin action centre and the Music Maker queue say it is retired and only songs already paid for remain; the Ugat brain tagline drops Music Maker and LED (retired 2026-08-11).
- **Editorial PRO** (2026-09-25 E4 "fix the 'Editorial PRO' copy"; 2026-11-20 Post Event → the event's Story): the door-less `/dashboard/<id>/studio/editorial-pro` buy page is deleted and forwards to `/dashboard/<id>/story` through `lib/legacy-redirects.ts` (one row, no route cost); the "Powered by" label for `EDITORIAL_PRO` reads "Story Maker".
- **Seat plan** (2026-11-11 "THE WEBSITE USES THE APP'S SHIPPED NAMES"): the reception-booked milestone says "Finalize your Seat plan", not "Seating Chart".
- **No typed price**: the admin inbox matcher's example drops its "PHP 2,999.43" figure.

SPEC IMPACT: None — copy brought in line with existing DECISION_LOG rows; no ruling changed.

**Ship controller, on the controller's answers (2026-11-22):**
- **Suno is no longer a subprocessor.** No code calls it; the only render that used it was Music Maker (retired 2026-11-20). Removed from `lib/subprocessors.ts`, the /privacy list and the NPC DPA task. The filed NPC PDFs are untouched (they are the filed record). The internal compliance record (`platform_compliance_facts.sub_processors`) still lists it; an admin reconciles that at /admin/compliance.
- **The onboarding "Patiktok" photo-booth chip reads "Video booth"**: migration `20271357924837_a_video_booth_chip.sql` changes `label_en` on that one row only. `option_key` stays 'Patiktok' so couples' stored answers still match. The code fallback says the same.
