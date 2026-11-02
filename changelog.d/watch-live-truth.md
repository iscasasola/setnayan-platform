## 2026-08-05 · fix(guest-site): the livestream stops implying a stream is running

**SPEC IMPACT:** None (copy). The real fix is scoped below and NOT built here.

The block renders a pulsing red dot and the words **WATCH LIVE** because the
couple SAVED A LINK and the event is inside its day-of window — which since the
timezone fix is **noon the day before to noon the day after**. The broadcast
itself might be three hours of that 48.

So the relative in Dubai who opens the page at 8 AM gets a live badge over a
player reading *"video unavailable"*, with no way to tell a stream that has not
started from one that broke.

Added one true sentence under the player, before they need it: *"If the ceremony
hasn't started, the player above will say the video is unavailable. Nothing is
wrong — check back a little later."*

⏭ **The real fix is a host switch** — the couple or their coordinator flipping
the broadcast on, the same shape as the host's Papic switch (owner-ruled
2026-08-03: *"the papic service will always run but the host of the event has
the power to allow use and not allow use"*). It needs a column and a control,
and it is the next slice in `EVENT_WEBSITE_BUILD_PLAN_2026-08-05.md`.

**Detecting it from YouTube is not an option** — the Google Cloud account is
suspended (appeal `73857927`), so there is no API to ask.
