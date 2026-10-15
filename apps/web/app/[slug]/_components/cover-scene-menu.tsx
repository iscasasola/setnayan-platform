/**
 * 🖼 THE COVER SCENE TAKES THE WHOLE FIRST SCREEN — NO TOP BAR, NO BOTTOM BAR OVER IT (owner 2026-10-15, DECISION_LOG
 * "THE COVER SCENE TAKES THE WHOLE FIRST SCREEN"; verbatim: "no top or bottom nav." and "after they swipe up to open
 * cover is when the menu should show").
 *
 * This puts `sn-cover-wait` on the root before first paint; `globals.css` then holds the page's ONE top bar
 * (`[data-sticky-top]`) and ONE bottom bar / rail (`nav[aria-label="Site sections"]`) off screen while a VISIBLE
 * Cover Scene (`header[data-cover-scene]`) leads the page, and drops the column's top padding so the cover starts at
 * the top edge. The guest's first upward swipe or scroll that moves the page adds `sn-cover-open` — the bars slide in
 * (reduced motion: they just appear) and stay. A page whose cover is not shown (another tab, an address with a mark)
 * opens at once. The Veil's own swipe does not scroll the page, so the menu waits for the swipe that opens the cover.
 *
 * Fail-visible like `ArrivalOnce`: no script, or any error → no `sn-cover-wait` (or `sn-cover-open` at once) → the
 * bars are drawn as always. Nothing here mounts a second bar.
 */
export const COVER_MENU_WAIT = 'sn-cover-wait';
export const COVER_MENU_OPEN = 'sn-cover-open';

export function CoverSceneMenuWaits() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){var r=document.documentElement;try{
if(r.classList.contains('${COVER_MENU_OPEN}'))return;
r.classList.add('${COVER_MENU_WAIT}');
function shown(){var h=document.querySelector('header[data-cover-scene]');return !!(h&&h.offsetParent!==null)}
function off(){removeEventListener('scroll',check);removeEventListener('hashchange',check);document.removeEventListener('click',later,true)}
function check(){if(r.classList.contains('${COVER_MENU_OPEN}'))return off();if(window.scrollY>4||!shown()){r.classList.add('${COVER_MENU_OPEN}');off()}}
function later(){setTimeout(check,60)}
addEventListener('scroll',check,{passive:true});addEventListener('hashchange',check);document.addEventListener('click',later,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check);else check();
}catch(e){r.classList.add('${COVER_MENU_OPEN}')}})()`,
      }}
    />
  );
}
