## 2026-10-01 · fix(maker): "Upload media" behind every scene opens the pictures again

The owner pressed Maker › 🎨 › Behind every scene › **Upload media** on his own event and nothing happened. The panel read the stored choice ("None — just the colour" / the theme's own) before the couple's press, so the photo tiles and the upload never drew — and with no hero photo ("Same as my hero" disabled) there was no way back to a photo at all. The rule is now one pure function, `lib/main-ground-choice.ts` `mainGroundChoice`, where the press wins; `lib/main-ground-choice.test.ts` runs it (red on the old order, green on the fix). Pressing still saves nothing — picking a photo does.

Also: a size tip under the upload — upright photo, 2,000 pixels or more on the long side, faces near the middle, clips up to 15 s — read from the real limits (`lib/image-max-edge.ts` `IMAGE_MAX_EDGE`, now the compressor's own default, and `MAKER_MAX_CLIP_SECONDS`).

SPEC IMPACT: None.
