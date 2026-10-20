/* ==========================================================================
   app.js — data assembly, router, navigation, search, progress
   ========================================================================== */
window.ODE = window.ODE || {};

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. assemble data
   * ------------------------------------------------------------------ */
  var CORE = window.ODE.core || [];
  var EXTRA = window.ODE.extra || {};
  var QUIZ = window.ODE.quizBank || [];
  var CARDS = window.ODE.cardDeck || [];

  var byId = {};
  CORE.forEach(function (s) { byId[s.id] = s; });

  ODE.data = {
    sections: CORE,
    ordered: CORE.map(function (s) { return s.id; }),
    byId: byId,
    extra: EXTRA,
    quiz: QUIZ,
    cards: CARDS
  };

  /* main learning sections (appendices excluded from the progress ring) */
  var MAIN = CORE.filter(function (s) { return /^s\d+$/.test(s.id); }).map(function (s) { return s.id; });

  /* ------------------------------------------------------------------ *
   * 2. which labs live in which section
   * ------------------------------------------------------------------ */
  ODE.widgets.plan = {
    s1: [{ lab: 'field', opts: { presets: [
        { label: "y′ = y", eq: 'y', r: [-3, 3, -3, 3] },
        { label: "y′ = −2y", eq: '-2*y', r: [-3, 3, -2, 2] },
        { label: "y′ = x + y", eq: 'x+y', r: [-4, 4, -4, 4] },
        { label: "y′ = 1 + y²", eq: '1+y^2', r: [-3, 3, -3, 3] },
        { label: "y′ = y(1−y)", eq: 'y*(1-y)', r: [-2, 5, -1, 2] },
        { label: "y′ = x² − y", eq: 'x^2-y', r: [-3, 3, -3, 5] },
        { label: "y′ = sin(x)·y", eq: 'sin(x)*y', r: [-6, 6, -3, 3] }
      ] } }],
    s2: [{ lab: 'field', opts: {
        title: '可分離方程的方向場 · Separable Field Lab',
        presets: [
          { label: "y′ = −2xy", eq: '-2*x*y', r: [-3, 3, -3, 3] },
          { label: "y′ = 1 + y²", eq: '1+y^2', r: [-3, 3, -3, 3] },
          { label: "y′ = x/y", eq: 'x/y', r: [-3, 3, -3, 3] },
          { label: "y′ = y² − 1", eq: 'y^2-1', r: [-3, 3, -2, 2] },
          { label: "y′ = (x+y)²", eq: '(x+y)^2', r: [-4, 4, -4, 4] },
          { label: "y′ = (x+y)/(x−y)", eq: '(x+y)/(x-y)', r: [-4, 4, -4, 4] },
          { label: "y′ = y/x（齊次型）", eq: 'y/x', r: [-3, 3, -3, 3] }
        ] } }],
    s3: [{ lab: 'exact', opts: {} }],
    s4: [{ lab: 'linear', opts: {} }],
    s5: [{ lab: 'wronsk', opts: {} }],
    s6: [{ lab: 'roots', opts: {} }, { lab: 'spring', opts: {} }],
    s7: [{ lab: 'euler', opts: {} }],
    s8: [{ lab: 'exists', opts: {} }, { lab: 'field', opts: {
        title: '不唯一／爆掉的方向場 · Field Lab',
        presets: [
          { label: "y′ = y^(2/3)", eq: 'y^(2/3)', r: [-1, 2, -0.5, 2] },
          { label: "y′ = √|y|", eq: 'sqrt(abs(y))', r: [-1, 1.6, -0.4, 1.2] },
          { label: "y′ = 1 + y²", eq: '1+y^2', r: [-2, 2, -2, 4] },
          { label: "y′ = −y²", eq: '-y^2', r: [-1, 2, -1, 3] },
          { label: "y′ = x/y", eq: 'x/y', r: [-2, 2, -1, 2] }
        ] } }]
  };

  /* ------------------------------------------------------------------ *
   * 3. small helpers
   * ------------------------------------------------------------------ */
  function stripTags(h) {
    return String(h || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\\[()\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* search index: one entry per block, tagged with the nearest heading */
  var INDEX = (function () {
    var out = [];
    CORE.forEach(function (sec) {
      var h = 0;
      sec.blocks.forEach(function (b) {
        var anchor = null, label = null;
        if (b.type === 'h3') {
          h++;
          anchor = 'h-' + sec.id + '-' + h;
          label = b.text;
        }
        var text = stripTags(b.title) + ' ' + stripTags(b.html || b.text || '');
        if (text.length < 2) return;
        out.push({ sec: sec.id, anchor: anchor, head: label, text: text });
      });
    });
    return out;
  })();

  /* ------------------------------------------------------------------ *
   * 4. navigation
   * ------------------------------------------------------------------ */
  var NAV_GROUPS = [
    { title: '開始', ids: ['intro'] },
    { title: '一階微分方程', ids: ['s1', 's2', 's3', 's4'] },
    { title: '二階線性方程', ids: ['s5', 's6', 's7'] },
    { title: '理論與總複習', ids: ['s8', 'apA', 'apB', 'apC', 'apD'] }
  ];

  function navHTML() {
    var html = '';
    NAV_GROUPS.forEach(function (g) {
      html += '<div class="navgrp">' + g.title + '</div>';
      g.ids.forEach(function (id) {
        var s = byId[id];
        if (!s) return;
        html += '<a class="navitem' + (ODE.store.isRead(id) ? ' done' : '') + '" data-sec="' + id + '" href="#/s/' + id + '">' +
          '<span class="k">' + ODE.esc(s.label || '·') + '</span>' +
          '<span class="t">' + ODE.esc(s.title_zh || s.title_en) + '</span>' +
          '<span class="tick">✓</span></a>';
      });
    });
    html += '<div class="navgrp">練習與工具</div>' +
      '<a class="navitem" href="#/quiz"><span class="k">✎</span><span class="t">題庫測驗（' + QUIZ.length + ' 題）</span></a>' +
      '<a class="navitem" href="#/cards"><span class="k">▤</span><span class="t">公式記憶卡（' + CARDS.length + ' 張）</span></a>' +
      '<a class="navitem" href="#/progress"><span class="k">◲</span><span class="t">學習進度儀表板</span></a>';
    return html;
  }

  function refreshNav() {
    var nav = ODE.$('#nav');
    if (nav) nav.innerHTML = navHTML();
    markActive();
  }

  function markActive() {
    var cur = (location.hash.match(/^#\/s\/([\w]+)/) || [])[1];
    ODE.$$('.navitem').forEach(function (a) {
      a.classList.toggle('active', a.dataset.sec === cur);
    });
  }

  function updateRing() {
    var total = MAIN.length || 1;
    var done = ODE.store.readCount(MAIN);
    var pct = Math.round(100 * done / total);
    var c = 2 * Math.PI * 16;
    var el = ODE.$('#ring .fg');
    if (el) {
      el.setAttribute('stroke-dasharray', c.toFixed(2));
      el.setAttribute('stroke-dashoffset', (c * (1 - pct / 100)).toFixed(2));
    }
    var t = ODE.$('#ringtxt');
    if (t) t.textContent = pct + '%';
  }

  /* ------------------------------------------------------------------ *
   * 5. views
   * ------------------------------------------------------------------ */
  function sectionView(id) {
    var sec = byId[id];
    var view = ODE.$('#view');
    var shell = ODE.$('#shell');
    if (!sec) { location.hash = '#/'; return; }
    var ctx = ODE.render.renderSection(view, sec, EXTRA[id]);
    shell.classList.add('with-toc');
    buildTOC(ctx);
    markActive();
    document.title = (sec.label ? sec.label + ' ' : '') + (sec.title_zh || sec.title_en) + ' · ODE 期中考互動學習站';
    window.scrollTo(0, 0);
    ODE.redraws = ODE.redraws.filter(function (f) { return f._sec === id || true; });
  }

  function buildTOC(ctx) {
    var toc = ODE.$('#toc');
    if (!toc) return;
    var heads = ctx && ctx.heads ? ctx.heads : [];
    toc.innerHTML = '<div class="tt">本頁目錄</div>' +
      heads.map(function (h) {
        return '<a href="#' + h.id + '" data-h="' + h.id + '">' + ODE.esc(h.text) + '</a>';
      }).join('') || '<div class="hint">（這一節沒有小標題）</div>';
  }

  function homeView() {
    var view = ODE.$('#view');
    var shell = ODE.$('#shell');
    shell.classList.add('with-toc');
    var toc = ODE.$('#toc');
    if (toc) {
      toc.innerHTML = '<div class="tt">快速跳轉</div>' +
        CORE.map(function (s) {
          return '<a href="#/s/' + s.id + '">' + ODE.esc((s.label ? s.label + ' ' : '') + (s.title_zh || s.title_en)) + '</a>';
        }).join('');
    }
    var done = ODE.store.readCount(MAIN);
    var st = ODE.store.state.quiz;
    var acc = st.asked ? Math.round(100 * st.correct / st.asked) : 0;

    view.innerHTML =
      '<div class="wrap">' +
      '<div class="hero">' +
      '<h1>常微分方程 · 期中考互動學習站</h1>' +
      '<p class="lede">把 §1–§8 的觀念、公式、例題全部拆成「可以動手玩」的形式：' +
      '方向場實驗室、特徵根探索器、正合性檢測器、逐步詳解例題、' + QUIZ.length + ' 題題庫與錯題本。' +
      '中英對照，考前一晚也能掃完。</p>' +
      '<div class="row" style="margin-top:18px">' +
      '<a class="btn primary" href="#/s/s1">從 §1 開始 ▸</a>' +
      '<a class="btn" href="#/quiz">直接測驗</a>' +
      '<a class="btn" href="#/s/apA">公式速查表</a>' +
      '<a class="btn" href="#/progress">我的進度 ' + done + '/' + MAIN.length + '</a>' +
      '</div></div>' +

      '<div class="statgrid">' +
      '<div class="stat"><div class="k">已讀章節</div><div class="v">' + done + '/' + MAIN.length + '</div></div>' +
      '<div class="stat"><div class="k">題庫總數</div><div class="v">' + QUIZ.length + '</div></div>' +
      '<div class="stat"><div class="k">作答過</div><div class="v">' + st.asked + '</div></div>' +
      '<div class="stat"><div class="k">正確率</div><div class="v">' + acc + '%</div></div>' +
      '<div class="stat"><div class="k">錯題本</div><div class="v">' + ODE.store.wrongList().length + '</div></div>' +
      '</div>' +

      '<h3 class="sub" style="border:none;padding:0;margin-top:26px">八個主題</h3>' +
      '<div class="gridcards">' +
      CORE.filter(function (s) { return /^s\d+$/.test(s.id); }).map(function (s) {
        var p = ODE.store.isRead(s.id) ? 100 : 0;
        var hasLab = !!(ODE.widgets.plan[s.id]);
        return '<a class="gcard" href="#/s/' + s.id + '">' +
          '<div class="k">' + ODE.esc(s.label) + (hasLab ? ' · 🧪 有互動' : '') + '</div>' +
          '<div class="t">' + ODE.esc(s.title_zh) + '</div>' +
          '<div class="d">' + ODE.esc(s.title_en) + '</div>' +
          '<div class="prog" style="width:' + p + '%"></div></a>';
      }).join('') +
      '</div>' +

      '<h3 class="sub" style="border:none;padding:0;margin-top:26px">練習與附錄</h3>' +
      '<div class="gridcards">' +
      '<a class="gcard" href="#/quiz"><div class="k">QUIZ</div><div class="t">題庫測驗</div>' +
      '<div class="d">' + QUIZ.length + ' 題，選擇／是非／填答，附詳解與錯題本</div></a>' +
      '<a class="gcard" href="#/cards"><div class="k">CARDS</div><div class="t">公式記憶卡</div>' +
      '<div class="d">' + CARDS.length + ' 張翻卡，考前速記</div></a>' +
      CORE.filter(function (s) { return /^ap/.test(s.id); }).map(function (s) {
        return '<a class="gcard" href="#/s/' + s.id + '"><div class="k">' + ODE.esc(s.label) + '</div>' +
          '<div class="t">' + ODE.esc(s.title_zh) + '</div><div class="d">' + ODE.esc(s.title_en) + '</div></a>';
      }).join('') +
      '</div>' +

      '<div class="box key" style="margin-top:26px"><div class="bt"><span>🔑</span><span>怎麼用這個站最有效</span></div>' +
      '<ol><li><b>先讀一節，再玩那一節的互動元件</b>（有 🧪 標記的章節）—— 圖形會把公式變成直覺。</li>' +
      '<li><b>每節的「加強例題」先自己在紙上做</b>，再按「下一步」對答案。</li>' +
      '<li>全部讀完後做 <b>15 題測驗</b>，錯的會自動進錯題本，隔天再練一次。</li>' +
      '<li>考前 10 分鐘：翻 <a href="#/cards">公式記憶卡</a> + 掃 <a href="#/s/apD">附錄 D 清單</a>。</li></ol></div>' +
      '</div>';
    document.title = 'ODE 期中考互動學習站 · 常微分方程';
    window.scrollTo(0, 0);
  }

  function progressView() {
    var view = ODE.$('#view');
    var shell = ODE.$('#shell');
    shell.classList.add('with-toc');
    var toc = ODE.$('#toc'); if (toc) toc.innerHTML = '<div class="tt">本頁目錄</div><a href="#pg-sec">章節進度</a><a href="#pg-quiz">測驗統計</a>';

    var st = ODE.store.state.quiz;
    var acc = st.asked ? Math.round(100 * st.correct / st.asked) : 0;
    var rows = MAIN.map(function (id) {
      var s = byId[id];
      var q = st.bySec[id];
      var cnt = QUIZ.filter(function (x) { return x.sec === id; }).length;
      return '<tr><td>' + ODE.esc(s.label + ' ' + s.title_zh) + '</td>' +
        '<td class="c">' + (ODE.store.isRead(id) ? '✅' : '—') + '</td>' +
        '<td class="c">' + (q ? q.c + ' / ' + q.a : '—') + '</td>' +
        '<td class="c">' + cnt + '</td>' +
        '<td class="c"><button class="btn ghost" data-goto="' + id + '">前往</button></td></tr>';
    }).join('');

    view.innerHTML =
      '<div class="wrap">' +
      '<div class="sechead"><div class="num">DASHBOARD</div><h1>學習進度儀表板</h1>' +
      '<div class="en">Where you stand</div></div>' +
      '<div class="statgrid">' +
      '<div class="stat"><div class="k">已讀章節</div><div class="v">' + ODE.store.readCount(MAIN) + '/' + MAIN.length + '</div></div>' +
      '<div class="stat"><div class="k">累計作答</div><div class="v">' + st.asked + '</div></div>' +
      '<div class="stat"><div class="k">正確率</div><div class="v">' + acc + '%</div></div>' +
      '<div class="stat"><div class="k">錯題本</div><div class="v">' + ODE.store.wrongList().length + '</div></div>' +
      '<div class="stat"><div class="k">記憶卡</div><div class="v">' + ODE.store.state.cards.known.length + '/' + CARDS.length + '</div></div>' +
      '</div>' +
      '<h3 class="sub" id="pg-sec">章節進度</h3>' +
      '<div class="tblwrap"><table><thead><tr><th>章節</th><th class="c">已讀</th><th class="c">測驗成績</th><th class="c">題庫題數</th><th class="c"></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<h3 class="sub" id="pg-quiz">測驗統計 · 分章</h3>' +
      perSecChart() +
      '<div class="row" style="margin-top:18px">' +
      '<button class="btn" id="pg-resetq">重設測驗紀錄</button>' +
      '<button class="btn" id="pg-resetc">重設記憶卡</button>' +
      '<button class="btn" id="pg-resetall">全部重設</button>' +
      '</div>' +
      '<p class="note" style="margin-top:12px">紀錄只存在你這台電腦的瀏覽器（localStorage），不會上傳到任何地方。</p>' +
      '</div>';

    view.onclick = function (e) {
      var b = e.target.closest('[data-goto]');
      if (b) location.hash = '#/s/' + b.dataset.goto;
    };
    ODE.$('#pg-resetq').onclick = function () {
      if (confirm('重設所有測驗紀錄與錯題本？')) { ODE.store.resetQuiz(); progressView(); ODE.toast('已重設測驗紀錄'); }
    };
    ODE.$('#pg-resetc').onclick = function () {
      if (confirm('重設記憶卡進度？')) { ODE.store.resetCards(); progressView(); ODE.toast('已重設記憶卡'); }
    };
    ODE.$('#pg-resetall').onclick = function () {
      if (confirm('全部重設（含已讀章節）？')) {
        try { localStorage.clear(); } catch (e) { }
        location.reload();
      }
    };
    window.scrollTo(0, 0);
  }

  function perSecChart() {
    var st = ODE.store.state.quiz;
    var html = '';
    MAIN.forEach(function (id) {
      var s = byId[id], q = st.bySec[id];
      var pct = q && q.a ? Math.round(100 * q.c / q.a) : 0;
      html += '<div style="margin:10px 0"><div class="row" style="justify-content:space-between">' +
        '<span style="font-size:13.5px">' + ODE.esc(s.label + ' ' + s.title_zh) + '</span>' +
        '<span class="hint">' + (q ? q.c + '/' + q.a + '（' + pct + '%）' : '還沒測驗') + '</span></div>' +
        '<div class="pbar" style="margin-top:5px"><i style="width:' + pct + '%"></i></div></div>';
    });
    return html;
  }

  /* ---- search ---- */
  function showSearch(q) {
    var view = ODE.$('#view');
    var shell = ODE.$('#shell');
    shell.classList.remove('with-toc');
    var toc = ODE.$('#toc'); if (toc) toc.innerHTML = '';
    var needle = q.toLowerCase();
    var hits = INDEX.filter(function (e) { return e.text.toLowerCase().indexOf(needle) >= 0; });
    var html = '<div class="wrap"><div class="sechead"><div class="num">SEARCH</div><h1>搜尋「' +
      ODE.esc(q) + '」</h1><div class="en">' + hits.length + ' 個結果</div></div>';
    if (!hits.length) {
      html += '<div class="box warn"><div class="bt"><span>⚠</span><span>找不到</span></div>' +
        '換個關鍵字試試，例如 <code>Wronskian</code>、<code>積分因子</code>、<code>重根</code>、<code>Lipschitz</code>。</div>';
    } else {
      html += '<div>';
      hits.slice(0, 60).forEach(function (e) {
        var i = e.text.toLowerCase().indexOf(needle);
        var a = Math.max(0, i - 60), b = Math.min(e.text.length, i + 130);
        var snip = (a > 0 ? '…' : '') + e.text.slice(a, b) + (b < e.text.length ? '…' : '');
        var sec = byId[e.sec];
        html += '<a href="#/s/' + e.sec + (e.anchor ? '#' + e.anchor : '') + '" style="display:block;padding:11px 14px;border:1px solid var(--line);border-radius:12px;margin-bottom:9px;background:var(--panel)">' +
          '<div style="font-size:11.5px;color:var(--muted);margin-bottom:3px">' +
          ODE.esc((sec.label ? sec.label + ' ' : '') + (sec.title_zh || '')) + (e.head ? ' › ' + ODE.esc(e.head) : '') +
          '</div><div style="font-size:13.5px;color:var(--fg-soft)">' +
          ODE.esc(snip).replace(new RegExp('(' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark style="background:var(--brand-soft);color:var(--brand-ink);border-radius:3px">$1</mark>') +
          '</div></a>';
      });
      html += '</div>';
    }
    html += '</div>';
    view.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ *
   * 6. router
   * ------------------------------------------------------------------ */
  function route() {
    ODE.redraws = [];
    var h = location.hash || '#/';
    var m;
    if ((m = h.match(/^#\/s\/([\w]+)/))) {
      var id = m[1];
      sectionView(id);
      /* jump to sub-anchor if given */
      var sub = (h.split('#')[2] || '');
      if (sub) {
        var el = document.getElementById(sub);
        if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
      }
      return;
    }
    if (h.indexOf('#/quiz') === 0) {
      var toc = ODE.$('#toc'); if (toc) toc.innerHTML = '';
      ODE.$('#shell').classList.remove('with-toc');
      ODE.Quiz.view(ODE.$('#view'));
      return;
    }
    if (h.indexOf('#/cards') === 0) {
      var t2 = ODE.$('#toc'); if (t2) t2.innerHTML = '';
      ODE.$('#shell').classList.remove('with-toc');
      ODE.cardsView(ODE.$('#view'));
      return;
    }
    if (h.indexOf('#/progress') === 0) { progressView(); return; }
    homeView();
  }

  window.addEventListener('hashchange', route);

  /* ------------------------------------------------------------------ *
   * 7. chrome: theme, scroll bar, mobile menu, keys
   * ------------------------------------------------------------------ */
  function boot() {
    ODE.store.applyTheme();
    refreshNav();
    updateRing();
    route();

    ODE.$('#btn-theme').onclick = function () {
      var t = ODE.store.cycleTheme();
      ODE.toast('主題：' + ({ auto: '跟隨系統', light: '淺色', dark: '深色' })[t]);
      (ODE.redraws || []).forEach(function (f) { try { f(); } catch (e) { } });
    };
    ODE.$('#btn-quiz').onclick = function () { location.hash = '#/quiz'; };
    ODE.$('#mobmenu').onclick = function () { ODE.$('#sidebar').classList.toggle('open'); };
    ODE.$('#fab-top').onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    ODE.$$('.navitem, .sidebar a').forEach(function (a) {
      a.addEventListener('click', function () { ODE.$('#sidebar').classList.remove('open'); });
    });

    var q = ODE.$('#q');
    var tmr = null;
    q.addEventListener('input', function () {
      clearTimeout(tmr);
      var v = q.value.trim();
      tmr = setTimeout(function () {
        if (v.length >= 2) showSearch(v);
        else if (location.hash.indexOf('#/') === 0 && !location.hash.match(/^#\/s\//)) route();
        else route();
      }, 180);
    });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { q.value = ''; route(); }
    });

    var bar = ODE.$('#readbar');
    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(100, 100 * window.scrollY / h) : 0;
      bar.style.width = p + '%';
      /* TOC highlight */
      var heads = ODE.$$('h3.sub');
      var tocLinks = ODE.$$('#toc a');
      if (heads.length && tocLinks.length) {
        var best = null, bestTop = -1e9;
        heads.forEach(function (hh) {
          var t = hh.getBoundingClientRect().top;
          if (t < 140 && t > bestTop) { bestTop = t; best = hh.id; }
        });
        tocLinks.forEach(function (a) { a.classList.toggle('on', a.dataset.h === best); });
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    var rz = null;
    window.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () { (ODE.redraws || []).forEach(function (f) { try { f(); } catch (e) { } }); }, 160);
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'j' || e.key === 'k') {
        var idx = ODE.data.ordered.indexOf((location.hash.match(/^#\/s\/(\w+)/) || [])[1]);
        if (idx < 0) idx = 0;
        var n = e.key === 'j' ? idx + 1 : idx - 1;
        if (n >= 0 && n < ODE.data.ordered.length) location.hash = '#/s/' + ODE.data.ordered[n];
      }
      if (e.key === 't') ODE.$('#btn-theme').click();
    });
  }

  ODE.app = {
    refreshNav: refreshNav,
    updateRing: updateRing,
    route: route,
    showSearch: showSearch,
    MAIN: MAIN
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
