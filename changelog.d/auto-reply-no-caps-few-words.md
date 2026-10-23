## 2026-10-23 · feat(auto-reply): no per-day limit on the assistant, and the fold says it in three lines

Owner, 23 Oct, on the supplier's Your page › Auto-reply fold: *"why do we limit the auto reply? and too
many words. we agreed to place all info that is possible inside (i) and if you add description outside
should be at minimum"*.

- **No limit, shown or enforced.** The "Daily reply cap" (default 30) and "Daily auto-accept cap"
  (default 10) are gone from the fold, the settings parser (`lib/vendor-autoreply/config.ts`), the save
  action, the inbox hook's gate (`inbox-decision.ts` no longer takes a count) and the auto-accept
  predicate (`auto-accept-decision.ts`). Before, a shop that hit either cap was stopped silently.
  **There is no hidden platform ceiling either:** a reply is string substitution over the shop's own rows
  (`phrasings.ts` forbids a model call per reply), so it costs ₱0, and it cannot loop (only a couple's
  message triggers it; the bot posts as the supplier). Couple-side spam is already held upstream by the
  inquiry velocity caps and Turnstile (`lib/inquiry-gate.ts`).
- **Auto-accept still respects the supplier's own limits.** It only opens the chat; it never books. The
  per-date couple ceiling still refuses an accept past it (`enforce_vendor_whitelist_per_date`), and the
  supplier's own "bookings per day" is checked when a booking is made (`vendor_agree_to_lock` →
  `daily_limit_reached`). Both are in the database, for a hand accept and an auto-accept alike.
- **Words.** Three controls — Auto-Reply Assistant, Auto-accept, Match threshold — each a title with
  the house ⓘ (`InfoTip`) and at most one short line. "It answers", "It hands to you", the AI-label
  promise and how the threshold works moved into the ⓘ. The card's outer frame and the inner auto-accept
  box are gone (frames only on what you press); topics are split by hairlines.
- **Save.** No Save buttons. Every control saves on change — the pattern this card's switches already
  shipped with (optimistic, toast). The threshold is a −/+ stepper (44 px) that saves once, a moment
  after the last press.
- Voice rotation now keys on the thread's own reply count instead of the retired per-day count.
- The two columns `vendor_bot_config.daily_reply_cap` / `daily_auto_accept_cap` are **left in place,
  unread** — dropping them is a production migration that buys nothing.
- Guard `lib/vendor-autoreply/no-daily-limit.test.ts` (4 properties; 6 sabotages all red, restored green).

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-23 records the ruling verbatim. Supersedes the build plan's
"daily cap" lines (`Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md` §4/§4A/tier table) — the plan file
itself is not rewritten; the decision row is the record.
