## 2026-06-28 · fix(recap): auto-recap "private photos" stat excludes guest clips

The Auto-Recap `privatePhotos` count summed the seat-side `papic_photos` query
(already filtered to `photo_type='photo'`) with the guest-side
`papic_guest_captures` count, but the guest side omitted the `media_type='photo'`
filter — so guest 5-second clips inflated a stat literally labelled "photos."
Added `.eq('media_type','photo')` to the guest-capture count so both sides are
consistent and the number means photos only. Sibling of #2335 / #2338 (same
photo-driven-reader clip-leak root cause).

SPEC IMPACT: None — corrects a stat to match its existing "photos" contract.
