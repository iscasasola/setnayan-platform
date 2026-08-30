## 2026-08-31 · rename(setnayan-ai): the assistant nickname "Suri" is now "Sai"

Owner decision: the five-pillar Filipino brand-name system (Ala Ala · Likha ·
Plano · Suri · Tiangge) is being retired in favor of plain functional names
(Memories · Studio · 3D Plan · Marketplace · …). Setnayan AI's informal
nickname "Suri" (Tagalog for "to analyze closely") is renamed to **Sai**
(from "Setnayan AI"), matching the plainer naming direction and clearing an
unrelated but real concern: "Suri" read one letter off from "Siri."

Renamed every genuine user-facing occurrence plus the internal identifiers
that back it, across 15 files:
- `lib/setnayan-ai-free-assist.ts` / `.test.ts` — `isSuriAssistFree*` →
  `isSaiAssistFree*`, `SURI_FREE_ASSIST_*` → `SAI_FREE_ASSIST_*`, and every
  copy string ("Let Suri find…" → "Let Sai find…", etc.)
- The couple Home's "Suri briefing" / "Suri on watch" surfaces
  (`event-dashboard.tsx`, `overview-inspector-body.tsx`, `page.tsx`)
- The internal-only `?suri=preview` override param → `?sai=preview`
  (`page.tsx`, `progress/page.tsx`)
- The Merkado guard banner, the free-venue-shortlist offer, and the admin
  background-videos pillar-icon caption

Explicitly NOT touched: `Surigao` (a real Philippine province/city name that
happens to contain the substring "suri") in `lib/regions.ts` and the
onboarding place-data files — verified untouched. Also did not rename the
other four pillar words (Ala Ala / Likha / Plano / Tiangge); that's a
separate, larger rename the owner referenced as already in progress
elsewhere and is out of scope here.

SPEC IMPACT: Yes — logged in `DECISION_LOG.md` (2026-08-31 entry) since this
reverses part of the 2026-06-30 five-pillar naming decision for the "Suri"
pillar specifically.
