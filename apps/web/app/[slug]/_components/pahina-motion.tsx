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

/**
 * Sits BELOW the page content — observes the chapters and reveals them.
 *
 * ── 🔴 THE DEFECT THIS SHAPE EXISTS FOR, CAUGHT WITH A STACK TRACE ─────────
 * From 2026-07-25 until 2026-09-14 this script ran ONE synchronous query and
 * gave up if it came back empty. On the public invitation it came back empty
 * EVERY TIME, and the page never animated — anywhere, for anyone.
 *
 * The page streams. React flushes Suspense content into `<div hidden id="S:…">`
 * buffers and moves it into place afterwards with `$RS(...)`. This script sits
 * at ~96% of the document, which is still BEFORE those moves. Measured on the
 * live page by patching `DOMTokenList.prototype.remove` and re-serving the real
 * HTML in a frame:
 *
 *     when: remove · called from: give() · readyState: "loading"
 *     selectorMatches: 0 · markers: 1 · hiddenBuffers: 3 · armed: true
 *     …afterwards: selectorMatches 8 · revealed 0 · flag off
 *
 * Zero chapters at that instant, eight a moment later. `give()` had already
 * removed the flag — globally and permanently — so every one of the eight
 * arrived unobserved.
 *
 * 🔑 THE FAIL-VISIBLE CONTRACT WAS SUPPRESSING THE FEATURE. `give()` did
 * exactly its job — "nothing to observe, so un-hide everything" — at the one
 * moment when finding nothing was a LIE rather than a fact. And because a
 * given-up page and a never-built page are the same pixels, and `give()` wrote
 * nothing anywhere, it survived seven weeks on the page every guest sees.
 *
 * ── WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ────────────────────────────
 * The contract is KEPT. `give()` still exists and still un-hides everything;
 * deleting it to make the animation work would trade a cosmetic failure for a
 * page of invisible sections, which is far worse. What changed is WHEN it is
 * allowed to conclude the page is empty:
 *
 *   1. Try to attach immediately — the fast path, unchanged for a page that is
 *      already complete (the editorial body, and any non-streaming render).
 *   2. If nothing matches AND the document is still parsing, do NOT give up.
 *      Wait for `DOMContentLoaded` — by then every `$RS(...)` has run and the
 *      chapters are real children — and try again.
 *   3. Only if the retry ALSO finds nothing is the emptiness genuine. Give up
 *      then, and SAY SO: a give-up now writes one console line naming what its
 *      selector saw. A silent safety net cannot be told apart from a feature
 *      nobody built, which is the sentence this whole file just cost.
 *
 * ⚠ THE DEFERRED PATH CANNOT STRAND A SECTION. Between this script and the
 * retry the flag is still set, so late chapters arrive hidden — which is the
 * intended pre-reveal state, not a fault. The observer attaches on the very
 * next tick and anything already in view intersects immediately. And if the
 * retry never runs at all (a listener that never fires), the RootFlag's 2s
 * self-heal is NOT a backstop here — `__pahinaArmed` is already true — so the
 * retry is scheduled TWO ways, on `DOMContentLoaded` and on a 1.5s timer,
 * whichever lands first, and whichever loses is a no-op.
 * `the-choreography-waits-for-the-page.test.ts` pins all of it.
 */
export function PahinaMotionObserver() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: post-content sync observer; see the fail-visible contract above
      dangerouslySetInnerHTML={{
        __html: `(function(){try{
var r=document.documentElement;
if(!r.classList.contains('pahina-js'))return;
window.__pahinaArmed=true;
var give=function(saw){try{console.warn('[pahina] scroll choreography stood down: no chapters to observe (matched '+saw+'). The page stays fully visible.')}catch(e){}r.classList.remove('pahina-js')};
var sel='.sn-editorial [data-pahina-chapters] > *';
var done=false;
var attach=function(){
if(done)return true;
var n=document.querySelectorAll(sel);
if(!n.length)return false;
done=true;
var io=new IntersectionObserver(function(es){
for(var i=0;i<es.length;i++){if(es[i].isIntersecting){es[i].target.classList.add('pahina-in');io.unobserve(es[i].target)}}
},{rootMargin:'0px 0px -6% 0px',threshold:0.01});
for(var i=0;i<n.length;i++){io.observe(n[i])}
return true};
if(!attach()){
var retry=function(){if(done)return;if(!attach()){give(document.querySelectorAll(sel).length)}};
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',retry,{once:true})}
setTimeout(retry,1500);
}
}catch(e){try{document.documentElement.classList.remove('pahina-js')}catch(e2){}}})()`,
      }}
    />
  );
}
