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
 * ── Why two scripts, and why inline ─────────────────────────────────────────
 * The flag must be set BEFORE the content paints (otherwise sections paint
 * visible, then hide, then re-reveal — a flash strictly worse than no
 * animation), and the observer can only be built AFTER the content exists. So
 * `RootFlag` mounts above the children and `Observer` below them. Both are
 * synchronous inline scripts — the same idiom `GuestHubCard` already uses for
 * its pre-paint localStorage read.
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
