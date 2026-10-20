/* ==========================================================================
   widgets.js — interactive labs (part 1): field · roots · spring · euler
   ========================================================================== */
window.ODE = window.ODE || {};

(function () {
  'use strict';

  /* ---------- shared scaffolding ---------- */
  function lab(icon, title, sub) {
    var root = ODE.el('div', 'wid');
    root.innerHTML = '<div class="wh"><span class="ic">' + icon + '</span><span class="ti">' +
      ODE.esc(title) + (sub ? '<small>' + ODE.esc(sub) + '</small>' : '') + '</span></div>';
    var body = ODE.el('div', 'wb');
    root.appendChild(body);
    return { root: root, body: body };
  }
  function grid(body) {
    var g = ODE.el('div', 'wgrid');
    var left = ODE.el('div');
    var right = ODE.el('div', 'wctl');
    g.appendChild(left); g.appendChild(right); body.appendChild(g);
    return { left: left, right: right };
  }
  function fld(label, ctrl, hint) {
    var d = ODE.el('div', 'fld');
    d.innerHTML = '<label>' + ODE.esc(label) + '</label>';
    d.appendChild(ctrl);
    if (hint) {
      var h = ODE.el('div', 'hint', ODE.esc(hint));
      d.appendChild(h);
    }
    return d;
  }
  function numInput(val, step, min, max) {
    var i = ODE.el('input');
    i.type = 'number'; i.value = val;
    if (step != null) i.step = step;
    if (min != null) i.min = min;
    if (max != null) i.max = max;
    return i;
  }
  function textInput(val) {
    var i = ODE.el('input');
    i.type = 'text'; i.value = val; i.spellcheck = false;
    i.style.fontFamily = 'var(--mono)';
    return i;
  }
  function slider(min, max, step, val, out) {
    var i = ODE.el('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val;
    return i;
  }
  function chips(items, onPick) {
    var w = ODE.el('div', 'chips');
    items.forEach(function (it, k) {
      var b = ODE.el('button', 'chip' + (it.on ? ' on' : ''), ODE.esc(it.label));
      b.title = it.title || it.label;
      b.onclick = function () {
        Array.prototype.forEach.call(w.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        onPick(it, k);
      };
      w.appendChild(b);
    });
    return w;
  }
  function kv(pairs) {
    var d = ODE.el('div', 'readout');
    d.innerHTML = pairs.map(function (p) {
      return '<div class="kv"><span class="k">' + p[0] + '</span><span class="v">' + p[1] + '</span></div>';
    }).join('');
    return d;
  }
  function mathBox(html) {
    var d = ODE.el('div', 'readout');
    d.style.fontSize = '14px';
    d.innerHTML = html;
    ODE.render.typeset(d);
    return d;
  }
  ODE.labUI = { lab: lab, grid: grid, fld: fld, numInput: numInput, textInput: textInput,
    slider: slider, chips: chips, kv: kv, mathBox: mathBox };

  /* ---------- RK4 for the system y'=v, v'=-a v - b y ---------- */
  function solve2(a, b, y0, v0, x0, x1, n) {
    n = n || 1200;
    var h = (x1 - x0) / n, x = x0, y = y0, v = v0, out = [[x, y]];
    function acc(y, v) { return -a * v - b * y; }
    for (var i = 0; i < n; i++) {
      var k1y = v, k1v = acc(y, v);
      var k2y = v + h * k1v / 2, k2v = acc(y + h * k1y / 2, v + h * k1v / 2);
      var k3y = v + h * k2v / 2, k3v = acc(y + h * k2y / 2, v + h * k2v / 2);
      var k4y = v + h * k3v, k4v = acc(y + h * k3y, v + h * k3v);
      y += h * (k1y + 2 * k2y + 2 * k3y + k4y) / 6;
      v += h * (k1v + 2 * k2v + 2 * k3v + k4v) / 6;
      x += h;
      if (!isFinite(y)) break;
      out.push([x, y]);
    }
    return out;
  }

  /* ======================================================================
     LAB 1 — 方向場實驗室
     ====================================================================== */
  function fieldLab(opts) {
    opts = opts || {};
    var L = lab('📈', opts.title || '方向場實驗室 · Direction Field Lab',
      '畫出 y′ = f(x, y) 的斜率場；在圖上點一下（或拖曳）就畫出通過該點的積分曲線');
    var G = grid(L.body);
    var cv = ODE.el('canvas');
    G.left.appendChild(cv);
    var info = ODE.el('div', 'readout');
    info.style.marginTop = '10px';
    G.left.appendChild(info);
    var plot = new ODE.Plot(cv, { h: opts.h || 340, xmin: -5, xmax: 5, ymin: -5, ymax: 5 });

    var presets = opts.presets || [
      { label: "y′ = y", eq: 'y', r: [-3, 3, -3, 3] },
      { label: "y′ = −2y", eq: '-2*y', r: [-3, 3, -2, 2] },
      { label: "y′ = x + y", eq: 'x+y', r: [-4, 4, -4, 4] },
      { label: "y′ = 1 + y²", eq: '1+y^2', r: [-3, 3, -3, 3] },
      { label: "y′ = y(1−y)", eq: 'y*(1-y)', r: [-2, 5, -1, 2] },
      { label: "y′ = x² − y", eq: 'x^2-y', r: [-3, 3, -3, 5] }
    ];

    var current = { f: null, eq: '' };
    var traces = [];
    var armed = -1;
    var pointer = null;

    var eqInput = textInput(presets[0].eq);
    var errBox = ODE.el('div', 'hint');
    var range = { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };

    function setEq(src) {
      var t = ODE.tryCompile(src);
      if (t.err) {
        current.f = null;
        errBox.innerHTML = '<span style="color:var(--bad)">✗ ' + ODE.esc(t.err) + '</span>';
      } else {
        current.f = t.f; current.eq = src;
        errBox.innerHTML = '<span style="color:var(--ok)">✓ 運算式可以解析</span>';
      }
      draw();
    }

    function draw() {
      plot.xmin = range.xmin; plot.xmax = range.xmax;
      plot.ymin = range.ymin; plot.ymax = range.ymax;
      plot.background().grid();
      if (current.f) {
        plot.field(current.f, { nx: Math.max(18, Math.round(plot.w / 26)), ny: 18, len: 0.5 });
        traces.forEach(function (t, i) {
          var dense = plot.rk(current.f, t[0], t[1], { n: 1100 });
          plot.poly(dense, {
            color: i === traces.length - 1 ? ODE.cssVar('--ex') : ODE.cssVar('--brand'),
            width: i === traces.length - 1 ? 2.8 : 1.9,
            glow: true
          });
        });
        traces.forEach(function (t) { plot.dot(t[0], t[1], { r: 4 }); });
      }
      if (pointer && current.f) {
        var m = current.f(pointer.x, pointer.y);
        /* keep the hover label inside the canvas: flip side near the right edge */
        var frac = (pointer.x - range.xmin) / (range.xmax - range.xmin);
        var right = frac > 0.62;
        plot.label(pointer.x, Math.min(Math.max(pointer.y, range.ymin + (range.ymax - range.ymin) * 0.06),
          range.ymax - (range.ymax - range.ymin) * 0.06),
          '(' + ODE.fmt(pointer.x, 2) + ', ' + ODE.fmt(pointer.y, 2) + ')  y′=' + ODE.fmt(m, 3),
          { dx: right ? -8 : 8, dy: -10, align: right ? 'right' : 'left', color: ODE.cssVar('--muted') });
        plot.dot(pointer.x, pointer.y, { r: 3, color: ODE.cssVar('--muted') });
      }
      renderInfo();
    }

    function renderInfo() {
      var t = traces[traces.length - 1];
      info.innerHTML =
        '<div style="margin-bottom:6px">目前方程：\\(' + 'y\' = ' + texEq(current.eq || '\\text{—}') + '\\)</div>' +
        '<div class="hint">已畫出 <b>' + traces.length + '</b> 條軌跡' +
        (t ? '　最新起點：\\((' + ODE.fmt(t[0], 2) + ', ' + ODE.fmt(t[1], 2) + ')\\)' : '　（在圖上點一下開始）') +
        '</div>' +
        '<div class="hint">拖曳可以連續改變起點；雙擊圖面清除全部。</div>';
      ODE.render.typeset(info);
    }

    function texEq(src) {
      return String(src).replace(/\*/g, '\\cdot ');
    }

    /* controls */
    G.right.appendChild(fld('範例方程 · Presets',
      chips(presets.map(function (p, i) { return { label: p.label, on: i === 0, title: p.eq }; }), function (p) {
        eqInput.value = p.eq;
        if (p.r) { range.xmin = p.r[0]; range.xmax = p.r[1]; range.ymin = p.r[2]; range.ymax = p.r[3]; syncRange(); }
        setEq(p.eq);
      })));
    G.right.appendChild(fld('自訂 f(x, y)', eqInput));
    G.right.appendChild(errBox);

    var row = ODE.el('div', 'row');
    [['xmin', 'xmin'], ['xmax', 'xmax'], ['ymin', 'ymin'], ['ymax', 'ymax']].forEach(function (p) {
      var inp = numInput(range[p[0]], 1);
      inp.style.width = '52px'; inp.title = p[0];
      inp.oninput = function () {
        var v = parseFloat(inp.value);
        if (isFinite(v)) { range[p[0]] = v; draw(); }
      };
      inp.dataset.k = p[0];
      row.appendChild(inp);
    });
    G.right.appendChild(fld('視窗範圍 xmin xmax ymin ymax', row, '調完直接重畫'));

    function syncRange() {
      Array.prototype.forEach.call(row.children, function (inp) { inp.value = range[inp.dataset.k]; });
    }

    var btns = ODE.el('div', 'row');
    var bClear = ODE.el('button', 'btn', '清除軌跡');
    var bRand = ODE.el('button', 'btn', '隨機 5 條');
    var bZoomIn = ODE.el('button', 'btn', '放大 ⊕');
    var bZoomOut = ODE.el('button', 'btn', '縮小 ⊖');
    bClear.onclick = function () { traces = []; draw(); };
    bRand.onclick = function () {
      traces = [];
      for (var i = 0; i < 5; i++) {
        traces.push([range.xmin + Math.random() * (range.xmax - range.xmin),
        range.ymin + Math.random() * (range.ymax - range.ymin)]);
      }
      draw();
    };
    function zoom(k) {
      var cx = (range.xmin + range.xmax) / 2, cy = (range.ymin + range.ymax) / 2;
      var hw = (range.xmax - range.xmin) / 2 * k, hh = (range.ymax - range.ymin) / 2 * k;
      range = { xmin: cx - hw, xmax: cx + hw, ymin: cy - hh, ymax: cy + hh };
      syncRange(); draw();
    }
    bZoomIn.onclick = function () { zoom(0.65); };
    bZoomOut.onclick = function () { zoom(1.55); };
    btns.appendChild(bClear); btns.appendChild(bRand);
    var btns2 = ODE.el('div', 'row');
    btns2.appendChild(bZoomIn); btns2.appendChild(bZoomOut);
    G.right.appendChild(btns); G.right.appendChild(btns2);

    plot.onPointer(function (p, kind) {
      if (kind === 'down') { traces.push([p.x, p.y]); armed = traces.length - 1; }
      else if (kind === 'move' && armed >= 0) { traces[armed] = [p.x, p.y]; }
      else if (kind === 'up') { armed = -1; }
      pointer = p;
      draw();
    });
    cv.addEventListener('pointerleave', function () { pointer = null; draw(); });
    cv.addEventListener('dblclick', function () { traces = []; draw(); });

    eqInput.oninput = function () { setEq(eqInput.value); };
    syncRange();
    setEq(presets[0].eq);
    if (presets[0].r) { range = { xmin: presets[0].r[0], xmax: presets[0].r[1], ymin: presets[0].r[2], ymax: presets[0].r[3] }; syncRange(); }

    ODE.redraws.push(function () { plot.resize(); draw(); });
    return L.root;
  }

  /* ======================================================================
     LAB 2 — 特徵根探索器 (常係數二階)
     ====================================================================== */
  function rootsLab() {
    var L = lab('🎯', '特徵根探索器 · Characteristic Root Explorer',
      '調整 y″ + a·y′ + b·y = 0 的 a、b，看根的位置怎麼決定解的樣子');
    var G = grid(L.body);

    var left = ODE.el('div');
    var cv = ODE.el('canvas');
    left.appendChild(cv);
    var cv2 = ODE.el('canvas');
    cv2.style.height = '130px';
    cv2.style.marginTop = '10px';
    cv2.style.cursor = 'default';
    left.appendChild(cv2);
    G.left.appendChild(left);

    var sol = ODE.el('div');
    sol.style.marginTop = '10px';
    G.left.appendChild(sol);

    var plot = new ODE.Plot(cv, { h: 250, xmin: 0, xmax: 6, ymin: -2, ymax: 2 });
    var plot2 = new ODE.Plot(cv2, { h: 130, xmin: -3, xmax: 3, ymin: -3, ymax: 3, pad: { l: 26, r: 10, t: 10, b: 18 } });

    var A = 1, B = 1;

    function analysis() {
      var disc = A * A - 4 * B;
      var out = { disc: disc, a: A, b: B };
      if (disc > 1e-12) {
        out.kind = 'I';
        out.l1 = (-A + Math.sqrt(disc)) / 2;
        out.l2 = (-A - Math.sqrt(disc)) / 2;
      } else if (disc < -1e-12) {
        out.kind = 'III';
        out.alpha = -A / 2;
        out.beta = Math.sqrt(-disc) / 2;
      } else {
        out.kind = 'II';
        out.l = -A / 2;
      }
      return out;
    }

    function generalSolution(r) {
      var f = function (v) { return ODE.fmt(v, 3); };
      if (r.kind === 'I') {
        return 'y = c_{1}e^{' + f(r.l1) + 'x} + c_{2}e^{' + f(r.l2) + 'x}';
      }
      if (r.kind === 'II') {
        return 'y = (c_{1} + c_{2}x)\\,e^{' + f(r.l) + 'x}';
      }
      var al = r.alpha, be = r.beta;
      var ex = Math.abs(al) < 1e-9 ? '' : 'e^{' + f(al) + 'x}';
      var inner = (Math.abs(al) < 1e-9 ? '' : '') + '\\left(c_{1}\\cos ' + f(be) + 'x + c_{2}\\sin ' + f(be) + 'x\\right)';
      return 'y = ' + (ex ? ex : '') + inner;
    }

    function labelKind(r) {
      if (r.kind === 'I') {
        if (r.l1 < 0 && r.l2 < 0) return ['Case I · 相異實根', '過阻尼 over-damped ／ 兩個衰減模態'];
        if (r.l1 > 0 || r.l2 > 0) return ['Case I · 相異實根', '有一個正根 → 指數成長（不穩定）'];
        return ['Case I · 相異實根', '一正一負 → 鞍點式行為'];
      }
      if (r.kind === 'II') {
        return r.l < 0 ? ['Case II · 重根', '臨界阻尼 critically damped ／ 有 x·e^{λx} 項']
          : ['Case II · 重根', '重根 ≥ 0 → 成長'];
      }
      return r.alpha < 0 ? ['Case III · 共軛複根', '欠阻尼 under-damped ／ 阻尼振盪 e^{αx}(cos+sin)']
        : r.alpha > 0 ? ['Case III · 共軛複根', 'α>0 → 振幅成長的振盪']
          : ['Case III · 共軛複根', '純振盪（無阻尼）／ 週期 ' + ODE.fmt(2 * Math.PI / r.beta, 3)];
    }

    function draw() {
      var r = analysis();
      plot.background().grid();
      /* several solution curves with different initial conditions */
      var ics = [[1, 0], [0, 1], [1, 1], [-1, 0.5], [0.5, -1.5]];
      var cols = ['--brand', '--ex', '--prac', '--thm', '--def'];
      /* vertical scale: pick from the max excursion of the first curve */
      var all = ics.map(function (ic) { return solve2(A, B, ic[0], ic[1], 0, 6, 900); });
      var mx = 0.8;
      all.forEach(function (s) { s.forEach(function (p) { if (isFinite(p[1])) mx = Math.max(mx, Math.abs(p[1])); }); });
      mx = Math.min(mx * 1.12, 40);
      plot.ymin = -mx; plot.ymax = mx;
      plot.background().grid();
      all.forEach(function (s, i) {
        plot.poly(s, { color: ODE.cssVar(cols[i % cols.length]), width: 1.9 });
      });
      plot.label(5.8, mx * 0.9, 'y(x)', { align: 'right', color: ODE.cssVar('--muted') });
      plot.dot(0, 0, { r: 0 });

      /* complex plane */
      plot2.background().grid({ nx: 6, ny: 6 });
      plot2.label(2.85, 0, 'Re', { align: 'right', dy: -8, color: ODE.cssVar('--muted') });
      plot2.label(0, 2.8, 'Im', { dy: 0, dx: 5, color: ODE.cssVar('--muted') });
      function rootDot(re, im, col) {
        plot2.dot(re, im, { r: 5, color: ODE.cssVar(col) });
      }
      if (r.kind === 'I') { rootDot(r.l1, 0, '--brand'); rootDot(r.l2, 0, '--ex'); }
      else if (r.kind === 'II') { rootDot(r.l, 0, '--thm'); }
      else { rootDot(r.alpha, r.beta, '--prac'); rootDot(r.alpha, -r.beta, '--prac'); }

      var names = labelKind(r);
      sol.innerHTML =
        '<div class="readout" style="border-left:3px solid ' + ODE.cssVar('--brand') + '">' +
        '<div style="font-weight:800;margin-bottom:5px">' + names[0] + '</div>' +
        '<div>判別式 \\(\\Delta = a^{2}-4b = ' + ODE.fmt(r.disc, 3) + '\\)　' +
        (r.kind === 'I' ? '\\(\\lambda_{1}=' + ODE.fmt(r.l1, 3) + ',\\ \\lambda_{2}=' + ODE.fmt(r.l2, 3) + '\\)'
          : r.kind === 'II' ? '\\(\\lambda=' + ODE.fmt(r.l, 3) + '\\)（重根）'
            : '\\(\\lambda = ' + ODE.fmt(r.alpha, 3) + ' \\pm ' + ODE.fmt(r.beta, 3) + '\\,i\\)') + '</div>' +
        '<div style="margin-top:6px">\\[' + generalSolution(r) + '\\]</div>' +
        '<div class="hint">' + names[1] + '</div></div>';
      ODE.render.typeset(sol);
    }

    var aOut = ODE.el('span', 'rv', 'a = 1');
    var bOut = ODE.el('span', 'rv', 'b = 1');
    var sA = slider(-6, 6, 0.25, 1), sB = slider(-9, 9, 0.25, 1);
    sA.oninput = function () { A = parseFloat(sA.value); aOut.textContent = 'a = ' + A; draw(); };
    sB.oninput = function () { B = parseFloat(sB.value); bOut.textContent = 'b = ' + B; draw(); };
    G.right.appendChild(fld('係數 a（y′ 的係數）', sA));
    G.right.appendChild(aOut);
    G.right.appendChild(fld('係數 b（y 的係數）', sB));
    G.right.appendChild(bOut);

    var quick = ODE.el('div', 'chips');
    [['−1, −6', -1, -6], ['4, 4', 4, 4], ['0, 4', 0, 4], ['−2, 5', -2, 5], ['0, 0', 0, 0], ['−6, 8', -6, 8]].forEach(function (q) {
      var b = ODE.el('button', 'chip', 'a=' + q[1] + ', b=' + q[2]);
      b.onclick = function () {
        A = q[1]; B = q[2]; sA.value = A; sB.value = B;
        aOut.textContent = 'a = ' + A; bOut.textContent = 'b = ' + B; draw();
      };
      quick.appendChild(b);
    });
    G.right.appendChild(fld('快速範例', quick));

    var note = ODE.el('div', 'hint');
    note.innerHTML = '圖上五條曲線是同一組 (a, b)、不同初始條件的解。' +
      '下方小圖是 λ 在複數平面的位置 —— <b>根在左半平面 → 解衰減</b>。';
    G.right.appendChild(note);

    ODE.redraws.push(function () { plot.resize(); plot2.resize(); draw(); });
    draw();
    return L.root;
  }

  /* ======================================================================
     LAB 3 — 彈簧–阻尼系統
     ====================================================================== */
  function springLab() {
    var L = lab('🌀', '彈簧–阻尼模型 · m y″ + c y′ + k y = 0',
      '把 §6 的三種情況對回真實的振動：過阻尼 / 臨界阻尼 / 欠阻尼');
    var G = grid(L.body);
    var cv = ODE.el('canvas');
    G.left.appendChild(cv);
    var out = ODE.el('div');
    out.style.marginTop = '10px';
    G.left.appendChild(out);
    var plot = new ODE.Plot(cv, { h: 250, xmin: 0, xmax: 12, ymin: -1.3, ymax: 1.3 });
    var M = 1, C = 0.6, K = 4, tmax = 12;

    function draw() {
      var a = C / M, b = K / M;
      var zeta = C / (2 * Math.sqrt(M * K));
      var w0 = Math.sqrt(K / M);
      var wd = Math.sqrt(Math.abs(1 - zeta * zeta)) * w0;
      var pts = solve2(a, b, 1, 0, 0, tmax, 1400);
      var mx = 1.05;
      pts.forEach(function (p) { if (isFinite(p[1])) mx = Math.max(mx, Math.abs(p[1])); });
      mx = Math.min(mx, 6);
      plot.xmin = 0; plot.xmax = tmax; plot.ymin = -mx * 1.12; plot.ymax = mx * 1.12;
      plot.background().grid();
      /* envelope for under-damped */
      if (zeta < 1) {
        var env = [];
        for (var i = 0; i <= 300; i++) {
          var t = tmax * i / 300;
          env.push([t, Math.exp(-zeta * w0 * t)]);
        }
        plot.poly(env, { color: ODE.cssVar('--muted'), width: 1.2, dash: [4, 4] });
        plot.poly(env.map(function (p) { return [p[0], -p[1]]; }), { color: ODE.cssVar('--muted'), width: 1.2, dash: [4, 4] });
      }
      plot.poly(pts, { color: ODE.cssVar('--brand'), width: 2.6, glow: true });
      plot.label(tmax * 0.985, mx * 0.95, 'y(t)', { align: 'right', color: ODE.cssVar('--muted') });

      var kind, cls, desc;
      if (Math.abs(zeta - 1) < 0.02) {
        kind = '臨界阻尼 · critically damped'; cls = 'thm';
        desc = '最快回到平衡而不來回振盪（Δ = 0，重根）。';
      } else if (zeta > 1) {
        kind = '過阻尼 · over-damped'; cls = 'def';
        desc = '兩個相異實負根，慢慢爬回平衡，不會越過 0 再回來。';
      } else {
        kind = '欠阻尼 · under-damped'; cls = 'ex';
        desc = '共軛複根 α ± iβ，阻尼振盪；虛線是包絡 e^{−ζω₀t}。';
      }
      out.innerHTML =
        '<div class="readout"><div style="font-weight:800;margin-bottom:6px">' + kind + '</div>' +
        '<div class="kv"><span class="k">阻尼比 ζ = c /(2√(mk))</span><span class="v">' + ODE.fmt(zeta, 4) + '</span></div>' +
        '<div class="kv"><span class="k">自然頻率 ω₀ = √(k/m)</span><span class="v">' + ODE.fmt(w0, 4) + '</span></div>' +
        '<div class="kv"><span class="k">阻尼頻率 ω_d</span><span class="v">' + (zeta < 1 ? ODE.fmt(wd, 4) : '—') + '</span></div>' +
        '<div class="kv"><span class="k">特徵根</span><span class="v">' + (zeta > 1 ? '兩相異實根'
          : Math.abs(zeta - 1) < 0.02 ? '重根' : 'α ± iβ') + '</span></div>' +
        '<div class="hint" style="margin-top:5px">' + desc + '</div></div>';
    }

    function mk(label, min, max, val, set) {
      var o = ODE.el('span', 'rv', String(val));
      var s = slider(min, max, 0.05, val);
      s.oninput = function () { set(parseFloat(s.value)); o.textContent = String(s.value); draw(); };
      var g = ODE.el('div');
      g.appendChild(s); g.appendChild(o);
      G.right.appendChild(fld(label, g));
    }
    mk('質量 m', 0.5, 4, 1, function (v) { M = v; });
    mk('阻尼 c', 0, 8, 0.6, function (v) { C = v; });
    mk('彈性 k', 0.5, 9, 4, function (v) { K = v; });
    mk('時間軸上限', 4, 30, 12, function (v) { tmax = v; });

    var q = ODE.el('div', 'chips');
    [['過阻尼 c=5', 5], ['臨界 c=4', 4], ['欠阻尼 c=0.6', 0.6], ['無阻尼 c=0', 0]].forEach(function (x) {
      var b = ODE.el('button', 'chip', x[0]);
      b.onclick = function () {
        C = x[1];
        var first = G.right.querySelector('input[type=range]');
        /* second slider is c */
        var ranges = G.right.querySelectorAll('input[type=range]');
        if (ranges[1]) { ranges[1].value = C; }
        draw();
      };
      q.appendChild(b);
    });
    G.right.appendChild(fld('快速嘗試', q));

    ODE.redraws.push(function () { plot.resize(); draw(); });
    draw();
    return L.root;
  }

  /* ======================================================================
     LAB 4 — Euler–Cauchy 對照器
     ====================================================================== */
  function eulerLab() {
    var L = lab('🔁', 'Euler–Cauchy 對照器 · x²y″ + a x y′ + b y = 0',
      '指標方程 m(m−1) + am + b = 0，以及 x = e^t 的常係數對應');
    var G = grid(L.body);
    var cv = ODE.el('canvas');
    G.left.appendChild(cv);
    var out = ODE.el('div');
    out.style.marginTop = '10px';
    G.left.appendChild(out);
    var plot = new ODE.Plot(cv, { h: 260, xmin: 0.02, xmax: 6, ymin: -3, ymax: 3 });
    var A = 1, B = -1;

    function rootsOf(a, b) {
      /* m^2 + (a-1) m + b = 0 */
      var p = a - 1, q = b, disc = p * p - 4 * q;
      if (disc > 1e-12) return { kind: 'I', m1: (-p + Math.sqrt(disc)) / 2, m2: (-p - Math.sqrt(disc)) / 2, disc: disc, p: p };
      if (disc < -1e-12) return { kind: 'III', al: -p / 2, be: Math.sqrt(-disc) / 2, disc: disc, p: p };
      return { kind: 'II', m: -p / 2, disc: disc, p: p };
    }
    function solText(r) {
      var f = function (v) { return ODE.fmt(v, 3); };
      if (r.kind === 'I') return 'y = c_{1}x^{' + f(r.m1) + '} + c_{2}x^{' + f(r.m2) + '}';
      if (r.kind === 'II') return 'y = \\left(c_{1} + c_{2}\\ln x\\right)x^{' + f(r.m) + '}';
      return 'y = x^{' + f(r.al) + '}\\left[c_{1}\\cos\\left(' + f(r.be) + '\\ln x\\right) + c_{2}\\sin\\left(' + f(r.be) + '\\ln x\\right)\\right]';
    }
    function yOf(r, x, c1, c2) {
      if (r.kind === 'I') return c1 * Math.pow(x, r.m1) + c2 * Math.pow(x, r.m2);
      if (r.kind === 'II') return (c1 + c2 * Math.log(x)) * Math.pow(x, r.m);
      return Math.pow(x, r.al) * (c1 * Math.cos(r.be * Math.log(x)) + c2 * Math.sin(r.be * Math.log(x)));
    }

    function draw() {
      var r = rootsOf(A, B);
      var xs = [];
      for (var i = 1; i <= 400; i++) xs.push(0.02 + (6 - 0.02) * i / 400);
      var ics = [[1, 0], [0, 1], [1, 1], [0.5, -1]];
      var cols = ['--brand', '--ex', '--thm', '--prac'];
      var mx = 1;
      var series = ics.map(function (ic) {
        var s = xs.map(function (x) { return [x, yOf(r, x, ic[0], ic[1])]; });
        s.forEach(function (p) { if (isFinite(p[1]) && Math.abs(p[1]) < 1e4) mx = Math.max(mx, Math.abs(p[1])); });
        return s;
      });
      mx = Math.min(mx * 1.1, 60);
      plot.ymin = -mx; plot.ymax = mx;
      plot.background().grid();
      series.forEach(function (s, i) { plot.poly(s, { color: ODE.cssVar(cols[i % 4]), width: 1.9 }); });
      plot.label(5.9, mx * 0.9, 'y(x)  (x > 0)', { align: 'right', color: ODE.cssVar('--muted') });

      var names = r.kind === 'I' ? 'Case I · 相異實根 m₁ ≠ m₂'
        : r.kind === 'II' ? 'Case II · 重根 m = (1−a)/2'
          : 'Case III · 共軛複根 m = α ± iβ';
      out.innerHTML =
        '<div class="readout" style="border-left:3px solid ' + ODE.cssVar('--brand') + '">' +
        '<div style="font-weight:800;margin-bottom:5px">' + names + '</div>' +
        '<div>指標方程 \\(m^{2}+(a-1)m+b = m^{2}+' + ODE.fmt(r.p, 3) + 'm+' + ODE.fmt(B, 3) + ' = 0\\)</div>' +
        '<div style="margin-top:5px">' +
        (r.kind === 'I' ? '\\(m_{1}=' + ODE.fmt(r.m1, 3) + ',\\ m_{2}=' + ODE.fmt(r.m2, 3) + '\\)'
          : r.kind === 'II' ? '\\(m=' + ODE.fmt(r.m, 3) + '\\)（重根 → 第二解乘 \\(\\ln x\\)）'
            : '\\(m = ' + ODE.fmt(r.al, 3) + ' \\pm ' + ODE.fmt(r.be, 3) + '\\,i\\)') + '</div>' +
        '<div style="margin-top:7px">\\[' + solText(r) + '\\]</div>' +
        '<div class="hint">令 \\(x=e^{t}\\)（即 \\(t=\\ln x\\)）後：\\(\\ddot{y}+(a-1)\\dot{y}+by=0\\)，' +
        '特徵方程一模一樣 —— 這就是為什麼 \\(m\\) 換成 \\(\\lambda\\) 就變成 §6。</div></div>';
      ODE.render.typeset(out);
    }

    var aOut = ODE.el('span', 'rv', 'a = 1'), bOut = ODE.el('span', 'rv', 'b = −1');
    var sA = slider(-5, 6, 0.5, 1), sB = slider(-9, 9, 0.5, -1);
    sA.oninput = function () { A = parseFloat(sA.value); aOut.textContent = 'a = ' + A; draw(); };
    sB.oninput = function () { B = parseFloat(sB.value); bOut.textContent = 'b = ' + B; draw(); };
    G.right.appendChild(fld('係數 a', sA)); G.right.appendChild(aOut);
    G.right.appendChild(fld('係數 b', sB)); G.right.appendChild(bOut);
    var q = ODE.el('div', 'chips');
    [['a=1,b=−1', 1, -1], ['a=−3,b=4', -3, 4], ['a=1,b=4', 1, 4], ['a=2,b=−6', 2, -6], ['a=−2,b=1', -2, 1]].forEach(function (x) {
      var b = ODE.el('button', 'chip', x[0]);
      b.onclick = function () {
        A = x[1]; B = x[2]; sA.value = A; sB.value = B;
        aOut.textContent = 'a = ' + A; bOut.textContent = 'b = ' + B; draw();
      };
      q.appendChild(b);
    });
    G.right.appendChild(fld('快速範例', q));
    var h = ODE.el('div', 'hint');
    h.innerHTML = '注意 \\(x\\to 0^{+}\\) 的行為：正根 → 趨近 0；負根 → 爆掉；重根 → 帶 \\(\\ln x\\)。' +
      '這正是「解的區間」要小心的地方（\\(x>0\\) 與 \\(x<0\\) 要分開講）。';
    G.right.appendChild(h);

    ODE.redraws.push(function () { plot.resize(); draw(); });
    draw();
    return L.root;
  }

  /* ---------- registry ---------- */
  ODE.widgets = ODE.widgets || {};
  ODE.redraws = ODE.redraws || [];
  ODE.widgets.labs = {
    field: fieldLab,
    roots: rootsLab,
    spring: springLab,
    euler: eulerLab
  };
})();
