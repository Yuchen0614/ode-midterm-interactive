/* ==========================================================================
   widgets2.js — interactive labs (part 2): exact · wronsk · linear · exists
   ========================================================================== */
window.ODE = window.ODE || {};

(function () {
  'use strict';

  var U = ODE.labUI;

  /* ---------- numeric helpers ---------- */
  function dY(f, x, y) { var h = 1e-5 * (1 + Math.abs(y)); return (f(x, y + h) - f(x, y - h)) / (2 * h); }
  function dX(f, x, y) { var h = 1e-5 * (1 + Math.abs(x)); return (f(x + h, y) - f(x - h, y)) / (2 * h); }
  function simpson(f, a, b, n) {
    n = n || 240; if (n % 2) n++;
    var h = (b - a) / n, s = f(a) + f(b);
    for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
    return s * h / 3;
  }

  /* ======================================================================
     LAB 5 — 正合性檢測器
     ====================================================================== */
  function exactLab() {
    var L = U.lab('🎯', '正合性檢測器 · Exactness Checker',
      '輸入 M(x,y)、N(x,y)，機器直接算 ∂M/∂y 與 ∂N/∂x 是否相等，並畫出位能函數的等值線');
    var G = U.grid(L.body);
    var cv = ODE.el('canvas');
    G.left.appendChild(cv);
    var out = ODE.el('div');
    out.style.marginTop = '10px';
    G.left.appendChild(out);
    var plot = new ODE.Plot(cv, { h: 320, xmin: -3, xmax: 3, ymin: -3, ymax: 3 });

    var presets = [
      { l: '(2xy−3)dx + (x²+4y)dy', M: '2*x*y-3', N: 'x^2+4*y', ok: true },
      { l: '(3x²+2y²)dx + (4xy+3)dy', M: '3*x^2+2*y^2', N: '4*x*y+3', ok: true },
      { l: '(cos y + y cos x)dx + (cos x − x sin y)dy', M: 'cos(y)+y*cos(x)', N: 'cos(x)-x*sin(y)', ok: true },
      { l: 'y dx − x dy  （不正合）', M: 'y', N: '-x', ok: false },
      { l: '(y + x²)dx + x dy', M: 'y+x^2', N: 'x', ok: true },
      { l: '(2x sin y)dx + (x² cos y)dy', M: '2*x*sin(y)', N: 'x^2*cos(y)', ok: true },
      { l: 'dx + (x/y)dy   （不正合；y-only 積分因子 μ=y → y dx + x dy）', M: '1', N: 'x/y', ok: false }
    ];

    var Mf = null, Nf = null, Msrc = '', Nsrc = '';
    var inM = U.textInput(presets[0].M);
    var inN = U.textInput(presets[0].N);
    var D = 3; /* half-range */

    function update() {
      var tM = ODE.tryCompile(inM.value), tN = ODE.tryCompile(inN.value);
      if (tM.err || tN.err) {
        Mf = Nf = null;
        out.innerHTML = '<div class="verdict bad">✗ 運算式有問題：' + ODE.esc(tM.err || tN.err) + '</div>';
        plot.background().grid();
        return;
      }
      Mf = tM.f; Nf = tN.f; Msrc = inM.value; Nsrc = inN.value;

      /* sample exactness error over a grid */
      var maxErr = 0, maxAbs = 0, bad = 0, at = null, pts = 0;
      for (var i = 0; i <= 12; i++) {
        for (var j = 0; j <= 12; j++) {
          var x = -D + 2 * D * i / 12, y = -D + 2 * D * j / 12;
          var a = dY(Mf, x, y), b = dX(Nf, x, y);
          if (!isFinite(a) || !isFinite(b)) { bad++; continue; }
          pts++;
          var e = Math.abs(a - b);
          if (e > maxErr) { maxErr = e; at = [x, y, a, b]; }
          maxAbs = Math.max(maxAbs, Math.abs(a), Math.abs(b));
        }
      }
      var scale = Math.max(1e-9, maxAbs);
      var isExact = pts > 0 && maxErr / scale < 2e-4;
      if (bad > 40) isExact = false;

      /* draw */
      plot.background().grid();
      var M0 = Mf(Math.max(-D, 0), 0), N0 = Nf(0, Math.max(-D, 0));
      /* direction field of dy/dx = -M/N */
      var fq = function (x, y) {
        var n = Nf(x, y), m = Mf(x, y);
        return (Math.abs(n) < 1e-12) ? NaN : -m / n;
      };
      plot.field(fq, { nx: 26, ny: 18, len: 0.5, alpha: 0.42, color: ODE.cssVar('--muted') });

      if (isExact) {
        var bx = 0, by = 0; /* base point; only shifts F by a constant */
        var F = function (x, y) {
          var v = simpson(function (t) { return Mf(t, by); }, bx, x, 60) +
            simpson(function (s) { return Nf(x, s); }, by, y, 60);
          return isFinite(v) ? v : NaN;
        };
        /* pick levels from quantiles of F over the grid */
        var vals = [];
        for (var a1 = 0; a1 <= 20; a1++) {
          for (var a2 = 0; a2 <= 20; a2++) {
            var vv = F(-D + 2 * D * a1 / 20, -D + 2 * D * a2 / 20);
            if (isFinite(vv)) vals.push(vv);
          }
        }
        vals.sort(function (p, q) { return p - q; });
        var levels = [];
        if (vals.length > 30) {
          var lo = vals[Math.floor(vals.length * 0.06)], hi = vals[Math.floor(vals.length * 0.94)];
          for (var k = 1; k <= 9; k++) { levels.push(lo + (hi - lo) * k / 10); }
        }
        var pal = ['--brand', '--ex', '--prac', '--thm', '--def'];
        plot.contour(F, levels, {
          N: 100,
          colors: levels.map(function (_, i) { return ODE.cssVar(pal[i % pal.length]); }),
          alpha: 0.9, width: 1.7
        });
      }

      out.innerHTML =
        '<div class="verdict ' + (isExact ? 'ok' : 'bad') + '">' +
        (isExact ? '✓ 正合 (EXACT) —— ∂M/∂y = ∂N/∂x，解法就是找 F 使 dF = M dx + N dy，解為 F(x,y) = c'
          : '✗ 不正合 (NOT exact) —— ∂M/∂y ≠ ∂N/∂x，需要先乘積分因子 F(x) 或 F(y)') + '</div>' +
        '<div class="readout" style="margin-top:10px">' +
        '<div class="kv"><span class="k">∂M/∂y 的取樣最大值</span><span class="v">' + ODE.fmt(maxAbs, 4) + '</span></div>' +
        '<div class="kv"><span class="k">max |∂M/∂y − ∂N/∂x|</span><span class="v">' + ODE.fmt(maxErr, 4) + '</span></div>' +
        (at ? '<div class="kv"><span class="k">誤差最大處 (x, y)</span><span class="v">(' + ODE.fmt(at[0], 2) + ', ' + ODE.fmt(at[1], 2) + ')</span></div>' +
          '<div class="kv"><span class="k">該點 ∂M/∂y / ∂N/∂x</span><span class="v">' + ODE.fmt(at[2], 3) + ' / ' + ODE.fmt(at[3], 3) + '</span></div>' : '') +
        '<div class="hint" style="margin-top:5px">' +
        (isExact ? '彩色曲線是 F(x,y) = c 的等值線 —— 每一條都是一個解（隱式）。灰色短線是方向場，可以看到解切於等值線。'
          : '灰色短線是 dy/dx = −M/N 的方向場。要找積分因子時先試 (M_y − N_x)/N 是否只含 x，或 (N_x − M_y)/M 是否只含 y。') +
        '</div></div>';
      ODE.render.typeset(out);
      if (!isExact) {
        /* still show a couple of numeric solution curves */
        var traces = [[-2.4, 1.4], [2.4, -1.4], [0.4, 2.4]];
        traces.forEach(function (t) { plot.poly(plot.rk(fq, t[0], t[1], { n: 700 }), { color: ODE.cssVar('--brand'), width: 2 }); });
      }
    }

    G.right.appendChild(U.fld('範例（M dx + N dy = 0）', U.chips(presets.map(function (p, i) {
      return { label: p.l, on: i === 0 };
    }), function (p) { inM.value = p.M; inN.value = p.N; update(); })));
    G.right.appendChild(U.fld('M(x, y)', inM));
    G.right.appendChild(U.fld('N(x, y)', inN));
    inM.oninput = update; inN.oninput = update;

    var zoomRow = ODE.el('div', 'row');
    [['範圍 ±3', 3], ['範圍 ±6', 6], ['範圍 ±1.5', 1.5]].forEach(function (z, i) {
      var b = ODE.el('button', 'btn' + (i === 0 ? ' primary' : ''), z[0]);
      b.onclick = function () {
        D = z[1]; plot.xmin = -D; plot.xmax = D; plot.ymin = -D; plot.ymax = D;
        Array.prototype.forEach.call(zoomRow.children, function (c) { c.classList.remove('primary'); });
        b.classList.add('primary');
        update();
      };
      zoomRow.appendChild(b);
    });
    G.right.appendChild(U.fld('檢驗範圍', zoomRow));

    ODE.redraws.push(function () { plot.resize(); update(); });
    update();
    return L.root;
  }

  /* ======================================================================
     LAB 6 — Wronskian 檢測器
     ====================================================================== */
  function wronskLab() {
    var L = U.lab('⚖️', 'Wronskian 檢測器 · 線性獨立嗎？',
      '輸入兩個函數 y₁(x)、y₂(x)，看 W = y₁y₂′ − y₂y₁′ 是否恆為 0 —— 恆 0 就是線性相依');
    var G = U.grid(L.body);
    var cv = ODE.el('canvas');
    var cv2 = ODE.el('canvas');
    cv2.style.height = '120px'; cv2.style.marginTop = '10px'; cv2.style.cursor = 'default';
    G.left.appendChild(cv); G.left.appendChild(cv2);
    var out = ODE.el('div'); out.style.marginTop = '10px'; G.left.appendChild(out);

    var p1 = new ODE.Plot(cv, { h: 230, xmin: -3, xmax: 3, ymin: -3, ymax: 3 });
    var p2 = new ODE.Plot(cv2, { h: 120, xmin: -3, xmax: 3, ymin: -3, ymax: 3, pad: { l: 34, r: 12, t: 10, b: 18 } });

    var presets = [
      { l: 'e^{2x}, e^{3x}', a: 'exp(2*x)', b: 'exp(3*x)', dep: false, r: [-1.5, 1.5] },
      { l: 'x, 3x', a: 'x', b: '3*x', dep: true, r: [-3, 3] },
      { l: 'sin x, cos x', a: 'sin(x)', b: 'cos(x)', dep: false, r: [-6, 6] },
      { l: 'x, x²', a: 'x', b: 'x^2', dep: false, r: [-3, 3] },
      { l: 'e^x, x·e^x', a: 'exp(x)', b: 'x*exp(x)', dep: false, r: [-3, 3] },
      { l: 'x², 2x² − 1 ?', a: 'x^2', b: '2*x^2-1', dep: false, r: [-3, 3] },
      { l: 'e^{−x}, 4e^{−x}', a: 'exp(-x)', b: '4*exp(-x)', dep: true, r: [-3, 3] },
      { l: 'x, |x| ?', a: 'x', b: 'abs(x)', dep: true, r: [-3, 3] }
    ];
    var inA = U.textInput(presets[0].a), inB = U.textInput(presets[0].b);
    var R = [-3, 3];

    function update() {
      var ta = ODE.tryCompile(inA.value), tb = ODE.tryCompile(inB.value);
      if (ta.err || tb.err) {
        out.innerHTML = '<div class="verdict bad">✗ ' + ODE.esc(ta.err || tb.err) + '</div>';
        p1.background().grid(); p2.background().grid();
        return;
      }
      var f1 = ta.f, f2 = tb.f;
      var N = 400, xs = [], s1 = [], s2 = [], W = [];
      var maxW = 0, maxY = 0.5, zeroish = 0, cnt = 0;
      for (var i = 0; i <= N; i++) {
        var x = R[0] + (R[1] - R[0]) * i / N;
        var a = f1(x, 0), b = f2(x, 0);
        var da = dX(function (xx) { return f1(xx, 0); }, x, 0);
        var db = dX(function (xx) { return f2(xx, 0); }, x, 0);
        var w = a * db - b * da;
        xs.push(x); s1.push([x, a]); s2.push([x, b]); W.push([x, w]);
        if (isFinite(w)) { maxW = Math.max(maxW, Math.abs(w)); cnt++; if (Math.abs(w) < 1e-6) zeroish++; }
        if (isFinite(a)) maxY = Math.max(maxY, Math.abs(a));
        if (isFinite(b)) maxY = Math.max(maxY, Math.abs(b));
      }
      var allZero = cnt > 0 && zeroish / cnt > 0.9;
      var relMax = maxW / Math.max(1, maxY * maxY);

      p1.xmin = R[0]; p1.xmax = R[1]; p1.ymin = -maxY * 1.15; p1.ymax = maxY * 1.15;
      p1.background().grid();
      p1.poly(s1, { color: ODE.cssVar('--brand'), width: 2.2 });
      p1.poly(s2, { color: ODE.cssVar('--ex'), width: 2.2 });
      p1.label(R[1] * 0.97, maxY * 0.85, 'y₁（藍）／ y₂（橘）', { align: 'right', color: ODE.cssVar('--muted') });

      p2.xmin = R[0]; p2.xmax = R[1]; p2.ymin = -maxW * 1.25 - 1e-9; p2.ymax = maxW * 1.25 + 1e-9;
      p2.background().grid();
      p2.poly(W, { color: ODE.cssVar('--thm'), width: 2.2 });
      p2.label(R[1] * 0.97, maxW * 0.8, 'W(x)', { align: 'right', color: ODE.cssVar('--muted') });

      out.innerHTML =
        '<div class="verdict ' + (allZero ? 'bad' : 'ok') + '">' +
        (allZero ? '線性相依 (dependent) —— W(x) ≡ 0，兩個函數只差一個常數倍'
          : '線性獨立 (independent) —— W(x) 不恆為 0，可以當作解的基底') + '</div>' +
        '<div class="readout" style="margin-top:10px">' +
        '<div class="kv"><span class="k">max |W(x)|</span><span class="v">' + ODE.fmt(maxW, 5) + '</span></div>' +
        '<div class="kv"><span class="k">W 為 0 的取樣比例</span><span class="v">' + (cnt ? (100 * zeroish / cnt).toFixed(1) + '%' : '—') + '</span></div>' +
        '<div class="hint" style="margin-top:5px">判斷口訣：<b>W 恆為 0 → 相依；只要有一點 W ≠ 0 → 獨立</b>' +
        '（前提是兩者都是同一個二階齊次線性方程的解；否則 W≠0 只證明獨立）。</div></div>';
      ODE.render.typeset(out);
    }

    G.right.appendChild(U.fld('範例配對', U.chips(presets.map(function (p, i) { return { label: p.l, on: i === 0 }; }),
      function (p) { inA.value = p.a; inB.value = p.b; R = p.r.slice(); syncR(); update(); })));
    G.right.appendChild(U.fld('y₁(x)', inA));
    G.right.appendChild(U.fld('y₂(x)', inB));
    inA.oninput = update; inB.oninput = update;
    var rrow = ODE.el('div', 'row');
    var rlo = U.numInput(-3, 0.5), rhi = U.numInput(3, 0.5);
    rlo.style.width = '60px'; rhi.style.width = '60px';
    function syncR() { rlo.value = R[0]; rhi.value = R[1]; }
    rlo.oninput = function () { var v = parseFloat(rlo.value); if (isFinite(v) && v < R[1]) { R[0] = v; update(); } };
    rhi.oninput = function () { var v = parseFloat(rhi.value); if (isFinite(v) && v > R[0]) { R[1] = v; update(); } };
    rrow.appendChild(rlo); rrow.appendChild(rhi);
    G.right.appendChild(U.fld('x 範圍', rrow));
    var note = ODE.el('div', 'hint');
    note.innerHTML = '小提醒：「x 與 |x| 在整個 \\((-\\infty,\\infty)\\) 上 W ≡ 0 但其實線性獨立」' +
      '—— 這是因為它們不是同一個二階齊次線性方程的一組解。考試考的是定理的前提。';
    G.right.appendChild(note);

    syncR();
    ODE.redraws.push(function () { p1.resize(); p2.resize(); update(); });
    update();
    return L.root;
  }

  /* ======================================================================
     LAB 7 — 一階線性 / 積分因子視覺化
     ====================================================================== */
  function linearLab() {
    var L = U.lab('🧮', '積分因子視覺化 · y′ + p(x)y = r(x)',
      '看積分因子 μ(x) = e^{∫p dx} 長什麼樣，以及所有解如何被 μ 拉成 μy = ∫μr dx + C');
    var G = U.grid(L.body);
    var cv = ODE.el('canvas');
    G.left.appendChild(cv);
    var out = ODE.el('div'); out.style.marginTop = '10px'; G.left.appendChild(out);
    var plot = new ODE.Plot(cv, { h: 300, xmin: -2, xmax: 6, ymin: -4, ymax: 4 });

    var presets = [
      { l: "y′ + y = e^{2x}", p: '1', r: 'exp(2*x)', s: 'μ = e^{x}', note: '教科書標準題：μ = e^{∫1 dx} = e^x' },
      { l: "y′ + 2y/x = 4x", p: '2/x', r: '4*x', s: 'μ = x²（x>0）', note: 'x 出現在係數 → μ = x²' },
      { l: "y′ + y tan x = sin 2x", p: 'tan(x)', r: 'sin(2*x)', s: 'μ = sec x', note: '∫tan x dx = −ln|cos x|' },
      { l: "y′ − y = e^{−x}", p: '-1', r: 'exp(-x)', s: 'μ = e^{−x}', note: '' },
      { l: "y′ + y/x = 1", p: '1/x', r: '1', s: 'μ = x', note: '' },
      { l: "y′ + y = x", p: '1', r: 'x', s: 'μ = e^{x}', note: '注意 x 的範圍限制在 x>0 之外也要小心' }
    ];
    var inP = U.textInput(presets[0].p), inR = U.textInput(presets[0].r);
    var x0 = 0.15, X = [-2, 6];

    function update() {
      var tp = ODE.tryCompile(inP.value), tr = ODE.tryCompile(inR.value);
      if (tp.err || tr.err) {
        out.innerHTML = '<div class="verdict bad">✗ ' + ODE.esc(tp.err || tr.err) + '</div>';
        plot.background().grid(); return;
      }
      var pf = tp.f, rf = tr.f;
      var f = function (x, y) { var v = rf(x, y) - pf(x, y) * y; return isFinite(v) ? v : NaN; };

      plot.background().grid();
      plot.field(f, { nx: 28, ny: 18, len: 0.5, alpha: 0.45, color: ODE.cssVar('--muted') });
      var ics = [[X[0] + 0.2, -3], [X[0] + 0.2, 0], [X[0] + 0.2, 1.5], [X[0] + 0.2, 3.2], [2.5, -2]];
      ics.forEach(function (ic) {
        plot.poly(plot.rk(f, ic[0], ic[1], { n: 900 }), { color: ODE.cssVar('--brand'), width: 1.9 });
      });

      /* mu(x) = exp(int p) referenced to the middle of the window */
      var ref = 0;
      var mu = [];
      var ACC = [0];
      var N = 600, dx = (X[1] - X[0]) / N;
      for (var i = 1; i <= N; i++) {
        var xa = X[0] + (i - 1) * dx, xb = X[0] + i * dx;
        var pm = pf((xa + xb) / 2, 0);
        ACC.push(ACC[i - 1] + (isFinite(pm) ? pm * dx : 0));
      }
      var muAt = function (x) {
        if (x < X[0] || x > X[1]) return NaN;
        var t = (x - X[0]) / dx;
        var i0 = Math.floor(t), fr = t - i0;
        if (i0 >= N) i0 = N - 1, fr = 1;
        var v = ACC[i0] + (ACC[i0 + 1] - ACC[i0]) * fr;
        return Math.exp(v - acc0);
      };
      var acc0 = ACC[Math.round((ref - X[0]) / dx)] || 0;
      for (var k = 0; k <= N; k++) {
        var xx = X[0] + k * dx;
        mu.push([xx, muAt(xx)]);
      }
      var muMax = 0; mu.forEach(function (m) { if (isFinite(m[1])) muMax = Math.max(muMax, Math.abs(m[1])); });
      if (muMax > 0) {
        /* draw mu on a secondary scale inside the same canvas (normalised, dashed) */
        var sc = Math.min((plot.ymax - plot.ymin) * 0.42 / muMax, 1e9);
        var muScaled = mu.map(function (m) { return [m[0], m[1] * sc + (plot.ymin + plot.ymax) / 2]; });
        plot.poly(muScaled, { color: ODE.cssVar('--prac'), width: 1.8, dash: [5, 4] });
      }
      plot.label(X[1] * 0.96, plot.ymin + (plot.ymax - plot.ymin) * 0.92,
        '紫色虛線 = μ(x)（縮放後）', { align: 'right', color: ODE.cssVar('--prac') });
      plot.label(X[1] * 0.96, plot.ymin + (plot.ymax - plot.ymin) * 0.80,
        '藍線 = 5 條不同初值的解', { align: 'right', color: ODE.cssVar('--brand') });

      var pv = pf(2, 0), rv = rf(2, 0), mv = muAt(2);
      out.innerHTML =
        '<div class="readout"><div style="font-weight:800;margin-bottom:6px">解法結構</div>' +
        '<div>\\(\\mu(x) = e^{\\int p\\,dx}\\)，乘上去之後 \\(\\left(\\mu y\\right)\' = \\mu r\\)，' +
        '所以 \\(y = \\dfrac{1}{\\mu}\\left(\\int \\mu r\\,dx + C\\right)\\)。</div>' +
        '<div class="kv" style="margin-top:7px"><span class="k">p(2)</span><span class="v">' + ODE.fmt(pv, 4) + '</span></div>' +
        '<div class="kv"><span class="k">r(2)</span><span class="v">' + ODE.fmt(rv, 4) + '</span></div>' +
        '<div class="kv"><span class="k">μ(2)（以 x=0 為參考點）</span><span class="v">' + ODE.fmt(mv, 4) + '</span></div>' +
        '<div class="hint" style="margin-top:5px">' + ODE.esc(presets.noteText || '') + '</div></div>';
      ODE.render.typeset(out);
    }

    G.right.appendChild(U.fld('範例題目', U.chips(presets.map(function (p, i) { return { label: p.l, on: i === 0 }; }),
      function (p) { inP.value = p.p; inR.value = p.r; presets.noteText = p.note; update(); })));
    G.right.appendChild(U.fld('p(x)　（y′ + p y = r 的係數）', inP));
    G.right.appendChild(U.fld('r(x)　（右邊項）', inR));
    inP.oninput = update; inR.oninput = update;
    G.right.appendChild(U.fld('視窗', (function () {
      var row = ODE.el('div', 'row');
      [['x>0 區間', 0.05, 6], ['全區間', -2, 6], ['大範圍', -3, 12]].forEach(function (z, i) {
        var b = ODE.el('button', 'btn' + (i === 1 ? ' primary' : ''), z[0]);
        b.onclick = function () {
          X = [z[1], z[2]]; plot.xmin = X[0]; plot.xmax = X[1];
          plot.ymin = -4; plot.ymax = 4;
          Array.prototype.forEach.call(row.children, function (c) { c.classList.remove('primary'); });
          b.classList.add('primary'); update();
        };
        row.appendChild(b);
      });
      return row;
    })()));
    presets.noteText = presets[0].note;
    ODE.redraws.push(function () { plot.resize(); update(); });
    update();
    return L.root;
  }

  /* ======================================================================
     LAB 8 — 存在與唯一性檢驗器
     ====================================================================== */
  function existsLab() {
    var L = U.lab('🧭', '存在／唯一性檢驗器 · 抓出「不唯一」的現場',
      '輸入 f(x,y) 與初始點，機器量測 ∂f/∂y 在附近是否有界，並畫出可能的解');
    var G = U.grid(L.body);
    var cv = ODE.el('canvas');
    G.left.appendChild(cv);
    var out = ODE.el('div'); out.style.marginTop = '10px'; G.left.appendChild(out);
    var plot = new ODE.Plot(cv, { h: 300, xmin: -1.2, xmax: 1.6, ymin: -0.6, ymax: 1.6 });

    var presets = [
      { l: 'y′ = y^(2/3)，y(0)=0  ← 不唯一！', f: 'y^(2/3)', x0: 0, y0: 0, r: [-1.2, 1.6, -0.6, 1.6], n: '反例：∂f/∂y = (2/3)y^(−1/3) 在 y=0 無界' },
      { l: 'y′ = y^(2/3)，y(0)=1  ← 唯一', f: 'y^(2/3)', x0: 0, y0: 1, r: [-1, 3, -0.5, 3], n: '遠離 y=0，導數有界 → Lipschitz 成立' },
      { l: 'y′ = 1 + y²，y(0)=0  ← 唯一但會爆', f: '1+y^2', x0: 0, y0: 0, r: [-1.6, 1.6, -2, 4], n: '解 y=tan x 只在 |x|<π/2 存在' },
      { l: 'y′ = √|y|，y(0)=0  ← 不唯一', f: 'sqrt(abs(y))', x0: 0, y0: 0, r: [-1, 1.6, -0.4, 1.2], n: '另一族解 y=(x−c)²/4' },
      { l: 'y′ = y　（標準良好情況）', f: 'y', x0: 0, y0: 1, r: [-1, 2, -0.5, 4], n: 'f、f_y 都連續 → 存在且唯一' },
      { l: 'y′ = −y²，y(0)=1  ← 唯一但爆', f: '-y^2', x0: 0, y0: 1, r: [-1, 2, -1, 3], n: '解 y = 1/(x+1)，在 x=−1 爆掉' },
      { l: 'y′ = x/y，y(0)=0  ← 分母 0', f: 'x/y', x0: 0.3, y0: 0.3, r: [-1.5, 1.5, -0.9, 1.5], n: 'f 本身在 y=0 不連續 → 連存在性都沒有' }
    ];
    var inF = U.textInput(presets[0].f);
    var inX0 = U.numInput(0, 0.1), inY0 = U.numInput(0, 0.1);
    inX0.style.width = '70px'; inY0.style.width = '70px';
    var A = 0.6, B = 0.6, cur = presets[0];

    function update() {
      var t = ODE.tryCompile(inF.value);
      X0 = parseFloat(inX0.value); Y0 = parseFloat(inY0.value);
      if (t.err || !isFinite(X0) || !isFinite(Y0)) {
        out.innerHTML = '<div class="verdict bad">✗ ' + ODE.esc(t.err || '初始點要填數字') + '</div>';
        plot.background().grid(); return;
      }
      var f = t.f;
      /* measure f and f_y over the rectangle, skipping non-finite regions */
      var Mmax = 0, Kmax = 0, badF = 0, badD = 0, tot = 0, grid = 14;
      for (var i = 0; i <= grid; i++) {
        for (var j = 0; j <= grid; j++) {
          var x = X0 - A + 2 * A * i / grid, y = Y0 - B + 2 * B * j / grid;
          var v = f(x, y);
          tot++;
          if (!isFinite(v)) { badF++; continue; }
          Mmax = Math.max(Mmax, Math.abs(v));
          var d = dY(f, x, y);
          if (!isFinite(d)) { badD++; continue; }
          Kmax = Math.max(Kmax, Math.abs(d));
        }
      }
      var fContinuous = badF / tot < 0.35;
      var fyBounded = (badD / tot) < 0.10 && isFinite(Kmax);
      var lip = fContinuous && fyBounded;
      var hExist = fContinuous && Mmax > 0 ? Math.min(A, B / Mmax) : A;

      plot.background().grid();
      plot.field(f, { nx: 26, ny: 18, len: 0.5, alpha: 0.45, color: ODE.cssVar('--muted') });
      /* trajectories from perturbed initial points -> shows splitting when non-unique */
      var offs = lip ? [[0, 0], [0.04, 0], [-0.04, 0], [0, 0.05], [0, -0.05]]
        : [[0, 0], [0.02, 0], [-0.02, 0], [0.05, 0], [-0.05, 0]];
      offs.forEach(function (o, i) {
        var s = plot.rk(f, X0 + o[0], Y0 + o[1], { n: 800 });
        plot.poly(s, { color: i === 0 ? ODE.cssVar('--ex') : ODE.cssVar('--brand'), width: i === 0 ? 2.6 : 1.6 });
      });
      plot.dot(X0, Y0, { r: 5 });
      plot.label(X0, Y0, '(x₀, y₀)', { dx: 8, dy: -12, color: ODE.cssVar('--ex') });
      /* the rectangle R */
      plot.poly([[X0 - A, Y0 - B], [X0 + A, Y0 - B], [X0 + A, Y0 + B], [X0 - A, Y0 + B], [X0 - A, Y0 - B]],
        { color: ODE.cssVar('--prac'), width: 1.3, dash: [4, 4] });

      out.innerHTML =
        '<div class="verdict ' + (lip ? 'ok' : 'bad') + '">' +
        (lip ? '✓ f 連續、∂f/∂y 在 R 上有界（K ≈ ' + ODE.fmt(Kmax, 3) + '）→ Picard–Lindelöf 保證：存在且唯一'
          : '⚠ Lipschitz 條件在這個 R 上失效（' + (fContinuous ? '∂f/∂y 無界' : 'f 本身不連續') + '）→ 定理不保證唯一，實際也常常真的不唯一') +
        '</div>' +
        '<div class="readout" style="margin-top:10px">' +
        '<div class="kv"><span class="k">R：|x−x₀| ≤ a = ' + ODE.fmt(A, 2) + '，|y−y₀| ≤ b = ' + ODE.fmt(B, 2) + '</span><span class="v">虛線框</span></div>' +
        '<div class="kv"><span class="k">M = max|f| 在 R 上</span><span class="v">' + ODE.fmt(Mmax, 4) + '</span></div>' +
        '<div class="kv"><span class="k">估計 Lipschitz 常數 K</span><span class="v">' + (fyBounded ? ODE.fmt(Kmax, 4) : '∞（無界）') + '</span></div>' +
        '<div class="kv"><span class="k">保證區間 h = min(a, b/M)</span><span class="v">' + (fContinuous ? ODE.fmt(hExist, 4) : '—') + '</span></div>' +
        '<div class="hint" style="margin-top:5px">' + ODE.esc(cur.n || '') + '</div></div>';
      ODE.render.typeset(out);
    }

    var X0 = 0, Y0 = 0;
    G.right.appendChild(U.fld('範例', U.chips(presets.map(function (p, i) { return { label: p.l, on: i === 0 }; }),
      function (p) {
        cur = p; inF.value = p.f; inX0.value = p.x0; inY0.value = p.y0;
        plot.xmin = p.r[0]; plot.xmax = p.r[1]; plot.ymin = p.r[2]; plot.ymax = p.r[3];
        update();
      })));
    G.right.appendChild(U.fld('f(x, y)', inF));
    var row = ODE.el('div', 'row');
    row.appendChild(ODE.el('span', 'hint', 'x₀')); row.appendChild(inX0);
    row.appendChild(ODE.el('span', 'hint', 'y₀')); row.appendChild(inY0);
    G.right.appendChild(U.fld('初始點', row));
    inF.oninput = update;

    var aOut = ODE.el('span', 'rv', 'a = 0.6'), bOut = ODE.el('span', 'rv', 'b = 0.6');
    var rl = [[G.right, 'R 的半寬 a', 'a']];
    function mkR(label, val, set, outEl) {
      var s = U.slider(0.05, 2, 0.05, val);
      s.oninput = function () { set(parseFloat(s.value)); outEl.textContent = label + ' = ' + s.value; update(); };
      var wrap = ODE.el('div');
      wrap.appendChild(s); wrap.appendChild(outEl);
      G.right.appendChild(U.fld(label, wrap));
    }
    mkR('R 的半寬 a', 0.6, function (v) { A = v; }, aOut);
    mkR('R 的半高 b', 0.6, function (v) { B = v; }, bOut);

    var note = ODE.el('div', 'hint');
    note.innerHTML = '圖上有多條從 \\((x_0,y_0)\\) 極近處出發的軌跡：' +
      '<b>如果它們一離開就分岔成不同曲線，就是「不唯一」的視覺證據</b>（例如 \\(y\'=y^{2/3}\\) 在 \\((0,0)\\)）。';
    G.right.appendChild(note);

    ODE.redraws.push(function () { plot.resize(); update(); });
    update();
    return L.root;
  }

  /* ---------- register + section mounts ---------- */
  ODE.widgets = ODE.widgets || {};
  ODE.widgets.labs = ODE.widgets.labs || {};
  ODE.widgets.labs.exact = exactLab;
  ODE.widgets.labs.wronsk = wronskLab;
  ODE.widgets.labs.linear = linearLab;
  ODE.widgets.labs.exists = existsLab;

  ODE.widgets.mount = function (wrap, secId) {
    var plan = (ODE.widgets.plan || {})[secId];
    if (!plan) return;
    plan.forEach(function (p) {
      var fn = ODE.widgets.labs[p.lab];
      if (!fn) return;
      try {
        wrap.appendChild(fn(p.opts || {}));
        ODE.render.typeset(wrap.lastChild);
      } catch (e) {
        var err = ODE.el('div', 'verdict bad', '⚠ 這個互動元件載入失敗：' + ODE.esc(e.message));
        wrap.appendChild(err);
        if (window.console) console.error('[lab ' + p.lab + ']', e);
      }
    });
  };
})();
