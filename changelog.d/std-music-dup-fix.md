## 2026-06-22 · fix(std): kill the iOS "video + background music at once" overlap on the Save-the-Date veil lift

The Save-the-Date content film (`apps/web/app/[slug]/_components/save-the-date-film.tsx`) kept the couple's keepsake clip playing **warm** before its beat — unmuted at `volume = 0`, looping, invisible — so its audio could ramp in via the crossfade on the beat without a fresh (iOS-blocked) `play()`/unmute. That warm-play silencing assumed `volume = 0` actually silences the clip.

It does on desktop/Android. But **iOS Safari treats `HTMLMediaElement.volume` as read-only** (system volume is the only control): the write is ignored and the getter keeps returning 1. So on iPhone the warm, invisible clip played at **full volume under the soundtrack** from the moment the veil lifted — the reported "once the veil goes up, both the video and background music play at the same time" on `setnayan.com/cale-ice`. The music-side ducking was unaffected because it silences by `pause()` (honored on iOS), not by volume; only the warm clip's volume-0 silencing was broken. Regression dates to the warm-play feature (commit `52ec8ef5`, 2026-06-21) — hence "not an issue before."

**Fix (iOS-gated; desktop/Android path unchanged):**

- New module helper `silenceWarmClip(v)` — sets `volume = 0`, reads it back; if the write didn't stick (iOS), falls back to `muted = true` (the only silence iOS honors). Returns whether the clip's volume is **controllable**, recorded in a new `videoVolCtlRef`.
- Both warm-play sites (the first-touch unlock effect + the off-beat re-warm) now route through `silenceWarmClip`, so the warm clip is **never audible** while invisible, on any platform.
- The video beat reads `videoVolCtlRef`: where volume is controllable it runs the existing smooth crossfade unchanged; where it is **not** (iOS) it plays the clip **muted**, keeps the soundtrack as the beat's audio (no dead air), and surfaces the existing **"Tap for sound"** control (a tap CAN unmute + duck via `enableVideoSound`). This restores the pre-warm-play iOS fallback that warm-play had silently defeated (the already-playing clip never rejected `play()`, so the catch-based fallback stopped firing).

Net: no platform ever plays the clip's audio and the soundtrack simultaneously. Desktop/Android keep the auto-crossfade; iOS gets muted clip + soundtrack + one-tap sound.

No schema changes. No SKU changes. Client-only logic in one component.

SPEC IMPACT: `0024_save_the_date/` — content-film audio behavior clarified: the keepsake clip's audio auto-crossfades only where the browser allows programmatic volume control (desktop/Android); iOS falls back to a muted clip under the soundtrack with a one-tap "Tap for sound". (Reference/history only — code is canonical per the 2026-06-07 ground-truth flip.)

---

## 2026-06-22 · perf(std): serve a screen-sized Save-the-Date background, not the full-res upload

Same `/cale-ice` report — the **background image loads slowly**. Root cause: the Step-1 "upload" background is the couple's ORIGINAL photo straight from R2 (cale-ice's is a **4.2 MB / 4460×2509** Nikon JPEG), drawn full-bleed behind the film via a low-priority CSS `background-image`. The browser streamed all ~4 MB to display it at ~400–1200 px wide on a phone.

`next/image` is not an option here: the codebase deliberately uses raw elements for presigned R2 URLs (the optimizer caches on the URL, and our presigned URLs rotate every render — see `app/[slug]/page.tsx` "raw <img> because the URLs are presigned"). Also the SDK serves virtual-hosted hosts (`<bucket>.<acct>.r2.cloudflarestorage.com`) that aren't in `next.config` `remotePatterns`.

**Fix:** new server-only `lib/std-bg-image.ts` → `displayUrlForStdBackground()`. It DERIVES a screen-sized WebP (1600 px wide, q72, EXIF-rotated) ONCE and caches it back in R2 next to the original (key suffix `__stdbg-w1600.webp`, `Cache-Control: immutable`), then presigns + serves that. Generation is lazy + idempotent (first view pays a one-time GET→resize→PUT; later views/guests just HEAD the cached variant) and **fails open to the original** on any error (R2 down in dev/preview, un-decodable source) so the background never breaks. `app/[slug]/page.tsx` calls it for the `upload` kind instead of `displayUrlForStoredAsset`. ~4 MB → a few hundred KB, identical full-bleed look. Cost-optimal vs. next/image (no per-render transform; one derived object per event, R2 egress free).

`realistic` backgrounds (local pre-optimized `/std/backgrounds/*.webp`) and `plain`/`paper` are unaffected. The builder preview still uses the original (single-user editing surface). Uses `sharp` (already a `serverExternalPackages` dep) + `transformToByteArray` (established in `lib/drive-upload.ts`).

No schema changes. No SKU changes.

SPEC IMPACT: `0024_save_the_date/` — Step-1 upload backgrounds are now served as a cached, screen-sized WebP variant rather than the raw original. (Reference/history only.)
