// Touch, mouse and keyboard controls for the city view.
// One finger: pan (or draw roads / drag the building being placed). Two fingers: pinch to zoom,
// twist to rotate. Mouse: drag to pan, right-drag to rotate, wheel to zoom.

export class Input {
  constructor(app) {
    this.app = app;
    this.el = app.world.renderer.domElement;
    this.ptr = new Map();
    this.gesture = null;
    const el = this.el;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      app.world.cam.dist *= k;
    }, { passive: false });
    // Safari gesture events (trackpad pinch)
    el.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e));
    this.keys = new Set();
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  get world() { return this.app.world; }

  down(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), button: e.button });
    const n = this.ptr.size;
    const mode = this.app.mode;
    if (n === 1) {
      const cell = this.world.pickCell(e.clientX, e.clientY);
      if (e.button === 2) { this.gesture = { kind: 'rotate' }; this.world.stopGlide(); return; }
      if (mode?.kind === 'place' && cell && this.app.ghostContains(cell)) {
        this.world.stopGlide();
        this.gesture = { kind: 'ghost', off: [cell[0] - mode.x, cell[1] - mode.z] };
        return;
      }
      if (mode?.kind === 'road' && cell) {
        this.world.stopGlide();
        this.gesture = { kind: 'road', start: cell, end: cell };
        this.app.roadPreview(cell, cell);
        return;
      }
      this.gesture = { kind: 'pan' };
      this.world.setDragging(true);
    } else if (n === 2) {
      this.world.setDragging(true);
      if (this.gesture?.kind === 'road') this.app.roadPreview(null);
      const [a, b] = [...this.ptr.values()];
      this.gesture = {
        kind: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        a0: Math.atan2(b.y - a.y, b.x - a.x),
        dist0: this.world.cam.dist,
        yaw0: this.world.cam.yaw,
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
      };
    }
  }

  move(e) {
    const p = this.ptr.get(e.pointerId);
    if (!p) {
      // hover for mouse: nothing
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pan') this.world.panBy(dx, dy);
    else if (g.kind === 'rotate') { this.world.cam.yaw -= dx * 0.006; this.world.cam.tilt += dy * 0.004; }
    else if (g.kind === 'ghost') {
      const cell = this.world.pickCell(e.clientX, e.clientY);
      if (cell) this.app.moveGhost(cell[0] - g.off[0], cell[1] - g.off[1]);
    } else if (g.kind === 'road') {
      const cell = this.world.pickCell(e.clientX, e.clientY);
      if (cell && (cell[0] !== g.end[0] || cell[1] !== g.end[1])) { g.end = cell; this.app.roadPreview(g.start, g.end); }
    } else if (g.kind === 'pinch' && this.ptr.size >= 2) {
      const [a, b] = [...this.ptr.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.world.cam.dist = g.dist0 * (g.d0 / Math.max(10, d));
      this.world.cam.yaw = g.yaw0 + (ang - g.a0);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // two fingers moving up/down together tilt the camera; sideways they pan
      this.world.cam.tilt += (my - g.my) * 0.0035;
      this.world.panBy(mx - g.mx, 0);
      g.mx = mx; g.my = my;
    }
  }

  up(e, cancel = false) {
    const p = this.ptr.get(e.pointerId);
    this.ptr.delete(e.pointerId);
    if (!p) return;
    const g = this.gesture;
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
    const quick = performance.now() - p.t < 450;
    if (this.ptr.size === 0) {
      this.world.setDragging(false);
      if (g?.kind !== 'pan' || moved < 9) this.world.stopGlide();
      if (g?.kind === 'road' && !cancel) this.app.finishRoad(g.start, g.end);
      else if (!cancel && moved < 9 && quick && g?.kind !== 'pinch' && p.button !== 2) this.app.tap(e.clientX, e.clientY);
      this.gesture = null;
    } else if (this.ptr.size === 1) {
      // continue panning with the remaining finger
      const [r] = [...this.ptr.values()];
      r.sx = r.x; r.sy = r.y; r.t = 0;
      this.gesture = { kind: 'pan' };
    }
  }

  key(e) {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    const w = this.world;
    if (k === 'q') w.cam.yaw += Math.PI / 8;
    else if (k === 'e') w.cam.yaw -= Math.PI / 8;
    else if (k === '+' || k === '=') w.cam.dist *= 0.85;
    else if (k === '-') w.cam.dist *= 1.18;
    else if (k === 'r') this.app.modeAction('rotate');
    else if (k === 'escape') this.app.escape();
    else if (k === 'enter') this.app.modeAction('confirm');
    else if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) this.keys.add(k);
  }

  update(dt) {
    const s = 600 * dt;
    let dx = 0, dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy += s;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy -= s;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx += s;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx -= s;
    if (dx || dy) this.world.panBy(dx, dy);
  }
}
