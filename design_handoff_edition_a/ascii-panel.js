// <ascii-panel field="terrain" fps="18"> — ported from avi-site/src/lib/ascii (fields.ts + AsciiPanel.tsx).
(() => {
  const TAU = Math.PI * 2;
  const fract = v => v - Math.floor(v);
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  function smoothNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm(x, y) { let s = 0, amp = .5, f = 1; for (let i = 0; i < 4; i++) { s += smoothNoise(x * f, y * f) * amp; f *= 2.02; amp *= .5; } return s; }
  const LV = 6;
  const FIELDS = {
    terrain: (x, y, t) => { const h = fbm(x * 2.3 + t * .03, y * 2.3 + t * .012); return Math.floor(fract(h * 2.6 + t * .045) * LV) / (LV - 1); },
    flow: (x, y, t) => { const w = fbm(x * 1.15 + t * .045, y * 1.15 - t * .028); const a = Math.sin((x * 1.35 + w * 1.9) * TAU + t * .3), b = Math.sin((y - w * 1.45) * TAU - t * .22); const l = a * b; return l <= 0 ? 0 : Math.pow(l, 1.5); },
    sphere: (x, y, t) => { const px = (x - .5) * 2.2, py = (y - .5) * 2.2, r2 = px * px + py * py; if (r2 > 1) return 0; const pz = Math.sqrt(1 - r2), c = Math.cos(t * .4), s = Math.sin(t * .4); const nx = px * c - pz * s, ny = py, nz = px * s + pz * c; const lam = Math.max(0, nx * .35 - ny * .35 + nz * .87); const lat = Math.abs(fract((Math.asin(clamp01(ny * .5 + .5) * 2 - 1) / Math.PI) * 8) - .5); const lon = Math.abs(fract((Math.atan2(nz, nx) / TAU) * 10) - .5); const wire = Math.max(Math.max(0, 1 - lat * 7), Math.max(0, 1 - lon * 7)); return Math.min(1, .16 + lam * .68 + wire * .26 * (.4 + lam)); },
    lattice: (x, y, t) => { const gx = Math.abs(fract(x * 6 + Math.sin(t * .2) * .15) - .5), gy = Math.abs(fract(y * 5 + Math.cos(t * .17) * .15) - .5); const bx = Math.max(0, 1 - gx / .16), by = Math.max(0, 1 - gy / .16); const p = .72 + .28 * Math.sin(t * .75 - (x + y) * 3.2); return Math.min(1, (Math.max(bx, by) * .62 + bx * by * .95) * p); },
    ripple: (x, y, t) => { const d1 = Math.hypot(x - .32, y - .44), d2 = Math.hypot(x - .72, y - .6); const w = Math.sin(d1 * 21 - t * 1.05) + Math.sin(d2 * 18 - t * .82); return Math.pow(Math.max(0, w * .5), 1.35); },
    spiral: (x, y, t) => { const dx = x - .5, dy = y - .5, r = Math.hypot(dx, dy); const arms = Math.sin(Math.atan2(dy, dx) * 3 + r * 17 - t * 1.1); return Math.max(0, arms) * Math.max(0, 1 - r * 1.85); },
    weave: (x, y, t) => { const u = x * 7 + Math.sin(t * .2) * .2, v = y * 7 - Math.cos(t * .17) * .2; const warp = Math.abs((Math.floor(u) + Math.floor(v)) % 2) === 0; const bar = warp ? 1 - Math.abs(fract(u) - .5) * 2.4 : 1 - Math.abs(fract(v) - .5) * 2.4; return Math.max(0, bar) * (.58 + .42 * Math.sin(t * .45 + (x - y) * 4.5)); },
    scan: (x, y, t) => { const band = Math.sin(y * 19 + Math.sin(x * 2.6 + t * .4) * 1.5 - t * .66); const env = .5 + .5 * Math.sin(x * 3.4 - t * .22); return Math.max(0, band) * (.3 + env * .8); },
  };
  const RAMPS = { terrain: "  .:=+*#", flow: " .:-=+*#", sphere: " .:-=+*#%@", lattice: " .:-=+*#", ripple: " .:-=+*#", spiral: " .:-=+*#%", weave: " .:-=+*#", scan: " .:-=+*#" };

  class AsciiPanel extends HTMLElement {
    connectedCallback() {
      if (!this.pre) {
        this.pre = document.createElement('pre');
        this.pre.setAttribute('aria-hidden', 'true');
        Object.assign(this.pre.style, { margin: 0, width: '100%', height: '100%', overflow: 'hidden', whiteSpace: 'pre', font: "300 10px/1.15 'IBM Plex Mono', ui-monospace, monospace", color: 'rgba(230,228,223,.5)', userSelect: 'none', display: 'block' });
        this.appendChild(this.pre);
        if (!this.style.display) this.style.display = 'block';
      }
      this.start();
    }
    disconnectedCallback() { this.stop(); }
    static get observedAttributes() { return ['field', 'fps']; }
    attributeChangedCallback() { if (this.isConnected) { this.stop(); this.start(); } }
    start() {
      const el = this.pre, field = this.getAttribute('field') || 'terrain', fps = +(this.getAttribute('fps') || 18);
      const fn = FIELDS[field] || FIELDS.terrain, ramp = RAMPS[field] || RAMPS.terrain, maxI = ramp.length - 1;
      let cols = 0, rows = 0, sx = 1, sy = 1, line = [], out = [];
      const measure = () => {
        const probe = document.createElement('span'); probe.textContent = '0'.repeat(40);
        Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' });
        el.appendChild(probe); const cw = probe.getBoundingClientRect().width / 40; probe.remove();
        const st = getComputedStyle(el), lh = parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.15;
        const w = el.clientWidth, h = el.clientHeight; if (!cw || !lh || !w || !h) return false;
        const nc = Math.max(8, Math.floor(w / cw)), nr = Math.max(4, Math.floor(h / lh));
        if (nc === cols && nr === rows) return false;
        cols = nc; rows = nr; const vw = cols * cw, vh = rows * lh, sh = Math.min(vw, vh); sx = vw / sh; sy = vh / sh;
        line = new Array(cols); out = new Array(rows); return true;
      };
      const draw = s => {
        if (!cols || !rows) return;
        for (let y = 0; y < rows; y++) { const v = (y / (rows - 1) - .5) * sy + .5; for (let x = 0; x < cols; x++) { const u = (x / (cols - 1) - .5) * sx + .5; line[x] = ramp[Math.round(clamp01(fn(u, v, s)) * maxI)]; } out[y] = line.join(''); }
        el.textContent = out.join('\n');
      };
      measure(); let last = 0;
      this.ro = new ResizeObserver(() => { if (measure()) draw(last); }); this.ro.observe(el);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(0); return; }
      let lastFrame = 0; const t0 = performance.now(), iv = 1000 / fps;
      const loop = now => { this.raf = requestAnimationFrame(loop); if (now - lastFrame < iv) return; lastFrame = now; last = (now - t0) * .001; draw(last); };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { cancelAnimationFrame(this.raf); if (this.ro) this.ro.disconnect(); }
  }
  if (!customElements.get('ascii-panel')) customElements.define('ascii-panel', AsciiPanel);
})();
