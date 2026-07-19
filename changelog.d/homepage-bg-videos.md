## 2026-06-30 · feat(homepage): admin uploader for the 6 homepage background videos

Adds an admin surface to upload the homepage's six background videos and wires
them into the live ELN-reskin homepage (`HomeReskin`):

- **`/admin/background-videos`** — one card per slot. Slot 0 = the **main**
  cinematic hero backdrop; slots 1–5 = the five **pillar "icon" videos** in the
  bottom dock (Ala Ala · Likha · Plano · Suri · Tiangge). Upload a plain
  looping clip (MP4/WebM/MOV) → it lands as a draft → Publish to make it live.
  Reuses the existing presigned-PUT R2 upload (`/api/upload`, media bucket) —
  no in-browser frame extraction (this is a plain loop, not the scroll-scrub).
- **Schema:** `homepage_background_videos` (six rows, slot 0–5; read-all RLS,
  admin-only writes via the service-role client — same posture as
  `homepage_hero_config` / `platform_settings`). Migration
  `20270328031951_homepage_background_videos.sql`.
- **Read path:** `lib/background-videos.ts` resolves each clip's R2 key to a
  browser-loadable URL per render (presigned today, clean public URL once
  `R2_PUBLIC_URL` is a bucket-bound public host) — mirrors `lib/hero-video.ts`.
- **Homepage wiring:** `HomeReskin` plays the main clip as the hero backdrop
  (gradient scene layers fade out to reveal it) and each pillar's clip as its
  dock tile; a selected pillar's clip also takes over the hero. Every slot
  degrades gracefully to the existing gradient when its video isn't published.
- Admin sidebar entry added to `nav-registry-defaults.ts`
  (`admin.sidebar.background-videos`, Lucide `Film`).

SPEC IMPACT: New homepage admin capability (background-video CMS) + new table
`homepage_background_videos`. Logged in `DECISION_LOG.md` (2026-06-30). The
five dock slots are labelled per the canonical pillar set
(Ala Ala · Likha · Plano · Suri · Tiangge — `project_setnayan_five_pillar_names`).

## 2026-06-30 · chore(homepage): pillar names reverted to short forms

Owner ("fix the naming accordingly") — the live pillar **display names** are
reverted to the short forms from the canonical positioning copy:
**Likhaan→Likha · Planuhan→Plano · Surian→Suri** (Ala Ala + Tiangge unchanged).
This reverses the 2026-06-29 "-an = place" long-form rename.

- Updated all user-facing strings across the homepage (`pillars.tsx` pillar
  names + section headers + glosses, `HomeReskin.tsx` footer + pricing copy,
  `HomeOverlays.tsx` pricing copy) and the `/admin/background-videos` labels +
  seed (`pillar_key` ala-ala/likha/plano/suri/tiangge). Prod DB rows updated to match.
- **Internal identifiers intentionally kept legacy** (no functional rename):
  widget ids `awLikhaan/awPlanuhan/awSurian`, mock component names, SKU key
  `PANOOD_SYSTEM`. Display text only.

SPEC IMPACT: Canonical pillar names = **Ala Ala · Likha · Plano · Suri ·
Tiangge** (short forms). Updated `project_setnayan_five_pillar_names` memory +
`DECISION_LOG.md` (2026-06-30). Broad corpus propagation (Pricing.md, prototype
HTML, Website_Master_Plan) remains a follow-up sweep.
