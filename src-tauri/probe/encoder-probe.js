// S0 spike probe — build-sessions/encoder/S0.md Questions 1 and 2.
//
// Evaluated by src-tauri/src/probe.rs (DEBUG builds only, and only when the
// SETNAYAN_PROBE env var is set) after https://setnayan.com finishes loading
// inside the real Tauri webview. Every record goes to the app's stdout through
// the `probe_report` command; src-tauri/probe/run.sh captures that to a log.
//
// Modes (window.__SETNAYAN_PROBE_MODE__, set by probe.rs from SETNAYAN_PROBE):
//   matrix  — Q1 feature/codec matrix only (~2 s)
//   ipc     — matrix + Q2: 60 s of 30 invokes/s × 10 KB Uint8Array, then a forced
//             CSP without ipc:/http://ipc.localhost and 10 s more (fallback proof)
//   encode  — matrix + the long encode: 1280×720 OffscreenCanvas in a worker at
//             30 fps → VideoEncoder avc1.42E01F CBR 2.5 Mbps, keyframe every 60,
//             10-s reports. Duration from SETNAYAN_PROBE_MINUTES (default 60).
(async function s0probe() {
  'use strict';
  if (window.__S0_PROBE_RAN__) return;
  window.__S0_PROBE_RAN__ = true;

  const MODE = String(window.__SETNAYAN_PROBE_MODE__ || 'matrix');
  const ENCODE_MINUTES = Number(window.__SETNAYAN_PROBE_MINUTES__ || 60);
  const SETTLE_S = Number(window.__SETNAYAN_PROBE_SETTLE_S__ || 0);
  const LOOPBACK_PORT = window.__SETNAYAN_PROBE_LOOPBACK_PORT__ || null;
  const tauri = window.__TAURI__;
  const invoke = tauri && tauri.core && tauri.core.invoke;
  const t0 = performance.now();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function log(stage, data) {
    const rec = Object.assign(
      { stage, ms: Math.round(performance.now() - t0), visibility: document.visibilityState },
      data || {}
    );
    const json = JSON.stringify(rec);
    console.log('[s0-probe]', json);
    if (!invoke) { sideChannel({ stage: 'no-invoke', rec }); return Promise.resolve(); }
    return invoke('probe_report', { json }).catch((e) => {
      console.error('[s0-probe] probe_report failed', e);
      // Side channel: when the invoke itself fails, the record would otherwise vanish
      // (console output never reaches the runner's log). Debug-only loopback listener.
      return sideChannel({ stage: 'probe_report-failed', error: String(e), rec });
    });
  }
  // Fire-and-forget POST to the loopback `/diag` path (printed verbatim by probe.rs).
  function sideChannel(obj) {
    if (!LOOPBACK_PORT) return Promise.resolve();
    try {
      return fetch('http://127.0.0.1:' + LOOPBACK_PORT + '/diag', {
        method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'text/plain' },
      }).catch(() => {});
    } catch (_) { return Promise.resolve(); }
  }

  if (!invoke) {
    console.error('[s0-probe] window.__TAURI__.core.invoke is missing — withGlobalTauri off?');
    sideChannel({ stage: 'no-invoke', href: location.href, hasTauri: !!tauri });
    return;
  }

  // --- transport diagnostics, BEFORE the first invoke ---
  // Tauri's ipc-protocol.js surfaces the reason for a custom-protocol failure only
  // through console.warn, so capture it; and try the ipc:// URL directly with and
  // without the headers Tauri sends, with a CSP-violation listener already armed,
  // so a failure is attributable (CSP vs. network/mixed-content vs. CORS).
  const tauriWarnings = [];
  const cspViolations = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    cspViolations.push({ blockedURI: e.blockedURI, directive: e.effectiveDirective, disposition: e.disposition });
  });
  const originalWarn = console.warn.bind(console);
  console.warn = function (...args) {
    try {
      if (String(args[0]).indexOf('IPC custom protocol failed') === 0) {
        tauriWarnings.push(args.map((a) => (a && a.stack) ? String(a) + ' @ ' + a.stack.split('\n')[0] : String(a)).join(' | '));
      }
    } catch (_) {}
    return originalWarn(...args);
  };
  const ipcUrl = window.__TAURI_INTERNALS__.convertFileSrc('probe_report', 'ipc');
  async function diagFetch(label, init) {
    try {
      const r = await fetch(ipcUrl, init);
      const text = await r.text().catch(() => '');
      return { label, ok: r.ok, status: r.status, type: r.type, tauriResponse: r.headers.get('Tauri-Response'), body: text.slice(0, 120) };
    } catch (e) {
      return { label, error: String(e) };
    }
  }
  const diag = [];
  diag.push(await diagFetch('POST no custom headers (no preflight)', { method: 'POST', body: '{}' }));
  diag.push(await diagFetch('POST with Tauri headers (preflight)', {
    method: 'POST', body: '{}',
    headers: { 'Content-Type': 'application/json', 'Tauri-Callback': '1', 'Tauri-Error': '2', 'Tauri-Invoke-Key': 'bogus' },
  }));
  diag.push(await diagFetch('POST mode=no-cors', { method: 'POST', body: '{}', mode: 'no-cors' }));
  diag.push(await diagFetch('GET', { method: 'GET' }));
  let xhrResult;
  try {
    xhrResult = await new Promise((resolve) => {
      const x = new XMLHttpRequest();
      x.open('POST', ipcUrl);
      x.onload = () => resolve({ status: x.status, body: String(x.responseText).slice(0, 120) });
      x.onerror = () => resolve({ error: 'xhr onerror', status: x.status });
      x.send('{}');
    });
  } catch (e) { xhrResult = { error: String(e) }; }

  await log('start', {
    ipcUrl,
    directFetch: diag,
    xhr: xhrResult,
    cspViolationsBeforeFirstInvoke: cspViolations.slice(),
    mode: MODE,
    href: location.href,
    origin: location.origin,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    devicePixelRatio: window.devicePixelRatio,
  });
  await log('first-invoke-transport', {
    tauriFallbackWarnings: tauriWarnings.slice(),
    cspViolationsSoFar: cspViolations.length,
  });

  // Measured 2026-09-05: /login hard-redirects to /dashboard ~17 s after load when a
  // session exists, unloading the document and killing whatever the probe was
  // measuring. The Rust side re-evaluates on the next page load, so the FIRST
  // instance must not start a long measurement before the page has settled.
  window.addEventListener('pagehide', () => { log('pagehide', { href: location.href }); });
  if (SETTLE_S > 0 && MODE !== 'matrix') {
    await log('settling', { seconds: SETTLE_S, href: location.href });
    await sleep(SETTLE_S * 1000);
    await log('settled', { href: location.href });
  }

  // ------------------------------------------------------------------ Q1 matrix
  const VIDEO_720 = {
    codec: 'avc1.42E01F',
    width: 1280,
    height: 720,
    bitrate: 2_500_000,
    framerate: 30,
  };
  const VIDEO_1080 = Object.assign({}, VIDEO_720, { width: 1920, height: 1080 });

  async function videoSupport(cfg) {
    if (typeof VideoEncoder !== 'function') return { supported: null, error: 'VideoEncoder undefined' };
    try {
      const r = await VideoEncoder.isConfigSupported(cfg);
      return { supported: r.supported, config: r.config };
    } catch (e) {
      return { supported: null, error: String(e) };
    }
  }
  async function audioSupport(cfg) {
    if (typeof AudioEncoder !== 'function') return { supported: null, error: 'AudioEncoder undefined' };
    try {
      const r = await AudioEncoder.isConfigSupported(cfg);
      return { supported: r.supported, config: r.config };
    } catch (e) {
      return { supported: null, error: String(e) };
    }
  }

  async function matrix() {
    await log('matrix-globals', {
      VideoEncoder: typeof VideoEncoder,
      AudioEncoder: typeof AudioEncoder,
      VideoFrame: typeof VideoFrame,
      AudioData: typeof AudioData,
      EncodedVideoChunk: typeof EncodedVideoChunk,
      EncodedAudioChunk: typeof EncodedAudioChunk,
      MediaStreamTrackProcessor_window: typeof MediaStreamTrackProcessor,
      MediaStreamTrackGenerator_window: typeof MediaStreamTrackGenerator,
      OffscreenCanvas: typeof OffscreenCanvas,
      AudioWorklet: typeof AudioWorklet,
      AudioWorkletNode: typeof AudioWorkletNode,
      audioWorklet_on_AudioContext:
        typeof AudioContext === 'function' && 'audioWorklet' in AudioContext.prototype,
      Worker: typeof Worker,
      SharedArrayBuffer: typeof SharedArrayBuffer,
      crossOriginIsolated: self.crossOriginIsolated,
    });

    const video = {};
    video['720p_require_hardware'] = await videoSupport(
      Object.assign({}, VIDEO_720, { hardwareAcceleration: 'require-hardware' })
    );
    video['720p_prefer_hardware'] = await videoSupport(
      Object.assign({}, VIDEO_720, { hardwareAcceleration: 'prefer-hardware' })
    );
    video['720p_no_preference'] = await videoSupport(VIDEO_720);
    video['1080p_require_hardware'] = await videoSupport(
      Object.assign({}, VIDEO_1080, { hardwareAcceleration: 'require-hardware' })
    );
    video['1080p_prefer_hardware'] = await videoSupport(
      Object.assign({}, VIDEO_1080, { hardwareAcceleration: 'prefer-hardware' })
    );
    // The exact config the long encode uses — shows which fields WebKit keeps.
    video['720p_encode_config'] = await videoSupport(
      Object.assign({}, VIDEO_720, {
        hardwareAcceleration: 'prefer-hardware',
        bitrateMode: 'constant',
        latencyMode: 'realtime',
        avc: { format: 'annexb' },
      })
    );
    await log('matrix-video', video);

    const audio = {};
    audio['aac_lc_48k_stereo'] = await audioSupport({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
    });
    audio['aac_lc_48k_stereo_128k'] = await audioSupport({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000,
    });
    audio['opus_48k_stereo'] = await audioSupport({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
    });
    await log('matrix-audio', audio);

    // Same globals + isConfigSupported from inside a dedicated worker.
    const workerSrc = `
      (async () => {
        const out = {
          VideoEncoder: typeof VideoEncoder,
          AudioEncoder: typeof AudioEncoder,
          VideoFrame: typeof VideoFrame,
          MediaStreamTrackProcessor_worker: typeof MediaStreamTrackProcessor,
          OffscreenCanvas_worker: typeof OffscreenCanvas,
        };
        try {
          const c = new OffscreenCanvas(64, 64);
          out.offscreen_2d_context = typeof c.getContext('2d');
        } catch (e) { out.offscreen_2d_context = 'error: ' + e; }
        try {
          const r = await VideoEncoder.isConfigSupported(${JSON.stringify(
            Object.assign({}, VIDEO_720, { hardwareAcceleration: 'prefer-hardware' })
          )});
          out.video_720p_prefer_hardware = { supported: r.supported, config: r.config };
        } catch (e) { out.video_720p_prefer_hardware = 'error: ' + e; }
        try {
          const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2 });
          out.audio_aac = { supported: r.supported, config: r.config };
        } catch (e) { out.audio_aac = 'error: ' + e; }
        postMessage(out);
      })();
    `;
    const workerResult = await new Promise((resolve) => {
      let worker;
      try {
        worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' })));
      } catch (e) {
        resolve({ error: 'worker construction failed: ' + e });
        return;
      }
      const timer = setTimeout(() => resolve({ error: 'worker timeout 10s' }), 10_000);
      worker.onmessage = (e) => { clearTimeout(timer); resolve(e.data); worker.terminate(); };
      worker.onerror = (e) => { clearTimeout(timer); resolve({ error: 'worker error: ' + (e.message || e) }); };
    });
    await log('matrix-worker', workerResult);
  }

  // ------------------------------------------------------------------ Q2 IPC
  async function ipcRun(label, seconds, rate) {
    const payload = new Uint8Array(10_240);
    for (let i = 0; i < payload.length; i++) payload[i] = i & 255;
    const interval = 1000 / rate;
    const latencies = [];
    const kinds = {};
    let sent = 0, errors = 0, inflight = 0, inflightMax = 0;
    const pending = [];
    const start = performance.now();
    const end = start + seconds * 1000;
    while (performance.now() < end) {
      const due = start + sent * interval;
      const now = performance.now();
      if (now < due) await sleep(due - now);
      sent++;
      const s = performance.now();
      inflight++;
      inflightMax = Math.max(inflightMax, inflight);
      pending.push(
        invoke('probe_ipc', payload)
          .then(
            (r) => { latencies.push(performance.now() - s); kinds[r] = (kinds[r] || 0) + 1; },
            (e) => { errors++; const k = 'error:' + String(e).slice(0, 120); kinds[k] = (kinds[k] || 0) + 1; }
          )
          .finally(() => { inflight--; })
      );
    }
    await Promise.all(pending);
    const elapsedMs = performance.now() - start;
    latencies.sort((a, b) => a - b);
    const q = (p) => (latencies.length ? +latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))].toFixed(3) : null);
    const mean = latencies.length ? +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3) : null;
    return log('ipc-' + label, {
      payloadBytes: payload.length,
      targetRate: rate,
      seconds,
      sent,
      completed: latencies.length,
      errors,
      achievedRate: +(sent / (elapsedMs / 1000)).toFixed(2),
      kinds,
      latencyMs: { mean, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) },
      inflightMax,
      elapsedMs: Math.round(elapsedMs),
    });
  }

  // Third arm: raw POST bodies to the debug-only loopback listener on 127.0.0.1.
  async function loopbackRun(label, seconds, rate) {
    if (!LOOPBACK_PORT) { await log('loopback-' + label, { skipped: 'no loopback port' }); return; }
    const url = 'http://127.0.0.1:' + LOOPBACK_PORT + '/probe';
    const payload = new Uint8Array(10_240);
    for (let i = 0; i < payload.length; i++) payload[i] = i & 255;
    const interval = 1000 / rate;
    const latencies = [];
    const kinds = {};
    let sent = 0, errors = 0, inflight = 0, inflightMax = 0;
    const pending = [];
    const start = performance.now();
    const end = start + seconds * 1000;
    while (performance.now() < end) {
      const due = start + sent * interval;
      const now = performance.now();
      if (now < due) await sleep(due - now);
      sent++;
      const s = performance.now();
      inflight++;
      inflightMax = Math.max(inflightMax, inflight);
      pending.push(
        fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/octet-stream' } })
          .then((r) => r.text().then((t) => (r.ok ? t : 'http:' + r.status)))
          .then(
            (r) => { latencies.push(performance.now() - s); kinds[r] = (kinds[r] || 0) + 1; },
            (e) => { errors++; const k = 'error:' + String(e).slice(0, 120); kinds[k] = (kinds[k] || 0) + 1; }
          )
          .finally(() => { inflight--; })
      );
    }
    await Promise.all(pending);
    const elapsedMs = performance.now() - start;
    latencies.sort((a, b) => a - b);
    const q = (p) => (latencies.length ? +latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))].toFixed(3) : null);
    const mean = latencies.length ? +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3) : null;
    return log('loopback-' + label, {
      url, payloadBytes: payload.length, targetRate: rate, seconds, sent, completed: latencies.length, errors,
      achievedRate: +(sent / (elapsedMs / 1000)).toFixed(2), kinds,
      latencyMs: { mean, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) },
      inflightMax, elapsedMs: Math.round(elapsedMs),
    });
  }

  // Fourth arm: can this origin open a WebSocket to 127.0.0.1 at all? The loopback
  // listener does not speak WebSocket; it logs the handshake it receives and answers
  // 405, so "close code 1006 AND Rust logged websocket-handshake-received" means the
  // page was ALLOWED to connect (no mixed-content block), while "error/close with NO
  // Rust line" means WebKit refused before opening the socket.
  async function websocketProbe() {
    if (!LOOPBACK_PORT) { await log('loopback-websocket', { skipped: 'no loopback port' }); return; }
    const url = 'ws://127.0.0.1:' + LOOPBACK_PORT + '/ws';
    const violations = [];
    const onV = (e) => { if (String(e.blockedURI).indexOf('ws') === 0 || String(e.blockedURI).indexOf('127.0.0.1') >= 0) violations.push({ blockedURI: e.blockedURI, directive: e.effectiveDirective, disposition: e.disposition }); };
    document.addEventListener('securitypolicyviolation', onV);
    const s = performance.now();
    const result = await new Promise((resolve) => {
      let ws;
      const events = [];
      try { ws = new WebSocket(url); } catch (e) { resolve({ constructorError: String(e) }); return; }
      const timer = setTimeout(() => { try { ws.close(); } catch (_) {} resolve({ events, timeout: true }); }, 5000);
      ws.onopen = () => events.push({ ev: 'open', ms: +(performance.now() - s).toFixed(1) });
      ws.onerror = () => events.push({ ev: 'error', ms: +(performance.now() - s).toFixed(1) });
      ws.onclose = (e) => { events.push({ ev: 'close', code: e.code, wasClean: e.wasClean, reason: e.reason, ms: +(performance.now() - s).toFixed(1) }); clearTimeout(timer); resolve({ events }); };
    });
    await sleep(100);
    document.removeEventListener('securitypolicyviolation', onV);
    await log('loopback-websocket', Object.assign({ url, pageOrigin: location.origin, violations }, result));
  }

  async function ipc() {
    // Baseline: what CSP does the live page ship, and does the IPC URL resolve?
    const metas = Array.from(document.querySelectorAll('meta[http-equiv]')).map((m) => ({
      httpEquiv: m.httpEquiv, content: m.content.slice(0, 200),
    }));
    await log('ipc-baseline', {
      ipcUrl: window.__TAURI_INTERNALS__.convertFileSrc('probe_ipc', 'ipc'),
      existingMetaCsp: metas,
    });
    await ipcRun('raw-60s', 60, 30);
    await loopbackRun('raw-60s', 60, 30);
    await websocketProbe();

    // Forced CSP: a policy whose connect-src has NO ipc: / http://ipc.localhost.
    // Every fetch to ipc://localhost is then a CSP violation; Tauri's
    // ipc-protocol.js sets customProtocolIpcFailed = true on the first one and
    // never clears it, so every later payload is JSON.stringify'd (Uint8Array →
    // Array.from) and delivered through window.ipc.postMessage.
    const violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      violations.push({
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        effectiveDirective: e.effectiveDirective,
        disposition: e.disposition,
        originalPolicy: e.originalPolicy,
      });
    });
    const csp = "connect-src 'self' https: wss:";
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = csp;
    document.head.appendChild(meta);
    await log('ipc-csp-injected', { csp });
    // One direct fetch so the FIRST violation is attributable, then 10 s at 30/s.
    let directFetch;
    try {
      const r = await fetch(window.__TAURI_INTERNALS__.convertFileSrc('probe_report', 'ipc'), { method: 'POST', body: '{}' });
      directFetch = { ok: r.ok, status: r.status };
    } catch (e) {
      directFetch = { error: String(e) };
    }
    await sleep(100);
    await log('ipc-csp-direct-fetch', { directFetch, violations: violations.slice(0, 3), violationCount: violations.length });
    await ipcRun('after-csp-10s', 10, 30);
    // The forced CSP above ("connect-src 'self' https: wss:") also excludes
    // http://127.0.0.1 — so this arm must now FAIL, proving the loopback path is
    // CSP-governed like any other connect-src target (S5 must allow-list it).
    await loopbackRun('after-csp-10s', 10, 30);
    await log('ipc-csp-violations', { violationCount: violations.length, first: violations[0] || null });
  }

  // ------------------------------------------------------------------ long encode
  function encodeWorkerSource() {
    return `
      const W = 1280, H = 720, FPS = 30, KEY_EVERY = 60;
      const INTERVAL = 1000 / FPS;
      const CONFIG = {
        codec: 'avc1.42E01F', width: W, height: H, bitrate: 2500000, framerate: FPS,
        bitrateMode: 'constant', latencyMode: 'realtime',
        hardwareAcceleration: 'prefer-hardware', avc: { format: 'annexb' },
      };
      const post = (stage, data) => postMessage(Object.assign({ stage }, data));
      let canvas, ctx, encoder;
      let frames = 0, chunks = 0, bytes = 0, keyframes = 0, skipped = 0, backpressureDrops = 0, late = 0;
      let maxQueueEver = 0, errors = 0;
      let win = fresh();
      let firstChunkTs = null, lastChunkTs = null, firstChunkAt = null, lastChunkAt = null;
      let firstFrameTs = null, lastFrameTs = null;
      function fresh() { return { frames: 0, chunks: 0, bytes: 0, late: 0, skipped: 0, drops: 0, maxQueue: 0, startedAt: performance.now() }; }
      function draw(i) {
        ctx.fillStyle = '#' + ((i * 37) & 0xff).toString(16).padStart(2, '0') + '2244';
        ctx.fillRect(0, 0, W, H);
        for (let k = 0; k < 24; k++) {
          const x = ((i * (3 + k)) + k * 97) % (W + 160) - 80;
          const y = ((i * (2 + (k % 5))) + k * 53) % (H + 160) - 80;
          ctx.fillStyle = 'hsl(' + ((i * 2 + k * 15) % 360) + ',80%,55%)';
          ctx.fillRect(x, y, 120, 90);
        }
        const g = ctx.createLinearGradient((i * 7) % W, 0, ((i * 7) % W) + 400, H);
        g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '48px sans-serif';
        ctx.fillText('S0 ' + i + ' ' + new Date().toISOString(), 40, H - 60);
      }
      self.onmessage = async (e) => {
        const minutes = e.data.minutes;
        canvas = new OffscreenCanvas(W, H);
        ctx = canvas.getContext('2d', { alpha: false });
        let support;
        try { support = await VideoEncoder.isConfigSupported(CONFIG); } catch (err) { post('encode-error', { where: 'isConfigSupported', error: String(err) }); return; }
        post('encode-config', { supported: support.supported, config: support.config, minutes });
        encoder = new VideoEncoder({
          output: (chunk) => {
            chunks++; bytes += chunk.byteLength; win.chunks++; win.bytes += chunk.byteLength;
            if (chunk.type === 'key') keyframes++;
            const now = performance.now();
            if (firstChunkTs === null) { firstChunkTs = chunk.timestamp; firstChunkAt = now; }
            lastChunkTs = chunk.timestamp; lastChunkAt = now;
          },
          error: (err) => { errors++; post('encode-error', { where: 'encoder.error', error: String(err) }); },
        });
        encoder.configure(CONFIG);
        const start = performance.now();
        const end = start + minutes * 60000;
        let i = 0;
        let nextReport = start + 10000;
        let frameCtor = 'canvas';
        function tick() {
          const now = performance.now();
          if (now >= end) { finish(); return; }
          const idx = Math.floor((now - start) / INTERVAL);
          if (idx > i) { const s = idx - i; skipped += s; win.skipped += s; i = idx; }
          const q = encoder.encodeQueueSize;
          if (q > maxQueueEver) maxQueueEver = q;
          if (q > win.maxQueue) win.maxQueue = q;
          draw(i);
          const ts = Math.round(i * 1e6 / FPS);
          if (q > 90) {
            backpressureDrops++; win.drops++;
          } else {
            let frame = null;
            try {
              frame = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(1e6 / FPS) });
            } catch (err) {
              try {
                const bmp = canvas.transferToImageBitmap();
                frame = new VideoFrame(bmp, { timestamp: ts, duration: Math.round(1e6 / FPS) });
                bmp.close();
                frameCtor = 'imagebitmap';
              } catch (err2) { errors++; post('encode-error', { where: 'VideoFrame', error: String(err) + ' / ' + String(err2) }); finish(); return; }
            }
            try { encoder.encode(frame, { keyFrame: frames % KEY_EVERY === 0 }); frames++; win.frames++; }
            catch (err) { errors++; post('encode-error', { where: 'encode', error: String(err) }); }
            frame.close();
            if (firstFrameTs === null) firstFrameTs = ts;
            lastFrameTs = ts;
          }
          i++;
          if (now >= nextReport) { report('encode-10s', now); nextReport += 10000; }
          const next = start + i * INTERVAL;
          const delay = next - performance.now();
          if (delay < 0) { late++; win.late++; }
          setTimeout(tick, Math.max(0, delay));
        }
        function report(stage, now) {
          const winS = (now - win.startedAt) / 1000;
          post(stage, {
            elapsedS: Math.round((now - start) / 1000),
            minute: +((now - start) / 60000).toFixed(2),
            window: {
              seconds: +winS.toFixed(2),
              fps: +(win.frames / winS).toFixed(2),
              chunksPerS: +(win.chunks / winS).toFixed(2),
              kbps: +((win.bytes * 8) / winS / 1000).toFixed(1),
              late: win.late, skipped: win.skipped, drops: win.drops, maxQueue: win.maxQueue,
            },
            totals: {
              frames, chunks, bytes, keyframes, skipped, backpressureDrops, late, errors,
              pendingChunks: frames - chunks, maxQueueEver, encodeQueueSize: encoder.encodeQueueSize,
              avgKbps: +((bytes * 8) / ((now - start) / 1000) / 1000).toFixed(1),
              state: encoder.state, frameCtor,
            },
          });
          win = fresh();
        }
        async function finish() {
          const now = performance.now();
          try { await encoder.flush(); } catch (err) { post('encode-error', { where: 'flush', error: String(err) }); }
          report('encode-final-window', performance.now());
          const wallS = (performance.now() - start) / 1000;
          post('encode-done', {
            wallS: +wallS.toFixed(1), frames, chunks, bytes, keyframes, skipped, backpressureDrops, late, errors,
            maxQueueEver, avgFps: +(frames / wallS).toFixed(2), avgKbps: +((bytes * 8) / wallS / 1000).toFixed(1),
            chunkTimestampSpanS: firstChunkTs === null ? null : +((lastChunkTs - firstChunkTs) / 1e6).toFixed(2),
            chunkWallSpanS: firstChunkAt === null ? null : +((lastChunkAt - firstChunkAt) / 1000).toFixed(2),
            frameTimestampSpanS: firstFrameTs === null ? null : +((lastFrameTs - firstFrameTs) / 1e6).toFixed(2),
            frameCtor, state: encoder.state,
          });
          try { encoder.close(); } catch (_) {}
        }
        tick();
      };
    `;
  }

  async function encode(minutes) {
    if (typeof VideoEncoder !== 'function' || typeof OffscreenCanvas !== 'function') {
      await log('encode-skipped', { reason: 'VideoEncoder or OffscreenCanvas missing on window' });
      return;
    }
    await new Promise((resolve) => {
      let worker;
      try {
        worker = new Worker(URL.createObjectURL(new Blob([encodeWorkerSource()], { type: 'text/javascript' })));
      } catch (e) {
        log('encode-error', { where: 'worker', error: String(e) }).then(resolve);
        return;
      }
      worker.onmessage = (e) => {
        const d = e.data;
        const stage = d.stage;
        delete d.stage;
        log(stage, d);
        if (stage === 'encode-done') { worker.terminate(); resolve(); }
      };
      worker.onerror = (e) => { log('encode-error', { where: 'worker.onerror', error: String(e.message || e) }).then(resolve); };
      worker.postMessage({ minutes });
    });
  }

  try {
    await matrix();
    if (MODE === 'ipc' || MODE === 'all') await ipc();
    if (MODE === 'encode' || MODE === 'all') await encode(ENCODE_MINUTES);
    await log('done', { mode: MODE });
  } catch (e) {
    await log('fatal', { error: String(e), stack: e && e.stack });
  }
})();
