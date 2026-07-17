/**
 * lib/monogram-studio/markup-v2.ts
 *
 * The Vector Monogram Studio's V2 editor DOM + styling (Monogram Maker council
 * verdict 2026-07-17 §2), injected by both studio hosts when the
 * `monogram_studio_v2` flag is ON (lib/monogram-studio/flag.ts). The shipped v1
 * markup (./markup.ts) is untouched — flag OFF stays byte-identical.
 *
 * What §2 rules and this file implements:
 *   · The `Arrange | Draw frame` mode toggle and the six-instruction edithint
 *     wall are DELETED. Three section tabs — **Letters · Frame · Reveal** — a
 *     segmented control at the top of the panel (sticky in the desktop
 *     two-column layout, where the panel scrolls).
 *   · Panel order = the couple's mental order: canvas → [starting-points strip
 *     mounts at #presetstrip in PR-5] → Names → Font → Colours (the Letters
 *     tab), one static hint line on the canvas.
 *   · The Frame tab opens on the pattern shelf slot (#frameshelf — PR-4) with
 *     "✎ Draw your own" revealing the full v1 pen/nib/mirror + symbol boxes
 *     unchanged (the pen SURVIVES, demoted — §4).
 *   · The Reveal tab holds the (always-open) animate panel — the collapsible
 *     #animhdr accordion is gone; #animbox keeps its id (the engine's chip +
 *     reflect queries key on it).
 *   · Fit/Reset demote into a "⋯" overflow (#more/#morebox); Undo/Redo stay.
 *   · Atelier reskin (§2.4): Hanken Grotesk (var(--font-hanken)) is the UI
 *     face, Space Mono (var(--font-space-mono)) the data face, gold supersedes
 *     mulberry as the accent. Both faces are loaded app-wide by app/layout.tsx.
 *     The FONT-PREVIEW chips keep their own display faces (they must render the
 *     monogram faces themselves).
 *
 * Every engine-wired id from v1 is preserved (cv/load/zoom/hint · selbox/cross
 * · penbox/symbox + nib/mirror/palette controls · names/fonts/inks/outs/bgs ·
 * animbox chips + dur/dl/smooth · undo/redo/fit/reset · ro). New v2-only ids
 * the engine feature-detects: #vtabs, #tab-letters/-frame/-reveal, #drawtoggle,
 * #drawtools, #more, #morebox, #presetstrip, #frameshelf.
 */

export const STUDIO_CSS_V2 = `
.vsroot .vs{--paper:#FBFBFA;--ink:#1E2229;--ink-soft:#5F5E5A;--line:#E7E1D6;--line2:#D9D2C4;--gold:#C5A059;--gold-deep:#8C6932;font-family:var(--font-hanken),system-ui,sans-serif;color:#1E2229;container-type:inline-size;}
.vsroot .vs .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}
.vsroot .vs .frame{background:transparent;padding:0;max-width:none;margin:0;}
.vsroot .vs .card{background:#FBFBFA;border:1px solid var(--line);border-radius:16px;overflow:hidden;}
.vsroot .vs .top{display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid var(--line);}
.vsroot .vs .wm{font-family:var(--font-space-mono),ui-monospace,monospace;font-size:12px;letter-spacing:.3em;font-weight:500;color:#1E2229;}
.vsroot .vs .tag{margin-left:auto;font-family:var(--font-space-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.18em;color:var(--gold-deep);text-transform:uppercase;}
.vsroot .vs .sw2{position:relative;height:clamp(320px,64vw,440px);}
.vsroot .vs canvas{display:block;width:100%;height:100%;touch-action:pan-y;background:#FBFBFA;}
.vsroot .vs .load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-space-mono),ui-monospace,monospace;font-size:12px;color:var(--ink-soft);background:rgba(251,251,250,.9);}
.vsroot .vs .load.off{display:none;}
.vsroot .vs .zoom{position:absolute;top:10px;right:12px;font-family:var(--font-space-mono),ui-monospace,monospace;font-size:11px;color:var(--ink-soft);background:rgba(251,251,250,.7);padding:2px 7px;border-radius:6px;pointer-events:none;}
.vsroot .vs .hint{position:absolute;left:0;right:0;bottom:12px;text-align:center;font-size:12px;color:var(--ink-soft);font-family:var(--font-space-mono),ui-monospace,monospace;pointer-events:none;transition:opacity .35s;padding:0 12px;margin:0;}
.vsroot .vs .panel{padding:0 16px 16px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line);background:#FBFBFA;}
.vsroot .vs .vtabs{position:sticky;top:0;z-index:3;display:flex;gap:4px;margin:0 -16px;padding:10px 16px;background:rgba(251,251,250,.92);backdrop-filter:blur(6px);border-bottom:1px solid var(--line);}
.vsroot .vs .vt{-webkit-appearance:none;appearance:none;flex:1;border:1px solid var(--line2);background:#fff;border-radius:10px;padding:9px 10px;font-family:var(--font-hanken),system-ui,sans-serif;font-size:13px;font-weight:600;color:var(--ink-soft);cursor:pointer;}
.vsroot .vs .vt.on{background:#1E2229;color:#FBFBFA;border-color:#1E2229;}
.vsroot .vs .vtab{display:flex;flex-direction:column;gap:12px;}
.vsroot .vs .vtab.off{display:none;}
.vsroot .vs .off{display:none;}
.vsroot .vs .lab{font-family:var(--font-space-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep);margin:0 0 7px;display:flex;justify-content:space-between;align-items:baseline;}
.vsroot .vs .lab b{color:var(--gold-deep);font-size:15px;font-weight:700;}
.vsroot .vs .lab2{font-family:var(--font-space-mono),ui-monospace,monospace;font-size:10.5px;letter-spacing:.06em;color:var(--ink-soft);margin:0;display:flex;justify-content:space-between;align-items:center;}
.vsroot .vs .box{border:1px solid var(--gold);background:#FBF6EA;border-radius:12px;padding:11px 13px;display:flex;flex-direction:column;gap:10px;}
.vsroot .vs .names{width:100%;-webkit-appearance:none;appearance:none;border:1px solid #D9D2C4!important;background:#fff!important;border-radius:10px;padding:11px 13px;font-family:var(--font-hanken),system-ui,sans-serif;font-size:15px;color:#1E2229!important;}
.vsroot .vs .names:focus{outline:none;border-color:var(--gold)!important;}
.vsroot .vs .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.vsroot .vs input[type=range]{width:100%;accent-color:#8C6932;}
.vsroot .vs .gaprow{display:flex;align-items:center;gap:10px;}
.vsroot .vs .gaprow input[type=range]{flex:1;}
.vsroot .vs .chip{-webkit-appearance:none;appearance:none;border:1px solid #D9D2C4!important;background:#fff!important;border-radius:999px;padding:7px 14px;font-size:15px;color:#5F5E5A!important;cursor:pointer;}
.vsroot .vs .chip.sel{background:#1E2229!important;color:#FBFBFA!important;border-color:#1E2229!important;}
.vsroot .vs .chip[data-f="cardo"]{font-family:'Cardo',serif;font-style:italic;}
.vsroot .vs .chip[data-f="gilda"]{font-family:'Gilda Display',serif;}
.vsroot .vs .chip[data-f="playfairsc"]{font-family:'Playfair Display SC',serif;}
.vsroot .vs .chip[data-f="marcellus"]{font-family:'Marcellus',serif;}
.vsroot .vs .chip[data-f="script"]{font-family:'Great Vibes',cursive;font-size:21px;padding:3px 16px;}
.vsroot .vs .chip[data-f="pinyon"]{font-family:'Pinyon Script',cursive;font-size:21px;padding:3px 16px;}
.vsroot .vs .chip[data-f="cinzeldec"]{font-family:'Cinzel Decorative',serif;}
.vsroot .vs .chip[data-f="yeseva"]{font-family:'Yeseva One',serif;}
.vsroot .vs .tg{-webkit-appearance:none;appearance:none;border:1px solid #D9D2C4!important;background:#fff!important;border-radius:9px;padding:8px 13px;font-size:12.5px;font-weight:500;color:#5F5E5A!important;cursor:pointer;white-space:nowrap;}
.vsroot .vs .tg.on{background:#1E2229!important;color:#FBFBFA!important;border-color:#1E2229!important;}
.vsroot .vs .tg.lg{font-size:17px;font-weight:700;padding:4px 16px;}
.vsroot .vs .tg.symg{font-size:17px;padding:6px 12px;color:#8C6932!important;}
.vsroot .vs .sw{-webkit-appearance:none;appearance:none;width:30px;height:30px;border-radius:50%;border:1px solid #D9D2C4;cursor:pointer;padding:0;}
.vsroot .vs .sw.sel{box-shadow:0 0 0 2px #FBFBFA,0 0 0 3.5px var(--gold);}
.vsroot .vs .bg{-webkit-appearance:none;appearance:none;width:34px;height:26px;border-radius:7px;border:1px solid #D9D2C4;cursor:pointer;padding:0;}
.vsroot .vs .bg.sel{box-shadow:0 0 0 2px #FBFBFA,0 0 0 3.5px var(--gold-deep);}
.vsroot .vs .foot{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding-top:12px;flex-wrap:wrap;}
.vsroot .vs .ro{font-family:var(--font-space-mono),ui-monospace,monospace;font-size:11.5px;color:var(--ink-soft);}
.vsroot .vs .btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.vsroot .vs .mini{-webkit-appearance:none;appearance:none;border:1px solid #D9D2C4!important;background:#fff!important;border-radius:9px;padding:8px 12px;font-size:12.5px;font-weight:500;color:#5F5E5A!important;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}
.vsroot .vs .mini.play{background:#1E2229!important;color:#FBFBFA!important;border-color:#1E2229!important;}
.vsroot .vs .mini:disabled{opacity:.4;cursor:default;}
.vsroot .vs .cap{font-size:11.5px;color:var(--ink-soft);}
.vsroot .vs .sub{font-family:var(--font-space-mono),ui-monospace,monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);margin:4px 0 -4px;padding-top:6px;border-top:1px dashed var(--line);}
.vsroot .vs .crow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.vsroot .vs .ckey{font-family:var(--font-space-mono),ui-monospace,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);width:58px;flex:none;}
.vsroot .vs .swrow{gap:7px;}
.vsroot .vs .cust{display:inline-flex;width:30px;height:30px;border-radius:50%;border:1px dashed var(--gold);overflow:hidden;cursor:pointer;padding:0;flex:none;}
.vsroot .vs .cust input[type=color]{width:150%;height:150%;border:none;padding:0;margin:-25%;cursor:pointer;background:none;}
.vsroot .vs .cust input[type=color]::-webkit-color-swatch-wrapper{padding:0;}
.vsroot .vs .cust input[type=color]::-webkit-color-swatch{border:none;}
.vsroot .vs .cust input[type=color]::-moz-color-swatch{border:none;}
.vsroot .vs .sw.clr{background:#fff;position:relative;}
.vsroot .vs .sw.clr::after{content:'';position:absolute;left:50%;top:4px;bottom:4px;width:2px;background:#C2724C;transform:translateX(-50%) rotate(45deg);border-radius:2px;}
.vsroot .vs .morebox{display:inline-flex;gap:8px;}
.vsroot .vs .morebox.off{display:none;}
.vsroot .vs .drawtools{display:flex;flex-direction:column;gap:12px;}
.vsroot .vs .drawtools.off{display:none;}
.vsroot .vs .fcards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;}
.vsroot .vs .fcard{-webkit-appearance:none;appearance:none;border:1px solid var(--line2);background:#fff;border-radius:12px;padding:8px 6px 7px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;}
.vsroot .vs .fcard.on{border-color:var(--gold);box-shadow:0 0 0 1.5px var(--gold);}
.vsroot .vs .fthumb{width:58px;height:46px;background-size:contain;background-repeat:no-repeat;background-position:center;}
.vsroot .vs .fname{font-family:var(--font-space-mono),ui-monospace,monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);text-align:center;}
.vsroot .vs .pstrip{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;}
.vsroot .vs .pcard{-webkit-appearance:none;appearance:none;flex:0 0 auto;scroll-snap-align:start;border:1px solid var(--line2);background:#fff;border-radius:12px;padding:7px 8px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;width:88px;}
.vsroot .vs .pcard.on{border-color:var(--gold);box-shadow:0 0 0 1.5px var(--gold);}
.vsroot .vs .pthumb{width:66px;height:48px;background-size:contain;background-repeat:no-repeat;background-position:center;}
.vsroot .vs .collapsible .animhdr{display:flex;align-items:center;cursor:pointer;user-select:none;}
.vsroot .vs .collapsible .animhdr .chev{margin-left:auto;color:var(--gold-deep);font-size:13px;transition:transform .2s;}
.vsroot .vs .collapsible.open .animhdr .chev{transform:rotate(90deg);}
.vsroot .vs .collapsible .animbody{display:none;flex-direction:column;gap:10px;margin-top:11px;}
.vsroot .vs .collapsible.open .animbody{display:flex;}
.vsroot .vs .replaybtn{position:absolute;right:12px;bottom:12px;z-index:2;-webkit-appearance:none;appearance:none;border:1px solid var(--line2);background:rgba(251,251,250,.92);border-radius:999px;padding:8px 14px;font-family:var(--font-hanken),system-ui,sans-serif;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;box-shadow:0 1px 6px rgba(30,34,41,.10);}
.vsroot .vs .replaybtn.off{display:none;}
.vsroot .vs .drawtoggle{-webkit-appearance:none;appearance:none;border:1px dashed var(--gold)!important;background:#FBF6EA!important;border-radius:10px;padding:10px 14px;font-family:var(--font-hanken),system-ui,sans-serif;font-size:13px;font-weight:600;color:var(--gold-deep)!important;cursor:pointer;text-align:left;}
.vsroot .vs .drawtoggle.on{background:#1E2229!important;color:#FBFBFA!important;border-style:solid;border-color:#1E2229!important;}
.vsroot .vs .shelfnote{font-size:12px;color:var(--ink-soft);border:1px dashed var(--line2);border-radius:10px;padding:10px 12px;}
/* Desktop two-column workspace — unchanged geometry from v1 (§2.1). */
@container (min-width:760px){
  .vsroot .vs .frame{max-width:none;padding:0;}
  .vsroot .vs .card{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,380px);grid-template-rows:auto clamp(460px,72vh,900px);grid-template-areas:"top top" "canvas panel";}
  .vsroot .vs .top{grid-area:top;}
  .vsroot .vs .sw2{grid-area:canvas;min-height:0;height:100%;border-right:1px solid var(--line);}
  .vsroot .vs canvas{height:100%;}
  .vsroot .vs .panel{grid-area:panel;min-height:0;height:100%;overflow-y:auto;border-top:none;}
}
`;

export const STUDIO_HTML_V2 = `
<h2 class="sr-only">Vector monogram studio — design your initials, then save them as your monogram.</h2>
<div class="frame"><div class="card">
  <div class="top"><span class="wm">SETNAYAN</span><span class="tag">Monogram studio</span></div>
  <div class="sw2">
    <canvas id="cv"></canvas>
    <div class="load" id="load">Loading the typeface…</div>
    <div class="zoom" id="zoom">100%</div>
    <button type="button" class="replaybtn off" id="replay">↻ Replay</button>
    <p class="hint" id="hint">Tap any letter to move it</p>
  </div>
  <div class="panel">
    <div class="vtabs" id="vtabs" role="tablist">
      <button type="button" class="vt on" data-vt="letters" role="tab" aria-selected="true">Letters</button>
      <button type="button" class="vt" data-vt="frame" role="tab" aria-selected="false">Frame</button>
      <button type="button" class="vt" data-vt="reveal" role="tab" aria-selected="false">Reveal</button>
    </div>

    <div class="vtab" id="tab-letters">
      <div id="presetstrip"></div>
      <div class="box" id="selbox" style="display:none">
        <p class="lab">Editing letter <b id="selname">J</b></p>
        <div><div class="lab2"><span>Outline · outside</span><span id="o_out">3</span></div><input type="range" id="s_outline" min="0" max="16" step="1" value="3" aria-label="Outline thickness"></div>
        <div><div class="lab2"><span>Cut gap · when on top (0 = none)</span><span id="o_gap">6</span></div><input type="range" id="s_gap" min="0" max="14" step="1" value="6" aria-label="Cut gap when this letter is on top"></div>
        <div><div class="lab2"><span>Finish · auto-clean</span><span></span></div><div class="gaprow"><button type="button" class="tg" id="s_clean">Auto-clean ✗</button><input type="range" id="s_strength" min="0" max="100" step="1" value="30" aria-label="Auto-clean strength"></div></div>
        <div class="row"><button type="button" class="tg" id="s_front">Bring to front</button><button type="button" class="tg" id="s_back">Send to back</button></div>
      </div>
      <div class="box" id="cross" style="display:none">
        <p class="lab" id="crosslab">This crossing</p>
        <div class="row"><button type="button" class="tg" data-act="merge">Combine</button><button type="button" class="tg" data-act="cut">Cut</button><button type="button" class="tg" data-act="delete">Delete</button></div>
        <div class="row" id="crosstop" style="display:none"></div>
        <div id="crossgap" style="display:none"><div class="lab2"><span>Gap · top letter <b id="cg_name"></b> (0 = none)</span><span id="cg_v"></span></div><input type="range" id="cg" min="0" max="14" step="1" aria-label="Gap under the top letter"></div>
      </div>
      <div><p class="lab">Names</p><input class="names" id="names" type="text" value="Maria &amp; Juan" autocomplete="off" aria-label="Names — the initials come from here"></div>
      <div><p class="lab">Font · 8</p><div class="row" id="fonts">
        <button type="button" class="chip sel" data-f="cardo">Cardo</button>
        <button type="button" class="chip" data-f="gilda">Gilda</button>
        <button type="button" class="chip" data-f="playfairsc">Playfair</button>
        <button type="button" class="chip" data-f="marcellus">Marcellus</button>
        <button type="button" class="chip" data-f="yeseva">Yeseva</button>
        <button type="button" class="chip" data-f="cinzeldec">Cinzel Dec</button>
        <button type="button" class="chip" data-f="script">Vibes</button>
        <button type="button" class="chip" data-f="pinyon">Pinyon</button>
      </div></div>
      <div class="box">
        <p class="lab">Colours</p>
        <div class="crow">
          <span class="ckey">Ink</span>
          <div class="row swrow" id="inks">
            <button type="button" class="sw sel" data-c="#5C2542" style="background:#5C2542" aria-label="Mulberry"></button>
            <button type="button" class="sw" data-c="#8C6932" style="background:#8C6932" aria-label="Gold"></button>
            <button type="button" class="sw" data-c="#C5A059" style="background:#C5A059" aria-label="Champagne"></button>
            <button type="button" class="sw" data-c="#1E2229" style="background:#1E2229" aria-label="Obsidian"></button>
            <button type="button" class="sw" data-c="#2A3A5E" style="background:#2A3A5E" aria-label="Navy"></button>
            <button type="button" class="sw" data-c="#6E7B66" style="background:#6E7B66" aria-label="Sage"></button>
            <button type="button" class="sw" data-c="#B07A86" style="background:#B07A86" aria-label="Dusty rose"></button>
          </div>
          <label class="cust" title="Custom ink colour"><input type="color" id="ink_custom" value="#5C2542" aria-label="Custom ink colour"></label>
        </div>
        <div class="crow">
          <span class="ckey">Outline</span>
          <div class="row swrow" id="outs">
            <button type="button" class="sw sel" data-c="#C5A059" style="background:#C5A059" aria-label="Gold"></button>
            <button type="button" class="sw" data-c="#E6D2A2" style="background:#E6D2A2" aria-label="Champagne"></button>
            <button type="button" class="sw" data-c="#C9CDD2" style="background:#C9CDD2" aria-label="Silver"></button>
            <button type="button" class="sw" data-c="#5C2542" style="background:#5C2542" aria-label="Mulberry"></button>
            <button type="button" class="sw" data-c="#1E2229" style="background:#1E2229" aria-label="Ink"></button>
            <button type="button" class="sw" data-c="#FFFFFF" style="background:#fff" aria-label="White"></button>
            <button type="button" class="sw clr" data-c="none" aria-label="No outline"></button>
          </div>
          <label class="cust" title="Custom outline colour"><input type="color" id="out_custom" value="#C5A059" aria-label="Custom outline colour"></label>
        </div>
        <div class="crow">
          <span class="ckey">Backdrop</span>
          <div class="row swrow" id="bgs">
            <button type="button" class="bg sel" data-c="#FBFBFA" style="background:#FBFBFA" aria-label="Paper"></button>
            <button type="button" class="bg" data-c="#ffffff" style="background:#fff" aria-label="White"></button>
            <button type="button" class="bg" data-c="#e7dcc2" style="background:#e7dcc2" aria-label="Cream"></button>
            <button type="button" class="bg" data-c="#F6ECEC" style="background:#F6ECEC" aria-label="Blush"></button>
            <button type="button" class="bg" data-c="#E7ECE3" style="background:#E7ECE3" aria-label="Sage"></button>
            <button type="button" class="bg" data-c="#1E2229" style="background:#1E2229" aria-label="Dark"></button>
            <button type="button" class="bg clr" data-c="transparent" style="background:conic-gradient(#dcdcdc 90deg,#fff 0 180deg,#dcdcdc 0 270deg,#fff 0) 0 0/12px 12px" aria-label="Clear (transparent)"></button>
          </div>
          <label class="cust" title="Custom backdrop colour"><input type="color" id="bg_custom" value="#FBFBFA" aria-label="Custom backdrop colour"></label>
        </div>
        <p class="cap">Backdrop is just your working canvas — your saved monogram is always transparent.</p>
      </div>
    </div>

    <div class="vtab off" id="tab-frame">
      <div id="frameshelf"><p class="shelfnote">Frame patterns are on the way — for now, draw your own below.</p></div>
      <button type="button" class="drawtoggle" id="drawtoggle">✎ Draw your own — mirrored fountain pen &amp; symbols</button>
      <div class="drawtools off" id="drawtools">
        <div class="box" id="penbox">
          <p class="lab">Fountain pen · mirrored frame</p>
          <div class="row" id="nibstyle"><span class="lab2" style="margin-right:2px">Tip</span><button type="button" class="tg on" data-ns="broad">Broad</button><button type="button" class="tg" data-ns="pointed">Pointed</button><button type="button" class="tg" data-ns="monoline">Round</button><button type="button" class="tg" data-ns="brush">Brush</button></div>
          <div class="row" id="mirror"><span class="lab2" style="margin-right:2px">Mirror</span><button type="button" class="tg" data-mir="off">Off</button><button type="button" class="tg on" data-mir="v">↔ Vert</button><button type="button" class="tg" data-mir="h">↕ Horiz</button><button type="button" class="tg" data-mir="4">✦ 4-way</button></div>
          <div id="nibrow"><div class="lab2"><span>Nib angle (broad)</span><span id="nib_v">40°</span></div><input type="range" id="nib" min="0" max="90" step="1" value="40" aria-label="Nib angle"></div>
          <div><div class="lab2"><span>Nib width</span><span id="pw_v">14</span></div><input type="range" id="pw" min="3" max="34" step="1" value="14" aria-label="Nib width"></div>
          <div><div class="lab2"><span>Stamp a symbol · uses Mirror (on = frame, off = standalone)</span></div><div class="row" id="palette">
            <button type="button" class="tg symg" data-sym="dot">●</button><button type="button" class="tg symg" data-sym="ring">◯</button><button type="button" class="tg symg" data-sym="diamond">◆</button><button type="button" class="tg symg" data-sym="star">★</button><button type="button" class="tg symg" data-sym="sparkle">✦</button><button type="button" class="tg symg" data-sym="triangle">▲</button><button type="button" class="tg symg" data-sym="heart">♥</button><button type="button" class="tg symg" data-sym="leaf">❀</button>
          </div></div>
          <button type="button" class="tg" id="clearpen">Clear frame &amp; symbols</button>
        </div>
        <div class="box" id="symbox" style="display:none">
          <p class="lab">Selected symbol</p>
          <div class="row" id="symmirror"><span class="lab2" style="margin-right:2px">Mirror</span><button type="button" class="tg" data-sm="off">Off</button><button type="button" class="tg" data-sm="v">↔ Vert</button><button type="button" class="tg" data-sm="h">↕ Horiz</button><button type="button" class="tg" data-sm="4">✦ 4-way</button></div>
          <div class="row"><button type="button" class="tg" id="symdel">Delete</button><button type="button" class="tg" id="symdone">Done</button><span class="ro">Drag to move · gold dot to size/rotate</span></div>
        </div>
      </div>
    </div>

    <div class="vtab off" id="tab-reveal">
      <div class="box" id="animbox">
        <p class="lab" style="margin:0">Animate the reveal</p>
        <div class="row"><button type="button" class="tg on" data-an="handwriting">Handwriting</button><button type="button" class="tg" data-an="trace">Trace</button><button type="button" class="tg" data-an="droplet">Bloom</button><button type="button" class="tg" data-an="gold">Gold Turn</button><button type="button" class="tg" data-an="molten">Molten Gold</button><button type="button" class="mini play" id="play">Play</button></div>
        <p class="cap off" id="moltennote" style="margin:0">Molten Gold needs a newer phone — older ones see Gold Turn instead.</p>
        <div class="row" id="tempo"><span class="lab2" style="margin-right:2px">Tempo</span><button type="button" class="tg" data-tp="quick">Quick</button><button type="button" class="tg on" data-tp="classic">Classic</button><button type="button" class="tg" data-tp="ceremonial">Ceremonial</button></div>
        <div class="collapsible" id="finetune">
          <div class="animhdr" id="fthdr"><p class="lab" style="margin:0">Fine-tune<span class="chev">▸</span></p></div>
          <div class="animbody">
            <div><div class="lab2"><span>Speed · drawing pace</span><span id="dur_v">6.0s</span></div><div class="gaprow"><span class="ro">Fast</span><input type="range" id="dur" min="10" max="150" step="5" value="60" aria-label="Animation speed"><span class="ro">Slow</span></div></div>
            <div><div class="lab2"><span>Delay · between letter starts</span><span id="dl_v">0.3s</span></div><div class="gaprow"><span class="ro">0s</span><input type="range" id="dl" min="0" max="20" step="1" value="3" aria-label="Delay between letter starts"><span class="ro">2s</span></div></div>
            <div><div class="lab2"><span>Smoothness</span><span id="sm_v">90%</span></div><div class="gaprow"><span class="ro">Linear</span><input type="range" id="smooth" min="0" max="100" step="1" value="90" aria-label="Animation smoothness"><span class="ro">Silky</span></div></div>
          </div>
        </div>
        <p class="cap" style="margin:0"><b>Animate the reveal</b> picks how your monogram appears on your website.</p>
      </div>
    </div>

    <div class="foot"><span class="ro" id="ro" aria-live="polite">Loading…</span>
      <div class="btns">
        <button type="button" class="mini" id="undo" disabled>Undo</button>
        <button type="button" class="mini" id="redo" disabled>Redo</button>
        <button type="button" class="mini" id="more" aria-label="More tools">⋯</button>
        <span class="morebox off" id="morebox"><button type="button" class="mini" id="fit">Fit</button><button type="button" class="mini" id="reset">Reset</button></span>
      </div></div>
  </div>
</div></div>
`;
