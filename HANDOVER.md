# HANDOVER — rd/preview-as-a-role (See as · Role ▾)

Owner 17 Oct: "i want to see how the palette changes depending on the guest?" / "view it as a father of the bride".

State: built, guard green locally (6/6, sabotaged 5 ways), real-page render walked (WebKit iPhone 13, 375) —
shots in ~/Documents/Claude/Projects/shots-2026-10-17/preview-role/. Draft PR, do-not-auto-merge.

Maker-lab walk 12/12 done. Left: CI green. PR body lives in ~/Documents/Claude/Projects/preview-role-pr-body.md (NOT the shared scratchpad — another builder overwrote scratchpad/pr-body.md once).

Decisions made here (no record covered them):
- Role ▾ shows only while See as draws a guest (pending / replied / declined); "Any guest" = the sample as before.
- Roles whose word does not say who get two rows (· man / · woman); parents/grandparents read "Father/Mother of…".
- A role preview never loads the preview person (⚖ 2026-09-14 generic guest); named "A father of the bride".
- Exit preview resets Role to Any guest (as it resets See as to You).
- The launch page's coordinator controller (HubStage View as) is NOT extended — its guest door opens the host's own
  page, and the couple's View as is the Maker's See as now (launch/page.tsx: "its View as is now the toolbar's switch").

Touches hideable-widget-render.tsx (dress_code case) — NOT dress-code-widget.tsx / attire-rows.ts.
