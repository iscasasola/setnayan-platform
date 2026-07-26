/**
 * PahinaMotion — the guest site's scroll choreography (design 2026-07-25 §6).
 *
 * The reveal is worth ~15 lines of JS and no library: chapters fade up 22px as
 * you reach them, which is what makes the page feel commissioned rather than
 * printed. The interesting part is the SAFETY, not the effect.
 *
 * ── The fail-visible contract (build plan ground rule 8) ────────────────────
 * A guest on a slow phone, a broken script, or a blocked bundle must NEVER see
 * blank sections. So the hidden state is not the default — it exists only while
 * the root carries `.pahina-js`, and three independent things can remove or
 * withhold it:
 *
 *   1. `RootFlag` refuses to add it at all when IntersectionObserver is missing
 *      or the guest asked for reduced motion. No flag → nothing is ever hidden.
 *   2. `RootFlag` arms a 2s self-heal. If `Observer` never runs — parse error,
 *      truncated HTML, an extension eating inline scripts — the flag is dropped
 *      and every section becomes visible. The page degrades to today's site.
 *   3. `Observer` drops the flag itself if it finds nothing to observe or if
 *      constructing the IntersectionObserver throws.
 *
 * Plus a CSS-side `prefers-reduced-motion` block in globals.css, so even if the
 * flag is somehow set, reduced-motion guests get everything visible and static.
 *
 * ── Why three scripts, and why inline ───────────────────────────────────────
 * The flag must be set BEFORE the content paints (otherwise sections paint
 * visible, then hide, then re-reveal — a flash strictly worse than no
 * animation), and the observer can only be built AFTER the content exists. So
 * `RootFlag` mounts above the children and `Observer` below them. Both are
 * synchronous inline scripts — the same idiom `GuestHubCard` already uses for
 * its pre-paint localStorage read.
 *
 * `CoverParallax` is the §6 hero effect and joins `Observer` below the content
 * for the same reason (it needs the plate to exist). It deliberately reuses the
 * SAME `.pahina-js` flag rather than arming a second one: one flag means one
 * set of exits to reason about, and a guest who opted out of motion opts out of
 * both effects with a single check. Its own safety note sits on the function.
 *
 * These are server components: no client bundle, no hydration cost.
 */

/** Sits ABOVE the page content — arms the hidden state before first paint. */
export function PahinaMotionRootFlag() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint sync flag; see the fail-visible contract above
      dangerouslySetInnerHTML={{
        __html: `(function(){try{
var r=document.documentElement;
if(!('IntersectionObserver' in window))return;
if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
r.classList.add('pahina-js');
setTimeout(function(){if(!window.__pahinaArmed){r.classList.remove('pahina-js')}},2000);
}catch(e){}})()`,
      }}
    />
  );
}

/**
 * Sits BELOW the page content — drifts the masthead's cover plate (design §6:
 * "hero cover parallax ±6%, rAF-throttled transform on the media wrapper").
 *
 * ── Why this cannot break the photo ─────────────────────────────────────────
 * The script NEVER writes `transform`. It writes one custom property,
 * `--pahina-parallax`, which is only ever read by a rule scoped to
 * `.pahina-js` (globals.css). That single choice buys the whole fail-visible
 * contract for free, because it inherits the reveal's three exits verbatim:
 * no IntersectionObserver, reduced motion, or the 2s self-heal all remove
 * `.pahina-js`, the rule stops matching, and the plate is instantly a plain
 * static `object-cover` photo — even if this script already ran and left a
 * property behind, because nothing else reads that property. Had it set
 * `el.style.transform` directly, dropping the flag would have left the image
 * frozen at whatever offset it happened to hold.
 *
 * A fourth exit is this script simply never running (parse error, blocked
 * inline script): the property is then never set, the rule's `0%` fallback
 * applies, and the plate is centred and still.
 *
 * ── Why it cannot expose a gap ──────────────────────────────────────────────
 * The CSS scales the layer to 1.16 and this clamps the offset to ±6% of the
 * plate height, so at either extreme ~2% of plate height of the scaled overhang
 * is still hidden under the `overflow-hidden` edge. The two numbers are a pair:
 * MAX below and the scale in globals.css must move together. Full derivation
 * lives with the CSS rule.
 */
export function PahinaCoverParallax() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: post-content sync parallax; see the contract above
      dangerouslySetInnerHTML={{
        __html: `(function(){try{
var r=document.documentElement;
if(!r.classList.contains('pahina-js'))return;
if(!window.requestAnimationFrame)return;
var ls=document.querySelectorAll('.sn-editorial [data-pahina-parallax]');
if(!ls.length)return;
var MAX=6,pending=false;
var tick=function(){pending=false;var vh=window.innerHeight||0;if(!vh)return;
for(var i=0;i<ls.length;i++){var el=ls[i],b=el.parentNode.getBoundingClientRect();
if(b.bottom<0||b.top>vh)continue;
var p=(vh-b.top)/(vh+b.height);p=p<0?0:p>1?1:p;
el.style.setProperty('--pahina-parallax',((p-0.5)*2*MAX).toFixed(2)+'%')}};
var q=function(){if(!pending){pending=true;requestAnimationFrame(tick)}};
window.addEventListener('scroll',q,{passive:true});
window.addEventListener('resize',q,{passive:true});
q();
}catch(e){}})()`,
      }}
    />
  );
}

/** Sits BELOW the page content — observes the chapters and reveals them. */
export function PahinaMotionObserver() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: post-content sync observer; see the fail-visible contract above
      dangerouslySetInnerHTML={{
        __html: `(function(){try{
var r=document.documentElement;
if(!r.classList.contains('pahina-js'))return;
window.__pahinaArmed=true;
var give=function(){r.classList.remove('pahina-js')};
var n=document.querySelectorAll('.sn-editorial [data-pahina-chapters] > *');
if(!n.length){give();return}
var io=new IntersectionObserver(function(es){
for(var i=0;i<es.length;i++){if(es[i].isIntersecting){es[i].target.classList.add('pahina-in');io.unobserve(es[i].target)}}
},{rootMargin:'0px 0px -6% 0px',threshold:0.01});
for(var i=0;i<n.length;i++){io.observe(n[i])}
}catch(e){try{document.documentElement.classList.remove('pahina-js')}catch(e2){}}})()`,
      }}
    />
  );
}
