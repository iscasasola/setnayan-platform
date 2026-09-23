/**
 * MagicMove — the travelling element, as an inline script.
 *
 * A server component that emits one synchronous script, exactly like
 * `PahinaMotionObserver` beside it: no client bundle, no hydration cost. The
 * reasoning for the whole feature is in `lib/magic-move.ts`; this file is the
 * fifteen lines that measure and the safety around them.
 *
 * ── WHAT IT WRITES, AND WHY THAT IS ALL IT WRITES ──────────────────────────
 * 🔒 THREE CUSTOM PROPERTIES ON THE TRAVELLER, AND NOTHING ELSE — never a
 * transform, never a class, never a style the CSS did not ask for. The same
 * rule `PahinaCoverParallax` follows, for the same reason: the effect then
 * exists ONLY while the rule reading them matches, and that rule is gated on
 * `.pahina-js`. Remove the flag — which reduced motion, a missing
 * IntersectionObserver and the 2s self-heal all already do — and the mark
 * returns to where the layout puts it, with nothing to un-stick.
 *
 *   --magic-dx · --magic-dy   how far it has travelled, in px
 *   --magic-k                 what it has scaled to, 1 → the berth's size
 *
 * ── THE GEOMETRY ───────────────────────────────────────────────────────────
 * Two rectangles: where the traveller SITS (its own layout box, read once at
 * rest) and where it is GOING (an empty box in the bar, `data-magic-berth`).
 * Progress is how far the resting place has scrolled toward the berth, clamped
 * to 0…1. At 0 the mark is exactly where CSS put it and the properties are the
 * identity; at 1 it is centred on the berth at the berth's size.
 *
 * ⚠ MEASURED AT REST, NOT MID-FLIGHT. `getBoundingClientRect` on a transformed
 * element returns the TRANSFORMED box, so reading the traveller while it is
 * already moving feeds its own output back in and the value runs away. The
 * resting rect is captured with the transform explicitly zeroed, and re-captured
 * only on resize.
 *
 * ── THE LESSON FROM THE FILE NEXT DOOR ─────────────────────────────────────
 * 🪤 `pahina-motion.tsx` once concluded "nothing to observe" WHILE THE PAGE WAS
 * STILL STREAMING — finding nothing was a lie at that instant, not a fact — and
 * silently suppressed the scroll reveal on every public invitation for seven
 * weeks. So this never gives up on a first empty look while the document is
 * parsing: it retries on `DOMContentLoaded` and on a timer, whichever lands
 * first, and if it really is empty it writes one console line saying what its
 * selector saw. A silent safety net cannot be told apart from a feature nobody
 * built.
 */
export function MagicMove() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: post-content sync measurer; see the fail-visible contract above
      dangerouslySetInnerHTML={{
        __html: `(function(){try{
var r=document.documentElement;
if(!r.classList.contains('pahina-js'))return;
var done=false;
var give=function(saw){try{console.warn('[magic] nothing travels: traveller/berth matched '+saw+'. The mark stays where the layout puts it.')}catch(e){}};
var attach=function(){
if(done)return true;
var t=document.querySelector('[data-magic-traveller]');
var b=document.querySelector('[data-magic-berth]');
if(!t||!b)return false;
done=true;
var rest=null,dest=null,ticking=false;
var measure=function(){
t.style.setProperty('--magic-dx','0px');t.style.setProperty('--magic-dy','0px');t.style.setProperty('--magic-k','1');
var a=t.getBoundingClientRect(),c=b.getBoundingClientRect(),y=window.scrollY||window.pageYOffset||0;
if(!a.width||!c.width){rest=null;return}
rest={x:a.left+a.width/2,y:a.top+a.height/2+y,w:a.width};
dest={x:c.left+c.width/2,y:c.top+c.height/2+y,w:c.width};
};
var frame=function(){
ticking=false;
if(!rest||!dest)return;
var y=window.scrollY||window.pageYOffset||0;
var span=Math.max(1,(dest.y-rest.y));
var p=(y-0)/span;p=p<0?0:(p>1?1:p);
var bx=dest.x-(window.scrollX||0);
t.style.setProperty('--magic-dx',((bx-rest.x)*p).toFixed(2)+'px');
t.style.setProperty('--magic-dy',((dest.y-rest.y)*p - y*p).toFixed(2)+'px');
t.style.setProperty('--magic-k',(1+((dest.w/rest.w)-1)*p).toFixed(4));
};
var onScroll=function(){if(ticking)return;ticking=true;requestAnimationFrame(frame)};
measure();frame();
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('resize',function(){measure();frame()},{passive:true});
return true};
if(!attach()){
var retry=function(){if(done)return;if(!attach()){give((document.querySelectorAll('[data-magic-traveller]').length)+'/'+(document.querySelectorAll('[data-magic-berth]').length))}};
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',retry,{once:true})}
setTimeout(retry,1500);
}
}catch(e){}})()`,
      }}
    />
  );
}
