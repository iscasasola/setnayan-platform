/**
 * lib/monogram-studio/markup.ts
 *
 * The Vector Monogram Studio's editor DOM (STUDIO_HTML) + scoped styling
 * (STUDIO_CSS), shared verbatim by the couple-facing dashboard studio AND the
 * free public studio on www.setnayan.com/monogram. Inert markup injected via
 * dangerouslySetInnerHTML into a `.vsroot` container; the engine
 * (lib/monogram-studio/engine.mountStudio) drives it. Extracted here so both
 * variants render the identical editor with no duplication.
 */

export const STUDIO_CSS = `
.vsroot .vs{--paper:#FBFBFA;--ink:#1E2229;--ink-soft:#5F5E5A;--line:#E7E1D6;--line2:#D9D2C4;--gold:#C5A059;--gold-deep:#8C6932;--mulberry:#5C2542;font-family:'Manrope',system-ui,sans-serif;color:#1E2229;}
.vsroot .vs .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}
.vsroot .vs .frame{background:#ECE7DD;border-radius:18px;padding:16px;max-width:430px;margin:0 auto;}
.vsroot .vs .card{background:#FBFBFA;border:1px solid var(--line);border-radius:16px;overflow:hidden;}
.vsroot .vs .top{display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid var(--line);}
.vsroot .vs .wm{font-family:'DM Mono',ui-monospace,monospace;font-size:12px;letter-spacing:.3em;font-weight:500;color:#1E2229;}
.vsroot .vs .tag{margin-left:auto;font-family:'DM Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;color:var(--gold-deep);text-transform:uppercase;}
.vsroot .vs .sw2{position:relative;}
.vsroot .vs canvas{display:block;width:100%;height:300px;touch-action:none;background:#FBFBFA;}
.vsroot .vs .load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',ui-monospace,monospace;font-size:12px;color:var(--ink-soft);background:rgba(251,251,250,.9);}
.vsroot .vs .load.off{display:none;}
.vsroot .vs .zoom{position:absolute;top:10px;right:12px;font-family:'DM Mono',ui-monospace,monospace;font-size:11px;color:var(--ink-soft);background:rgba(251,251,250,.7);padding:2px 7px;border-radius:6px;pointer-events:none;}
.vsroot .vs .hint{position:absolute;left:0;right:0;bottom:12px;text-align:center;font-size:12px;color:var(--ink-soft);font-family:'DM Mono',ui-monospace,monospace;pointer-events:none;transition:opacity .35s;padding:0 12px;margin:0;}
.vsroot .vs .panel{padding:13px 16px 16px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line);background:#FBFBFA;}
.vsroot .vs .lab{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep);margin:0 0 7px;display:flex;justify-content:space-between;align-items:baseline;}
.vsroot .vs .lab b{color:var(--mulberry);font-family:'Cardo',serif;font-style:italic;font-size:16px;font-weight:600;}
.vsroot .vs .lab2{font-family:'DM Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.06em;color:var(--ink-soft);margin:0;display:flex;justify-content:space-between;align-items:center;}
.vsroot .vs .box{border:1px solid var(--gold);background:#FBF6EA;border-radius:12px;padding:11px 13px;display:flex;flex-direction:column;gap:10px;}
.vsroot .vs .names{width:100%;-webkit-appearance:none;appearance:none;border:1px solid #D9D2C4!important;background:#fff!important;border-radius:10px;padding:11px 13px;font-family:'Manrope',system-ui,sans-serif;font-size:15px;color:#1E2229!important;}
.vsroot .vs .names:focus{outline:none;border-color:var(--gold)!important;}
.vsroot .vs .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.vsroot .vs input[type=range]{width:100%;accent-color:#5C2542;}
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
.vsroot .vs .tg.on{background:#5C2542!important;color:#FBFBFA!important;border-color:#5C2542!important;}
.vsroot .vs .tg.lg{font-family:'Cardo',serif;font-style:italic;font-size:17px;padding:4px 16px;}
.vsroot .vs .tg.symg{font-size:17px;padding:6px 12px;color:#5C2542!important;}
.vsroot .vs .sw{-webkit-appearance:none;appearance:none;width:30px;height:30px;border-radius:50%;border:1px solid #D9D2C4;cursor:pointer;padding:0;}
.vsroot .vs .sw.sel{box-shadow:0 0 0 2px #FBFBFA,0 0 0 3.5px var(--gold);}
.vsroot .vs .bg{-webkit-appearance:none;appearance:none;width:34px;height:26px;border-radius:7px;border:1px solid #D9D2C4;cursor:pointer;padding:0;}
.vsroot .vs .bg.sel{box-shadow:0 0 0 2px #FBFBFA,0 0 0 3.5px var(--mulberry);}
.vsroot .vs .foot{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding-top:12px;flex-wrap:wrap;}
.vsroot .vs .ro{font-family:'DM Mono',ui-monospace,monospace;font-size:11.5px;color:var(--ink-soft);}
.vsroot .vs .btns{display:flex;gap:8px;flex-wrap:wrap;}
.vsroot .vs .mini{-webkit-appearance:none;appearance:none;border:1px solid #D9D2C4!important;background:#fff!important;border-radius:9px;padding:8px 12px;font-size:12.5px;font-weight:500;color:#5F5E5A!important;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}
.vsroot .vs .mini.play{background:#5C2542!important;color:#FBFBFA!important;border-color:#5C2542!important;}
.vsroot .vs .mini:disabled{opacity:.4;cursor:default;}
.vsroot .vs .cap{font-size:11.5px;color:var(--ink-soft);}
.vsroot .vs .edithint{border:1px dashed var(--line2);background:#FBF9F4;border-radius:12px;padding:12px 13px;font-family:'DM Mono',ui-monospace,monospace;font-size:11.5px;line-height:1.7;color:var(--ink-soft);}
.vsroot .vs .edithint b{color:var(--mulberry);font-family:'Cardo',serif;font-style:italic;font-weight:600;font-size:14px;}
.vsroot .vs .sub{font-family:'DM Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);margin:4px 0 -4px;padding-top:6px;border-top:1px dashed var(--line);}
.vsroot .vs .collapsible .animhdr{display:flex;align-items:center;cursor:pointer;user-select:none;}
.vsroot .vs .collapsible .animhdr .chev{margin-left:auto;color:var(--gold-deep);font-size:13px;transition:transform .2s;}
.vsroot .vs .collapsible.open .animhdr .chev{transform:rotate(90deg);}
.vsroot .vs .collapsible .animbody{display:none;flex-direction:column;gap:10px;margin-top:11px;}
.vsroot .vs .collapsible.open .animbody{display:flex;}
.vsroot .vs .crow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.vsroot .vs .ckey{font-family:'DM Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);width:58px;flex:none;}
.vsroot .vs .swrow{gap:7px;}
.vsroot .vs .cust{display:inline-flex;width:30px;height:30px;border-radius:50%;border:1px dashed var(--gold);overflow:hidden;cursor:pointer;padding:0;flex:none;}
.vsroot .vs .cust input[type=color]{width:150%;height:150%;border:none;padding:0;margin:-25%;cursor:pointer;background:none;}
.vsroot .vs .cust input[type=color]::-webkit-color-swatch-wrapper{padding:0;}
.vsroot .vs .cust input[type=color]::-webkit-color-swatch{border:none;}
.vsroot .vs .cust input[type=color]::-moz-color-swatch{border:none;}
.vsroot .vs .sw.clr{background:#fff;position:relative;}
.vsroot .vs .sw.clr::after{content:'';position:absolute;left:50%;top:4px;bottom:4px;width:2px;background:#C2724C;transform:translateX(-50%) rotate(45deg);border-radius:2px;}
`;

export const STUDIO_HTML = `
<h2 class="sr-only">Vector monogram studio — design your initials, then save them as your wedding monogram.</h2>
<div class="frame"><div class="card">
  <div class="top"><span class="wm">SETNAYAN</span><span class="tag">Monogram studio · vector</span></div>
  <div class="sw2">
    <canvas id="cv"></canvas>
    <div class="load" id="load">Loading the typeface…</div>
    <div class="zoom" id="zoom">100%</div>
    <p class="hint" id="hint">Tap a letter to edit · Draw frame · animate</p>
  </div>
  <div class="panel">
    <div class="row" id="modes"><button type="button" class="tg on" data-m="arrange">Arrange</button><button type="button" class="tg" data-m="draw">Draw frame</button></div>
    <div class="edithint" id="edithint"><b>Tap to fix the mark.</b><br>Tap a letter to restyle it · tap where two letters cross to weave or merge them · drag to move · pinch / scroll to size · gold dot to rotate · double-tap a letter to reset.</div>
    <div class="box" id="selbox" style="display:none">
      <p class="lab">Editing letter <b id="selname">J</b></p>
      <div><div class="lab2"><span>Outline · outside</span><span id="o_out">3</span></div><input type="range" id="s_outline" min="0" max="16" step="1" value="3"></div>
      <div><div class="lab2"><span>Cut gap · when on top (0 = none)</span><span id="o_gap">6</span></div><input type="range" id="s_gap" min="0" max="14" step="1" value="6"></div>
      <div><div class="lab2"><span>Finish · auto-clean</span><span></span></div><div class="gaprow"><button type="button" class="tg" id="s_clean">Auto-clean ✗</button><input type="range" id="s_strength" min="0" max="100" step="1" value="30"></div></div>
      <div class="row"><button type="button" class="tg" id="s_front">Bring to front</button><button type="button" class="tg" id="s_back">Send to back</button></div>
    </div>
    <div class="box" id="cross" style="display:none">
      <p class="lab" id="crosslab">This crossing</p>
      <div class="row"><button type="button" class="tg" data-act="merge">Combine</button><button type="button" class="tg" data-act="cut">Cut</button><button type="button" class="tg" data-act="delete">Delete</button></div>
      <div class="row" id="crosstop" style="display:none"></div>
      <div id="crossgap" style="display:none"><div class="lab2"><span>Gap · top letter <b id="cg_name"></b> (0 = none)</span><span id="cg_v"></span></div><input type="range" id="cg" min="0" max="14" step="1"></div>
    </div>
    <div class="box" id="penbox" style="display:none">
      <p class="lab">Fountain pen · mirrored frame</p>
      <div class="row" id="nibstyle"><span class="lab2" style="margin-right:2px">Tip</span><button type="button" class="tg on" data-ns="broad">Broad</button><button type="button" class="tg" data-ns="pointed">Pointed</button><button type="button" class="tg" data-ns="monoline">Round</button><button type="button" class="tg" data-ns="brush">Brush</button></div>
      <div class="row" id="mirror"><span class="lab2" style="margin-right:2px">Mirror</span><button type="button" class="tg" data-mir="off">Off</button><button type="button" class="tg on" data-mir="v">↔ Vert</button><button type="button" class="tg" data-mir="h">↕ Horiz</button><button type="button" class="tg" data-mir="4">✦ 4-way</button></div>
      <div id="nibrow"><div class="lab2"><span>Nib angle (broad)</span><span id="nib_v">40°</span></div><input type="range" id="nib" min="0" max="90" step="1" value="40"></div>
      <div><div class="lab2"><span>Nib width</span><span id="pw_v">14</span></div><input type="range" id="pw" min="3" max="34" step="1" value="14"></div>
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
    <p class="sub">Setup</p>
    <div><p class="lab">Names</p><input class="names" id="names" type="text" value="Maria &amp; Juan" autocomplete="off"></div>
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
    <div class="box collapsible" id="animbox">
      <div class="animhdr" id="animhdr"><p class="lab" style="margin:0">Preview · animate the reveal<span class="chev">▸</span></p></div>
      <div class="animbody">
        <div class="row"><button type="button" class="tg on" data-an="handwriting">Handwriting</button><button type="button" class="tg" data-an="trace">Trace</button><button type="button" class="tg" data-an="droplet">Droplet</button><button type="button" class="mini play" id="play">Play</button></div>
        <div><div class="lab2"><span>Speed · drawing pace</span><span id="dur_v">6.0s</span></div><div class="gaprow"><span class="ro">Fast</span><input type="range" id="dur" min="10" max="150" step="5" value="60"><span class="ro">Slow</span></div></div>
        <div><div class="lab2"><span>Delay · before next letter</span><span id="dl_v">0.3s</span></div><div class="gaprow"><span class="ro">0s</span><input type="range" id="dl" min="0" max="20" step="1" value="3"><span class="ro">2s</span></div></div>
        <div><div class="lab2"><span>Smoothness</span><span id="sm_v">90%</span></div><div class="gaprow"><span class="ro">Linear</span><input type="range" id="smooth" min="0" max="100" step="1" value="90"><span class="ro">Silky</span></div></div>
      </div>
    </div>
    <p class="cap">Everything is real vector — crisp at any size, transparent-ready, animatable. Tap to fix the mark; open <b>Preview</b> to animate the reveal.</p>
    <div class="foot"><span class="ro" id="ro">Loading…</span>
      <div class="btns">
        <button type="button" class="mini" id="undo" disabled>Undo</button>
        <button type="button" class="mini" id="redo" disabled>Redo</button>
        <button type="button" class="mini" id="fit">Fit</button>
        <button type="button" class="mini" id="reset">Reset</button>
      </div></div>
  </div>
</div></div>
`;
