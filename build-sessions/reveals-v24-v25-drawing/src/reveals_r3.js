(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), cover = $('cover'), stateEl = $('state'), go = $('go'), shelf = $('shelf'), cur = 'veil', ids = {};
  function fail() { $('fallback').hidden = false; stateEl.hidden = true; go.hidden = true; cv.hidden = true; shelf.hidden = true; }
  if (!window.THREE || !window.RV) return fail();
  try { RV.mount(cv); } catch (e) { return fail(); }
  function say(state) {
    var m = RV_META[cur];
    if (state === 'closed') { stateEl.textContent = m.hint; go.textContent = cur === 'scratch' ? 'Scratch it for me' : 'Open it'; cv.style.pointerEvents = 'auto'; }
    else if (state === 'opening') { stateEl.textContent = 'Opening, at the veil’s pace…'; go.textContent = 'Close it again'; }
    else { stateEl.textContent = 'Open. This is the Event Hub cover the guest lands on.'; go.textContent = 'Close it again'; cv.style.pointerEvents = 'none'; }
    go.disabled = false;
  }
  RV.onstate = function (state) { say(state); };
  RV.onprogress = function (p) { if (RV.state() === 'closed') stateEl.textContent = Math.round(p * 100) + '% scratched. It opens at 60%.'; };
  /* this reveal's own options: one dropdown each. A change rebuilds the reveal, closed, in the new look */
  var optsEl = $('opts');
  function drawOpts(name) {
    var list = RV.OPTIONS[name] || []; optsEl.textContent = ''; optsEl.hidden = !list.length;
    list.forEach(function (o) {
      var lab = document.createElement('label'), sp = document.createElement('span'), sel = document.createElement('select'); lab.className = 'opt'; sp.textContent = o.label; sel.dataset.k = o.key;
      o.choices.forEach(function (c) { var op = document.createElement('option'); op.value = c[0]; op.textContent = c[1]; if (RV.opts[name][o.key] === c[0]) op.selected = true; sel.appendChild(op); });
      lab.appendChild(sp); lab.appendChild(sel); optsEl.appendChild(lab);
    });
  }
  optsEl.addEventListener('change', function (e) { var s = e.target; if (!s.dataset || !s.dataset.k) return; RV.opts[cur][s.dataset.k] = s.value; try { RV.select(cur); } catch (x) { fail(); } });
  function pick(name) {
    if (name !== cur || !optsEl.childNodes.length) drawOpts(name);
    cur = name;
    [].forEach.call(shelf.querySelectorAll('.tile'), function (b) { var on = b.dataset.r === name; b.setAttribute('aria-pressed', on ? 'true' : 'false'); if (on) shelf.scrollTo({ left: b.offsetLeft - shelf.clientWidth / 2 + b.clientWidth / 2, behavior: 'smooth' }); });
    cover.style.backgroundImage = 'url(' + window.TEX[RV_META[name].cover] + ')';
    cv.style.touchAction = RV_META[name].drag ? 'none' : 'pan-y';
    try { RV.select(name); } catch (e) { fail(); }
  }
  shelf.addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (b) pick(b.dataset.r); });
  go.addEventListener('click', function () { if (RV.state() === 'closed') RV.play(); else pick(cur); });
  var speed = $('speed'); RV.setSpeed(12);
  speed.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; [].forEach.call(speed.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); RV.setSpeed(+b.dataset.s); pick(cur); });
  /* the envelopes: the card inside is a little smaller than the envelope, and grows to fill the screen as you move in */
  RV.onlift = function (l) { var z = RV_META[cur].zoom, k = Math.max(0, Math.min(1, (l - .3) / .7)); cover.style.transform = z ? 'scale(' + (.9 + .1 * k * k * (3 - 2 * k)) + ')' : 'none'; $('ph').style.background = z ? '#ece3d2' : ''; };
  function at(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2]; }
  cv.addEventListener('pointerdown', function (e) { ids[e.pointerId] = 1; try { cv.setPointerCapture(e.pointerId); } catch (x) {} var p = at(e); RV.down(e.pointerId, p[0], p[1]); });
  cv.addEventListener('pointermove', function (e) { if (!ids[e.pointerId]) return; var p = at(e); RV.move(e.pointerId, p[0], p[1]); });
  ['pointerup', 'pointercancel'].forEach(function (k) { cv.addEventListener(k, function (e) { if (!ids[e.pointerId]) return; delete ids[e.pointerId]; var p = at(e); RV.up(e.pointerId, p[0], p[1]); }); });
  var seen = true; function pause() { RV.paused = !seen || document.hidden; }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; pause(); }, { threshold: .05 }).observe($('ph'));
  document.addEventListener('visibilitychange', pause);
  pick(cur);
})();
