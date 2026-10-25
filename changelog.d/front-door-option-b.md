## 2026-10-25 · feat(frontdoor): signed-out hero is Option B, told truthfully

Owner approved Option B of `prototypes/ceremo_deltas_2026-10-25/01_front_door.html` with an honesty fix
("don't they pay for papic?" · "unlimited camera but papic credits is used" · "free 50 credits is only on
their first event" · "DO NOT INVENT … we want to tell the truth").

- Headline: "Plan any event free. Every photo in one album." (no "never lose a photo" / "Keep every photo";
  home `<title>` and description follow).
- Sub-line keeps the "Setnayan is …" purpose sentence Google's OAuth review needs, plus the Taglish pain line.
- Trust chips: Free to start · No guest limit · No credit card · Guests don't sign in; one line under them:
  "Unlimited cameras · photos use Papic credits." (no amounts).
- Before → After strip (scattered photos → one album), drawn tiles with no invented counts.
- Main button is terracotta (`.fd-btn-terra` on `--m-mulberry`), not the gold — owner: "for setnayan use our template".
- "Start your event — free" now reaches the create-event type picker (`/signup?next=/dashboard/create-event`)
  instead of `/onboarding/wedding` alone. "How it works" unchanged (/our-story).
- Guard: `app/_components/frontdoor/the-front-door-tells-the-truth.test.ts` (seen failing against origin/main, 5/5).
- `lib/ugat/screens.generated.json` regenerated (the button's door moved from /onboarding/wedding to /signup).

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 (front door Option B + honesty fix + terracotta main button + type-aware door).
