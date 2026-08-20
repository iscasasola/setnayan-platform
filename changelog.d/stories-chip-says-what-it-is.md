## 2026-08-20 · change(frontdoor): the Stories chip says what it is for, not "try another chip"

Verified LIVE the same day the new chip row shipped: pressing **Stories**
rendered *"Nothing under "Stories" yet — try another chip, or clear the
filter."*

That sentence is right for a filter that happens to be bare. It is wrong for
the one chip naming what this product exists to hold — it reads as a filter
that **broke** rather than a shelf waiting to fill, which the front door's own
composition module forbids in as many words ("an empty shelf reads as BROKEN,
not young"). Prod holds **zero** published stories, so this is the state most
people pressing that chip will actually meet, not an edge case.

It now carries the same invitation voice the real-weddings rail below already
uses, and a way onward to the hub.

### 🪤 The guard for it was decoration TWICE, and both mutations reported green

1. It matched the invitation's **text anywhere in the file**. Renaming the
   condition to `chip === 'NEVER'` made the whole invitation **unreachable**
   while leaving every searched string in place. Green.
2. Rewritten to split on the condition — but the **last segment ran to end of
   file**, swallowing the generic fallback and the real-weddings invitation
   below it. Deleting the Stories invitation's own link found somebody else's
   `fd-go` and passed. Green.

Now bounded by **paren balance**: from the branch's `? (` to its matching `)`,
not one character further. **Bound by structure — never by a split, a window,
or a file-level count.** This is the third time in two days that a fixed-width
or unbounded window has made one of my guards decoration.

🛡 Four mutations, each landed and measured, each RED:

| mutation | count | verdict |
|---|---|---|
| Stories branch unreachable, text intact | `chip === 'Stories'` 1 → 0 | RED |
| strip the Stories invitation's link | file `fd-go` 7 → 6 | RED |
| strip every link in the Your people branch | branch `fd-go` **3 → 0** | RED |
| reword the Your people heading | 1 → 0 | RED |

⚠ One sabotage in between **did not land at all** — a Python f-string
SyntaxError meant the file was never written, and the suite then passed against
unmodified source. *An unmeasured mutation proves nothing.* Re-run with the
before/after counts printed.

SPEC IMPACT: None (copy + one guard).
