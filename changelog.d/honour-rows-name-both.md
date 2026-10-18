## 2026-10-19 · fix(dress-code): an honour row is always titled with both names

Owner, on the Studio row that read "Maid of Honor" for a guest list with no matron: *"maid and matron of honor same
row"*. Each honour row now always reads "Maid of Honor & Matron of Honor" and "Best Man & Best Woman" (each half in the
event's own role names) whenever either role is on the guest list — in the Studio, on the guest page's dress code and
on the prints (`honourRowLabel`, lib/attire-rows.ts). Nothing else changes. Guard:
`lib/the-honour-attendants-have-their-own-rows.test.ts`.

SPEC IMPACT: None (follows the 2026-10-19 honour-rows ruling; the controller records the wording call).
