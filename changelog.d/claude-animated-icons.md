## 2026-11-15 · feat(icons): the service icons are the drawn, animated set

Owner, Nov 2026, on the approved service-icons prototype: *"they change color when they are pressed and is selected. then animate to lose the color again"*.

- **16 folders + 77 services** now draw the owner-approved icons in place of stock lucide glyphs. The drawing data is generated from the prototype into `apps/web/lib/service-icon-art.ts`, and `apps/web/lib/service-icon.ts` turns each drawing into an icon component that takes lucide's props. Every `tileIcon()` / `folderIcon()` call site is unchanged: the service picker, the open-shop cards, the shortlist bench and the Explore folder strip.
- **At rest** it is a plain line icon. **On a press** it turns mulberry at once, its short play runs in colour, then the colour fades back. Only transform and opacity animate (`apps/web/app/service-icons.css`). Under "reduce motion" the play is shortened, not skipped, which is the prototype's choice.
- A small player mounted once in the root layout (`app/_components/service-icon-play.tsx`, one delegated listener) adds `.go` to every `svg.si` inside the pressed control, links included. A keyboard Enter/Space press also starts it. It is kept apart from `PressFeel`, which its guard holds to one listener and no timers.
- `taxonomy-icons.ts` keeps its lucide maps as the fallback. The exported maps are still exhaustive and the functions are still total. Four hidden tiles have no drawing yet and stay on lucide: `officiants`, `counseling_seminars`, `livestream`, `everything_else`.
- Explore folder strip: the drawn folder icon now wins over the admin `service_categories.icon_name` override. The override only fills a folder that has no icon in code.
- Not in this change: badges, seals, ribbons (their own design track), menu icons, the fold chevron. The prototype's "Shoes & Footwear" drawing has no app tile yet, so it is not wired.

SPEC IMPACT: The service icons are no longer lucide. That narrows the Explore Replan line "the icons are Lucide" (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-B) for folders and services. The owner approved it on the prototype. It is flagged for the change tracker rather than edited silently.
