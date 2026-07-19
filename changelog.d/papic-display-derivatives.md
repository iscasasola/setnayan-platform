### Papic display-derivative pipeline — cheap, fast galleries (memory-home foundation)

Galleries were presigning the FULL-RES original (or, for clips, the poster) as every grid tile — a 250-tile gallery shipped 250 multi-MB files. This generates compressed derivatives server-side and serves those, which both fixes the cost/speed bug and makes the "memory home" cheap to keep forever.

- **Migration** `20270218000000_papic_display_derivatives.sql` — nullable `display_r2_key` + `thumb_r2_key` on `papic_photos` + `papic_guest_captures` (additive, `IF NOT EXISTS`, no RLS change). NULL = no derivative → readers fall back to the original.
- **`lib/papic-derivatives.ts`** (NEW, `server-only`) — `sharp` generates a display JPEG (long-edge 1280, q80) + thumb (320, q70) for photos; clips reuse the existing poster (no server transcode — Vercel has no ffmpeg). Uploaded to the original's bucket under `derivatives/…`; refs persisted via the admin client. Fully best-effort: never throws, swallows pre-migration `PGRST204`.
- **Generation hook** — fires in the existing capture `after()` screening callbacks (seat `app/papic/actions.ts`, guest `app/api/papic/guest-capture/route.ts`), AFTER the NSFW screen, fire-and-forget. Zero added capture latency.
- **Serve** — `lib/papic-gallery.ts` + the Library hub `photos-albums.ts` now prefer `thumb_r2_key ?? display_r2_key ?? poster/original`. Pre-existing rows (null derivatives) fall back to the original — no breakage.

⚠️ ACTIVATION: the migration must be applied (`supabase db push`) for derivatives to persist; until then the code no-ops gracefully (serves originals). New captures get derivatives going forward; a backfill sweep over null-derivative rows is a natural follow-up.

SPEC IMPACT: 10_Papic_Feature_Specification.md storage section (display tier) — to be documented in the storage-lifecycle spec (North-Star follow-up).
