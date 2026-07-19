## 2026-07-16 · feat(admin): downloadable NPC submission documents on the Data Privacy board

Adds an admin-only "NPC submission documents" section to `/admin/data-privacy` — download the full merged packet or any single PDF of the DPO-prepared NPC (National Privacy Commission) filing set.

- `apps/web/assets/npc-docs/*.pdf` — the 14 bundled PDFs (executive dossier + 8-doc compliance pack + 3 companions + merged packet + the internal completeness audit). Added to `outputFileTracingIncludes` so Vercel bundles them (same mechanism as the face/nsfw models + cipher fonts).
- `lib/npc-documents.ts` — the document manifest (key → filename → title → group).
- `app/admin/data-privacy/documents/[doc]/route.ts` — admin-only streaming route (re-checks admin + 404s like the growth export; filename resolved via the manifest allow-list, never from raw input → no path traversal; `Content-Disposition: attachment`).
- `app/admin/data-privacy/page.tsx` — the download section (featured full packet + grouped per-document links).

Internal compliance documents — served admin-only, never public. The set is DPO-prepared drafts pending external counsel review before lodging (the bundled completeness audit flags the set as ~60% filing-ready with the specific gaps).

Gates: tsc 0 · next lint clean.

SPEC IMPACT: None (documents are the corpus NPC submission set; logged in DECISION_LOG 2026-07-16).
