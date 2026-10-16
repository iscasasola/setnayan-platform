## 2026-10-16 · fix(veil): behind the veil none of the cover's words show — every line enters after the unveil

Owner, verbatim (DECISION_LOG 2026-10-16 "BEHIND THE VEIL, NONE OF THE COVER'S WORDS SHOW"): *"Yes — behind the veil,
none of the cover's words show. After the unveil, every line enters with the cover's entrance (lines with no Build in
get the cover's default)."* Live on cale-ice the date, the venue and the mark's two hairlines showed through the fabric:
they had no Build in, so nothing held them back.

- **Every cover line is marked** (`data-cover-line`, `pahina-masthead.tsx`, all four designs): eyebrow, mark (with its
  hairlines), names, line, date, time, venue, link, caption, the rule under the names, the day's badge. `own` on a line
  with a Build in of its own. The joiner rides inside the names.
- **While the veil is closed** the hold's own `<style data-veil-hold>` (`lib/hub-veil.ts`) draws every line at
  opacity 0 — place kept, nothing jumps. The ground (photo, clip, scene) stays behind the veil as before, still held.
- **After the unveil** a persistent `<style data-veil-words>` (written beside the hold, never removed) gives every line
  with no Build in the shipped default Build in (Calm — `hub-in-fade`, 1.1 s, the timed ease, 0.12 s apart), in
  reading order (`--cover-at`, numbered by the release before it lets go). A line with its own Build in keeps it. A
  Drift-only line fades in on the same clock without losing its Drift. No veil → no marker → nothing changes;
  reduced motion → no hold → the lines are simply there. The Maker's ▶ preview tab is the same page, so it behaves
  the same; the Maker's canvas mounts no veil.
- **The loading frame in front of a veil** (coordinator, live: the date and hairlines showed before the veil came in)
  keeps the lines' places and draws none (`data-loading-veiled`, ≤ 12 s — the hold's own failsafe), decided by the
  page's own opening rule (`loadingOpensUnderAVeil` + `revealAllowedFor`, the same `cache()`d reads).
- **No SETNAYAN bar over the loading frame's cover** (2026-10-15 "NO TOP BAR, NO BOTTOM BAR OVER IT"): the loading
  screen writes the page's own cover-menu marker and its band is the shell's `data-sticky-top` band, so the ONE rule
  that holds the page's bar off the cover holds this one off too; the column takes the shell's `data-page-column`.
- Lab: `/dev/maker-lab/guest?veil=1` mounts the real `RevealMount` (Sheer veil) over the lab cover.
- Guards: `app/[slug]/_components/the-veil-hides-the-cover-words.test.ts` (marks · hold · default = Calm · loading
  frame) and, rendered, `tests/e2e/the-veil-hides-the-cover-words.spec.ts` (opacity 0 under the hold, entering after
  the release, 1 at the end; reduced motion; no veil).

SPEC IMPACT: implements DECISION_LOG 2026-10-16 "BEHIND THE VEIL, NONE OF THE COVER'S WORDS SHOW" (already recorded).
Builder calls for the owner's sign-off, in the PR: the loading frame in front of a veil draws no cover words; the
loading frame's bar follows the 2026-10-15 no-bar ruling; a Drift-only line fades in by transition.
