## 2026-08-09 · fix(open-shop): you can see the logo you just uploaded, and the event chips line up

Two findings from the owner reading step 1 of Open your shop on a phone.

**1 · The uploaded logo was invisible.** On a single-image `square` field the dropzone vanishes at capacity, and all the vendor got back was a 48px thumbnail in a filename row. They had just chosen a picture and could not actually SEE it — which is the one thing that confirms the right file went up, and the logo is the asset couples see on every vendor card. The upload now fills the field it replaced, at the size the dropzone was, with the Remove control under it.

Scoped deliberately to `!multiple && variant === 'square' && isImage && displayUrl`. Every clause is load-bearing: a gallery needs a scannable list rather than N hero images; `wide` is the evidence lane where filenames are the point; a PDF has nothing to show and **audio already gets a real player in the row that a big preview would hide**; and without a resolved `displayUrl` an `<img>` renders a broken-image glyph — worse than the thumbnail it replaced.

🪤 **In-flight rows still render.** `isSingleImagePreview` needs a COMPLETED item, so it is false for the entire time a file is uploading — guarding the whole list block on it would have blanked the field mid-upload, replacing a progress spinner with nothing. The list renders on `inFlight.length > 0 || (items.length > 0 && !isSingleImagePreview)`, and the completed-items map is skipped only when the big preview owns the item, so a replacement never shows the picture and its filename row at once.

**2 · "Events you serve" was a ragged wrap.** Sixteen `flex flex-wrap` pills packed a different number of differently-sized chips per row — *Celebration · Travel · Corporate* on one line, *Wedding · Debut* on the next. Nothing lined up and the set read as noise. Owner: *"events you serve can be legibly balanced. or a checklist? that auto adapts how many columns to show."*

Now a `repeat(auto-fit, minmax(9.5rem, 1fr))` grid — the browser fits as many equal columns as the width allows (2 on a narrow phone, 3–4 on a wide one), every cell the same size, every row aligned. No breakpoint list to maintain and it cannot go ragged. `truncate` on the label stops a long name widening its whole column.

SPEC IMPACT: None — layout only. No field, validation or stored value changed.
