## 2026-08-29 · fix(papic): the eight the first sweep could not see

A live re-measurement after PR #5000 shipped found `/pricing` still saying
*shots* five times. Not a missed pass — **a blind spot in the tool I used**, and
worth writing down because it will recur.

The rewriter only edited text **inside quoted strings**. Two kinds of copy are
invisible to that:

1. **JSX text nodes**, which are not in quotes at all — *"Papic is one pot of
   shots for the whole celebration"* sat in plain markup.
2. **Strings whose apostrophe clashes with the quote character**. My literal
   pattern excluded `'` from a literal's body, so a backtick string containing
   `every guest's phone` could never match.

🔑 **A sweep is only as wide as the shape it can see.** Both misses were in the
most-read pricing copy on the site, and both looked identical to "done" from the
inside — the file changed, the tests passed, the word stayed.

Eight strings fixed across the pricing page, the estimator, the onboarding shell,
the ready-nudge, the cameras card, the event dashboard and help.

⛔ **And three that look identical were deliberately LEFT**, because they mean a
photograph: *"keep your shots free of objectionable content"*, *"other guests at
the same event can see your shots"*, *"if you would rather your shots went only
to…"*. Same word, same shape, different noun.

The re-scan that found these reads the whole file body rather than only its
string literals, so JSX text is covered next time.

11,418 unit · typecheck exit 0.

SPEC IMPACT: None beyond the rename already recorded.
