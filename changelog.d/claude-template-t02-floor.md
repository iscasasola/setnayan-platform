## 2026-11-14 · style(supplier-shop): T02 follow-up — every button at 44, every word at 12 or larger

Follow-up to #7641 (batch T02), from the controller's W1 walk of `/vendor-dashboard/shop` at 390 and 1280. Only T02's
files that no open PR edits; shared `ActionButton` and tokens only; no new colour, motion, server action or migration.

- **Buttons at the 44 floor:** every `ActionButton` in the T02 files draws at 44 (`!h-11`, icon-only also `!w-11`) —
  the shared button draws 40 and presses 46, an open owner call on the sheet ("44 or 40?"), so the component itself is
  untouched. `editable-row`'s "Manage / Add" text link is the shared button. The Forms Maker's drag handle is 44 wide.
  The offer editor's segmented picks are 44 inside their box; its two gift fields are 44; its amount boxes are 48 (the
  sheet's typed box). The growth-tip link, "Retry" and "Shop wallet" press at 44. The growth card's door is 44 (was 40,
  `analytics-growing.css`).
- **Words at 12 or larger:** the `.sn-eye` section labels (10.5 px, gold) on Offers, Analytics, Badges, Bundles, Makers,
  Services and the offer editor are the template's section label (12 px, slate, bold capitals); 11.5 px captions →
  `text-xs`; the offer editor's question hints (10.4 px) → 12; every font size under 12 in `analytics-growing.css` → 12.
- **Measured in the browser** (Playwright on the dev labs, 390 and 1280): the offers list, the offer editor, the
  analytics carousel and the forms pages now have **0** controls under 44 and **0** words under 12. What the shop tab
  still shows under the floor is drawn by files outside this batch — listed in the PR.

SPEC IMPACT: None — applies the approved template's floors.
