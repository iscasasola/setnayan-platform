## 2026-09-29 · feat(patiktok): free to use, pay to save and share

Owner, verbatim: *"can we finish tiktok later or hide it."* → *"yes use for free.
but pay to save and share"*. An audit found Patiktok sold as `PATIKTOK_COMPILER`
while no server entry point checked payment — an unpaid couple could store and
download reels.

- **Free:** the booth, recording clips (`recordPatiktokClip`, clip uploads),
  queuing (`submitPatiktokRender`) and rendering + watching the reel. An unpaid
  render carries a light "PREVIEW · SETNAYAN" mark on every frame
  (`RenderTemplate.watermark` in `lib/reel-render.ts`) and is never uploaded;
  its job stays `queued` — the reel waiting in "Your renders".
- **Paid, checked on the server** (`lib/patiktok-save-gate.ts` →
  `eventSkuActive`): reel upload (`/api/patiktok/upload` kind=reel → 402),
  `finalizePatiktokRenderJob` (store + download link + "reel ready" email),
  download links on the Patiktok page, reels on the public recap
  (`lib/auto-recap.ts`), TikTok connect (`/api/tiktok/auth/start` + callback)
  and `publishPatiktokCompilation`.
- The unpaid preview's "Save & share" opens the shipped `InlineCheckoutDrawer`
  in place; marked ◆ PRO, never a padlock; absent in the app-store shell.
- Audit bugs: the booth's primary/backup pick now saves (gallery honours
  `?role=&other=`, swap saves; per-event cookie — no column exists), and the
  false "We email a print-ready PDF" / printed booth QR promises are gone.
- Guard: `apps/web/lib/patiktok-pay-to-save.test.ts` — rule table + closed-set
  sweep of every Patiktok action and API route; 19 sabotages, all caught.

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — new 2026-09-29 row "PATIKTOK: FREE TO
USE, PAY TO SAVE AND SHARE" (applied directly).
