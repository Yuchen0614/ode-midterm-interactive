/* ==========================================================================
   plot.js — tiny expression compiler + canvas plotting toolkit
   No dependencies. Used by the interactive labs.
   ========================================================================== */
window.ODE = window.ODE || {};

/* ------------------------------------------------------------------ *
 * 1. Expression compiler:  "3x^2 - sin(y/2)"  ->  f(x,y)
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  var CONSTS = { pi: Math.PI, PI: Math.PI, 'π': Math.PI, e: Math.E, E: Math.E, tau: 2 * Math.PI };
  var FNS = {
    sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot',
    asin: 'asin', acos: 'acos', atan: 'atan',
    sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
    exp: 'exp', sqrt: 'sqrt', abs: 'abs', sign: 'sign',
    floor: 'floor', ceil: 'ceil', round: 'round',
    ln: 'log', log: 'log', log10: 'log10', log2: 'log2',
    min: 'min', max: 'max', pow: 'pow', atan2: 'atan2', hypot: 'hypot',
    sec: 'sec', csc: 'csc'
  };
  var MATH_EXTRA = {
    cot: 'function(a){return 1/Math.tan(a)}',
    sec: 'function(a){return 1/Math.cos(a)}',
    csc: 'function(a){return 1/Math.sin(a)}'
  };

  function compile(src) {
    var S = String(src == null ? '' : src)
      .replace(/[−–—]/g, '-')
      .replace(/\s+/g, '');
    if (!S) throw new Error('運算式是空的');
    var i = 0;

    function bad(msg) { throw new Error(msg + '（第 ' + (i + 1) + ' 個字元附近）'); }
    function expr() {
      var v = term();
      while (i < S.length) {
        var c = S[i];
        if (c === '+') { i++; v = { t: '+', a: v, b: term() }; }
        else if (c === '-') { i++; v = { t: '-', a: v, b: term() }; }
        else break;
      }
      return v;
    }
    function term() {
      var v = unary();
      while (i < S.length) {
        var c = S[i];
        if (c === '*') { i++; v = { t: '*', a: v, b: unary() }; }
        else if (c === '/') { i++; v = { t: '/', a: v, b: unary() }; }
        else if (/[0-9A-Za-z_(π]/.test(c)) { v = { t: '*', a: v, b: unary() }; }  /* implicit 2x */
        else break;
      }
      return v;
    }
    function unary() {
      if (S[i] === '-') { i++; return { t: 'neg', a: unary() }; }
      if (S[i] === '+') { i++; return unary(); }
      return power();
    }
    function power() {
      var base = primary();
      if (S[i] === '^') { i++; return { t: '^', a: base, b: unary() }; }
      return base;
    }
    function primary() {
      if (S[i] === '(') {
        i++;
        var e = expr();
        if (S[i] !== ')') bad('缺少右括號 )');
        i++;
        return e;
      }
      if (/[0-9.]/.test(S[i])) {
        var st = i;
        while (i < S.length && /[0-9.]/.test(S[i])) i++;
        var txt = S.slice(st, i);
        if ((txt.match(/\./g) || []).length > 1) bad('數字格式錯誤');
        return { t: 'num', v: parseFloat(txt) };
      }
      if (/[A-Za-z_π]/.test(S[i])) {
        var st2 = i;
        while (i < S.length && /[A-Za-z_0-9π]/.test(S[i])) i++;
        var name = S.slice(st2, i);
        if (name === 'π') return { t: 'num', v: Math.PI };
        if (S[i] === '(') {
          if (!FNS[name]) bad('未知函數 ' + name);
          i++;
          var args = [expr()];
          while (S[i] === ',') { i++; args.push(expr()); }
          if (S[i] !== ')') bad('函數 ' + name + ' 缺少 )');
          i++;
          return { t: 'call', name: FNS[name], args: args };
        }
        if (name in CONSTS) return { t: 'num', v: CONSTS[name] };
        if (name === 'x' || name === 'y') return { t: 'var', name: name };
        if (name === 't') return { t: 'var', name: 'x' };   /* allow t as the independent var */
        bad('未知符號 ' + name);
      }
      bad('看不懂的運算式');
    }

    var ast = expr();
    if (i < S.length) bad('多餘的字元 ' + S.slice(i));

    function code(n) {
      switch (n.t) {
        case 'num': return '(' + n.v + ')';
        case 'var': return n.name;
        case '+': return '(' + code(n.a) + '+' + code(n.b) + ')';
        case '-': return '(' + code(n.a) + '-' + code(n.b) + ')';
        case '*': return '(' + code(n.a) + '*' + code(n.b) + ')';
        case '/': return '(' + code(n.a) + '/' + code(n.b) + ')';
        case '^': return 'Math.pow(' + code(n.a) + ',' + code(n.b) + ')';
        case 'neg': return '(-' + code(n.a) + ')';
        case 'call':
          var a = n.args.map(code);
          if (MATH_EXTRA[n.name]) return '(' + MATH_EXTRA[n.name] + ')(' + a.join(',') + ')';
          return 'Math.' + n.name + '(' + a.join(',') + ')';
        default: throw new Error('內部錯誤');
      }
    }

    var body = 'return (' + code(ast) + ');';
    var fn;
    try { fn = new Function('x', 'y', body); }
    catch (e) { throw new Error('無法編譯：' + e.message); }

    function wrapped(x, y) {
      var v = fn(x, y);
      return typeof v === 'number' ? v : NaN;
    }
    wrapped.source = src;
    return wrapped;
  }

  ODE.compile = compile;
  ODE.tryCompile = function (src) {
    try { return { f: compile(src) }; } catch (e) { return { err: e.message }; }
  };
})();

/* ------------------------------------------------------------------ *
 * 2. Plot: canvas in "world" coordinates
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  function NiceStep(range, target) {
    var raw = range / Math.max(1, target);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var mult = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return mult * mag;
  }

  function fmtTick(v, step) {
    if (Math.abs(v) < 1e-12) return '0';
    var dec = Math.max(0, Math.min(6, -Math.floor(Math.log10(step)) + (step < 1 ? 0 : 0)));
    if (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3)) return v.toExponential(1);
    return v.toFixed(dec);
  }

  function Plot(canvas, opts) {
    opts = opts || {};
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.xmin = opts.xmin != null ? opts.xmin : -5;
    this.xmax = opts.xmax != null ? opts.xmax : 5;
    this.ymin = opts.ymin != null ? opts.ymin : -5;
    this.ymax = opts.ymax != null ? opts.ymax : 5;
    this.pad = opts.pad || { l: 40, r: 14, t: 14, b: 28 };
    this.h = opts.h || 320;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
  }

  Plot.prototype.resize = function () {
    var c = this.c, rect = c.getBoundingClientRect();
    var w = Math.max(200, Math.round(rect.width || c.parentNode.clientWidth || 420));
    c.style.height = this.h + 'px';
    c.width = Math.round(w * this.dpr);
    c.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = w;
    this.ctx.clearRect(0, 0, w, this.h);
  };

  Plot.prototype.mx = function (x) {
    return this.pad.l + (x - this.xmin) / (this.xmax - this.xmin) * (this.w - this.pad.l - this.pad.r);
  };
  Plot.prototype.my = function (y) {
    return this.h - this.pad.b - (y - this.ymin) / (this.ymax - this.ymin) * (this.h - this.pad.t - this.pad.b);
  };
  Plot.prototype.ix = function (px) {
    return this.xmin + (px - this.pad.l) / (this.w - this.pad.l - this.pad.r) * (this.xmax - this.xmin);
  };
  Plot.prototype.iy = function (py) {
    return this.ymin + (this.h - this.pad.b - py) / (this.h - this.pad.t - this.pad.b) * (this.ymax - this.ymin);
  };

  Plot.prototype.background = function () {
    var ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = ODE.cssVar('--panel-2') || '#fff';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
    return this;
  };

  Plot.prototype.grid = function (opts) {
    opts = opts || {};
    var ctx = this.ctx, w = this.w, h = this.h;
    var stepx = opts.stepx || NiceStep(this.xmax - this.xmin, opts.nx || 8);
    var stepy = opts.stepy || NiceStep(this.ymax - this.ymin, opts.ny || 6);
    var line = ODE.cssVar('--line') || '#e5e5e5';
    var line2 = ODE.cssVar('--line-2') || '#ccc';
    var mut = ODE.cssVar('--muted') || '#888';

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = line;
    var x, y;
    for (x = Math.ceil(this.xmin / stepx) * stepx; x <= this.xmax + 1e-9; x += stepx) {
      ctx.beginPath(); ctx.moveTo(this.mx(x), this.pad.t); ctx.lineTo(this.mx(x), h - this.pad.b); ctx.stroke();
    }
    for (y = Math.ceil(this.ymin / stepy) * stepy; y <= this.ymax + 1e-9; y += stepy) {
      ctx.beginPath(); ctx.moveTo(this.pad.l, this.my(y)); ctx.lineTo(w - this.pad.r, this.my(y)); ctx.stroke();
    }
    /* axes */
    ctx.strokeStyle = line2; ctx.lineWidth = 1.4;
    if (this.ymin < 0 && this.ymax > 0) {
      ctx.beginPath(); ctx.moveTo(this.pad.l, this.my(0)); ctx.lineTo(w - this.pad.r, this.my(0)); ctx.stroke();
    }
    if (this.xmin < 0 && this.xmax > 0) {
      ctx.beginPath(); ctx.moveTo(this.mx(0), this.pad.t); ctx.lineTo(this.mx(0), h - this.pad.b); ctx.stroke();
    }
    /* ticks */
    ctx.fillStyle = mut;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (x = Math.ceil(this.xmin / stepx) * stepx; x <= this.xmax + 1e-9; x += stepx) {
      var lx = this.mx(x);
      if (lx < this.pad.l - 1 || lx > w - this.pad.r + 1) continue;
      ctx.fillText(fmtTick(x, stepx), lx, h - this.pad.b + 4);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (y = Math.ceil(this.ymin / stepy) * stepy; y <= this.ymax + 1e-9; y += stepy) {
      var ly = this.my(y);
      if (ly < this.pad.t || ly > h - this.pad.b) continue;
      ctx.fillText(fmtTick(y, stepy), this.pad.l - 5, ly);
    }
    ctx.restore();
    return this;
  };

  /* direction field of y' = f(x,y) */
  Plot.prototype.field = function (f, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    var nx = opts.nx || 30, ny = opts.ny || 19;
    var col = opts.color || ODE.cssVar('--brand') || '#3b5bdb';
    var dx = (this.xmax - this.xmin) / nx, dy = (this.ymax - this.ymin) / ny;
    var pxPerX = (this.w - this.pad.l - this.pad.r) / (this.xmax - this.xmin);
    var pxPerY = (this.h - this.pad.t - this.pad.b) / (this.ymax - this.ymin);
    var len = Math.min(pxPerX * dx, pxPerY * dy) * (opts.len || 0.46);

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (var i = 0; i <= nx; i++) {
      for (var j = 0; j <= ny; j++) {
        var x = this.xmin + i * dx, y = this.ymin + j * dy;
        var m = f(x, y);
        if (!isFinite(m)) continue;
        /* direction vector (1, m) normalised in SCREEN space so it looks right */
        var vx = pxPerX, vy = -m * pxPerY;
        var L = Math.hypot(vx, vy);
        if (!isFinite(L) || L < 1e-9) continue;
        var ux = vx / L * len, uy = vy / L * len;
        var cx = this.mx(x), cy = this.my(y);
        ctx.globalAlpha = opts.alpha != null ? opts.alpha : 0.5;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx - ux, cy - uy);
        ctx.lineTo(cx + ux, cy + uy);
        ctx.stroke();
      }
    }
    ctx.restore();
    return this;
  };

  /* polyline through world-space points, breaking at NaN / out-of-range */
  Plot.prototype.poly = function (pts, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = opts.color || ODE.cssVar('--brand') || '#3b5bdb';
    ctx.lineWidth = opts.width || 2.4;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (opts.dash) ctx.setLineDash(opts.dash);
    if (opts.glow) { ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 6; }
    ctx.beginPath();
    var started = false, prevY = null;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var ok = isFinite(p[0]) && isFinite(p[1]) && p[1] >= this.ymin - 4 && p[1] <= this.ymax + 4;
      if (!ok) { started = false; continue; }
      /* break on huge jumps (blow-up) */
      if (started && prevY != null && Math.abs(p[1] - prevY) > (this.ymax - this.ymin) * 0.6) started = false;
      var sx = this.mx(p[0]), sy = this.my(p[1]);
      if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      prevY = p[1];
    }
    ctx.stroke();
    ctx.restore();
    return this;
  };

  /* one solution curve of y'=f(x,y) through (x0,y0), classic RK4 */
  Plot.prototype.rk = function (f, x0, y0, opts) {
    opts = opts || {};
    var n = opts.n || 900;
    var h = (this.xmax - this.xmin) / n;
    var self = this;

    function march(x, y, hs, sign) {
      var out = [[x, y]];
      for (var i = 0; i < n; i++) {
        var s = sign * hs;
        var k1 = f(x, y);
        if (!isFinite(k1)) break;
        var k2 = f(x + s / 2, y + s * k1 / 2);
        var k3 = f(x + s / 2, y + s * k2 / 2);
        var k4 = f(x + s, y + s * k3);
        if (!isFinite(k2) || !isFinite(k3) || !isFinite(k4)) break;
        y += s * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
        x += s;
        if (!isFinite(y) || Math.abs(y) > 1e6) break;
        out.push([x, y]);
        if (x < self.xmin - 1 || x > self.xmax + 1) break;
      }
      return out;
    }

    var fwd = march(x0, y0, h, 1);
    if (opts.both === false) return fwd;
    var back = march(x0, y0, h, -1).slice(1).reverse();
    return back.concat(fwd);
  };

  Plot.prototype.dot = function (x, y, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = opts.color || ODE.cssVar('--ex') || '#a9750b';
    ctx.beginPath();
    ctx.arc(this.mx(x), this.my(y), opts.r || 4.2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = opts.stroke || ODE.cssVar('--panel') || '#fff';
    ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();
    return this;
  };

  Plot.prototype.label = function (x, y, text, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    ctx.save();
    ctx.font = (opts.font || '11.5px ui-sans-serif, system-ui, sans-serif');
    ctx.fillStyle = opts.color || ODE.cssVar('--fg') || '#000';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    ctx.fillText(text, this.mx(x) + (opts.dx || 0), this.my(y) + (opts.dy || 0));
    ctx.restore();
    return this;
  };

  /* marching-squares contour of F(x,y) at given levels */
  Plot.prototype.contour = function (F, levels, opts) {
    opts = opts || {};
    var N = opts.N || 110;
    var cols = opts.colors || [];
    var dx = (this.xmax - this.xmin) / N;
    var dy = (this.ymax - this.ymin) / N;
    var g = new Float64Array((N + 1) * (N + 1));
    var i, j;
    for (i = 0; i <= N; i++) {
      for (j = 0; j <= N; j++) {
        var v = F(this.xmin + i * dx, this.ymin + j * dy);
        g[i * (N + 1) + j] = isFinite(v) ? v : NaN;
      }
    }
    var ctx = this.ctx;
    var ip = function (px, py, qx, qy, va, vb, L) {
      var t = (L - va) / (vb - va);
      return [px + (qx - px) * t, py + (qy - py) * t];
    };
    ctx.save();
    ctx.lineWidth = opts.width || 1.4;
    ctx.lineCap = 'round';
    for (var li = 0; li < levels.length; li++) {
      var L = levels[li];
      ctx.strokeStyle = cols[li % (cols.length || 1)] || (ODE.cssVar('--brand') || '#3b5bdb');
      ctx.globalAlpha = opts.alpha != null ? opts.alpha : 0.85;
      ctx.beginPath();
      for (i = 0; i < N; i++) {
        for (j = 0; j < N; j++) {
          var x0 = this.xmin + i * dx, y0 = this.ymin + j * dy;
          var a = g[i * (N + 1) + j], b = g[(i + 1) * (N + 1) + j];
          var c = g[(i + 1) * (N + 1) + j + 1], d = g[i * (N + 1) + j + 1];
          if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) continue;
          var segs = [];
          var P = [[x0, y0], [x0 + dx, y0], [x0 + dx, y0 + dy], [x0, y0 + dy]];
          var V = [a, b, c, d];
          var edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
          for (var e = 0; e < 4; e++) {
            var e1 = edges[e], e2 = edges[(e + 1) % 4];
            var v1a = V[e1[0]], v1b = V[e1[1]], v2a = V[e2[0]], v2b = V[e2[1]];
            var x1 = (v1a - L) * (v1b - L) < 0, x2 = (v2a - L) * (v2b - L) < 0;
            if (x1 && x2) {
              segs.push([
                ip(P[e1[0]][0], P[e1[0]][1], P[e1[1]][0], P[e1[1]][1], v1a, v1b, L),
                ip(P[e2[0]][0], P[e2[0]][1], P[e2[1]][0], P[e2[1]][1], v2a, v2b, L)
              ]);
            }
          }
          for (var s = 0; s < segs.length; s++) {
            ctx.moveTo(this.mx(segs[s][0][0]), this.my(segs[s][0][1]));
            ctx.lineTo(this.mx(segs[s][1][0]), this.my(segs[s][1][1]));
          }
        }
      }
      ctx.stroke();
    }
    ctx.restore();
    return this;
  };

  Plot.prototype.clearCurves = function () { return this; };

  /* pointer -> world coords */
  Plot.prototype.onPointer = function (cb) {
    var self = this, c = this.c;
    function pos(ev) {
      var r = c.getBoundingClientRect();
      var px = ev.clientX - r.left, py = ev.clientY - r.top;
      if (px < self.pad.l || px > self.w - self.pad.r || py < self.pad.t || py > self.h - self.pad.b) return null;
      return { x: self.ix(px), y: self.iy(py), px: px, py: py };
    }
    var dragging = false;
    c.addEventListener('pointerdown', function (ev) {
      var p = pos(ev); if (!p) return;
      dragging = true;
      try { c.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic / stale pointer */ }
      cb(p, 'down'); ev.preventDefault();
    });
    c.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var p = pos(ev); if (!p) return;
      cb(p, 'move');
    });
    c.addEventListener('pointerup', function (ev) {
      if (!dragging) return;
      dragging = false;
      try { c.releasePointerCapture(ev.pointerId); } catch (e) { }
      var p = pos(ev);
      if (p) cb(p, 'up');
    });
    c.addEventListener('pointercancel', function () { dragging = false; });
    return this;
  };

  ODE.Plot = Plot;
  ODE.niceStep = NiceStep;
  ODE.fmtTick = fmtTick;
  ODE.fmt = function (v, d) {
    if (!isFinite(v)) return '—';
    if (v === 0) return '0';
    if (Math.abs(v) >= 1e5 || Math.abs(v) < 1e-4) return v.toExponential(2);
    return Number(v.toFixed(d == null ? 4 : d)).toString();
  };
})();
