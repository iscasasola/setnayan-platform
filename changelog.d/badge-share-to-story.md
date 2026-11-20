## 2026-11-21 · feat(supplier-badges): an earned badge shares to story from Shop › Badges

Owner, 21 Nov: *"i thought we also have share icons for the different badges you achieved."* The award kit's
"↗ Share to story" and its 10-second `StoryVideo` were built and approved, but only `app/dev/award-lab` passed
`onShare`. The live Shop › Badges row opened an earned badge with no share button.

- `shop-badge-row.tsx`: the EARNED tiered badge's `BadgeFullscreen` now passes `onShare`. It works the same way as
  the award lab: it mounts the lazy `StoryVideo` with the tier's tone, "Tier · Badge" and "Awarded on …". A locked
  badge still rises as the locked look and never shares. Setnayan Verified keeps its own `VerifiedFullscreen`
  with no share button, because the approved v84 drawing gives `.vfz` none.
- New `app/_components/award/picture-story-svg.ts`: the v84 badges are `.webp` pictures. The kit's `serializeArt`
  reads only `<svg>`, so it would have handed the story an empty string. An SVG decoded as an image cannot load an
  outside file either (measured in Chromium: the file URL draws the broken-image icon). The helper paints the
  picture on a canvas on the device and carries it inside the SVG as a data URL. There is no fetch, so award-kit
  rule 8 still holds.
- Guard: `app/vendor-dashboard/shop/an-earned-badge-shares-to-story.test.ts`. Three sabotages were each seen red
  and then restored.

Your gifts and Today were checked. Neither opens a badge or seal full screen for the shop's own badges: Today's
earned line links "See it" to Shop › Badges, and the card-badge congratulations is a different screen with no
share in its drawing. So nothing else needed wiring.

SPEC IMPACT: None. This wires an approved, already-built control. No new ruling.
