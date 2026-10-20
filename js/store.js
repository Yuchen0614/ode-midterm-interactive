/* ==========================================================================
   store.js — tiny persistent state (progress / quiz / cards) + helpers
   ========================================================================== */
window.ODE = window.ODE || {};

(function () {
  'use strict';
  var NS = 'ode-midterm-v1';
  var K = {
    theme: NS + ':theme',
    read: NS + ':read',
    quiz: NS + ':quiz',
    wrong: NS + ':wrong',
    cards: NS + ':cards'
  };

  function read(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }

  var state = {
    theme: read(K.theme, 'auto'),
    readsecs: read(K.read, {}),      // { secId: true }
    quiz: read(K.quiz, { asked: 0, correct: 0, bySec: {}, seen: {} }),
    wrong: read(K.wrong, []),        // [qid]  錯題本
    cards: read(K.cards, { known: [], again: [] })
  };

  function save() {
    write(K.theme, state.theme);
    write(K.read, state.readsecs);
    write(K.quiz, state.quiz);
    write(K.wrong, state.wrong);
    write(K.cards, state.cards);
  }

  var Store = {
    state: state,
    save: save,

    /* ---- theme ---- */
    applyTheme: function () {
      var t = state.theme;
      if (t === 'auto') {
        var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', t);
      }
    },
    cycleTheme: function () {
      var order = ['auto', 'light', 'dark'];
      state.theme = order[(order.indexOf(state.theme) + 1) % 3];
      save();
      Store.applyTheme();
      return state.theme;
    },

    /* ---- reading progress ---- */
    isRead: function (id) { return !!state.readsecs[id]; },
    toggleRead: function (id) {
      if (state.readsecs[id]) delete state.readsecs[id];
      else state.readsecs[id] = true;
      save();
      return !!state.readsecs[id];
    },
    readCount: function (ids) {
      var n = 0;
      for (var i = 0; i < ids.length; i++) if (state.readsecs[ids[i]]) n++;
      return n;
    },

    /* ---- quiz ---- */
    recordAnswer: function (q, ok) {
      state.quiz.asked++;
      if (ok) state.quiz.correct++;
      var s = state.quiz.bySec[q.sec] || (state.quiz.bySec[q.sec] = { a: 0, c: 0 });
      s.a++; if (ok) s.c++;
      state.quiz.seen[q.id] = ok ? 1 : -1;
      if (!ok) { if (state.wrong.indexOf(q.id) < 0) state.wrong.push(q.id); }
      else {
        var i = state.wrong.indexOf(q.id);
        if (i >= 0) state.wrong.splice(i, 1);
      }
      save();
    },
    resetQuiz: function () {
      state.quiz = { asked: 0, correct: 0, bySec: {}, seen: {} };
      state.wrong = [];
      save();
    },
    wrongList: function () { return state.wrong.slice(); },

    /* ---- flashcards ---- */
    markCard: function (id, known) {
      var a = state.cards.known, b = state.cards.again;
      a = a.filter(function (x) { return x !== id; });
      b = b.filter(function (x) { return x !== id; });
      (known ? a : b).push(id);
      state.cards.known = a; state.cards.again = b;
      save();
    },
    resetCards: function () { state.cards = { known: [], again: [] }; save(); }
  };

  /* ---- helpers ---- */
  ODE.$ = function (sel, root) { return (root || document).querySelector(sel); };
  ODE.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  ODE.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  ODE.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var toastT = null;
  ODE.toast = function (msg) {
    var t = ODE.$('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 1900);
  };
  ODE.cssVar = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  };

  ODE.store = Store;
  Store.applyTheme();
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (state.theme === 'auto') Store.applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  save();
})();
