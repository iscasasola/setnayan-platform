## 2026-11-14 · feat(template): T05 — supplier pages onto the design template

Batch T05 of `design_template_audit_2026-11-14.md`, judged against the owner-approved
`design_template_sheet_2026-11-14_fable.html`. Every fact, control and link is kept; same server actions, no
data change.

- **Customers › QR codes (`/vendor-dashboard/invite`)** — the 28 px visible title is screen-reader only (the
  pinned row names the page) and its explanation sits behind the ⓘ beside the one line under it; a refused read
  says so in amber ("not the same as none"), an empty Issued list is one plain line. The Booked QR deal form is
  plain sections divided by hairlines instead of six cards; Event and Contract are `PickMenu`s (the event still
  posts as `event_type`); "Generate Locked QR" is the one terracotta main; date-status chips use the state
  tokens; the "complete every field" paragraph moves behind an ⓘ.
- **Shop › Page (`/vendor-dashboard/website`)** — the web-addresses refusal is the amber couldn't-read line;
  "Use your own web address" is a plain section (no card, no shadow) with its how-to behind an ⓘ, domain rows
  are hairline rows, Verify / Add domain are `ActionButton`s (no spinner; "Checking…" / "Adding…"), hex
  fallbacks become tokens. Reviews: refused reads amber, empty one line, Post reply / Submit flag are
  `ActionButton` looks, typewriter labels become the template's bold capitals, axis tiles lose their boxes.
- **Shop › Promote** — Share your work: kicker in bold grey capitals, the grey caption under the title goes
  (it is in the ⓘ), refusals amber, empty one line with its ⓘ.
- **Today, Collections, the video-links editor, body panel, Instagram, push toggle** — words at ink ≤ 60 % and
  9–11 px captions become the template's dark grey at ≥ 12 px; raw palette colours (`red-600`, `amber-*`,
  `emerald-*`) become state tokens; the Instagram block loses its card and its paragraph goes behind an ⓘ;
  hand-made buttons become `ActionButton`s (push Enable/Disable, Sync now, Disconnect, Add another video,
  gallery Save).
- **Open shop parts** — mid-grey words under 13 px move to dark grey (`--m-slate-2`); the address box's `#fff`
  becomes `--color-raised`.

SPEC IMPACT: None — implements the approved design template; no decision changed.
