## 2026-11-14 · feat(events): the December 19 event-date rule is off for everyone

Owner, 14 Nov: *"just remove that rule for everyone"* · *"so we don't stress on it"*. Any account can now date an
event on any day; date pickers start today. The rule (owner 2026-11-01: no event before 19 Dec, the founders'
wedding first) is turned off by one switch, `EVENT_DATE_FLOOR_ON = false` in `lib/event-date-floor.ts`. Every door
still asks it, so turning it back on is one line. The onboarding calendar no longer says the floor sentence.
Not changed: guest import still opens on 19 Dec (a separate rule, owner 2026-11-02).

SPEC IMPACT: DECISION_LOG.md — new row "THE DECEMBER 19 EVENT-DATE RULE IS OFF FOR EVERYONE" (supersedes the
2026-11-01 floor for event dates; the guest-import day is unchanged).
