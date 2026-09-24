/**
 * Loading boundary — the press has to commit NOW, not when the payload lands.
 *
 * 🔴 WITHOUT THIS FILE THE ROUTE PREFETCHES AN EMPTY TREE. The numbers are
 * this repo's own, from `(shell)/explore/loading.tsx`: force-static prefetched
 * 72,197 bytes (instant); dynamic with no boundary prefetched 162 bytes —
 * nothing; dynamic WITH one prefetched 58,473 bytes. With no boundary the
 * router has nothing to show, so it holds the OLD page — URL unchanged, no
 * spinner, no paint — until the whole server payload arrives.
 *
 * 📐 NOT INDIVIDUALLY TIMED — this route was not one of the four clicked during
 * the 2026-09-23 live sweep (`/dashboard` 1445ms · `/budget` 559ms ·
 * `/marketplace` 431ms · `/guest-list` 380ms). It is in the same group, is
 * reached from the same rail and shipped without a boundary for the same
 * reason, so it is fixed with them rather than left as the odd one out.
 * If you want its number, time the click before trusting a figure here.
 *
 * 🔑 IT RENDERS NOTHING ON PURPOSE. This route wears the shared shell, and the
 * shell — rail, top bar — is already on screen and does NOT re-render for this
 * boundary. A skeleton here would paint a second set of furniture inside the
 * first, which is the jump this boundary exists to remove, one frame long.
 *
 * ⚠ A `loading.tsx` FORCES STREAMING, which commits the HTTP status before the
 * page body runs — that is how `/v/[slug]` shipped a soft-404 (HTTP 200 on a
 * shop that does not exist). Checked rather than assumed before this file was
 * added: `page.tsx` on this route contains ZERO calls to `notFound()`.
 */
export default function SamahanLoading() {{
  return null;
}}
