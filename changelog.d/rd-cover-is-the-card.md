## 2026-09-26 · fix(home): every event's cover is The Card on Classic unless it has a hero photo

Owner, on the live Planning cards (both events showed the same terracotta stamp):
*"why is the hero cover same? and is it using the template provided on the event hub?
our default is the classic remember?"* `posterFor` chose the 09-24 `deep` / `moon`
sheets whenever the event had a colour (`events.monogram_color`), so every coloured
event got the same stamp and none matched the hero the Event Hub draws. Now: a wake →
`quiet` · a hero photo → `photo` · everything else → `invitation` (The Card), with the
couple's colour still carried to tint the mark. Test replaced: a colour never changes the
layout (sabotage: re-adding the moon branch → 1 fail).

SPEC IMPACT: DECISION_LOG 2026-09-26 row (cover follows the hero; default Classic).
