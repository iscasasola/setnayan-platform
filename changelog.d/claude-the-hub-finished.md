## 2026-09-21 · feat(invitation): the pass looks like a pass, and the hub moves

Owner: "build all 3 in 1 merge" — the pass's look and the motion ship together;
the third, the bottom tab bar, the owner decided to KEEP ("do not remove the
bottom tab bar"), so nothing is built for it.

**The pass** (canvas "4 · The pass"; owner: "so many text … minimalist"): a wine
band with the couple's names and date, the four facts, a dashed tear line, one
large QR, one line ("Show this at the door. It finds your table too."), the
save/copy keepers and "Find my seat". Gone from the card: the "YOUR INVITATION
QR · For tagging & pickup" heading, the photographer paragraph, the raw URL.

**The motion** (brief `build-sessions/ARRIVAL-S7-motion.md`), on the site's
EXISTING tokens (`--sn-dur-elem`, `--sn-dur-enter`, `--sn-ease-out`, mirrored in
`lib/motion.ts`), keyframes `from`-only and `backwards` (never `both` — a held
transform unpins fixed descendants):
1. arrival — mark, names, date, action, ONCE per invitation per browser (`ArrivalOnce`);
2. sections rise — already shipped (`pahina-motion.tsx`), unchanged;
3. the reply lands — the action's words fade in after a guest answers;
4. sheets rise — everything-else (opt-in `rise` on the shared Sheet; other callers
   byte-identical), the RSVP sheet moved onto the tokens, the camera's first-tap cards;
5. the pass lifts when opened (`#site-pass:target`);
6. "happening now" uses the site's one live pulse `.sn-live-dot`; no new loop.
All off under prefers-reduced-motion. Guard: `lib/the-hub-moves-with-meaning.test.ts`.

SPEC IMPACT: DECISION_LOG.md rows (pass look, motion, keep the tab bar).
