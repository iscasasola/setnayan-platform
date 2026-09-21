## 2026-09-21 · fix(people): a name search matches its words in any order

"Casasola Ice" now finds "Ice Casasola". The People find-by-name box
(`searchPeopleByName`) matched the whole typed string as one substring, so a
surname-first search — the way many Filipinos write names — found nobody. The
query is now split into words (spaces and commas; up to five; repeats
collapsed) by the pure `nameSearchTerms`, and each word gets its own escaped
ILIKE on `display_name`, ANDed, so every word must appear, in any order. The
enumeration guard is kept: a search needs at least one word of two or more
characters ("a b" searches nothing; "Casasola I" is kept, since the initial only
narrows). Tests in `lib/people-search.test.ts`, including a source check that
the reader filters per term; both sabotages (whole-string ILIKE, no split) turn
them red.

SPEC IMPACT: None
