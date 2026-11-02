## 2026-10-19 · fix(hub): the bars stay off the cover for a guest who arrives by a client-side navigation; the end counts only where the cover cannot leave

Owner, 21:45, live cale-ice on his phone just after the unveil: the top bar (✕ SETNAYAN, song) and the bottom bar
(Home · Details · Story · Me) over the cover — "but i also see the top and bottom nav".

- **Cause (measured live, WebKit iPhone 13, signed out, read-only):** a hard load of `/cale-ice` holds both bars off
  (`style[data-cover-menu]="wait"`, before and after the unveil). The same page reached by a CLIENT-SIDE navigation
  (`router.push('/cale-ice')` from `/`) has NO marker at all: React never executes the `dangerouslySetInnerHTML`
  script it inserts, so the `:has()` gate never matched — both bars drawn, the cover pushed 109 px down under the
  in-flow top bar. Exactly the owner's picture. The Veil's hold already had this door (`ensureVeilHold()`); the bars'
  wait did not.
- `cover-scene-menu.tsx` + new `cover-scene-menu-on-client.tsx`: one layout effect (before paint) re-runs the server
  script's own text (`script[data-cover-menu-script]`), or asks the running script to look again
  (`window.__coverMenuCheck`). A cover streamed in after the script looked is caught by one MutationObserver on the body
  (gone once found, or after 10 s).
- The page's end (#6676) now counts only where the page cannot scroll the cover away, and only after the guest's own
  touch / wheel / key / press — never a load, a layout shift or a scroll the page made itself.
- Guards: `the-invitation-is-one-page.test.ts` 9 (new, executed: client-side arrival, already-running re-check,
  late cover, Me, the end needs the guest's move); 8 re-aimed (a touch first); phrase pin in
  `the-cover-scene-is-one-group.test.ts` re-aimed to `atEnd(h)`; script-strip regexes take the new attribute;
  goldens regenerated.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-15 (one page, bars off the cover), 2026-10-16 (bars only once the
cover is fully gone) and Q3 (a tap on the bar never hides it) as already ruled.
