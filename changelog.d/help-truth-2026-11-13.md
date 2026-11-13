## 2026-11-13 · fix(help): public Help says only what is live today

Every article in `apps/web/lib/help.ts` was fact-checked against `origin/main`; 30 were rewritten and 3 added.

- **Plans:** couples see Free · Event Plus · Event Pro. "Event Hub Pro" / "Event Hub PRO" is gone from Help; Setnayan AI is described as coming inside Event Plus and Event Pro (not sold on its own since 2026-11-04). Supplier plan names are not printed (the upcoming rename is not live). No price or credit number is typed.
- **Places:** the account bar is Home · Discover (Events, People, Memories, Shop are Home's sections); the event bar is Today · Guests · Suppliers · Memories · Hub; Studio is gone — Papic is the card in Memories (Add more), Live Watch opens from the Live stream card on Today (Open controller), Budget is on Today; Appearance is in the account menu; New QR is on the guest's ticket; Guests settings (⚙) holds the one join link.
- **Corrected facts:** ceremony/venue lists, Tagalog (feature pages only), Music Maker (no claim about how the song is made), support form (no routing or 24-hour promise), Papic gallery (search, not filters; no Drive claim), guest selfie (asked on the day, not at RSVP), no per-camera guest top-up, per-guest credit cap named.
- **New articles:** `event-plus-and-event-pro`, `help-me-choose-a-date`, `your-ticket`.
- **Guard:** `help-tips-and-tours-name-what-ships.test.ts` names Event Hub Pro as removed (Help strings only — tours and ⓘ still say it and are another build's) and its own stale line is fixed.

SPEC IMPACT: None.
