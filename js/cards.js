/* ==========================================================================
   cards.js — flashcard deck view
   ========================================================================== */
window.ODE = window.ODE || {};

(function () {
  'use strict';

  function cardsView(host) {
    var all = (ODE.data && ODE.data.cards) || [];
    var wrap = ODE.el('div', 'wrap');

    var known = ODE.store.state.cards.known;
    var pct = all.length ? Math.round(100 * known.length / all.length) : 0;

    wrap.innerHTML =
      '<div class="sechead"><div class="num">CARDS</div><h1>公式記憶卡</h1>' +
      '<div class="en">Flip to check — 考前十分鐘翻一輪</div>' +
      '<div class="meta"><span class="pill">共 ' + all.length + ' 張</span>' +
      '<span class="pill">已記住 ' + known.length + ' 張（' + pct + '%）</span></div></div>';

    var bar = ODE.el('div', 'pbar');
    bar.style.marginBottom = '16px';
    bar.innerHTML = '<i style="width:' + pct + '%"></i>';
    wrap.appendChild(bar);

    /* category filter */
    var cats = [];
    all.forEach(function (c) { if (cats.indexOf(c.cat) < 0) cats.push(c.cat); });
    var chipbox = ODE.el('div', 'chips');
    chipbox.style.marginBottom = '16px';
    var chosen = 'all';
    ['all'].concat(cats).forEach(function (k) {
      var b = ODE.el('button', 'chip' + (k === 'all' ? ' on' : ''), k === 'all' ? '全部' : k);
      b.onclick = function () {
        chosen = k;
        Array.prototype.forEach.call(chipbox.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        paint();
      };
      chipbox.appendChild(b);
    });
    wrap.appendChild(chipbox);

    var deck = ODE.el('div', 'carddeck');
    wrap.appendChild(deck);

    var foot = ODE.el('div', 'row');
    foot.style.marginTop = '20px';
    var rs = ODE.el('button', 'btn', '重設記憶卡進度');
    rs.onclick = function () {
      ODE.store.resetCards();
      ODE.toast('已重設');
      paint();
    };
    foot.appendChild(rs);
    wrap.appendChild(foot);

    function paint() {
      deck.innerHTML = '';
      var list = all.filter(function (c) { return chosen === 'all' || c.cat === chosen; });
      list.forEach(function (c) {
        var isKnown = ODE.store.state.cards.known.indexOf(c.id) >= 0;
        var fc = ODE.el('div', 'fc' + (isKnown ? ' flipped' : ''));
        fc.innerHTML =
          '<div class="inner">' +
          '<div class="face front"><div class="cat">' + ODE.esc(c.cat) + (isKnown ? ' · 已記住' : '') + '</div>' +
          '<div class="qt">' + c.q + '</div>' +
          '<div class="hintflip">點一下看答案</div></div>' +
          '<div class="face back"><div class="cat">答案</div><div class="at">' + c.a + '</div>' +
          '<div class="hintflip">點一下翻回去</div></div></div>';
        fc.onclick = function () { fc.classList.toggle('flipped'); };
        deck.appendChild(fc);
        ODE.render.typeset(fc);
      });

      /* per-card marking row */
      var mr = ODE.el('div', 'markdone');
      mr.innerHTML = '<span class="t">看完一輪了嗎？把記住的標起來，進度會出現在上面。</span>';
      var kb = ODE.el('button', 'btn primary', '✓ 目前顯示的都記住了');
      kb.onclick = function () {
        list.forEach(function (c) {
          if (ODE.store.state.cards.known.indexOf(c.id) < 0) ODE.store.markCard(c.id, true);
        });
        ODE.toast('已標記 ' + list.length + ' 張');
        cardsView(host);
      };
      mr.appendChild(kb);
      if (foot.parentNode) foot.parentNode.insertBefore(mr, foot);
    }

    paint();
    host.innerHTML = '';
    host.appendChild(wrap);
  }

  ODE.cardsView = cardsView;
})();
