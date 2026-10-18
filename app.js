/* 魔法蜜蜂 LINE 每週免費三張牌 v1 — pure static, no build step. */
(function () {
'use strict';

/* ================= 設定 CONFIG ================= */
var CONFIG = {
  FREE_PER_WEEK: 1,              // 每週免費次數
  REVERSED_RATE: 0.3,            // 逆位機率
  // 「想要更深入的專屬解讀」連結。空字串＝顯示「即將開放」提示。
  // 之後可填綠界 https://a.ecpay.tw/eFJ7 或 LINE 對話連結 https://line.me/R/oaMessage/@xxxx/?text=...
  DEEP_READING_URL: '',
  POSITIONS: [
    { key: 'past',  label: '起因', intro: '這張牌說的是讓事情走到今天的原因。' },
    { key: 'now',   label: '現在', intro: '這張牌說的是你此刻的狀態。' },
    { key: 'future', label: '未來', intro: '這張牌說的是接下來朝你靠近的發展。' }
  ],
  TZ_OFFSET_H: 8,                // Asia/Taipei (no DST)
  STORAGE_KEY: 'mbee_tarot_v1'
};
var params = new URLSearchParams(location.search);
var TEST_MODE = params.get('test') === '1';
// ?reset=1 clears this device's weekly record (for demos), then drops the param
if (params.get('reset') === '1') { try { localStorage.removeItem(CONFIG.STORAGE_KEY); localStorage.removeItem(CONFIG.STORAGE_KEY + '_test'); } catch (e) {} params.delete('reset'); try { history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch (e) {} }
// test only: ?test=1&revs=010 forces upright/reversed per position (for previews)
var FORCE_REVS = TEST_MODE && /^[01]{3}$/.test(params.get('revs') || '') ? params.get('revs') : null;
var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= 週期 Week helpers (Monday 00:00 Asia/Taipei) ================= */
var DAY = 864e5, OFF = CONFIG.TZ_OFFSET_H * 36e5;
function weekStart(now) {            // UTC ms of this week's Monday 00:00 Taipei
  var t = new Date(now + OFF), back = (t.getUTCDay() + 6) % 7;
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - back) - OFF;
}
function md(ms) { var t = new Date(ms + OFF); return (t.getUTCMonth() + 1) + '/' + t.getUTCDate(); }

/* ================= 次數儲存 Draw store =================
 * v1: localStorage (per device/browser).
 * Later (LIFF): implement the same interface with liff.getProfile().userId and a
 * server endpoint, e.g. { load: GET /draws?uid=..., save: POST /draws }, then set
 * `store = RemoteDrawStore`. Everything else only talks to `store`.
 * Record shape: { weekStart:Number, uses:Number, drawnAt:Number, cards:[{id,rev}] }
 */
var LocalDrawStore = {
  key: TEST_MODE ? CONFIG.STORAGE_KEY + '_test' : CONFIG.STORAGE_KEY,
  load: function () {
    try { return Promise.resolve(JSON.parse(localStorage.getItem(this.key)) || null); }
    catch (e) { return Promise.resolve(null); }
  },
  save: function (rec) {
    try { localStorage.setItem(this.key, JSON.stringify(rec)); } catch (e) {}
    return Promise.resolve(rec);
  }
};
var store = LocalDrawStore;

function quota(rec, now) {
  var ws = weekStart(now);
  var cur = rec && rec.weekStart === ws ? rec : null;
  var used = cur ? (cur.uses || 0) : 0;
  return {
    weekStart: ws, nextReset: ws + 7 * DAY, current: cur,
    remaining: TEST_MODE ? Math.max(1, CONFIG.FREE_PER_WEEK - used) : Math.max(0, CONFIG.FREE_PER_WEEK - used)
  };
}

/* ================= utils ================= */
var $ = function (id) { return document.getElementById(id); };
function rnd() { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
function shuffled(arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function img(id) { return 'c-' + id + '.webp'; }
function preload(src) { return new Promise(function (r) { var i = new Image(); i.onload = i.onerror = function () { r(); }; i.src = src; setTimeout(r, 4000); }); }
function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

var app = $('app');
if (TEST_MODE) app.classList.add('test');
var READINGS = null, BYID = {};
var readingsP = fetch('readings.json').then(function (r) { return r.json(); }).then(function (d) {
  READINGS = d; d.forEach(function (c) { BYID[c.id] = c; }); return d;
});
// 蠟燭推薦：candles.json { candles: { 名稱: { cta, url } }, map: { cardId: { upright, reversed } } }
// 要加商品連結，只要在 candles.json 填 url，網頁會自動出現「看看這款蠟燭」按鈕。
var CANDLES = null;
var candlesP = fetch('candles.json').then(function (r) { return r.json(); }).then(function (d) { CANDLES = d; return d; })
  .catch(function () { return null; });

/* ================= sparkles ================= */
(function () {
  var s = $('sparkles'), h = '';
  for (var i = 0; i < 18; i++) h += '<div class="sp" style="left:' + (rnd() * 96).toFixed(1) + '%;top:' + (rnd() * 97).toFixed(1) + '%;font-size:' + (8 + rnd() * 12).toFixed(0) + 'px;--o:' + (.55 + rnd() * .45).toFixed(2) + ';animation-delay:-' + (rnd() * 3).toFixed(2) + 's">' + (rnd() > .5 ? '✦' : '✧') + '</div>';
  for (i = 0; i < 30; i++) h += '<div class="dot" style="left:' + (rnd() * 98).toFixed(1) + '%;top:' + (rnd() * 98).toFixed(1) + '%;--o:' + (.4 + rnd() * .6).toFixed(2) + ';animation-delay:-' + (rnd() * 2.6).toFixed(2) + 's"></div>';
  s.innerHTML = h;
})();

/* ================= screens ================= */
function show(id) {
  ['home', 'table', 'result'].forEach(function (s) { $(s).classList.toggle('on', s === id); });
}

/* ================= HOME ================= */
var Q = null, countdownT = null;
function renderHome() {
  return store.load().then(function (rec) {
    Q = quota(rec, Date.now());
    clearInterval(countdownT);
    if (Q.remaining > 0) {
      $('badge').innerHTML = '✦ 本週剩 <b>' + Q.remaining + '</b> 次 ✦';
      $('btnStart').textContent = '開始抽牌';
      $('note').textContent = '每週一 00:00 重置免費次數';
    } else {
      $('badge').innerHTML = '✦ 本週已抽過 ✦';
      $('btnStart').textContent = '看我這週的牌';
      var tick = function () {
        var left = Math.max(0, Q.nextReset - Date.now());
        if (left === 0) { renderHome(); return; }
        var d = Math.floor(left / DAY), hh = Math.floor(left % DAY / 36e5), mm = Math.floor(left % 36e5 / 6e4);
        $('note').innerHTML = '下次免費抽牌還有 <b style="color:#c07a10">' + (d ? d + ' 天 ' : '') + hh + ' 小時 ' + mm + ' 分</b><br>每週一 00:00 重置';
      };
      tick(); countdownT = setInterval(tick, 20000);
    }
    show('home');
  });
}
$('btnStart').addEventListener('click', function () {
  if (!Q) return;
  if (Q.remaining > 0) startDraw();
  else if (Q.current && Q.current.cards) { renderResult(Q.current); show('result'); }
});

/* ================= TABLE: layout ================= */
var N = 78, STEP = 360 / N;
var W, H, PX, PY, R, CW = 62, CH = 122;
var els = [], deckIds = [], cs = [];   // cs = per-card state
var theta = 0, phase = 'idle', picks = [], busy = false;

function layout() {
  W = app.clientWidth; H = app.clientHeight;
  app.style.setProperty('--H', H + 'px');
  var ar = app.getBoundingClientRect(), sr = $('slots').getBoundingClientRect();
  var slotsBottom = sr.bottom - ar.top + 22;   // + label
  R = Math.max(230, Math.min(320, W * 0.72));
  var arcTop = Math.max(slotsBottom + 64, H * 0.5);
  arcTop = Math.min(arcTop, H - 230);
  PX = W / 2; PY = arcTop + CH / 2 + R;
  setWheel();
}
function setWheel() { $('wheel').style.transform = 'translate(' + PX + 'px,' + PY + 'px) rotate(' + theta + 'deg)'; }
function tf(x, y, r, s) { return 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + r.toFixed(2) + 'deg) scale(' + s + ')'; }
function arcA(j) { return (j - 39) * STEP; }
function arcTf(j, extra) {
  var a = arcA(j), rr = R + (extra || 0), rad = a * Math.PI / 180;
  return tf(rr * Math.sin(rad), -rr * Math.cos(rad), cs[j].arcRot, 1);
}

/* ================= TABLE: build + shuffle ================= */
function buildDeck() {
  var wheel = $('wheel');
  wheel.innerHTML = ''; wheel.style.transition = ''; wheel.style.opacity = '';
  els = []; cs = []; theta = 0; picks = [];
  deckIds = shuffled(READINGS.map(function (c) { return c.id; }));
  for (var j = 0; j < N; j++) {
    var e = document.createElement('div'); e.className = 'c'; e.dataset.j = j;
    wheel.appendChild(e); els.push(e);
    var sign = rnd() > .5 ? 1 : -1;
    cs.push({
      r0: .18 + Math.sqrt(rnd()) * .82, a0: rnd() * Math.PI * 2, w: sign * (.18 + rnd() * .38),
      f1: .5 + rnd(), p1: rnd() * 6.3, f2: .6 + rnd() * .9, p2: rnd() * 6.3, f3: .4 + rnd() * .8, p3: rnd() * 6.3,
      rot0: (rnd() - .5) * 80, x: 0, y: 0, rot: 0, arcRot: 0
    });
  }
  // reset slots/table UI
  var slots = $('slots'); slots.style.transform = '';
  slots.querySelectorAll('.slot').forEach(function (s) { s.classList.remove('filled'); var f = s.querySelector('.flip'); if (f) f.remove(); });
  slots.querySelectorAll('.st').forEach(function (s) { s.classList.remove('on'); s.innerHTML = ''; });
  $('fly').innerHTML = '';
  $('pickTitle').textContent = '想著你的問題，選三張牌';
  $('nSel').textContent = '0'; updateHint();
  $('table').className = 'screen';
}

var raf = 0, tSh = 0, lastTs = 0, zTop = 100, zT = 0;
function shuffleFrame(ts) {
  var dt = lastTs ? Math.min(50, ts - lastTs) : 16; lastTs = ts; tSh += dt / 1000;
  placeShuffle(tSh);
  zT += dt; if (zT > 110) { zT = 0; els[Math.floor(rnd() * N)].style.zIndex = ++zTop; }
  raf = requestAnimationFrame(shuffleFrame);
}
function placeShuffle(t) {
  var cx = 0, cy = H * 0.5 - PY, rx = W * 0.36, ry = Math.min(H * 0.25, 230);
  var k = Math.min(1, t / 1.2); k = 1 - Math.pow(1 - k, 3);   // spread-out intro from a stacked deck
  for (var j = 0; j < N; j++) {
    var c = cs[j], ang = c.a0 + c.w * t, r = c.r0 * (.82 + .18 * Math.sin(t * c.f1 + c.p1));
    var x = rx * r * Math.cos(ang) + 9 * Math.sin(t * c.f2 + c.p2);
    var y = ry * r * Math.sin(ang) + 9 * Math.cos(t * c.f2 * 1.3 + c.p2);
    var rot = c.rot0 + c.w * t * 34 + 18 * Math.sin(t * c.f3 + c.p3);
    c.x = cx + k * x; c.y = cy + k * y; c.rot = k * rot + (1 - k) * (j % 7 - 3) * .6;
    els[j].style.transform = tf(c.x, c.y, c.rot, 1.18);
  }
}
function startDraw() {
  readingsP.then(function () {
    buildDeck(); show('table');
    requestAnimationFrame(function () {
      layout(); phase = 'shuffle'; tSh = 0; lastTs = 0;
      if (REDUCED) placeShuffle(4); else raf = requestAnimationFrame(shuffleFrame);
    });
  });
}

/* ================= TABLE: arrange into arc ================= */
$('btnShuffled').addEventListener('click', function () {
  if (phase !== 'shuffle') return;
  phase = 'arrange'; cancelAnimationFrame(raf);
  $('table').classList.add('picking');
  for (var j = 0; j < N; j++) {
    var c = cs[j], a = arcA(j);
    c.arcRot = a + 360 * Math.round((c.rot - a) / 360);        // nearest equivalent angle: no wild spins
    var e = els[j];
    e.style.zIndex = j;
    e.classList.add('go');
    e.style.transitionDelay = (REDUCED ? 0 : Math.min(Math.abs(j - 39), 40) * 9) + 'ms';
    e.style.transform = arcTf(j);
  }
  setTimeout(function () {
    els.forEach(function (e) { e.classList.remove('go'); e.style.transitionDelay = ''; });
    phase = 'pick';
  }, REDUCED ? 50 : 1250);
});

/* ================= TABLE: swipe wheel + tap to pick ================= */
var drag = null, vel = 0, momRaf = 0;
$('deck').addEventListener('pointerdown', function (e) {
  if (phase !== 'pick') return;
  cancelAnimationFrame(momRaf);
  drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, t: performance.now(), moved: false, target: e.target.closest('.c') };
  vel = 0;
});
window.addEventListener('pointermove', function (e) {
  if (!drag) return;
  var dx = e.clientX - drag.x, now = performance.now();
  if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 8) drag.moved = true;
  if (drag.moved) {
    var dd = dx / R * 57.2958;
    theta += dd; setWheel();
    var dtm = Math.max(1, now - drag.t); vel = .7 * vel + .3 * (dd / dtm);
  }
  drag.x = e.clientX; drag.t = now;
});
function endDrag() {
  if (!drag) return;
  var d = drag; drag = null;
  if (!d.moved) { if (d.target) pick(d.target); return; }
  if (performance.now() - d.t > 90) vel = 0;
  if (REDUCED) return;
  var last = performance.now();
  (function mom(ts) {
    var dt = Math.min(40, ts - last); last = ts;
    if (Math.abs(vel) < 0.002 || phase !== 'pick') return;
    theta += vel * dt; vel *= Math.pow(0.94, dt / 16); setWheel();
    momRaf = requestAnimationFrame(mom);
  })(last);
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', function () { drag = null; });

function updateHint() {
  var n = picks.length;
  $('hintMain').textContent = n === 0 ? '憑直覺選第一張牌' : n === 1 ? '很好，再選 2 張' : '再選 1 張，就能看到你的訊息';
}

function pick(el) {
  if (phase !== 'pick' || busy || picks.length >= 3 || el.classList.contains('gone')) return;
  busy = true; cancelAnimationFrame(momRaf); vel = 0;
  var j = +el.dataset.j, id = deckIds[j], slotI = picks.length, rev = FORCE_REVS ? FORCE_REVS[slotI] === '1' : rnd() < CONFIG.REVERSED_RATE;
  picks.push({ id: id, rev: rev }); preload(img(id));
  $('nSel').textContent = picks.length; updateHint();
  el.style.zIndex = 500;
  el.classList.add('lift'); el.style.transform = arcTf(j, 34);
  setTimeout(function () {
    busy = false;
    var ar = app.getBoundingClientRect(), r = el.getBoundingClientRect();
    var slot = $('slots').querySelectorAll('.slot')[slotI], sr = slot.getBoundingClientRect();
    var fc = document.createElement('div'); fc.className = 'flyc';
    var sx = sr.left - ar.left, sy = sr.top - ar.top;
    fc.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:' + sr.width + 'px;height:' + sr.height + 'px';
    var fl = document.createElement('div'); fl.className = 'flip';
    fl.innerHTML = '<div class="face b"></div><div class="face f' + (rev ? ' rev' : '') + '" style="background-image:url(' + img(id) + ')"></div>';
    fc.appendChild(fl);
    var dx = (r.left + r.width / 2) - ar.left - (sx + sr.width / 2), dy = (r.top + r.height / 2) - ar.top - (sy + sr.height / 2);
    fc.style.transform = tf(dx, dy, cs[j].arcRot + theta, (CW / sr.width).toFixed(3));
    $('fly').appendChild(fc);
    el.classList.add('gone');
    fc.getBoundingClientRect();              // reflow
    fc.style.transform = 'none';
    setTimeout(function () {
      fl.remove(); slot.appendChild(fl); slot.classList.add('filled'); fc.remove();
      if (picks.length === 3 && slotI === 2) reveal();
    }, REDUCED ? 30 : 660);
  }, REDUCED ? 30 : 300);
}

/* ================= TABLE: reveal ================= */
function reveal() {
  phase = 'reveal';
  var t = $('table'); t.classList.remove('picking'); t.classList.add('reveal');
  // save immediately so a refresh can't re-draw
  var rec = { weekStart: weekStart(Date.now()), uses: ((Q && Q.current && Q.current.uses) || 0) + 1, drawnAt: Date.now(), cards: picks.slice() };
  store.save(rec).then(function () { return store.load(); }).then(function (r) { Q = quota(r, Date.now()); });
  $('pickTitle').textContent = '你的三張牌';
  // deck falls away
  var wh = $('wheel');
  wh.style.transition = 'transform .9s cubic-bezier(.5,0,.75,.3),opacity .7s';
  wh.style.transform = 'translate(' + PX + 'px,' + (PY + H * .7) + 'px) rotate(' + (theta + 25) + 'deg)';
  wh.style.opacity = '0';
  // slots grow to centre
  var slots = $('slots'), ar = app.getBoundingClientRect(), ws_ = slots.querySelectorAll('.slotw');
  var r0 = ws_[0].getBoundingClientRect(), r2 = ws_[2].getBoundingClientRect(), srr = slots.getBoundingClientRect();
  var sr = { width: r2.right - r0.left, height: srr.height, top: srr.top };
  var s = Math.min(1.6, (W - 30) / sr.width, (H * .5) / sr.height);
  var top0 = sr.top - ar.top, want = H * .47 - sr.height * s / 2;
  slots.style.transform = 'translateY(' + (want - top0).toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
  Promise.all([wait(REDUCED ? 50 : 900)].concat(picks.map(function (p) { return preload(img(p.id)); }))).then(function () {
    var flips = slots.querySelectorAll('.flip'), sts = slots.querySelectorAll('.st');
    picks.forEach(function (p, i) {
      setTimeout(function () {
        flips[i].classList.add('on');
        sts[i].innerHTML = p.rev ? '<span class="tag">逆位</span>' : '<span class="tag up">正位</span>';
        sts[i].classList.add('on');
      }, REDUCED ? 0 : i * 520);
    });
    setTimeout(function () { renderResult(rec); t.classList.add('done'); phase = 'done'; }, REDUCED ? 100 : 3 * 520 + 500);
  });
}
$('btnSee').addEventListener('click', function () { show('result'); $('result').querySelector('.res-in').scrollTop = 0; });

/* ================= RESULT ================= */
function renderResult(rec) {
  var ws = rec.weekStart;
  $('resSub').textContent = md(ws) + '（一）– ' + md(ws + 6 * DAY) + '（日）・起因・現在・未來';
  $('items').innerHTML = rec.cards.map(function (p, i) {
    var c = BYID[p.id] || { name_zh: p.id, upright: '', reversed: '' }, pos = CONFIG.POSITIONS[i];
    return '<div class="item"><div class="card' + (p.rev ? ' rev' : '') + '" style="background-image:url(' + img(p.id) + ')"></div><div class="tx">' +
      '<div class="pos">✦ ' + pos.label + '</div>' +
      '<div class="name">' + esc(c.name_zh) + (p.rev ? '<span class="tag">逆位</span>' : '<span class="tag up">正位</span>') + '</div>' +
      '<div class="intro">' + pos.label + '：' + pos.intro + '</div>' +
      '<div class="desc">' + esc(p.rev ? c.reversed : c.upright) + '</div></div></div>';
  }).join('');
  renderCandle(rec);
  var q = quota(rec, Date.now());
  $('resNote').textContent = TEST_MODE ? '測試模式：不限次數' : '下次免費抽牌：' + md(q.nextReset) + '（一）00:00 起';
}
/* 依「未來」(第三張) 牌的正逆位推薦一款蠟燭 */
var candleSeq = 0;
function renderCandle(rec) {
  var box = $('candle'), seq = ++candleSeq;
  box.innerHTML = ''; box.classList.remove('on');
  var f = rec.cards && rec.cards[2];
  if (!f) return;
  candlesP.then(function (d) {
    if (seq !== candleSeq || !d || !d.map || !d.candles) return;
    var m = d.map[f.id], name = m && (f.rev ? m.reversed : m.upright), c = name && d.candles[name];
    if (!c) return;
    var url = (c.url || '').trim(), safe = /^https?:\/\//i.test(url);
    box.innerHTML =
      '<div class="cd-ic" aria-hidden="true"><svg viewBox="0 0 40 64" width="34" height="54">' +
        '<defs><linearGradient id="cdF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".55" stop-color="#f4b23c"/><stop offset="1" stop-color="#e07a1c"/></linearGradient>' +
        '<linearGradient id="cdB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6dfa6"/><stop offset=".5" stop-color="#fff6de"/><stop offset="1" stop-color="#e9c77a"/></linearGradient></defs>' +
        '<ellipse cx="20" cy="15" rx="11" ry="13" fill="#ffd36b" opacity=".25"/>' +
        '<path class="cd-fl" d="M20 4C23 10 26 13 26 18a6 6 0 0 1-12 0c0-5 3-8 6-14z" fill="url(#cdF)"/>' +
        '<rect x="19.2" y="21" width="1.6" height="5" rx=".8" fill="#6a4a24"/>' +
        '<rect x="9" y="26" width="22" height="34" rx="3" fill="url(#cdB)" stroke="#e2b34d" stroke-width="1.2"/>' +
        '<path d="M9 30q5 3 11 0t11 0" fill="none" stroke="#e2b34d" stroke-width="1"/></svg></div>' +
      '<div class="tx"><div class="pos">✦ 為未來點一盞燭光</div>' +
      '<div class="name">「' + esc(name) + '」蠟燭</div>' +
      '<div class="desc">' + esc(c.cta) + '</div>' +
      (safe ? '<a class="cd-btn" href="' + esc(url) + '" target="_blank" rel="noopener">看看這款蠟燭</a>' : '') +
      '</div>';
    box.classList.add('on');
  });
}
$('btnDeep').addEventListener('click', function () {
  if (CONFIG.DEEP_READING_URL) location.href = CONFIG.DEEP_READING_URL;
  else toast('專屬解讀即將開放，敬請期待 ✦');
});
$('btnNext').addEventListener('click', function () { renderHome(); });

window.addEventListener('resize', function () { if (phase === 'pick' || phase === 'shuffle') { layout(); if (phase === 'pick') els.forEach(function (e, j) { if (!e.classList.contains('gone')) e.style.transform = arcTf(j); }); } });

/* boot */
readingsP.then(function () {
  // result screen needs readings; home can render right away
}).catch(function () { toast('讀取牌義失敗，請重新整理'); });
renderHome();

// expose for automated preview/testing
window.__mbee = { pickVisible: function (k) { var c = els.filter(function (e) { return !e.classList.contains('gone'); }); var mid = c.filter(function (e) { return Math.abs(((arcA(+e.dataset.j) + theta) % 360 + 540) % 360 - 180) < 25; }); pick(mid[Math.min(k, mid.length - 1)]); }, rotate: function (d) { theta += d; setWheel(); }, phase: function () { return phase; }, candle: function () { var b = $('candle'); return b.classList.contains('on') ? b.querySelector('.name').textContent : ''; } };
})();
