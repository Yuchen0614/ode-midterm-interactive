/* ==========================================================================
   render.js — turn content data into DOM (+ KaTeX typesetting)
   ========================================================================== */
window.ODE = window.ODE || {};

(function () {
  'use strict';

  var KATEX_OPTS = {
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false,
    errorColor: '#c0392b',
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option']
  };

  function typeset(root) {
    if (!root || typeof window.renderMathInElement !== 'function') return;
    try { window.renderMathInElement(root, KATEX_OPTS); } catch (e) { /* keep going */ }
  }

  var BOX_META = {
    def:  { icon: '◈', label: '定義' },
    thm:  { icon: '★', label: '定理' },
    ex:   { icon: '✎', label: '例題' },
    warn: { icon: '⚠', label: '易錯點' },
    prac: { icon: '◇', label: '練習' },
    key:  { icon: '🔑', label: '重點' }
  };

  function blockEl(b, ctx) {
    var t = b.type;
    if (t === 'h3') {
      var id = 'h-' + ctx.secId + '-' + (ctx.h++);
      var h = ODE.el('h3', 'sub');
      h.id = id;
      h.innerHTML = ODE.esc(b.text) + '<a class="anc" href="#' + id + '" aria-label="anchor">#</a>';
      ctx.heads.push({ id: id, text: b.text });
      return h;
    }
    if (BOX_META[t]) {
      var m = BOX_META[t];
      var box = ODE.el('div', 'box ' + t);
      box.innerHTML =
        '<div class="bt"><span>' + m.icon + '</span><span>' + (b.title ? ODE.esc(b.title) : m.label) +
        '</span></div><div class="bx">' + (b.html || '') + '</div>';
      return box;
    }
    if (t === 'table') {
      var w = ODE.el('div', 'tblwrap');
      w.innerHTML = '<table><tbody>' + (b.html || '').replace(/<\/?tbody>/g, '') + '</tbody></table>';
      return w;
    }
    if (t === 'p') return ODE.el('p', null, b.html || '');
    if (t === 'list') return ODE.el('div', 'lst', b.html || '');
    if (t === 'note') return ODE.el('p', 'note', b.html || '');
    if (t === 'div') return ODE.el('div', null, b.html || '');
    return ODE.el('div', null, b.html || '');
  }

  /* ---- interactive worked example (step-by-step reveal) ---- */
  function exampleEl(x, idx) {
    var wrap = ODE.el('div', 'exw');
    var stars = '';
    for (var s = 0; s < 3; s++) stars += s < (x.lv || 1) ? '●' : '○';
    var tags = (x.tags || []).map(function (g) { return '<span class="tag">' + ODE.esc(g) + '</span>'; }).join('');

    var head = ODE.el('div', 'eh');
    head.innerHTML =
      '<span class="n">' + ODE.esc(x.n || ('例 ' + idx)) + '</span>' +
      '<span class="ti">' + ODE.esc(x.title || '') + '</span>' +
      '<span class="lv" title="難度">' + stars + '</span>';

    var body = ODE.el('div', 'eb');
    body.innerHTML = '<div class="prob">' + (x.problem || '') + '</div>' + (tags ? '<div style="margin-top:8px">' + tags + '</div>' : '');

    var stepsBox = ODE.el('div', 'steps');
    var shown = 0;
    var stepEls = [];

    (x.steps || []).forEach(function (st, i) {
      var d = ODE.el('div', 'stepline');
      d.innerHTML = '<div class="sh">' + ODE.esc(st.h || ('Step ' + (i + 1))) + '</div>' +
        '<div class="sb">' + (st.b || '') + '</div>';
      d.style.display = 'none';
      stepsBox.appendChild(d);
      stepEls.push(d);
    });
    body.appendChild(stepsBox);

    var ansBox = ODE.el('div', 'finalans');
    ansBox.style.display = 'none';
    ansBox.innerHTML = '<div class="fh">答案 · Final answer</div><div class="ab">' + (x.ans || '') + '</div>';
    body.appendChild(ansBox);

    if (x.tip) {
      var tp = ODE.el('div', 'tip');
      tp.style.display = 'none';
      tp.innerHTML = '<b>💡 老師提醒：</b>' + x.tip;
      body.appendChild(tp);
    }

    var ctl = ODE.el('div', 'stepctl');
    var bNext = ODE.el('button', 'btn primary', '下一步 ▸');
    var bAll = ODE.el('button', 'btn', '全部展開');
    var bRst = ODE.el('button', 'btn ghost', '重來 ↺');
    var cnt = ODE.el('span', 'cnt');
    var tipEl = body.querySelector('.tip');

    function refresh() {
      cnt.textContent = shown + ' / ' + stepEls.length + ' 步';
      bNext.disabled = shown >= stepEls.length;
      if (shown >= stepEls.length) {
        ansBox.style.display = '';
        if (tipEl) tipEl.style.display = '';
        bAll.disabled = true;
      } else {
        ansBox.style.display = 'none';
        if (tipEl) tipEl.style.display = 'none';
        bAll.disabled = false;
      }
    }
    function reveal(n) {
      for (var i = shown; i < Math.min(n, stepEls.length); i++) stepEls[i].style.display = '';
      shown = Math.min(n, stepEls.length);
      refresh();
    }

    bNext.onclick = function () { reveal(shown + 1); };
    bAll.onclick = function () { reveal(stepEls.length); };
    bRst.onclick = function () {
      stepEls.forEach(function (d) { d.style.display = 'none'; });
      shown = 0; refresh();
    };
    ctl.appendChild(bNext); ctl.appendChild(bAll); ctl.appendChild(bRst); ctl.appendChild(cnt);
    body.appendChild(ctl);

    /* click the problem text to peek the first step */
    refresh();
    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }

  /* ---- render a whole section ---- */
  function renderSection(host, sec, extras) {
    var ctx = { secId: sec.id, h: 0, heads: [] };
    var wrap = ODE.el('div', 'wrap');

    var head = ODE.el('div', 'sechead');
    var nblocks = sec.blocks.length;
    head.innerHTML =
      (sec.label ? '<div class="num">' + ODE.esc(sec.label) + '</div>' : '') +
      '<h1>' + ODE.esc(sec.title_zh || sec.title_en) + '</h1>' +
      (sec.title_en && sec.title_zh ? '<div class="en">' + ODE.esc(sec.title_en) + '</div>' : '') +
      '<div class="meta">' +
      '<span class="pill">' + nblocks + ' 個段落</span>' +
      (extras && extras.length ? '<span class="pill">+' + extras.length + ' 題詳解</span>' : '') +
      '</div>';
    wrap.appendChild(head);

    var body = ODE.el('div', 'secbody');
    sec.blocks.forEach(function (b) { body.appendChild(blockEl(b, ctx)); });
    wrap.appendChild(body);

    /* extra hand-authored examples */
    if (extras && extras.length) {
      var h = ODE.el('h3', 'sub');
      h.id = 'h-' + sec.id + '-extra';
      h.innerHTML = '🧪 加強例題（逐步詳解）<a class="anc" href="#' + h.id + '">#</a>';
      wrap.appendChild(h);
      var note = ODE.el('p', 'note', '以下每題都可以按「下一步」逐步看推導 —— 先自己在紙上寫，再對照。');
      wrap.appendChild(note);
      extras.forEach(function (x, i) { wrap.appendChild(exampleEl(x, i + 1)); });
      ctx.heads.push({ id: h.id, text: '🧪 加強例題' });
    }

    /* mount widgets for this section */
    if (ODE.widgets && ODE.widgets.mount) ODE.widgets.mount(wrap, sec.id, ctx);

    /* mark as read */
    var md = ODE.el('div', 'markdone' + (ODE.store.isRead(sec.id) ? ' on' : ''));
    var mt = ODE.el('span', 't', ODE.store.isRead(sec.id) ? '✅ 已標記為讀完這一節' : '讀完了嗎？標記起來，進度環會更新');
    var mb = ODE.el('button', 'btn' + (ODE.store.isRead(sec.id) ? '' : ' primary'),
      ODE.store.isRead(sec.id) ? '取消標記' : '✓ 我讀完了');
    mb.onclick = function () {
      var on = ODE.store.toggleRead(sec.id);
      md.classList.toggle('on', on);
      mt.textContent = on ? '✅ 已標記為讀完這一節' : '讀完了嗎？標記起來，進度環會更新';
      mb.textContent = on ? '取消標記' : '✓ 我讀完了';
      mb.classList.toggle('primary', !on);
      if (on) ODE.toast('已標記「' + (sec.title_zh || sec.id) + '」');
      ODE.app.refreshNav();
      ODE.app.updateRing();
    };
    md.appendChild(mt); md.appendChild(mb);
    wrap.appendChild(md);

    /* prev / next */
    var idx = ODE.data.ordered.indexOf(sec.id);
    var prev = ODE.data.ordered[idx - 1], next = ODE.data.ordered[idx + 1];
    var nf = ODE.el('div', 'navfoot');
    if (prev) {
      var a = ODE.data.byId[prev];
      nf.innerHTML += '<a href="#/s/' + prev + '"><div class="d">← 上一節</div><div class="t">' +
        ODE.esc(a.label + ' ' + (a.title_zh || a.title_en)) + '</div></a>';
    } else nf.innerHTML += '<span style="flex:1"></span>';
    if (next) {
      var b2 = ODE.data.byId[next];
      nf.innerHTML += '<a class="r" href="#/s/' + next + '"><div class="d">下一節 →</div><div class="t">' +
        ODE.esc(b2.label + ' ' + (b2.title_zh || b2.title_en)) + '</div></a>';
    }
    wrap.appendChild(nf);

    host.innerHTML = '';
    host.appendChild(wrap);
    typeset(wrap);
    /* canvases are measured before layout; re-measure on the next frame */
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () {
        var fns = ODE.redraws || [];
        for (var i = 0; i < fns.length; i++) {
          try { fns[i](); } catch (e) { if (window.console) console.error(e); }
        }
      });
    }
    return ctx;
  }

  ODE.render = {
    typeset: typeset,
    exampleEl: exampleEl,
    renderSection: renderSection,
    blockEl: blockEl
  };
})();
