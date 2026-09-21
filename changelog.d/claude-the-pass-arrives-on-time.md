## 2026-09-21 · fix(invitation): the pass says the right arrival time

Seen live as a test guest on /cale-ice: the pass said "ARRIVE 9:30 PM" for a
1:30 PM arrival. The schedule stores the couple's wall-clock parked in UTC and
the programme reads it with `timeZone: 'UTC'`; the pass converted it to
Asia/Manila, adding eight hours a second time. It now uses the programme's own
formatter (`formatBlockTimeRange`). The pass guard had REQUIRED the Manila
conversion — it now forbids it and checks a real stored value reads 1:30 PM.

SPEC IMPACT: None.
