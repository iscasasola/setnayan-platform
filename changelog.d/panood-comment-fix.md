## 2026-06-26 · docs(panood): correct stale "future PAID multi-camera tier" comments — control room is BUILT

Three internal code comments still described the Panood multi-camera control
room as a *future* PAID tier. The control room shipped (route at
`apps/web/app/dashboard/[eventId]/studio/panood/broadcast/` — `page.tsx` +
`control-room.tsx`) and the free-single-cam + paid-multicam packaging was
finalized 2026-06-26 (see `Panood_Multicam_Architecture_2026-06-26.md`
§ "Packaging LOCKED"), so the "future" framing now reads as factually wrong.

Comment wording only — **no runtime logic changed**. The PANOOD_SYSTEM gate
behavior (single-cam go-live + the public live embed stay FREE / ungated) is
untouched; only the prose now points at the shipped `./broadcast` upgrade.

- **`app/dashboard/[eventId]/studio/panood/setup/actions.ts`** — header doc
  comment + `goLivePanood` inline comment: "reserved for the future paid
  multi-camera tier" → "gates the PAID multi-camera control-room upgrade
  (built at ./broadcast)".
- **`app/[slug]/page.tsx`** — public live-embed comment: same correction,
  pointing at `studio/panood/broadcast`.

SPEC IMPACT: None.
