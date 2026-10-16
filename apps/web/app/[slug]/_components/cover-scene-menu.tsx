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
 * 🚫 NOT A CLASS ON `<html>` (tester, 2026-10-15, Batch 8 W1): the first cut added `sn-cover-wait` to the root's
 * class list from this inline script, BEFORE hydration. React renders that `className` itself (`app/layout.tsx`), so
 * every guest page hydrated with "attributes of the server rendered HTML didn't match" on `<html>` — and React does
 * not patch it up. A `<style>` in `<head>` is a node React 19 skips, the same door the Veil's hold uses
 * (`lib/hub-veil.ts`). Held by `lib/nothing-touches-the-root-before-hydration.test.ts`.
 *
 * Fail-visible like `ArrivalOnce`: no script, or any error → no marker (or `"open"` at once) → the bars are drawn as
 * always. Nothing here mounts a second bar.
 */
/** On the one `<style>` in `<head>`: `"wait"` while any of the cover is on screen, `"open"` once it is fully gone. */
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
function cover(){var h=d.querySelector('header[data-cover-scene]');return h&&h.offsetParent!==null?h:null}
var io=null,seen=null,vis=true;
function gone(h){if(io)return !vis;return h.getBoundingClientRect().bottom<=0}
function watch(h){if(!io||seen===h)return;if(seen)io.unobserve(seen);seen=h;vis=true;io.observe(h)}
function check(){var h=cover();if(h)watch(h);var open=!h||gone(h);if(open!==isOpen())m.setAttribute('${COVER_MENU_ATTR}',open?'${COVER_MENU_OPEN}':'${COVER_MENU_WAIT}')}
function later(){setTimeout(check,60)}
if(typeof IntersectionObserver==='function')io=new IntersectionObserver(function(es){var e=es[es.length-1];if(e&&e.target===seen){vis=e.isIntersecting;check()}},{threshold:0});
else addEventListener('scroll',check,{passive:true});
addEventListener('hashchange',check);d.addEventListener('click',later,true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
}catch(e){try{if(m)m.setAttribute('${COVER_MENU_ATTR}','${COVER_MENU_OPEN}')}catch(e2){}}})()`,
      }}
    />
  );
}
