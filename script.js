/* ══ PROJECTS DATA ══ */
const PROJECTS = [
  {
    title: 'Coaching Tool',
    year: '2024 — Unreal Engine 5 · C++',
    tags: ['C++', 'UE5', 'FSM', 'UMG', 'Blueprint', 'DynMaterial'],
    desc: 'An in-editor Unreal Engine 5 tool built for the Coaching project. A Finite State Machine architecture drives a toolbar system for actor manipulation in-scene. C++ base classes expose clean Blueprint-friendly UPROPERTY interfaces, while UMG widgets reflect live state changes. Dynamic Material Instances handle real-time color/parameter overrides. Implements the Template Method Pattern for extensible button behaviours.',
    links: [{ label: 'GitHub ↗', url: '#' }, { label: 'Video ↗', url: '#' }],
    slides: [
      { label: 'FSM Architecture', color: '#0b150a' },
      { label: 'Toolbar UI', color: '#090e1a' },
      { label: 'Actor Manipulation', color: '#130a1a' },
      { label: 'Material Instances', color: '#1a0e0a' },
      { label: 'Blueprint Integration', color: '#0a1512' }
    ]
  },
  {
    title: 'PlayStation SDK Integration',
    year: '2023 — Unreal Engine 5 · PlayStation',
    tags: ['C++', 'PS SDK', 'Console', '.self', 'UE5', 'Build Pipeline'],
    desc: 'Deep platform integration for PlayStation consoles within an Unreal Engine 5 project. Covers .self binary packaging, save-data management, controller input layer, trophies/achievements and full platform-compliance. Build pipeline spans Linux ↔ Windows via SSH tunnelling.',
    links: [{ label: 'Details ↗', url: '#' }],
    slides: [
      { label: 'Platform API', color: '#00122e' },
      { label: 'Save System', color: '#00180d' },
      { label: 'Build Pipeline', color: '#1a0e00' },
      { label: 'Input Layer', color: '#16001a' }
    ]
  },
  {
    title: 'UI Widget Framework',
    year: '2023 — Unreal Engine 5 · UMG',
    tags: ['C++', 'UMG', 'Blueprint', 'UI', 'UPROPERTY', 'UMG Animations'],
    desc: 'A reusable, composable widget system built on UMG. C++ base classes expose fully customisable properties via UPROPERTY specifiers, letting designers iterate without touching engine code. Includes dynamic data binding, UMG animation hooks, and a component-based composition model.',
    links: [{ label: 'GitHub ↗', url: '#' }],
    slides: [
      { label: 'Widget System', color: '#0d0a1a' },
      { label: 'Blueprint Integration', color: '#001a18' },
      { label: 'Dynamic Binding', color: '#1a0012' }
    ]
  }
];

/* ══ HERO MAZE + A* ══ */
(function () {
  var canvas = document.getElementById('hero-canvas');
  var ctx = canvas.getContext('2d');
  var heroEl = document.getElementById('hero');
  var hint = document.getElementById('hero-hint');

  var CELL = 38;
  var W, H, COLS, ROWS, offX, offY;
  var cells;
  var N = 0, E = 1, S = 2, W3 = 3;
  var OPP = [2, 3, 0, 1], DDC = [0, 1, 0, -1], DDR = [-1, 0, 1, 0];

  /* ══════════════════════════════════════════════
     MAZE COLORS — edit here to restyle the hero
     ══════════════════════════════════════════════ */
  var C = {
    wall: 'rgba(232,255,90,',   /* accent yellow — wall stroke base (opacity appended at runtime) */
    wallUncarved: 0.40,                 /* wall opacity for uncarved (solid) blocks                      */
    wallCarved: 0.28,                 /* wall opacity for normal carved cells                          */
    wallActive: 0.65,                 /* wall opacity when cell is explored / in-path / in-open        */

    blockFill: 'rgba(121, 113, 19, 0.15)',  /* uncarved cell background — yellowish block                */
    openFill: 'rgba(160,195,230,0.12)', /* A* open-set cell tint                                     */

    /* A* explored cells: base RGB, brightness shifts with distance */
    exploredR: 28, exploredG: 34, exploredB: 44,

    /* path pulse (glow + line) */
    pathFill: 'rgba(232,255,90,',   /* path cell background (opacity appended)                      */
    pathLine: 'rgba(232,255,90,',   /* path polyline colour (opacity appended)                      */
    pathGlowAlpha: 0.08,                 /* glow pass base alpha                                         */
    pathGlowDelta: 0.06,                 /* glow pass animated delta                                     */
    pathLineAlpha: 0.55,                 /* sharp line base alpha                                        */
    pathLineDelta: 0.30,                 /* sharp line animated delta                                    */
    pathHead: 'rgba(255,255,200,0.95)', /* travelling dot at path head                              */
    pathHeadGlow: 'rgba(232,255,90,0.7)',   /* shadow glow around path head                             */

    /* start / goal dots */
    dotStart: 'rgba(60, 103, 210, 0.85)',   /* green start dot                                          */
    dotGoal: 'rgba(105, 255, 40, 0.85)',  /* yellow goal dot                                          */
    dotStartPick: 'rgba(60, 103, 210, 0.25)',   /* start cell highlight while waiting for goal click        */
  };


  /* ── Two-mode state machine ──────────────────────────────
     mode = 'auto'  → normal loop: generate → solve → regen
     mode = 'user'  → user placed points, A* running/done
     userPhase: 'pick_start' | 'pick_goal' | 'solving' | 'done'
  ─────────────────────────────────────────────────────── */
  var mode = 'auto';
  var autoPhase = 'generate';   /* generate | pause_pre_solve | solve | showpath | pause_pre_regen */
  var autoTimer = 0;
  var userPhase = 'pick_start'; /* pick_start | pick_goal | solving | done */
  var userDoneTimer = 0;
  var USER_DONE_PAUSE = 3500;   /* ms before returning to auto after user solve */

  var primFrontier = [];         /* candidate cells for Prim's expansion */
  var primVisited = null;
  var GEN_SPEED = 2;          /* frontier cells carved per frame */
  var SOLVE_SPEED = 6;
  var PAUSE_SHORT = 1000;
  var PAUSE_LONG = 4000;

  var aOpen, aClosed, aCameFrom, gScore, fScore;
  var aRunning = false;
  var solvePath = null, showPathIdx = 0;
  var pathGlow = 0, pathDrawTick = 0;

  /* start/goal for whichever mode is active */
  var startIdx = -1, goalIdx = -1;
  /* user-picked cells (used in 'user' mode only) */
  var userStart = -1, userGoal = -1;

  function ci(c, r) { return r * COLS + c; }

  /* ── layout ── */
  function resize() {
    W = heroEl.offsetWidth || window.innerWidth;
    H = heroEl.offsetHeight || window.innerHeight;
    if (!W || !H || W < 100) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    enterAuto();
  }

  function initCells() {
    COLS = Math.floor(W / CELL);
    ROWS = Math.floor(H / CELL);
    offX = Math.floor((W - COLS * CELL) / 2);
    offY = Math.floor((H - ROWS * CELL) / 2);
    cells = [];
    for (var i = 0; i < COLS * ROWS; i++)
      cells.push({ walls: [true, true, true, true], explored: false, inOpen: false, inPath: false });
  }

  /* ── AUTO mode ── */
  function enterAuto() {
    mode = 'auto';
    initCells();
    primVisited = new Uint8Array(COLS * ROWS);
    primFrontier = [];
    solvePath = null; aRunning = false; pathGlow = 0; pathDrawTick = 0;
    startIdx = -1; goalIdx = -1;
    userStart = -1; userGoal = -1;
    userPhase = 'pick_start';
    autoPhase = 'generate';
    if (hint) { hint.textContent = 'Click to set start · click again to solve'; hint.classList.remove('hide'); }
    /* seed from centre */
    var sc = Math.floor(COLS / 2), sr = Math.floor(ROWS / 2);
    primVisit(sc, sr);
  }

  function primVisit(c, r) {
    primVisited[ci(c, r)] = 1;
    /* add unvisited neighbours to frontier */
    for (var d = 0; d < 4; d++) {
      var nc = c + DDC[d], nr = r + DDR[d];
      if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && !primVisited[ci(nc, nr)]) {
        primVisited[ci(nc, nr)] = 2;   /* 2 = in frontier */
        primFrontier.push({ c: nc, r: nr });
      }
    }
  }

  function stepGenerate() {
    for (var s = 0; s < GEN_SPEED; s++) {
      if (!primFrontier.length) return false;
      /* pick a random frontier cell */
      var fi = Math.floor(Math.random() * primFrontier.length);
      var cur = primFrontier.splice(fi, 1)[0];
      if (primVisited[ci(cur.c, cur.r)] === 1) continue;  /* already carved */
      /* find a random visited neighbour to connect to */
      var dirs = [0, 1, 2, 3].sort(function () { return Math.random() - .5; });
      for (var di = 0; di < 4; di++) {
        var d = dirs[di];
        var nc = cur.c + DDC[d], nr = cur.r + DDR[d];
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && primVisited[ci(nc, nr)] === 1) {
          /* carve passage between cur and this visited neighbour */
          cells[ci(cur.c, cur.r)].walls[d] = false;
          cells[ci(nc, nr)].walls[OPP[d]] = false;
          primVisit(cur.c, cur.r);
          break;
        }
      }
    }
    return primFrontier.length > 0;
  }

  function autoStartSolve() {
    var corners = [0, COLS - 1, ci(0, ROWS - 1), ci(COLS - 1, ROWS - 1)];
    var si = Math.floor(Math.random() * 2);
    startIdx = corners[si];
    goalIdx = corners[3 - si];
    beginAStar(startIdx, goalIdx);
    autoPhase = 'solve';
  }

  /* ── A* core (shared) ── */
  function beginAStar(si, gi) {
    startIdx = si; goalIdx = gi;
    aRunning = true; solvePath = null; showPathIdx = 0; pathDrawTick = 0;
    var n = COLS * ROWS;
    aClosed = new Uint8Array(n);
    aCameFrom = new Int32Array(n).fill(-1);
    gScore = new Float32Array(n).fill(Infinity);
    fScore = new Float32Array(n).fill(Infinity);
    for (var i = 0; i < cells.length; i++) {
      cells[i].explored = false; cells[i].inOpen = false; cells[i].inPath = false;
    }
    gScore[startIdx] = 0;
    fScore[startIdx] = heur(startIdx);
    aOpen = [startIdx];
    cells[startIdx].inOpen = true;
  }

  function heur(idx) {
    var ac = idx % COLS, ar = Math.floor(idx / COLS);
    var bc = goalIdx % COLS, br = Math.floor(goalIdx / COLS);
    return Math.abs(ac - bc) + Math.abs(ar - br);
  }

  function stepSolve() {
    for (var s = 0; s < SOLVE_SPEED; s++) {
      if (!aRunning) return;
      if (!aOpen.length) { aRunning = false; return; }
      var bi = 0;
      for (var k = 1; k < aOpen.length; k++)
        if (fScore[aOpen[k]] < fScore[aOpen[bi]]) bi = k;
      var cur = aOpen.splice(bi, 1)[0];
      cells[cur].inOpen = false; cells[cur].explored = true; aClosed[cur] = 1;
      if (cur === goalIdx) {
        solvePath = []; var node = goalIdx;
        while (node !== -1) { solvePath.unshift(node); node = aCameFrom[node]; }
        aRunning = false; return;
      }
      var cc = cur % COLS, cr = Math.floor(cur / COLS);
      for (var d = 0; d < 4; d++) {
        if (cells[cur].walls[d]) continue;
        var nc = cc + DDC[d], nr = cr + DDR[d];
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        var nb = ci(nc, nr);
        if (aClosed[nb]) continue;
        var tg = gScore[cur] + 1;
        if (tg < gScore[nb]) {
          aCameFrom[nb] = cur; gScore[nb] = tg; fScore[nb] = tg + heur(nb);
          if (aOpen.indexOf(nb) === -1) { aOpen.push(nb); cells[nb].inOpen = true; }
        }
      }
    }
  }

  /* ── render (shared) ── */
  function render() {
    ctx.clearRect(0, 0, W, H);
    pathGlow += 0.05;

    var maxG = 1;
    if (gScore) for (var i = 0; i < gScore.length; i++)
      if (gScore[i] < Infinity && gScore[i] > maxG) maxG = gScore[i];

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var idx = ci(c, r), cell = cells[idx];
        var px = offX + c * CELL, py = offY + r * CELL;
        var inner = CELL - 2;

        /* uncarved = all 4 walls intact → yellowish block, not selectable */
        var uncarved = cell.walls[N] && cell.walls[E] && cell.walls[S] && cell.walls[W3];
        if (uncarved) {
          ctx.fillStyle = C.blockFill;
          ctx.fillRect(px + 1, py + 1, inner, inner);
        } else if (cell.inPath) {
          var gp = Math.sin(pathGlow) * .5 + .5;
          ctx.fillStyle = C.pathFill + (.05 + gp * .04) + ')';
          ctx.fillRect(px + 1, py + 1, inner, inner);
          ctx.strokeStyle = C.pathFill + (.45 + gp * .30) + ')';
          ctx.lineWidth = .8;
          ctx.strokeRect(px + 2, py + 2, inner - 2, inner - 2);
        } else if (cell.explored && gScore) {
          var gn = gScore[idx] < Infinity ? Math.min(1, gScore[idx] / maxG) : 0;
          ctx.fillStyle = 'rgba(' + (C.exploredR + gn * 8) + ',' + (C.exploredG + gn * 10) + ',' + (C.exploredB + gn * 12) + ',' + (.65 - gn * .15) + ')';
          ctx.fillRect(px + 1, py + 1, inner, inner);
        } else if (cell.inOpen && gScore) {
          ctx.fillStyle = C.openFill;
          ctx.fillRect(px + 1, py + 1, inner, inner);
        }

        /* highlight user-picked start cell while waiting for goal */
        if (mode === 'user' && userPhase === 'pick_goal' && idx === userStart) {
          ctx.fillStyle = C.dotStartPick;
          ctx.fillRect(px + 1, py + 1, inner, inner);
        }

        var wa = uncarved ? C.wallUncarved : (cell.inPath || cell.explored || cell.inOpen) ? C.wallActive : C.wallCarved;
        ctx.strokeStyle = C.wall + wa + ')';
        ctx.lineWidth = 1; ctx.lineCap = 'square';
        if (cell.walls[N]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + CELL, py); ctx.stroke(); }
        if (cell.walls[E]) { ctx.beginPath(); ctx.moveTo(px + CELL, py); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
        if (cell.walls[S]) { ctx.beginPath(); ctx.moveTo(px, py + CELL); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
        if (cell.walls[W3]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + CELL); ctx.stroke(); }
      }
    }

    /* dots: only draw when a solve is active or done */
    if (startIdx >= 0) drawDot(startIdx, C.dotStart);
    if (goalIdx >= 0) drawDot(goalIdx, C.dotGoal);

    /* path line */
    if (solvePath && showPathIdx > 1) {
      var gv = Math.sin(pathGlow) * .5 + .5;
      ctx.beginPath();
      for (var p = 0; p < showPathIdx && p < solvePath.length; p++) {
        var pc = solvePath[p] % COLS, pr = Math.floor(solvePath[p] / COLS);
        var ppx = offX + pc * CELL + CELL / 2, ppy = offY + pr * CELL + CELL / 2;
        p === 0 ? ctx.moveTo(ppx, ppy) : ctx.lineTo(ppx, ppy);
      }
      ctx.strokeStyle = C.pathLine + (C.pathGlowAlpha + gv * C.pathGlowDelta) + ')';
      ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath();
      for (var p2 = 0; p2 < showPathIdx && p2 < solvePath.length; p2++) {
        var pc2 = solvePath[p2] % COLS, pr2 = Math.floor(solvePath[p2] / COLS);
        var ppx2 = offX + pc2 * CELL + CELL / 2, ppy2 = offY + pr2 * CELL + CELL / 2;
        p2 === 0 ? ctx.moveTo(ppx2, ppy2) : ctx.lineTo(ppx2, ppy2);
      }
      ctx.strokeStyle = C.pathLine + (C.pathLineAlpha + gv * C.pathLineDelta) + ')';
      ctx.lineWidth = 1.8; ctx.stroke();
      if (showPathIdx > 0) {
        var hi = solvePath[Math.min(showPathIdx - 1, solvePath.length - 1)];
        var hpc = hi % COLS, hpr = Math.floor(hi / COLS);
        ctx.shadowColor = C.pathHeadGlow; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(offX + hpc * CELL + CELL / 2, offY + hpr * CELL + CELL / 2, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = C.pathHead; ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawDot(idx, color) {
    if (idx < 0) return;
    var c = idx % COLS, r = Math.floor(idx / COLS);
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(offX + c * CELL + CELL / 2, offY + r * CELL + CELL / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ── main loop ── */
  function draw(ts) {
    requestAnimationFrame(draw);

    if (mode === 'user') {
      /* userPhase: pick_start → (click) → pick_goal → (click) → solving → done → auto */
      if (userPhase === 'solving') {
        if (aRunning) {
          stepSolve();
        } else {
          /* A* finished */
          if (solvePath) {
            pathDrawTick++;
            if (pathDrawTick % 2 === 0 && showPathIdx < solvePath.length) {
              cells[solvePath[showPathIdx]].inPath = true;
              showPathIdx++;
            }
            if (showPathIdx >= solvePath.length) {
              userPhase = 'done';
              userDoneTimer = ts;
              if (hint) { hint.textContent = 'Click anywhere to search again'; hint.classList.remove('hide'); }
            }
          } else {
            /* no path found */
            userPhase = 'done'; userDoneTimer = ts;
          }
        }
      } else if (userPhase === 'done') {
        /* after pause, return to auto */
        if (ts - userDoneTimer > USER_DONE_PAUSE) enterAuto();
      }
      /* pick_start and pick_goal: just render, waiting for clicks */
      render();
      return;
    }

    /* mode === 'auto' */
    if (autoPhase === 'generate') {
      if (!stepGenerate()) { autoPhase = 'pause_pre_solve'; autoTimer = ts; }
    } else if (autoPhase === 'pause_pre_solve') {
      if (ts - autoTimer > PAUSE_SHORT) autoStartSolve();
    } else if (autoPhase === 'solve') {
      stepSolve();
      if (!aRunning && solvePath) { autoPhase = 'showpath'; }
      else if (!aRunning && !solvePath) { autoPhase = 'pause_pre_regen'; autoTimer = ts; }
    } else if (autoPhase === 'showpath') {
      pathDrawTick++;
      if (pathDrawTick % 3 === 0) {
        if (showPathIdx < solvePath.length) { cells[solvePath[showPathIdx]].inPath = true; showPathIdx++; }
        else { autoPhase = 'pause_pre_regen'; autoTimer = ts; }
      }
    } else if (autoPhase === 'pause_pre_regen') {
      if (ts - autoTimer > PAUSE_LONG) enterAuto();
    }
    render();
  }

  /* ── click handler ── */
  canvas.addEventListener('click', function (e) {
    var rect = canvas.getBoundingClientRect();          /* use canvas, not heroEl */
    var lx = e.clientX - rect.left;
    var ly = e.clientY - rect.top;
    var cc = Math.floor((lx - offX) / CELL);
    var cr = Math.floor((ly - offY) / CELL);
    if (cc < 0 || cc >= COLS || cr < 0 || cr >= ROWS) return;
    var idx = ci(cc, cr);
    /* reject uncarved cells (all 4 walls still intact) */
    var cel = cells[idx];
    if (cel.walls[0] && cel.walls[1] && cel.walls[2] && cel.walls[3]) return;

    if (mode === 'auto' || (mode === 'user' && (userPhase === 'done' || userPhase === 'pick_start'))) {
      /* First click: enter user mode, place start */
      mode = 'user'; userPhase = 'pick_goal';
      userStart = idx; userGoal = -1;
      startIdx = -1; goalIdx = -1;        /* clear auto dots */
      solvePath = null; aRunning = false;
      for (var i = 0; i < cells.length; i++) {
        cells[i].explored = false; cells[i].inOpen = false; cells[i].inPath = false;
      }
      gScore = null;
      if (hint) { hint.textContent = 'Now click a destination cell'; hint.classList.remove('hide'); }

    } else if (mode === 'user' && userPhase === 'pick_goal') {
      /* Second click: place goal, start A* */
      if (idx === userStart) return;      /* same cell → ignore */
      userGoal = idx;
      userPhase = 'solving';
      beginAStar(userStart, userGoal);    /* sets startIdx / goalIdx */
      if (hint) hint.classList.add('hide');
    }
  });

  window.addEventListener('resize', function () {
    clearTimeout(window._mrt);
    window._mrt = setTimeout(resize, 80);
  });

  var _started = false;
  function tryInit() {
    if (_started) return;
    W = heroEl.offsetWidth || window.innerWidth;
    H = heroEl.offsetHeight || window.innerHeight;
    if (!W || !H || W < 100) { setTimeout(tryInit, 50); return; }
    _started = true;
    resize();
    requestAnimationFrame(draw);
  }
  if (document.readyState === 'complete') setTimeout(tryInit, 0);
  else window.addEventListener('load', tryInit);
  setTimeout(tryInit, 300);
})();

/* ══ CURSOR ══ */
var cur = document.getElementById('cur');
var ring = document.getElementById('cur-ring');
var cmx = 0, cmy = 0, crx = 0, cry = 0;
document.addEventListener('mousemove', function (e) { cmx = e.clientX; cmy = e.clientY; });
(function animC() {
  cur.style.left = cmx + 'px'; cur.style.top = cmy + 'px';
  crx += (cmx - crx) * .13; cry += (cmy - cry) * .13;
  ring.style.left = crx + 'px'; ring.style.top = cry + 'px';
  requestAnimationFrame(animC);
})();
document.querySelectorAll('a,button,.proj-row,.stat-card').forEach(function (el) {
  el.addEventListener('mouseenter', function () { cur.classList.add('big'); });
  el.addEventListener('mouseleave', function () { cur.classList.remove('big'); });
});

/* ══ NAV ══ */
window.addEventListener('scroll', function () {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 40);
});

/* ══ FADE-IN ══ */
var obs = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); } });
}, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.fi,.titem').forEach(function (el, i) {
  el.style.transitionDelay = (i % 5) * .07 + 's'; obs.observe(el);
});
setTimeout(function () { document.querySelectorAll('.fi,.titem').forEach(function (el) { el.classList.add('vis'); }); }, 900);

/* ══ MODAL + SLIDER ══ */
var overlay = document.getElementById('modal-overlay');
var slidesEl = document.getElementById('slides');
var dotsEl = document.getElementById('sl-dots');
var counterEl = document.getElementById('sl-counter');
var curSlide = 0, totSlides = 0;

function goTo(n) {
  curSlide = ((n % totSlides) + totSlides) % totSlides;
  slidesEl.style.transform = 'translateX(-' + (curSlide * 100) + '%)';
  document.querySelectorAll('.sl-dot').forEach(function (d, i) { d.classList.toggle('on', i === curSlide); });
  counterEl.textContent = (curSlide + 1) + ' / ' + totSlides;
}
function buildSlider(slides) {
  slidesEl.innerHTML = ''; dotsEl.innerHTML = ''; totSlides = slides.length;
  slides.forEach(function (s, i) {
    var div = document.createElement('div'); div.className = 'slide';
    if (s.img) {
      div.innerHTML = '<img src="' + s.img + '" alt="' + s.label + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"/><span class="slide-label" style="position:relative;z-index:2">' + s.label + '</span>';
    } else {
      var col = document.createElement('div'); col.className = 'slide-color'; col.style.background = s.color || '#111';
      var bg = document.createElement('div'); bg.className = 'slide-bg';
      var lbl = document.createElement('span'); lbl.className = 'slide-label'; lbl.textContent = s.label;
      div.appendChild(col); div.appendChild(bg); div.appendChild(lbl);
    }
    slidesEl.appendChild(div);
    var dot = document.createElement('div'); dot.className = 'sl-dot' + (i === 0 ? ' on' : '');
    dot.addEventListener('click', function () { goTo(i); });
    dotsEl.appendChild(dot);
  });
  goTo(0);
}
function openModal(idx) {
  var p = PROJECTS[idx]; if (!p) return;
  document.getElementById('modal-title').textContent = p.title;
  document.getElementById('modal-year').textContent = p.year;
  document.getElementById('modal-desc').textContent = p.desc;
  document.getElementById('modal-tags').innerHTML = p.tags.map(function (t) { return '<span class="modal-tag">' + t + '</span>'; }).join('');
  document.getElementById('modal-links').innerHTML = p.links.map(function (l) { return '<a class="modal-link" href="' + l.url + '" target="_blank">' + l.label + '</a>'; }).join('');
  buildSlider(p.slides);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('sl-prev').addEventListener('click', function () { goTo(curSlide - 1); });
document.getElementById('sl-next').addEventListener('click', function () { goTo(curSlide + 1); });
overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
document.querySelectorAll('.proj-row').forEach(function (row) {
  row.addEventListener('click', function () { openModal(+row.dataset.project); });
});
document.addEventListener('keydown', function (e) {
  if (!overlay.classList.contains('open')) return;
  if (e.key === 'ArrowRight') goTo(curSlide + 1);
  if (e.key === 'ArrowLeft') goTo(curSlide - 1);
  if (e.key === 'Escape') closeModal();
});
var touchX = null;
overlay.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
overlay.addEventListener('touchend', function (e) {
  if (touchX === null) return;
  var dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) goTo(curSlide + (dx < 0 ? 1 : -1));
  touchX = null;
});