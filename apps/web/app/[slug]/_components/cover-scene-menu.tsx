/**
 * 🖼 THE COVER SCENE TAKES THE WHOLE FIRST SCREEN — NO TOP BAR, NO BOTTOM BAR OVER IT (owner 2026-10-15, DECISION_LOG
 * "THE COVER SCENE TAKES THE WHOLE FIRST SCREEN"; verbatim: "no top or bottom nav." and "after they swipe up to open
 * cover is when the menu should show").
 *
 * This puts ONE `<style data-cover-menu="wait">` in `<head>` before first paint; `globals.css` then holds the page's
 * ONE top bar (`[data-sticky-top]`) and ONE bottom bar / rail (`nav[aria-label="Site sections"]`) off screen while a
 * VISIBLE Cover Scene (`header[data-cover-scene]`) leads the page, and drops the column's top padding so the cover
 * starts at the top edge. The guest's first upward swipe or scroll that moves the page sets it to `"open"` — the bars
 * slide in (reduced motion: they just appear). A page whose cover is not shown (another tab, an address with a mark)
 * opens at once.
 *
 * 📜 …AND THEY HIDE AGAIN WHENEVER THE COVER IS BACK ON SCREEN (owner 2026-10-15, the one-page Invitation approved with
 * its five recommendations — Q3: *"the cover is reached by scrolling up, where the bar hides again"*).
 *
 * 🚪 ONLY ONCE THE COVER IS FULLY GONE (owner 2026-10-16, DECISION_LOG "THE TOP AND BOTTOM BARS ARRIVE ONLY WHEN THE
 * COVER IS FULLY GONE", verbatim: *"top nav and bottom nav will only be available once we fully leave the cover page.
 * not as we scroll down. the cover page needs to be fully gone first."* — amending 2026-10-15's "the first swipe").
 * While ANY pixel of the Cover Scene (`header[data-cover-scene]`) is on screen the marker is `"wait"`; it turns `"open"`
 * only once the cover's bottom edge has passed the top of the screen — ONE IntersectionObserver on the cover,
 * threshold 0, so it fires at fully out — and back to `"wait"` the moment any of it shows again. Only the marker's
 * VALUE changes — the same `<style>`, never the root. A browser with no IntersectionObserver measures the same edge
 * on scroll (`getBoundingClientRect().bottom <= 0`). A page whose cover is not shown (another tab, an address with a
 * mark) is open at once. Held by `app/[slug]/_lib/the-invitation-is-one-page.test.ts` (5). The Veil's own swipe does
 * not scroll the page, so the menu waits for the scroll that takes the cover away.
 *
 * 📏 …OR ONCE THE GUEST HAS REACHED THE PAGE'S END (controller 2026-10-19, on the live short Save the Date: marco-marga
 * signed out at 375 — the page under the cover is shorter than a screen, so its foot is reached with 305 px of the
 * cover still on screen and the bars, Me among them, never came at all). The marker is also `"open"` while the guest is
 * at the page's end (the page moved, and its bottom is within `END_SLACK` px of the screen's) — whichever comes first.
 * Measured on scroll (one passive listener — the cover's own gate stays the one observer above), never writing.
 *
 * 📏 …BUT ONLY WHERE THE PAGE CANNOT SCROLL THE COVER AWAY (owner 2026-10-19 21:45, live cale-ice on his phone: both
 * bars over the cover just after the unveil — "but i also see the top and bottom nav"). The end counts only while the
 * page's whole scroll is shorter than the cover (`coverBottomInPage > maxScroll`: the cover can never fully leave), and
 * only after the guest's own touch, wheel, key or press (`user`) — never a load, a layout shift or a scroll the page
 * made itself. On a long page the only door is the cover fully gone (2026-10-16 "bars-after-cover").
 *
 * 🧭 …AND THE SAME SCRIPT RUNS WHEN THE GUEST ARRIVES BY A CLIENT-SIDE NAVIGATION (the same live report — the cause):
 * React never executes a `dangerouslySetInnerHTML` script it inserts, so a guest who came in from another Setnayan
 * page (the home feed, the app, the reply page's redirect) got NO marker, no `:has()` match, and both bars drawn over
 * the cover, the cover pushed down under the in-flow top bar. `CoverSceneMenuOnClient` (one layout effect, before
 * paint) re-runs THIS script's own text from the page — the pattern `ensureVeilHold()` (`lib/hub-veil.ts`) set for the
 * Veil's hold — or, when it already runs, asks it to look again (`window.__coverMenuCheck`). One script, one source.
 * A cover drawn AFTER the script looked (streamed in) is caught by one MutationObserver on the body, gone the moment the
 * cover is found or after `ARRIVE_MS`.
 *
 * 👆 …AND A TAP ON A BAR NEVER TAKES THE BARS AWAY (Q3, owner 2026-10-15: "so the bar never re-hides itself"). A click
 * inside the bottom bar / rail (its jumps; the top bar holds none) while the bars are shown holds them open until the guest's own next touch, wheel or key moves the page
 * (a tap's touchstart comes before its click, so the tap on the bar itself unpins and then pins).
 *
 * 🚫 NOT A CLASS ON `<html>` (tester, 2026-10-15, Batch 8 W1): the first cut added `sn-cover-wait` to the root's
 * class list from this inline script, BEFORE hydration. React renders that `className` itself (`app/layout.tsx`), so
 * every guest page hydrated with "attributes of the server rendered HTML didn't match" on `<html>` — and React does
 * not patch it up. A `<style>` in `<head>` is a node React 19 skips, the same door the Veil's hold uses
 * (`lib/hub-veil.ts`). Held by `lib/nothing-touches-the-root-before-hydration.test.ts`.
 *
 * Fail-visible like `ArrivalOnce`: no script, or any error → no marker (or `"open"` at once) → the bars are drawn as
 * always. Nothing here mounts a second bar.
 */
import { CoverSceneMenuOnClient } from './cover-scene-menu-on-client';

/** On the one `<style>` in `<head>`: `"wait"` while any of the cover is on screen, `"open"` once it is fully gone. */
export const COVER_MENU_ATTR = 'data-cover-menu';
export const COVER_MENU_WAIT = 'wait';
export const COVER_MENU_OPEN = 'open';
/**
 * 👁 THE MAKER'S ▶ WHOLE-PAGE PREVIEW KEEPS THE SAME RULE (owner 2026-10-16, on cale-ice's preview: the Maker drew its
 * own guest bar — Home · Details · Story · Me — under the cover from the first frame). The preview's bar is the
 * Maker's, OUTSIDE this page's frame, so a CSS rule here cannot reach it: the Maker's SHOWN canvas frame
 * (`iframe[data-maker-canvas-frame="shown"]`, same origin) mirrors the marker onto the Maker shell as
 * `data-canvas-cover`, and `globals.css` holds the preview's bar off while it is `"wait"`. A page in no frame, in a
 * warm hidden frame, or in a cross-origin frame writes nothing (the `try` swallows the cross-origin refusal).
 */
export const MAKER_CANVAS_COVER_ATTR = 'data-canvas-cover';
/** How close to the page's end counts as "reached the end" (px) — a screen's rounding, not a gesture. */
export const END_SLACK = 4;
/** What the guest presses to move around the page: the ONE bottom bar / rail (the top bar holds no jumps). */
const BARS = `nav[aria-label='Site sections']`;
/** How long the script waits for a cover still being drawn (a client-side navigation streams the page in after it). */
export const ARRIVE_MS = 10000;
/** On the server's `<script>`, so the client can find the text React inserted but did not run. */
export const COVER_MENU_SCRIPT_ATTR = 'data-cover-menu-script';
/** The running script's own "look again" (set by the script; read by `CoverSceneMenuOnClient`). */
export const COVER_MENU_CHECK = '__coverMenuCheck';

export function CoverSceneMenuWaits() {
  return (
    <>
    <script
      {...{ [COVER_MENU_SCRIPT_ATTR]: '' }}
      dangerouslySetInnerHTML={{
        __html: `(function(){var d=document,m=null;try{
var old=d.querySelector('style[${COVER_MENU_ATTR}]');
if(old&&typeof window.${COVER_MENU_CHECK}==='function'){window.${COVER_MENU_CHECK}();return}
if(!d.head)return;
m=old||d.createElement('style');if(!old){m.setAttribute('${COVER_MENU_ATTR}','${COVER_MENU_WAIT}');d.head.appendChild(m)}
function isOpen(){return m.getAttribute('${COVER_MENU_ATTR}')==='${COVER_MENU_OPEN}'}
function cover(){var h=d.querySelector('header[data-cover-scene]');return h&&h.offsetParent!==null?h:null}
var io=null,seen=null,vis=true,pin=false,user=false,frame=0;
function gone(h){if(io)return !vis;return h.getBoundingClientRect().bottom<=0}
function atEnd(h){var s=d.scrollingElement,y=window.scrollY||0;if(!s||!user||y<=0)return false;var max=s.scrollHeight-window.innerHeight;if(h&&h.getBoundingClientRect().bottom+y<=max)return false;return y>=max-${END_SLACK}}
function watch(h){if(!io||seen===h)return;if(seen)io.unobserve(seen);seen=h;vis=true;io.observe(h)}
function mirror(open){try{var fe=window.frameElement;if(!fe||fe.getAttribute('data-maker-canvas-frame')!=='shown')return;var s=fe.ownerDocument.querySelector('[data-maker-shell]');if(s)s.setAttribute('${MAKER_CANVAS_COVER_ATTR}',open?'${COVER_MENU_OPEN}':'${COVER_MENU_WAIT}')}catch(e){}}
function check(){var h=cover();if(h)watch(h);var open=!h||gone(h)||atEnd(h)||(pin&&isOpen());if(open!==isOpen())m.setAttribute('${COVER_MENU_ATTR}',open?'${COVER_MENU_OPEN}':'${COVER_MENU_WAIT}');mirror(open)}
function later(){setTimeout(check,60)}
function tapped(e){var t=e&&e.target;if(isOpen()&&t&&t.closest&&t.closest("${BARS}"))pin=true;later()}
function unpin(){pin=false;user=true}
function pressed(){user=true}
function scrolled(){if(frame)return;frame=1;setTimeout(function(){frame=0;check()},16)}
if(typeof IntersectionObserver==='function')io=new IntersectionObserver(function(es){var e=es[es.length-1];if(e&&e.target===seen){vis=e.isIntersecting;check()}},{threshold:0});
addEventListener('scroll',io?scrolled:check,{passive:true});
addEventListener('wheel',unpin,{passive:true});addEventListener('touchstart',unpin,{passive:true});addEventListener('keydown',unpin,{passive:true});
addEventListener('pointerdown',pressed,{passive:true});addEventListener('mousedown',pressed,{passive:true});
addEventListener('hashchange',check);addEventListener('load',check);d.addEventListener('click',tapped,true);
window.${COVER_MENU_CHECK}=check;
function arrive(){if(typeof MutationObserver!=='function'||!d.body)return;var mo=new MutationObserver(function(){if(cover()){mo.disconnect();check()}});mo.observe(d.body,{childList:true,subtree:true});setTimeout(function(){mo.disconnect()},${ARRIVE_MS})}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
if(!cover())arrive();
}catch(e){try{if(m)m.setAttribute('${COVER_MENU_ATTR}','${COVER_MENU_OPEN}')}catch(e2){}}})()`,
      }}
    />
    <CoverSceneMenuOnClient />
    </>
  );
}
