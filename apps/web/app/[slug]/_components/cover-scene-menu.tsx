/**
 * 🖼 THE COVER SCENE TAKES THE WHOLE FIRST SCREEN — NO TOP BAR, NO BOTTOM BAR OVER IT (owner 2026-10-15, DECISION_LOG
 * "THE COVER SCENE TAKES THE WHOLE FIRST SCREEN"; verbatim: "no top or bottom nav." and "after they swipe up to open
 * cover is when the menu should show").
 *
 * This puts ONE `<style data-cover-menu="wait">` in `<head>` before first paint; `globals.css` then holds the page's
 * ONE top bar (`[data-sticky-top]`) and ONE bottom bar / rail (`nav[aria-label="Site sections"]`) off screen while a
 * VISIBLE Cover Scene (`header[data-cover-scene]`) leads the page, and drops the column's top padding so the cover
 * starts at the top edge. The guest's first upward swipe or scroll that moves the page sets it to `"open"` — the bars
 * slide in (reduced motion: they just appear) and stay. A page whose cover is not shown (another tab, an address with
 * a mark) opens at once. The Veil's own swipe does not scroll the page, so the menu waits for the swipe that opens the
 * cover.
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
/** On the one `<style>` in `<head>`: `"wait"` until the cover is swiped open, then `"open"`. */
export const COVER_MENU_ATTR = 'data-cover-menu';
export const COVER_MENU_WAIT = 'wait';
export const COVER_MENU_OPEN = 'open';

export function CoverSceneMenuWaits() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){var d=document,m=null;try{
if(d.querySelector('style[${COVER_MENU_ATTR}]'))return;
if(!d.head)return;
m=d.createElement('style');m.setAttribute('${COVER_MENU_ATTR}','${COVER_MENU_WAIT}');d.head.appendChild(m);
function isOpen(){return m.getAttribute('${COVER_MENU_ATTR}')==='${COVER_MENU_OPEN}'}
function shown(){var h=d.querySelector('header[data-cover-scene]');return !!(h&&h.offsetParent!==null)}
function off(){removeEventListener('scroll',check);removeEventListener('hashchange',check);d.removeEventListener('click',later,true)}
function check(){if(isOpen())return off();if(window.scrollY>4||!shown()){m.setAttribute('${COVER_MENU_ATTR}','${COVER_MENU_OPEN}');off()}}
function later(){setTimeout(check,60)}
addEventListener('scroll',check,{passive:true});addEventListener('hashchange',check);d.addEventListener('click',later,true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
}catch(e){try{if(m)m.setAttribute('${COVER_MENU_ATTR}','${COVER_MENU_OPEN}')}catch(e2){}}})()`,
      }}
    />
  );
}
