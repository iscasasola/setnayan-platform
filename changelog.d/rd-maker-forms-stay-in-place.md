## 2026-09-29 · perf(maker): a form saved from the Maker is shown in place — the Maker is never remounted by a save

Follow-up to #6116 (DECISION_LOG 2026-09-29 "THE MAKER MUST NEVER FEEL SLOW"). Measured on
#6116: a Maker form's server action that ends `redirect(return_to)` remounts the WHOLE Maker,
twice, even when `lib/maker-stay.ts` points the redirect at the address the couple is already on.
When that happens the canvas and every stage preloaded behind it come back blank. An action that
revalidates the page and RETURNS does not remount; its response carries the fresh render.

New `lib/maker-land.server.ts` · `landAfterWrite(formData, fallback, suffix)`:
- From the Maker (`maker_stay=1` and a `/launch` `return_to`), it revalidates that one page and
  returns.
- Anywhere else, it redirects exactly as before.

Every Maker write now lands through it:
- the draft doors (`finishDraftSave`, `saveWidgetToDraft`, `saveCanvasToDraft`,
  `draftEventsAndReturn`, `draftBackdrop`, `draftHero`), which cover Shown, an own scene's
  template / slot / clip / layout, motion, background and crop;
- the tails of the panel actions (colours, site chrome, story, photos, dress code, special
  message, what to bring, hero photo, privacy, RSVP backdrop, open browsing);
- removing a scene.

Error and no-op early exits still redirect.

⚠ `redirect` never returns and this helper does, so a draft save could now run on into the LIVE
write. Every call was changed to `return f(…)`. The new `lib/a-maker-save-lands-in-place.test.ts`
(TypeScript AST) finds the landing functions itself, across files, and fails on any call that is
not returned. It caught three that were only safe by position. Five older guards pinned the
`await …; // never` shape; each now pins the returned door instead.

SPEC IMPACT: None.

**Rebased onto #6116 + main (2026-09-29).** The new guard caught three draft doors that main had
added since, each `await`ed and so able to run on into the live write:
- site-chrome's music and hero-video draft;
- our-photos' gallery draft;
- an own scene's first words.

All three are now `return`ed.
