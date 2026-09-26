## 2026-09-26 · fix(home): on a wide card, The Card starts below the tags too

Owner's desktop screenshot: "You organise this" still printed over "Together with their
families". The chips are a fixed size (~105 px tall incl. offset) at every card width, so a
% top padding cleared them only on narrow cards (#6007). Above 220 px the paper now starts
at `max(10%, 7rem)`; the narrow case keeps 34 % + dropped minor lines.

SPEC IMPACT: None.
