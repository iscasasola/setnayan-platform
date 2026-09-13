/*
  NOT A 'use client' MODULE, ON PURPOSE. A server component that imports a plain value from a
  'use client' file gets a CLIENT REFERENCE, not the value: React sends a pointer that the browser
  resolves only after downloading that file. In <head> that made React pause, replay the head and
  read the page against the head's tags — hydration error #418 on ~1 in 6 loads (Story step 8,
  2026-09-11). Values a server file needs live in plain modules like this one; the guard is
  lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts.
*/

/**
 * The animation stylesheet — emitted once by the page. All pre-animation
 * states are scoped under .apx-anim (JS-gated); transform/opacity only.
 */
export const APX_CSS = `
.apx-anim [data-reveal]{opacity:0;transform:translateY(12px);transition:opacity .55s cubic-bezier(.22,.8,.3,1),transform .55s cubic-bezier(.22,.8,.3,1);transition-delay:var(--apx-d,0ms)}
.apx-anim [data-reveal].apx-in{opacity:1;transform:none}
.apx-anim [data-reveal] .apx-draw{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .9s cubic-bezier(.22,.8,.3,1) calc(var(--apx-d,0ms) + 200ms)}
.apx-anim [data-reveal].apx-in .apx-draw{stroke-dashoffset:0}
.apx-anim [data-reveal] .apx-bar{transform:scaleY(0);transform-origin:bottom;transform-box:fill-box;transition:transform .5s cubic-bezier(.22,.8,.3,1) calc(var(--apx-d,0ms) + 150ms)}
.apx-anim [data-reveal].apx-in .apx-bar{transform:scaleY(1)}
.apx-anim [data-reveal] .apx-lb{transform:scaleX(0);transform-origin:left;transition:transform .5s cubic-bezier(.22,.8,.3,1) calc(var(--apx-d,0ms) + 200ms)}
.apx-anim [data-reveal].apx-in .apx-lb{transform:scaleX(1)}
`;
