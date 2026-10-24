## 2026-10-24 · fix(hub): pictures open in place with a way back; photos never move by themselves

Owner reports, 24 Oct: *"when i opened the QR Code, there is no way to go back"* · a Love Story photo opened
see-through · the "Not me" / "Take it down" pills covered the photos · the wall's credit read "8:…" · *"there
shouldnt be the auto scrolling photos"*.

- **Gift QR** (`app/_components/pabuya/pabuya-qr-viewer.tsx`, new): tapping a gift method's QR opens the shared viewer
  over the page, with the QR large on a white plate, the method and account name under it, Save QR (`?download=1`)
  and ✕. It was an `<a target="_blank">` to `/api/pabuya/qr/<id>`, a bare PNG with no way back in the app and the PWA.
  The route itself is unchanged.
- **The shared viewer** (`GalleryLightbox`) is now portalled to `document.body`, stands on an opaque ground
  (`.sn-gal-scrim` = `--sn-ob-page`), and closes on the phone's Back as well as ✕, Escape, a tap outside and
  swipe-down (`lib/use-back-closes.ts`, the shape `theme-preview-overlay.tsx` shipped, now shared). It also takes an
  optional caption, a white plate, and ‹ › neighbours with a sideways swipe. Root cause of the see-through Love Story
  viewer: it was `fixed inset-0` inside a moment's size container (layout containment) that also wears a
  transform/opacity entrance, so "the screen" was the moment's box.
- **Love Story / Glimpse** (`glimpse-rail.tsx`): no drift, no loop copies, no resume timer; the rail moves only on a
  swipe, a tap or ‹ ›. The viewer shows the moment's title under the photo.
- **Photos of you**: "Not me" and "Take it down" moved off the tile into the viewer (still labelled, still 44 px).
- **Live Photo Wall**: the tile credit is stacked (name, then time) and never clipped. "Open full size to save"
  (a new tab on the raw presigned URL) is now a Save button in the viewer, in both this and Photos of you.
- **Your shots**: the tile opens the viewer; Save fetches the same full-size EXIF-stripped route.

Guards: `lib/a-photo-viewer-is-a-real-screen.test.ts` (portal, Back, opaque ground; no `target="_blank"` to the QR
route anywhere on the Hub or on its picture surfaces) and `lib/photos-never-move-by-themselves.test.ts` (no timers,
frame loops or scroll nudges in the Hub's photo components). No flag gates: ships on for every Event Hub.

SPEC IMPACT: Reverses DECISION_LOG "GLIMPSE'S MOTION IS A SLOW CONTINUOUS DRIFT, NOT A STEP" (2026-10-15) per the
owner's 24 Oct ruling. Needs a DECISION_LOG row in the corpus.
