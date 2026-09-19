/*
  NOT A 'use client' MODULE, ON PURPOSE — app/layout.tsx (a server component) reads the script
  string below and inlines it into <head>. A value taken from a 'use client' file arrives as a
  client reference, not the value (see lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts).
*/

/**
 * A page whose stylesheet failed to load recovers, instead of sitting there as raw HTML.
 *
 * ── WHAT THE OWNER SAW (2026-09-18, ~13:50Z) ────────────────────────────────
 * `/vendor-dashboard` rendered with NO styles at all: serif default font, no
 * layout, the screen-reader copy printed beside the visible copy ("SearchSearch
 * events…", "What's new2"). Every stylesheet on the page had failed to apply,
 * and nothing anywhere noticed — a failed `<link rel="stylesheet">` throws into
 * no error boundary, so `lib/stale-bundle.ts` (which rescues a failed SCRIPT)
 * never runs. The page is simply wrong, silently, until a person reloads by hand.
 *
 * ── WHAT WAS MEASURED, AND WHAT WAS NOT ─────────────────────────────────────
 * Refuted: deployment skew. Skew Protection is ON for the project
 * (`skewProtectionMaxAge` 43200 = 12h, read from the Vercel project API), every
 * CSS href carries `?dpl=<deployment>`, and an old `dpl` was measured routing
 * to THAT deployment's files (a hash only the new build has came back 404 under
 * the old `dpl`, 200 under the new one). A page cannot ask for CSS its own
 * build does not have.
 * Not visible: Vercel's runtime logs carry no CDN static requests, so whether
 * the four CSS requests 404'd, errored, or never left the browser is unknown.
 * The one layer between this page and its CSS is `public/sw.js`, which answers
 * every stylesheet request (stale-while-revalidate) and is replaced on EVERY
 * deploy — ~20 times that day. That is a candidate, not a finding.
 *
 * 🔑 SO THIS IS A MITIGATION, NOT A CURE. It turns the symptom into one
 * automatic reload, and it RECORDS the failure (href, whether a service worker
 * was controlling the page, time) under `STYLESHEET_FAILURE_KEY`, which
 * `DeferredObservability` sends to Sentry on the next good load. The next
 * occurrence answers the open question; this one could not.
 *
 * ── HOW IT DECIDES ──────────────────────────────────────────────────────────
 * Only OUR build's CSS counts (`/_next/static/css/`): a font or third-party
 * sheet failing is not "the page has no styles". A sheet is failed when the
 * browser gave it no stylesheet object, or an EMPTY one — every CSS file our
 * build emits has rules, so zero rules means an error page or nothing arrived.
 * ⚠ MEASURED IN CHROMIUM, AND IT IS NOT WHAT YOU WOULD GUESS: a stylesheet that
 * 404s still HAS a `sheet` object, and reading its `cssRules` THROWS a
 * SecurityError ("Cannot access rules"). The first draft of this script treated
 * a throw as healthy and would have missed exactly the failure it exists for.
 * Our hrefs are same-origin, where a healthy sheet never throws, so a throw on
 * one of OUR sheets counts as failed.
 * Checked twice: at `load` for the sheets the server sent, and on each `error`
 * event for sheets a client-side navigation adds later. With storage disabled
 * there is no way to prove "once", so it never reloads — it shows the bar.
 *
 * ── ONCE, AND THE ONCE IS THE WHOLE POINT ───────────────────────────────────
 * Same rule as `reloadForStaleBundle`: a page that reloads on every failure is
 * an infinite refresh loop on a screen nobody can read or leave. The marker is
 * cleared on a load where every sheet arrived, so a genuine failure after a
 * LATER deploy gets its own reload. If the reload fails too, the page says so
 * in a bar styled INLINE (no stylesheet can be relied on) with a Reload button,
 * rather than showing raw HTML as though that were the page.
 */

/** One-shot marker: this tab already reloaded once for a failed stylesheet. */
export const STYLESHEET_RELOAD_KEY = 'setnayan:stylesheet-reloaded';

/** What failed, kept across the reload so it can be reported once the app is up. */
export const STYLESHEET_FAILURE_KEY = 'setnayan:stylesheet-failure';

/** The path every stylesheet our own build emits lives under. */
export const APP_STYLESHEET_PATH = '/_next/static/css/';

export const stylesheetRecoveryScript = `(function(){try{
  var RK=${JSON.stringify(STYLESHEET_RELOAD_KEY)},FK=${JSON.stringify(STYLESHEET_FAILURE_KEY)},P=${JSON.stringify(APP_STYLESHEET_PATH)};
  var done=false;
  function ours(l){return !!(l&&l.tagName==='LINK'&&/(^|\\s)stylesheet(\\s|$)/i.test(l.rel||'')&&(l.href||'').indexOf(P)!==-1);}
  function failed(l){var s=l.sheet;if(!s)return true;try{return !s.cssRules||s.cssRules.length===0;}catch(e){return true;}}
  function bar(){if(document.getElementById('sn-css-failed'))return;var d=document.createElement('div');d.id='sn-css-failed';d.setAttribute('role','alert');
    d.setAttribute('style','position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:12px 16px;background:#1f1a17;color:#fff;font:15px/1.4 system-ui,sans-serif;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap');
    d.appendChild(document.createTextNode('This page did not finish loading.'));var b=document.createElement('button');b.type='button';b.textContent='Reload';
    b.setAttribute('style','padding:6px 14px;border:0;border-radius:6px;background:#fff;color:#1f1a17;font:inherit;font-weight:600;cursor:pointer');
    b.onclick=function(){location.reload();};d.appendChild(b);(document.body||document.documentElement).appendChild(d);}
  function recover(l){if(done)return;done=true;var s;
    try{s=window.sessionStorage;s.setItem(FK,JSON.stringify({href:l.href,sw:!!(navigator.serviceWorker&&navigator.serviceWorker.controller),at:new Date().toISOString(),path:location.pathname,retried:!!s.getItem(RK)}));
      if(s.getItem(RK)){bar();return;}s.setItem(RK,'1');}
    catch(e){bar();return;}
    location.reload();}
  document.addEventListener('error',function(e){var t=e.target;if(ours(t))recover(t);},true);
  window.addEventListener('load',function(){var ls=document.querySelectorAll('link[rel~="stylesheet"]'),bad=null;
    for(var i=0;i<ls.length;i++){if(ours(ls[i])&&failed(ls[i])){bad=ls[i];break;}}
    if(bad){recover(bad);return;}
    try{window.sessionStorage.removeItem(RK);}catch(e){}});
}catch(e){}})();`;
