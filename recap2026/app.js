/* 魔法蜜蜂 2026 塔羅年度回顧 — vanilla JS, no build step. Text/data: data.js (generated from quiz.md). */
(function () {
'use strict';
var D = window.RECAP_DATA, Q = D.questions, R = D.results, LETTERS = ['A', 'B', 'C', 'D'];
var ACC = { A: [232, 190, 92], B: [255, 160, 190], C: [255, 150, 110], D: [140, 220, 210] };   // same as make_recap.EN_COL
var LINE_URL = 'https://line.me/R/ti/p/@041giocs';
var params = new URLSearchParams(location.search);
var TEST_MODE = params.get('test') === '1';
function $(id) { return document.getElementById(id); }
var app = $('app');
if (TEST_MODE) app.classList.add('test');

/* ================= GoatCounter events (skipped for ?test=1 / ?reset=1, same as the draw page) ================= */
var NO_COUNT = !!window.__mbeeNoCount || TEST_MODE, gcQueue = [], gcPoll = null;
function gcSend(v) { try { window.goatcounter.count(v); } catch (e) {} }
function track(path, title) {
  if (NO_COUNT) return;
  var v = { path: path, title: title || path, event: true };
  try {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') { gcSend(v); return; }
    gcQueue.push(v);
    if (!gcPoll) { var tries = 0; gcPoll = setInterval(function () {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') { while (gcQueue.length) gcSend(gcQueue.shift()); }
      if (!gcQueue.length || ++tries > 30) { clearInterval(gcPoll); gcPoll = null; gcQueue = []; }
    }, 500); }
  } catch (e) {}
}

/* ================= 計分 scoring =================
 * A=金 B=水 C=火 D=風. The most-picked letter decides the energy.
 * That letter picked 5+ times -> 強 card, 4 or fewer -> 平衡 card.
 * Tie for most-picked: the tied letter answered most recently wins. Walking back from Q8 means
 * Q8's answer wins whenever it is one of the tied letters (the rule in quiz.md); if it isn't,
 * Q7's answer is checked, then Q6 ... (a tie can only happen at 4/4, 3/3/x, or 2/2/2/2, so it is always 平衡). */
function score(ans) {
  var cnt = { A: 0, B: 0, C: 0, D: 0 }, i, max = 0, tied, letter;
  for (i = 0; i < ans.length; i++) cnt[ans[i]]++;
  LETTERS.forEach(function (l) { if (cnt[l] > max) max = cnt[l]; });
  tied = LETTERS.filter(function (l) { return cnt[l] === max; });
  letter = tied[0];
  if (tied.length > 1) for (i = ans.length - 1; i >= 0; i--) if (tied.indexOf(ans[i]) >= 0) { letter = ans[i]; break; }
  var level = cnt[letter] >= 5 ? '強' : '平衡';
  var res = R.filter(function (r) { return r.letter === letter && r.level === level; })[0];
  return { letter: letter, level: level, count: cnt[letter], counts: cnt, tied: tied, result: res };
}

/* ================= stars ================= */
(function () {
  var s = $('sky'), h = '', i, r = Math.random;
  for (i = 0; i < 70; i++) {
    var sz = r() < .8 ? 2 : 3, col = ['#fff', '#ffe296', '#dcc8ff'][Math.floor(r() * 3)];
    h += '<i class="st" style="left:' + (r() * 99).toFixed(1) + '%;top:' + (r() * 99).toFixed(1) + '%;width:' + sz + 'px;height:' + sz + 'px;background:' + col +
      ';--o:' + (.3 + r() * .5).toFixed(2) + ';animation-delay:-' + (r() * 3).toFixed(2) + 's"></i>';
  }
  for (i = 0; i < 9; i++) h += '<i class="sp" style="left:' + (r() * 95).toFixed(1) + '%;top:' + (r() * 96).toFixed(1) + '%;font-size:' + (8 + r() * 9).toFixed(0) + 'px;--o:' + (.4 + r() * .4).toFixed(2) + ';animation-delay:-' + (r() * 3).toFixed(2) + 's;font-style:normal">✦</i>';
  s.innerHTML = h;
})();

function show(id) { ['intro', 'quiz', 'reveal', 'result'].forEach(function (s) { $(s).classList.toggle('on', s === id); }); }
function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200); }
function cardImg(slug) { return '../c-' + slug + '.webp'; }
function preload(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }

/* ================= 背景音樂 BGM (same file, volume, loop and mute key as the draw page) ================= */
var BGM = (function () {
  var VOL = 0.2, LOOP_START = 0.5, LOOP_LEN = 48, FADE_IN = 2, KEY = 'mbee_bgm_muted', SRC = '../bgm.mp3';
  var AC = window.AudioContext || window.webkitAudioContext, ctx = null, g = null, buf = null, src = null, el = null, want = false, level = 1, loading = false;
  var muted = false; try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var btn = $('bgmBtn');
  try { if (AC) { ctx = new AC(); g = ctx.createGain(); g.gain.value = 0; g.connect(ctx.destination); } } catch (e) { ctx = null; }
  function target() { return muted ? 0 : VOL * level; }
  function load() {
    if (loading) return; loading = true;
    if (ctx) {
      fetch(SRC).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
        ctx.decodeAudioData(ab, function (b) { buf = b; if (want) startNode(); }, function () {});
      }).catch(function () {});
    } else {
      try {
        el = new Audio(SRC); el.preload = 'auto'; el.volume = 0;
        el.addEventListener('timeupdate', function () { if (el.currentTime > LOOP_START + LOOP_LEN) el.currentTime -= LOOP_LEN; });
      } catch (e) { el = null; }
    }
  }
  function ramp(to, sec) {
    try {
      if (g) { var now = ctx.currentTime, p = g.gain; p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(to, now + Math.max(.02, sec)); }
      else if (el) el.volume = Math.max(0, Math.min(1, to));
    } catch (e) {}
  }
  function startNode() {
    if (!want || src || !buf) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      var end = Math.min(buf.duration, LOOP_START + LOOP_LEN); s.loopStart = Math.max(0, end - LOOP_LEN); s.loopEnd = end;
      s.connect(g); g.gain.setValueAtTime(0, ctx.currentTime); s.start(0, s.loopStart); src = s; ramp(target(), FADE_IN);
    } catch (e) { src = null; }
  }
  function paint() { btn.classList.toggle('off', muted); btn.setAttribute('aria-pressed', muted ? 'false' : 'true'); btn.setAttribute('aria-label', muted ? '開啟背景音樂' : '關閉背景音樂'); }
  function start() {          // inside the 開始測驗 tap (iOS / LINE browser need a gesture)
    if (want) return; want = true; level = 1; app.classList.add('bgm'); load();
    try {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); startNode(); }
      else if (el) { try { el.currentTime = LOOP_START; } catch (e) {} var p = el.play(); if (p && p.catch) p.catch(function () {}); ramp(target(), 0); }
    } catch (e) {}
  }
  function duck(l) { level = l; if (want) ramp(target(), 1.5); }
  btn.addEventListener('click', function (e) { e.stopPropagation(); muted = !muted; try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (x) {} paint(); if (want) ramp(target(), .5); });
  document.addEventListener('visibilitychange', function () {
    try { if (document.hidden) { if (el) el.pause(); } else if (want) { if (ctx && ctx.state === 'suspended') ctx.resume(); if (el) el.play().catch(function () {}); } } catch (e) {}
  });
  paint();
  return { start: start, duck: duck, state: function () { return { want: want, muted: muted, loaded: !!buf || !!el, playing: !!src || !!(el && !el.paused) }; } };
})();

/* ================= quiz flow ================= */
var answers = [], qi = 0, busy = false, current = null, shareFile = null, shareUrl = null;
function renderQ(dir) {
  var q = Q[qi];
  $('qno').textContent = 'Q' + (qi + 1) + ' / ' + Q.length;
  $('bar').style.width = ((qi + 1) / Q.length * 100) + '%';
  $('qtext').textContent = q.q;
  $('opts').innerHTML = q.opts.map(function (o, k) {
    var L = LETTERS[k];   // all options share one gold style so nothing hints at the energy
    return '<button class="opt' + (answers[qi] === L ? ' sel' : '') + '" type="button" role="listitem" data-l="' + L + '"><b>' + L + '</b><span></span></button>';
  }).join('');
  Array.prototype.forEach.call($('opts').children, function (b, k) { b.querySelector('span').textContent = q.opts[k]; });
  var box = document.querySelector('.quiz-in'); box.classList.remove('anim'); void box.offsetWidth; if (dir) box.classList.add('anim');
}
$('opts').addEventListener('click', function (e) {
  var b = e.target.closest('.opt'); if (!b || busy) return;
  busy = true; answers[qi] = b.dataset.l;
  Array.prototype.forEach.call($('opts').children, function (x) { x.classList.toggle('sel', x === b); });
  setTimeout(function () {
    busy = false;
    if (qi < Q.length - 1) { qi++; renderQ(1); } else finish();
  }, 260);
});
$('btnBack').addEventListener('click', function () {
  if (busy) return;
  if (qi === 0) { show('intro'); return; }
  qi--; renderQ(-1);
});
$('btnStart').addEventListener('click', function () {
  track('recap2026-start', '2026 年度回顧：開始測驗');
  BGM.start(); answers = []; qi = 0; renderQ(0); show('quiz');
});
$('btnAgain').addEventListener('click', function () {
  answers = []; qi = 0; renderQ(0); BGM.duck(1); show('quiz');
});

function finish() {
  var s = score(answers); current = s;
  var face = $('rvFace'); face.style.backgroundImage = 'url(' + cardImg(s.result.slug) + ')';
  var rv = $('rvCard'); rv.classList.remove('on');
  show('reveal');
  var ready = Promise.all([preload(cardImg(s.result.slug)), buildShare(s)]);
  setTimeout(function () { rv.classList.add('on'); }, 450);
  Promise.all([ready, new Promise(function (ok) { setTimeout(ok, 1700); })]).then(function () { renderResult(s); });
}

function renderResult(s) {
  var r = s.result, c = ACC[r.letter].join(','), el = D.energy[r.letter];
  var card = $('resCard');
  card.style.setProperty('--acc', 'rgb(' + c + ')'); card.style.setProperty('--accA', 'rgba(' + c + ',.28)');
  $('rImg').src = cardImg(r.slug); $('rImg').alt = r.name;
  $('rName').textContent = r.name;
  $('rTag').textContent = r.tag;
  $('sEl').textContent = el[0]; $('sElD').textContent = el[1];
  $('sCnt').textContent = s.count + '/' + Q.length; $('sCntD').textContent = r.letter + ' 選項';
  $('sKw').textContent = r.kw; $('sKwD').textContent = r.level + '主牌';
  $('rText').textContent = r.text;
  $('rSpell').textContent = r.spell;
  BGM.duck(.6);
  show('result'); $('resIn').scrollTop = 0;
  track('recap2026-result-' + r.slug, '2026 年度回顧結果：' + r.name + '（' + r.letter + ' ' + s.count + '/8）');
}

/* ================= 分享圖 share image: 1080x1920 PNG drawn client-side =================
 * img/base-<slug>.webp is the exact site_results card with the 「你選了它幾次」 number blank;
 * img/count-N.png is that number drawn by the same script. Canvas puts them together, so the
 * PNG matches the approved card with the reader's real count. Built before the tap so
 * navigator.share runs inside the user gesture (iOS needs that). */
function renderCard(slug, count) {
  return Promise.all([preload('img/base-' + slug + '.webp'), preload('img/count-' + count + '.png')]).then(function (im) {
    if (!im[0] || !im[1]) throw new Error('img');
    var cv = document.createElement('canvas'); cv.width = D.card[0]; cv.height = D.card[1];
    var x = cv.getContext('2d'), a = D.countAnchor[slug], o = D.countPatch[count];
    x.drawImage(im[0], 0, 0, cv.width, cv.height);
    x.drawImage(im[1], Math.round(a[0] + o[0]), Math.round(a[1] + o[1]));
    return new Promise(function (ok, no) { cv.toBlob(function (b) { b ? ok(b) : no(new Error('blob')); }, 'image/png'); });
  });
}
function buildShare(s) {
  shareFile = null; if (shareUrl) { URL.revokeObjectURL(shareUrl); shareUrl = null; }
  return renderCard(s.result.slug, s.count).then(function (blob) {
    var name = 'magicbee-2026-' + s.result.slug + '.png';
    try { shareFile = new File([blob], name, { type: 'image/png' }); } catch (e) { shareFile = blob; shareFile.name = name; }
    shareUrl = URL.createObjectURL(blob);
  }).catch(function () { shareFile = null; });
}
function openSheet() {
  $('sheetImg').src = shareUrl; $('btnDl').href = shareUrl; $('btnDl').setAttribute('download', shareFile.name || 'magicbee-2026.png');
  $('sheet').classList.add('on');
}
$('btnShare').addEventListener('click', function () {
  if (!shareFile || !current) { toast('圖片準備中，請再按一次'); if (current) buildShare(current); return; }
  var data = { files: [shareFile], title: '我的 2026 主牌', text: current.result.share };
  var canFiles = false; try { canFiles = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [shareFile] })); } catch (e) {}
  if (canFiles) {
    navigator.share(data).catch(function (e) { if (!e || e.name !== 'AbortError') openSheet(); });
    return;
  }
  var touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!touch) {     // desktop: plain download
    var a = document.createElement('a'); a.href = shareUrl; a.download = shareFile.name || 'magicbee-2026.png';
    document.body.appendChild(a); a.click(); a.remove(); toast('圖片已下載');
    return;
  }
  openSheet();      // phones without file sharing (e.g. some in-app browsers): long-press to save
});
$('btnClose').addEventListener('click', function () { $('sheet').classList.remove('on'); });
$('sheet').addEventListener('click', function (e) { if (e.target === $('sheet')) $('sheet').classList.remove('on'); });

/* test-only: ?test=1&ans=AAAAABCD jumps to that result (previews / QA) */
if (TEST_MODE && /^[ABCD]{8}$/.test(params.get('ans') || '')) {
  answers = params.get('ans').split(''); qi = 7; current = score(answers);
  buildShare(current).then(function () { renderResult(current); });
}
window.__recap = { score: score, renderCard: renderCard, current: function () { return current; }, shareReady: function () { return !!shareFile; }, bgm: function () { return BGM.state(); } };
})();
