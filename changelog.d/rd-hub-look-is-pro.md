## 2026-09-24 · feat(event-hub): the page's look is Pro — every look writer asks first

Owner ruling 2026-09-24 ("A"): uploading the couple's own photos, snippets and films to the Event Hub's look is Event Hub Pro — *"Free is the page we write. Pro is changing how it looks."* Their words and facts stay free; guest photos in Papic and the gallery are untouched.

**One decision, one gate.** `lib/hub-look-pro.ts` (pure) classifies each look write as `none · remove · add · change` and answers once: Pro may do anything, a free couple may keep (`none`) or take off (`remove`) a look, never add or change one — the same grandfather custom sections use. `lib/hub-look-gate.ts` (server-only, not `'use server'` — zero new routes) reads Pro with the admin client, as `website/colors/actions.ts` does, and never reads it for a removal.

**Gated now (server + editor):** hero photo upload · living hero · hero video (was explicitly free) · background music (was: grandfathered couples could REPLACE their song) · their own gallery (was: grandfathered couples could keep ADDING) · a section's background photo, crop/zoom and motion (were ungated) · the invitation backdrop (was ungated) · colours/face/art/magic move (was already gated — now also lets a free couple RESET, which it previously refused).

**Second door closed:** the Save-the-Date builder (`saveAllStdContent`) wrote `site_bg_music_r2_key` — the same column the site editor gates — plus the couple's own STD background photo and film, all ungated. It now refuses a new upload with `pro-required`, which the builder shows as a sentence (not "something went wrong"), and its three uploaders are locked for a free couple.

**Free couples keep what they have:** "Remove" on the hero, "Reset how it moves" and "Remove this section's photo" on each section, clearing the backdrop, and taking photos out of the gallery never ask for Pro.

**Guards:** `hub-look-pro.test.ts` executes the decision (free AND owning couple); `hub-look-is-pro.test.ts` scans every `'use server'` file for writes to a look column or canvas look key and asserts, per action, that the gate is called before the first `.update(` (10 gated · 3 exempt with asserted reasons · counts printed); `a-free-section-shows-no-look-controls.test.ts` paints `SectionsPanel` for a free and an owning couple. Sabotage: removing the gate from `setWidgetCrop` turned the guard red naming that action; restored byte-identical.

⚠ Not closed here: the look columns are still host-writable via a direct PostgREST PATCH (`lib/security/events-column-privileges.ts` lists them as legitimately host-written) — closing that needs a migration and is an owner call.

SPEC IMPACT: None — the ruling is already recorded in DECISION_LOG 2026-09-24.
