## 2026-08-13 · docs(creator): retire the sentence that cost the storyteller feature its entire life

Comment-only. No behaviour change — which is the point: **every defect fixed in
this chain was code faithfully implementing a sentence that had stopped being
true**, and three of those sentences were still in the tree.

- `lib/creator-chapters.ts:4` — *"The locked model: a Chapter EMBEDS the
  creator's finished edit"*. The most expensive line in the subsystem. Read
  literally at four layers it produced a publish gate requiring an external
  video account, three read paths that hid a written story from its own author,
  an admin control that never rendered, a route the middleware ate, and public
  copy telling visitors to "Watch" an essay. **Prod held zero chapters for the
  entire life of the feature as a direct result.** Nobody re-litigated it;
  everybody believed it.
- `lib/creator-chapters.ts:19` — *"a Chapter's whole point is the embed"*.
- `lib/creator-public.ts:13` — *"embed only"* listed as a red line.
- `lib/creator-public.ts:148` — the share gate described as *"chapter published
  + carries an embed"*, while the code 30 lines below already used
  `chapterHasReadableContent`.

🔑 **A stale comment is not documentation debt — it is a live instruction.** It
kept the face-tagging switch shut for seven weeks, it was the stated
justification for the admin thumbnail gate, and here it defined what a chapter
*is* for every reader who arrived after the decision changed. Corrected at the
source rather than annotated around, and each correction names what it used to
say so the next reader can see the change rather than trust it.

SPEC IMPACT: None (the model change was logged 2026-08-12).
