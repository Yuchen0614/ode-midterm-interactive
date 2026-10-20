/* ==========================================================================
   quiz.js — quiz engine (multiple choice / true-false / numeric)
   ========================================================================== */
window.ODE = window.ODE || {};

(function () {
  'use strict';

  var LET = ['A', 'B', 'C', 'D', 'E'];

  function sectionName(id) {
    var s = ODE.data && ODE.data.byId[id];
    return s ? (s.label ? s.label + ' ' : '') + (s.title_zh || s.title_en) : id;
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var Quiz = {
    pool: [],
    order: [],
    idx: 0,
    score: 0,
    answered: 0,
    perSec: {},
    host: null,

    /* opts: {sec, count, mode:'all'|'wrong'|'sec'} */
    start: function (host, opts) {
      opts = opts || {};
      this.host = host;
      var all = (ODE.data && ODE.data.quiz) || [];
      var pool = all;
      if (opts.mode === 'wrong') {
        var wrong = ODE.store.wrongList();
        pool = all.filter(function (q) { return wrong.indexOf(q.id) >= 0; });
        if (!pool.length) pool = all;
      } else if (opts.sec && opts.sec !== 'all') {
        pool = all.filter(function (q) { return q.sec === opts.sec; });
      }
      pool = shuffle(pool);
      var n = opts.count && opts.count > 0 ? Math.min(opts.count, pool.length) : pool.length;
      this.order = pool.slice(0, n);
      this.idx = 0; this.score = 0; this.answered = 0; this.perSec = {};
      this.render();
    },

    render: function () {
      var self = this, host = this.host;
      host.innerHTML = '';
      var wrap = ODE.el('div', 'wrap');

      if (!this.order.length) {
        wrap.innerHTML = '<div class="qcard"><h3>這一組沒有題目</h3><p class="note">換個範圍再試試。</p></div>';
        host.appendChild(wrap);
        return;
      }
      if (this.idx >= this.order.length) return this.summary(wrap, host);

      var q = this.order[this.idx];
      var pctTotal = Math.round(100 * this.idx / this.order.length);

      var head = ODE.el('div', 'quizhead');
      head.innerHTML =
        '<h1 style="font-size:24px;margin:0">✎ 測驗模式</h1>' +
        '<span class="pill">第 ' + (this.idx + 1) + ' / ' + this.order.length + ' 題</span>' +
        '<span class="pill">目前得分 ' + this.score + '</span>' +
        '<span class="spacer" style="flex:1"></span>';
      var quit = ODE.el('button', 'btn', '結束測驗');
      quit.onclick = function () { self.finish(); };
      head.appendChild(quit);
      wrap.appendChild(head);

      var bar = ODE.el('div', 'pbar');
      bar.innerHTML = '<i style="width:' + pctTotal + '%"></i>';
      bar.style.marginBottom = '14px';
      wrap.appendChild(bar);

      var card = ODE.el('div', 'qcard');
      card.innerHTML =
        '<div class="qmeta">' +
        '<span class="tag">' + ODE.esc(sectionName(q.sec)) + '</span>' +
        '<span class="tag" style="background:var(--ex-bg);color:var(--ex);border-color:transparent">' +
        '難度 ' + '●'.repeat(q.lv || 1) + '○'.repeat(Math.max(0, 3 - (q.lv || 1))) + '</span>' +
        '<span>' + (q.type === 'num' ? '填數字' : q.type === 'tf' ? '是非題' : '單選') + '</span>' +
        '</div>' +
        '<div class="qtext">' + q.q + '</div>';
      wrap.appendChild(card);
      ODE.render.typeset(card);

      var feedback = null, locked = false;

      function lock(ok, chosenText) {
        locked = true;
        self.answered++;
        self.score += ok ? 1 : 0;
        var ps = self.perSec[q.sec] || (self.perSec[q.sec] = { a: 0, c: 0 });
        ps.a++; if (ok) ps.c++;
        ODE.store.recordAnswer(q, ok);
        feedback = ODE.el('div', 'feedback ' + (ok ? 'ok' : 'bad'));
        feedback.innerHTML =
          '<div class="fh">' + (ok ? '✓ 答對了！' : '✗ 不對喔') +
          (chosenText ? '（你選了 ' + ODE.esc(chosenText) + '）' : '') + '</div>' +
          '<div>' + (q.why || '') + '</div>';
        card.appendChild(feedback);
        ODE.render.typeset(feedback);
        var okEl = ODE.el('div', 'verdict ' + (ok ? 'ok' : 'bad'), '正解：' + (q.ansText || ''));
        okEl.style.marginTop = '8px';
        card.appendChild(okEl);
        ODE.render.typeset(okEl);
        foot.querySelector('.nextbtn').disabled = false;
        foot.querySelector('.nextbtn').focus();
      }

      if (q.type === 'mc' || q.type === 'tf') {
        var choices = q.type === 'tf' ? ['對 (True)', '錯 (False)'] : q.choices;
        var box = ODE.el('div', 'choices');
        choices.forEach(function (c, i) {
          var b = ODE.el('button', 'choice');
          b.innerHTML = '<span class="key">' + LET[i] + '</span><span>' + c + '</span>';
          b.onclick = function () {
            if (locked) return;
            var ok = i === q.a;
            Array.prototype.forEach.call(box.children, function (x, k) {
              x.disabled = true;
              if (k === q.a) x.classList.add('correct');
              else if (k === i) x.classList.add('wrong');
            });
            lock(ok, LET[i] + '. ' + choices[i].replace(/<[^>]+>/g, ''));
          };
          box.appendChild(b);
        });
        card.appendChild(box);
        ODE.render.typeset(box);
      } else {
        var row = ODE.el('div', 'row');
        var inp = ODE.el('input');
        inp.type = 'text';
        inp.placeholder = '輸入答案…';
        inp.style.fontFamily = 'var(--mono)';
        inp.style.fontSize = '16px';
        inp.style.padding = '10px 14px';
        inp.style.borderRadius = '10px';
        inp.style.border = '1.5px solid var(--line-2)';
        inp.style.width = '220px';
        var sub = ODE.el('button', 'btn primary', '送出');
        var doSubmit = function () {
          if (locked) return;
          var raw = parseFloat(String(inp.value).replace(/[,\s]/g, ''));
          var ok = isFinite(raw) && Math.abs(raw - q.a) <= (q.tol != null ? q.tol : 0.01 * Math.max(1, Math.abs(q.a)));
          inp.disabled = true; sub.disabled = true;
          inp.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)';
          lock(ok, inp.value);
        };
        sub.onclick = doSubmit;
        inp.onkeydown = function (e) { if (e.key === 'Enter') doSubmit(); };
        row.appendChild(inp); row.appendChild(sub);
        card.appendChild(row);
        var gh = ODE.el('div', 'hint');
        gh.innerHTML = '提示：純數字或小數，例如 <code>-0.5</code>（誤差容許 ±' +
          ODE.fmt(q.tol != null ? q.tol : 0.01 * Math.max(1, Math.abs(q.a)), 4) + '）';
        card.appendChild(gh);
        setTimeout(function () { inp.focus(); }, 60);
      }

      var foot = ODE.el('div', 'qfoot');
      foot.innerHTML = '<span class="hint">答完才能按「下一題」</span>';
      var nxt = ODE.el('button', 'btn primary nextbtn', '下一題 ▸');
      nxt.disabled = true;
      nxt.onclick = function () { self.idx++; self.render(); };
      foot.appendChild(nxt);
      card.appendChild(foot);
      host.appendChild(wrap);

      host.appendChild(wrap);
      /* keep the question card visible */
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    summary: function (wrap, host) {
      var self = this;
      var pct = this.order.length ? Math.round(100 * this.score / this.order.length) : 0;
      var msg = pct >= 90 ? '狀態極佳，可以進考場了 🎉'
        : pct >= 75 ? '不錯！把錯的題目再看一次就很穩了'
          : pct >= 50 ? '基本盤有，但還有明顯洞，建議回頭看標記的章節'
            : '先回去把 §1–§8 的例題走一遍，再來考一次';

      var card = ODE.el('div', 'qcard');
      card.innerHTML =
        '<div class="scorebig">' + pct + '<span style="font-size:20px;color:var(--muted)">%</span></div>' +
        '<div style="font-size:16px;font-weight:700;margin:6px 0 2px">' + this.score + ' / ' + this.order.length + ' 題正確</div>' +
        '<div class="hint">' + msg + '</div>';

      var stats = ODE.el('div', 'statgrid');
      Object.keys(this.perSec).forEach(function (k) {
        var s = self.perSec[k];
        stats.innerHTML += '<div class="stat"><div class="k">' + ODE.esc(sectionName(k)) + '</div>' +
          '<div class="v">' + s.c + '/' + s.a + '</div></div>';
      });
      card.appendChild(stats);

      var foot = ODE.el('div', 'qfoot');
      var again = ODE.el('button', 'btn primary', '再考一次 ↺');
      again.onclick = function () { self.start(host, {}); };
      var wrongs = ODE.el('button', 'btn', '只練錯題（' + ODE.store.wrongList().length + '）');
      wrongs.onclick = function () { self.start(host, { mode: 'wrong' }); };
      var home = ODE.el('button', 'btn ghost', '回目錄');
      home.onclick = function () { location.hash = '#/'; };
      foot.appendChild(again); foot.appendChild(wrongs); foot.appendChild(home);
      card.appendChild(foot);

      wrap.appendChild(card);
      host.innerHTML = '';
      host.appendChild(wrap);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    finish: function () { this.idx = this.order.length; this.render(); }
  };

  /* ---- the quiz launcher view ---- */
  function quizView(host) {
    var all = (ODE.data && ODE.data.quiz) || [];
    var secs = {};
    all.forEach(function (q) { secs[q.sec] = (secs[q.sec] || 0) + 1; });

    var wrap = ODE.el('div', 'wrap');
    var st = ODE.store.state.quiz;
    var acc = st.asked ? Math.round(100 * st.correct / st.asked) : 0;

    wrap.innerHTML =
      '<div class="sechead"><div class="num">QUIZ</div><h1>題庫與測驗</h1>' +
      '<div class="en">Test yourself — 每題都有詳解</div>' +
      '<div class="meta"><span class="pill">共 ' + all.length + ' 題</span>' +
      '<span class="pill">累計作答 ' + st.asked + ' 題</span>' +
      '<span class="pill">累計正確率 ' + acc + '%</span>' +
      '<span class="pill">錯題本 ' + ODE.store.wrongList().length + ' 題</span></div></div>';

    var opts = ODE.el('div', 'qcard');
    opts.innerHTML = '<h3 style="font-size:16px;margin-bottom:12px">選擇測驗範圍</h3>';

    var chipbox = ODE.el('div', 'chips');
    var SEC_ORDER = ['all'].concat(Object.keys(secs).sort());
    var chosen = 'all';
    SEC_ORDER.forEach(function (k) {
      var b = ODE.el('button', 'chip' + (k === 'all' ? ' on' : ''),
        k === 'all' ? '全部（' + all.length + '）' : sectionName(k) + '（' + secs[k] + '）');
      b.onclick = function () {
        chosen = k;
        Array.prototype.forEach.call(chipbox.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      };
      chipbox.appendChild(b);
    });
    opts.appendChild(chipbox);

    var row = ODE.el('div', 'row');
    row.style.marginTop = '16px';
    var nsel = ODE.el('select');
    [10, 15, 20, 30, 999].forEach(function (n) {
      var o = ODE.el('option', null, n >= 999 ? '全部題目' : n + ' 題');
      o.value = n; nsel.appendChild(o);
    });
    nsel.value = 15;
    row.appendChild(nsel);
    var go = ODE.el('button', 'btn primary', '開始測驗 ▸');
    go.onclick = function () {
      Quiz.start(host, { sec: chosen, count: +nsel.value });
    };
    row.appendChild(go);
    var gw = ODE.el('button', 'btn', '只練錯題（' + ODE.store.wrongList().length + '）');
    gw.onclick = function () { Quiz.start(host, { mode: 'wrong', count: 999 }); };
    row.appendChild(gw);
    opts.appendChild(row);

    var tip = ODE.el('p', 'note');
    tip.innerHTML = '建議：先做「全部 15 題」當暖身，錯的題目會自動進<b>錯題本</b>，' +
      '之後用「只練錯題」反覆練到全對。';
    opts.appendChild(tip);
    wrap.appendChild(opts);

    if (ODE.store.wrongList().length) {
      var wl = ODE.el('div', 'qcard');
      wl.style.marginTop = '16px';
      wl.innerHTML = '<h3 style="font-size:16px;margin-bottom:10px">錯題本</h3>';
      var ul = ODE.el('div');
      ODE.store.wrongList().forEach(function (id) {
        var q = all.filter(function (x) { return x.id === id; })[0];
        if (!q) return;
        var d = ODE.el('div');
        d.style.padding = '8px 0';
        d.style.borderBottom = '1px solid var(--line)';
        d.innerHTML = '<span class="tag">' + ODE.esc(sectionName(q.sec)) + '</span> ' + q.q;
        ul.appendChild(d);
      });
      if (!ul.children.length) ul.innerHTML = '<p class="note">（原本的錯題都被你訂正掉了，讚）</p>';
      wl.appendChild(ul);
      ODE.render.typeset(wl);
      wrap.appendChild(wl);
    }

    host.innerHTML = '';
    host.appendChild(wrap);
    ODE.render.typeset(wrap);
  }

  Quiz.view = quizView;
  ODE.Quiz = Quiz;
})();
