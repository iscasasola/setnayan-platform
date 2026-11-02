## 2026-07-10 · feat(launcher): real monograms + plain-language status on the "Where to?" hub

Owner feedback on `/dashboard`: "each event should show their monogram + status/date
/ the best information", "the shop needs to show what shop we have", and "make this
page understandable." Three changes to `app/dashboard/(launcher)/page.tsx`:

- **Event cards render the REAL monogram**, not a faint decorative initial. Swapped
  the big `text-6xl` first-letter for the shared `<EventMonogram>` badge (size `lg`),
  so uploaded / bespoke-AI SVG, framed lockups, and lettered designs all show exactly
  as they do in the event chrome and on the public site. Uploaded outranks custom per
  the app-wide `monogram_uploaded_svg ?? monogram_custom_svg` precedence (resolved at
  the call site since `EventMonogram` only reads `monogram_custom_svg`). Removed the
  now-dead `monogramLetter` helper + `deriveMonogram` import.
- **Clearer status/date.** The old two-line combo ("In planning" meta + "Planned"
  caption) was contradictory and "Planned · 161 days" was ambiguous. Now: line 1 is
  WHEN + WHERE (`Dec 18 · Manila`, or "Date to be set" when neither is known); the
  ring line is a plain-language countdown — `161 days to go` / `Tomorrow` /
  `Happening today` / `Celebrated` (finished) / `Just getting started` (no date, no
  progress) — with a muted `{pct}% planned` sublabel that finally explains what the
  ring's number means.
- **Shop card shows the actual shop(s).** "YOUR SPACES" now renders one card per
  vendor profile the user owns or is on the team of, titled by `business_name` with
  its `logo_url` in the chip, instead of a single generic "Your shop" tile with the
  first business buried in the subtitle. Forward-compatible with the paused
  multi-shop marketplace (one card per shop).

No schema, query, or route changes — presentation only, reading fields the launcher
already fetched. Typecheck clean.

SPEC IMPACT: None (UI polish on an existing shipped surface; no locked decision, SKU,
or schema touched).
