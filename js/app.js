/* DFA 化简实验室 — UI orchestration */
(function () {
  'use strict';

  const core = window.DFACore;
  if (!core) {
    document.body.innerHTML = '<pre style="padding:32px;color:#ff8790">DFACore 未加载：请检查 js/core.js。</pre>';
    return;
  }

  const CLASS_COLORS = [
    '#72e7cf', '#80b8ff', '#f7c86c', '#ff8790', '#b99cff',
    '#7dd3fc', '#f0abfc', '#a3e635', '#fca5a5', '#93c5fd'
  ];
  const NODE_R = 29;

  const EXAMPLES = [
    {
      id: 'redundant',
      name: '冗余状态 · 可合并',
      dsl: `# 默认示例：q1 与 q2 等价，q3 与 q4 等价
states: q0, q1, q2, q3, q4, q5
alphabet: a, b
start: q0
finals: q3, q4

q0 -a-> q1
q0 -b-> q2
q1 -a-> q1
q1 -b-> q3
q2 -a-> q1
q2 -b-> q3
q3 -a-> q4
q3 -b-> q5
q4 -a-> q4
q4 -b-> q5
q5 -a-> q5
q5 -b-> q5`,
      positions: {
        q0: { x: 112, y: 300 },
        q1: { x: 334, y: 155 },
        q2: { x: 334, y: 445 },
        q3: { x: 596, y: 155 },
        q4: { x: 596, y: 445 },
        q5: { x: 840, y: 300 }
      }
    },
    {
      id: 'mod3',
      name: '二进制 % 3 · 无合并',
      dsl: `# 识别二进制数值能被 3 整除的串
states: r0, r1, r2
alphabet: 0, 1
start: r0
finals: r0

r0 -0-> r0
r0 -1-> r1
r1 -0-> r2
r1 -1-> r0
r2 -0-> r1
r2 -1-> r2`,
      positions: {
        r0: { x: 160, y: 300 },
        r1: { x: 590, y: 145 },
        r2: { x: 590, y: 455 }
      }
    },
    {
      id: 'unreachable',
      name: '不可达状态 · 自动移除',
      dsl: `# s2、s3 无法从开始状态到达
states: s0, s1, s2, s3
alphabet: a, b
start: s0
finals: s1

s0 -a-> s1
s0 -b-> s0
s1 -a-> s1
s1 -b-> s0
s2 -a-> s3
s2 -b-> s2
s3 -a-> s3
s3 -b-> s3`,
      positions: {
        s0: { x: 190, y: 300 },
        s1: { x: 470, y: 300 },
        s2: { x: 755, y: 170 },
        s3: { x: 755, y: 440 }
      }
    },
    {
      id: 'partial',
      name: '缺失转移 · 自动补陷阱',
      dsl: `# 某些状态没有 1 转移；化简时会补入 sink
states: q0, q1, q2
alphabet: 0, 1
start: q0
finals: q2

q0 -0-> q1
q1 -0-> q2
q1 -1-> q0
q2 -0-> q2`,
      positions: {
        q0: { x: 210, y: 300 },
        q1: { x: 500, y: 300 },
        q2: { x: 770, y: 300 }
      }
    },
    {
      id: 'blank',
      name: '空白自动机 · 从零开始',
      dsl: `# 从单状态开始，自己添加字母、转移和终态
states: q0
alphabet: ∅
start: q0
finals: ∅`,
      positions: {
        q0: { x: 480, y: 300 }
      }
    }
  ];

  const dom = {
    exampleSelect: document.getElementById('exampleSelect'),
    minimizeBtn: document.getElementById('minimizeBtn'),
    helpBtn: document.getElementById('helpBtn'),
    inputStatus: document.getElementById('inputStatus'),
    graphTab: document.getElementById('graphTab'),
    expressionTab: document.getElementById('expressionTab'),
    graphPane: document.getElementById('graphPane'),
    expressionPane: document.getElementById('expressionPane'),
    selectToolBtn: document.getElementById('selectToolBtn'),
    connectToolBtn: document.getElementById('connectToolBtn'),
    addStateBtn: document.getElementById('addStateBtn'),
    layoutBtn: document.getElementById('layoutBtn'),
    toolHint: document.getElementById('toolHint'),
    alphabetCount: document.getElementById('alphabetCount'),
    alphabetChips: document.getElementById('alphabetChips'),
    addSymbolForm: document.getElementById('addSymbolForm'),
    symbolInput: document.getElementById('symbolInput'),
    selectionBadge: document.getElementById('selectionBadge'),
    inspector: document.getElementById('inspector'),
    overviewBadge: document.getElementById('overviewBadge'),
    dfaStats: document.getElementById('dfaStats'),
    warnings: document.getElementById('warnings'),
    resetSampleBtn: document.getElementById('resetSampleBtn'),
    syncExpressionBtn: document.getElementById('syncExpressionBtn'),
    expressionInput: document.getElementById('expressionInput'),
    expressionFeedback: document.getElementById('expressionFeedback'),
    applyExpressionBtn: document.getElementById('applyExpressionBtn'),
    graphTitle: document.getElementById('graphTitle'),
    graphStage: document.getElementById('graphStage'),
    graphSvg: document.getElementById('dfaGraph'),
    graphBadge: document.getElementById('graphBadge'),
    graphLegend: document.getElementById('graphLegend'),
    graphEmpty: document.getElementById('graphEmpty'),
    connectHint: document.getElementById('connectHint'),
    connectHintText: document.getElementById('connectHintText'),
    cancelConnectBtn: document.getElementById('cancelConnectBtn'),
    graphStats: document.getElementById('graphStats'),
    viewButtons: Array.from(document.querySelectorAll('.view-btn')),
    tableEmpty: document.getElementById('tableEmpty'),
    pairTableScroll: document.getElementById('pairTableScroll'),
    pairTable: document.getElementById('pairTable'),
    currentReason: document.getElementById('currentReason'),
    processStatus: document.getElementById('processStatus'),
    phaseLabel: document.getElementById('phaseLabel'),
    stepCounter: document.getElementById('stepCounter'),
    progressBar: document.getElementById('progressBar'),
    prevBtn: document.getElementById('prevBtn'),
    playBtn: document.getElementById('playBtn'),
    nextBtn: document.getElementById('nextBtn'),
    skipBtn: document.getElementById('skipBtn'),
    speedSelect: document.getElementById('speedSelect'),
    activeStep: document.getElementById('activeStep'),
    logCount: document.getElementById('logCount'),
    stepsLog: document.getElementById('stepsLog'),
    resultCard: document.getElementById('resultCard'),
    resultCount: document.getElementById('resultCount'),
    resultSummary: document.getElementById('resultSummary'),
    classList: document.getElementById('classList'),
    resultNotes: document.getElementById('resultNotes'),
    copyResultBtn: document.getElementById('copyResultBtn'),
    toastHost: document.getElementById('toastHost'),
    helpDialog: document.getElementById('helpDialog'),
    closeHelpBtn: document.getElementById('closeHelpBtn'),
    symbolDialog: document.getElementById('symbolDialog'),
    symbolDialogTitle: document.getElementById('symbolDialogTitle'),
    closeSymbolBtn: document.getElementById('closeSymbolBtn'),
    cancelSymbolBtn: document.getElementById('cancelSymbolBtn'),
    symbolOptions: document.getElementById('symbolOptions'),
    dialogSymbolInput: document.getElementById('dialogSymbolInput'),
    dialogAddSymbolBtn: document.getElementById('dialogAddSymbolBtn'),
    confirmSymbolBtn: document.getElementById('confirmSymbolBtn')
  };

  const app = {
    dfa: null,
    positions: {},
    selectedExampleId: EXAMPLES[0].id,
    activeTab: 'graph',
    tool: 'select',
    selected: null,
    connectFrom: null,
    expressionDirty: false,
    run: null,
    drag: null,
    suppressGraphClick: false,
    symbolPending: null,
    symbolSelected: new Set(),
    lastViewBox: null,
    layoutRaf: 0
  };

  let playbackTimer = null;
  let dragRaf = 0;
  let confirmDialogEl = null;
  let labelMeasureContext = null;

  /* =========================================================
     Small utilities
     ========================================================= */

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function icon(name, extraClass) {
    const cls = extraClass ? `icon ${extraClass}` : 'icon';
    return `<svg class="${cls}"><use href="#i-${name}"></use></svg>`;
  }

  function setUseIcon(el, name) {
    const use = el.querySelector('use');
    if (use) use.setAttribute('href', `#i-${name}`);
  }

  function svgEl(tag, attrs, text) {
    const ns = 'http://www.w3.org/2000/svg';
    const node = document.createElementNS(ns, tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        if (attrs[key] === undefined || attrs[key] === null) return;
        node.setAttribute(key, attrs[key]);
      });
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const value = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
    const num = parseInt(value, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function classColor(index) {
    return CLASS_COLORS[index % CLASS_COLORS.length];
  }

  function getClassForPair(analysis, i, j) {
    return analysis.classes.find((cls) => cls.members.includes(i) && cls.members.includes(j)) || null;
  }

  function showToast(message, type = 'info', duration = 2600) {
    if (!dom.toastHost) return;
    dom.toastHost.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' is-error' : type === 'warning' ? ' is-warning' : ''}`;
    toast.textContent = message;
    dom.toastHost.appendChild(toast);
    window.setTimeout(() => {
      if (!toast.isConnected) return;
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 240);
    }, duration);
  }

  function ensureConfirmDialog() {
    if (confirmDialogEl) return confirmDialogEl;
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog confirm-dialog';
    dialog.innerHTML = `
      <div class="dialog-head">
        <div>
          <span class="eyebrow">PLEASE CONFIRM</span>
          <h2 id="confirmTitle">确认操作</h2>
        </div>
        <button type="button" class="dialog-close" data-confirm="cancel" aria-label="关闭">${icon('x')}</button>
      </div>
      <div class="dialog-body">
        <p class="confirm-message" id="confirmMessage"></p>
        <div class="dialog-actions">
          <button type="button" class="ghost-btn" data-confirm="cancel">取消</button>
          <button type="button" class="danger-btn" data-confirm="ok" id="confirmOkBtn">确认</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    confirmDialogEl = dialog;
    return dialog;
  }

  function askConfirm({ title = '确认操作', message = '', confirmLabel = '确认', danger = true } = {}) {
    const dialog = ensureConfirmDialog();
    dialog.querySelector('#confirmTitle').textContent = title;
    dialog.querySelector('#confirmMessage').textContent = message;
    const ok = dialog.querySelector('#confirmOkBtn');
    ok.textContent = confirmLabel;
    ok.classList.toggle('danger-btn', danger);
    return new Promise((resolve) => {
      let settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        dialog.close();
        resolve(value);
      }
      function onClick(event) {
        const target = event.target.closest('[data-confirm]');
        if (!target) return;
        finish(target.dataset.confirm === 'ok');
      }
      function onCancel(event) {
        event.preventDefault();
        finish(false);
      }
      function onClosed() {
        dialog.removeEventListener('click', onClick);
        dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('close', onClosed);
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }
      dialog.addEventListener('click', onClick);
      dialog.addEventListener('cancel', onCancel);
      dialog.addEventListener('close', onClosed);
      dialog.showModal();
      ok.focus();
    });
  }

  function getCanvasMeasure() {
    if (!labelMeasureContext) {
      const canvas = document.createElement('canvas');
      labelMeasureContext = canvas.getContext('2d');
    }
    return labelMeasureContext;
  }

  function measureLabel(text) {
    const ctx = getCanvasMeasure();
    ctx.font = '9px "Cascadia Code", "Consolas", monospace';
    return Math.ceil(ctx.measureText(text).width + 13);
  }

  /* =========================================================
     Geometry + layout
     ========================================================= */

  function hasValidPosition(pos) {
    return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y);
  }

  function autoLayoutDfa(dfa) {
    const states = [...dfa.states];
    const n = states.length;
    const result = {};
    if (!n) return result;
    if (n === 1) {
      result[states[0]] = { x: 480, y: 300 };
      return result;
    }

    const W = 960;
    const H = 600;
    const cx = W / 2;
    const cy = H / 2;
    const startIndex = Math.max(0, states.indexOf(dfa.start));
    const ordered = [states[startIndex], ...states.filter((state) => state !== states[startIndex])];
    const radiusX = n <= 4 ? 230 : 300;
    const radiusY = n <= 4 ? 190 : 215;

    const points = new Map();
    ordered.forEach((state, index) => {
      const angle = Math.PI + (Math.PI * 2 * index) / n;
      points.set(state, {
        x: cx + Math.cos(angle) * radiusX,
        y: cy + Math.sin(angle) * radiusY
      });
    });

    const uniqueEdges = [];
    const seenEdges = new Set();
    states.forEach((from) => {
      dfa.alphabet.forEach((symbol) => {
        const to = core.getTarget(dfa, from, symbol);
        if (!to || to === from || !points.has(to)) return;
        const key = from < to ? `${from}|${to}` : `${to}|${from}`;
        if (seenEdges.has(key)) return;
        seenEdges.add(key);
        uniqueEdges.push([from, to]);
      });
    });

    const array = ordered.map((state) => points.get(state));
    const indexOf = new Map(ordered.map((state, index) => [state, index]));
    const k = Math.sqrt((W * H) / n) * 0.72;
    let temperature = Math.max(W, H) / 7;

    for (let iteration = 0; iteration < 310; iteration += 1) {
      const disp = array.map(() => ({ x: 0, y: 0 }));

      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          let dx = array[i].x - array[j].x;
          let dy = array[i].y - array[j].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const force = (k * k) / dist;
          const ux = dx / dist;
          const uy = dy / dist;
          disp[i].x += ux * force;
          disp[i].y += uy * force;
          disp[j].x -= ux * force;
          disp[j].y -= uy * force;
        }
      }

      uniqueEdges.forEach(([from, to]) => {
        const i = indexOf.get(from);
        const j = indexOf.get(to);
        if (i === undefined || j === undefined) return;
        const dx = array[i].x - array[j].x;
        const dy = array[i].y - array[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const force = (dist * dist) / (k * 1.18);
        const ux = dx / dist;
        const uy = dy / dist;
        disp[i].x -= ux * force;
        disp[i].y -= uy * force;
        disp[j].x += ux * force;
        disp[j].y += uy * force;
      });

      for (let i = 0; i < n; i += 1) {
        disp[i].x += (cx - array[i].x) * 0.028;
        disp[i].y += (cy - array[i].y) * 0.028;
        const length = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y) || 0.1;
        const step = Math.min(length, temperature);
        array[i].x = clamp(array[i].x + (disp[i].x / length) * step, 82, W - 82);
        array[i].y = clamp(array[i].y + (disp[i].y / length) * step, 82, H - 82);
      }
      temperature *= 0.985;
    }

    // Resolve residual collisions. A deterministic nudge follows each push.
    for (let iteration = 0; iteration < 90; iteration += 1) {
      let moved = false;
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          let dx = array[i].x - array[j].x;
          let dy = array[i].y - array[j].y;
          let distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (distance >= 126) continue;
          moved = true;
          if (distance < 0.01) {
            dx = 1;
            dy = 0.35;
            distance = 1.06;
          }
          const push = (126 - distance) / 2;
          const ux = dx / distance;
          const uy = dy / distance;
          array[i].x = clamp(array[i].x + ux * push, 82, W - 82);
          array[i].y = clamp(array[i].y + uy * push, 82, H - 82);
          array[j].x = clamp(array[j].x - ux * push, 82, W - 82);
          array[j].y = clamp(array[j].y - uy * push, 82, H - 82);
        }
      }
      if (!moved) break;
    }

    ordered.forEach((state, index) => {
      result[state] = {
        x: Math.round(array[index].x * 10) / 10,
        y: Math.round(array[index].y * 10) / 10
      };
    });
    return result;
  }

  function findFreePosition(excludeState) {
    const occupied = Object.keys(app.positions)
      .filter((state) => state !== excludeState)
      .map((state) => app.positions[state])
      .filter(hasValidPosition);
    if (!occupied.length) return { x: 480, y: 300 };
    const candidates = [];
    const center = {
      x: occupied.reduce((sum, pos) => sum + pos.x, 0) / occupied.length,
      y: occupied.reduce((sum, pos) => sum + pos.y, 0) / occupied.length
    };
    for (const radius of [170, 235, 300, 355]) {
      for (let step = 0; step < 16; step += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * step) / 16 + radius * 0.013;
        candidates.push({
          x: clamp(center.x + Math.cos(angle) * radius * 1.25, 70, 890),
          y: clamp(center.y + Math.sin(angle) * radius * 0.85, 70, 530)
        });
      }
    }
    let best = candidates[0];
    let bestScore = -1;
    candidates.forEach((candidate) => {
      let minDistance = Infinity;
      occupied.forEach((pos) => {
        const dx = candidate.x - pos.x;
        const dy = candidate.y - pos.y;
        minDistance = Math.min(minDistance, Math.sqrt(dx * dx + dy * dy));
      });
      if (minDistance > bestScore) {
        bestScore = minDistance;
        best = candidate;
      }
    });
    return { x: Math.round(best.x), y: Math.round(best.y) };
  }

  function ensurePositions(dfa) {
    if (!dfa || !dfa.states.length) return;
    const missing = dfa.states.filter((state) => !hasValidPosition(app.positions[state]));
    if (!missing.length) return;
    if (missing.length === dfa.states.length) {
      Object.assign(app.positions, autoLayoutDfa(dfa));
      return;
    }
    missing.forEach((state) => {
      app.positions[state] = findFreePosition(state);
    });
  }

  function ensureAugmentedPositions(analysis) {
    ensurePositions(analysis.augmented);
    analysis.augmented.states.forEach((state) => {
      if (hasValidPosition(app.positions[state])) return;
      if (state === analysis.preparation.sinkName) {
        const occupied = analysis.augmented.states
          .filter((s) => s !== state && hasValidPosition(app.positions[s]))
          .map((s) => app.positions[s]);
        const avgX = occupied.length ? occupied.reduce((sum, pos) => sum + pos.x, 0) / occupied.length : 480;
        const maxY = occupied.length ? Math.max(...occupied.map((pos) => pos.y)) : 440;
        app.positions[state] = {
          x: clamp(Math.round(avgX + 40), 100, 860),
          y: clamp(Math.round(maxY + 105), 140, 555)
        };
        if (occupied.some((pos) => Math.hypot(pos.x - app.positions[state].x, pos.y - app.positions[state].y) < 100)) {
          app.positions[state] = findFreePosition(state);
        }
      } else {
        app.positions[state] = findFreePosition(state);
      }
    });
  }

  function resolveNodeOverlaps(layout, keys, minDistance = 150) {
    for (let iteration = 0; iteration < 100; iteration += 1) {
      let moved = false;
      for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
          const a = layout[keys[i]];
          const b = layout[keys[j]];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.hypot(dx, dy) || 0.01;
          if (dist >= minDistance) continue;
          moved = true;
          if (dist < 1) {
            dx = 1;
            dy = 0;
            dist = 1;
          }
          const push = (minDistance - dist) / 2;
          a.x += (dx / dist) * push;
          a.y += (dy / dist) * push;
          b.x -= (dx / dist) * push;
          b.y -= (dy / dist) * push;
        }
      }
      keys.forEach((key) => {
        layout[key].x = clamp(layout[key].x, 90, 870);
        layout[key].y = clamp(layout[key].y, 100, 510);
      });
      if (!moved) break;
    }
  }

  function computeResultPositions(analysis) {
    const positions = {};
    analysis.classes.forEach((cls) => {
      const members = cls.memberStates
        .map((state) => app.positions[state])
        .filter(hasValidPosition);
      if (!members.length) {
        positions[cls.label] = { x: 480, y: 300 };
      } else {
        positions[cls.label] = {
          x: members.reduce((sum, pos) => sum + pos.x, 0) / members.length,
          y: members.reduce((sum, pos) => sum + pos.y, 0) / members.length
        };
      }
    });
    resolveNodeOverlaps(positions, analysis.classes.map((cls) => cls.label));
    return positions;
  }

  function computeViewBox(positions, states) {
    if (!states.length) return { x: 0, y: 0, w: 960, h: 600 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    states.forEach((state) => {
      const pos = positions[state];
      if (!hasValidPosition(pos)) return;
      minX = Math.min(minX, pos.x - 82);
      maxX = Math.max(maxX, pos.x + 82);
      minY = Math.min(minY, pos.y - 112);
      maxY = Math.max(maxY, pos.y + 82);
    });
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 960, h: 600 };
    let width = Math.max(maxX - minX, 300);
    let height = Math.max(maxY - minY, 240);
    const stageRect = dom.graphStage.getBoundingClientRect();
    const stageRatio = stageRect.width > 0 && stageRect.height > 0
      ? stageRect.width / stageRect.height
      : 1.7;
    const boxRatio = width / height;
    if (boxRatio < stageRatio) {
      const newWidth = height * stageRatio;
      minX -= (newWidth - width) / 2;
      width = newWidth;
    } else {
      const newHeight = width / stageRatio;
      minY -= (newHeight - height) / 2;
      height = newHeight;
    }
    return { x: minX, y: minY, w: width, h: height };
  }

  function applyViewBox(box) {
    if (!box) return;
    const value = `${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}`;
    dom.graphSvg.setAttribute('viewBox', value);
    app.lastViewBox = value;
  }

  function getCurrentViewBoxString() {
    return dom.graphSvg.getAttribute('viewBox') || '0 0 960 600';
  }

  function clientToSvg(clientX, clientY) {
    const point = dom.graphSvg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = dom.graphSvg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  /* =========================================================
     Expression parse / apply
     ========================================================= */

  function clearExpressionFeedback() {
    if (!dom.expressionFeedback) return;
    dom.expressionFeedback.innerHTML = '';
  }

  function renderExpressionFeedback(kind, message, items = []) {
    const wrap = dom.expressionFeedback;
    wrap.innerHTML = '';
    if (!message && !items.length) return;
    const box = document.createElement('div');
    box.className = kind === 'error' ? 'feedback-error' : 'feedback-ok';
    const text = document.createElement('div');
    text.textContent = message || '';
    box.appendChild(text);
    if (items.length) {
      const list = document.createElement('div');
      list.className = 'expression-feedback-list';
      items.slice(0, 8).forEach((item) => {
        const row = document.createElement('div');
        if (item.line) {
          const line = document.createElement('b');
          line.textContent = `第 ${item.line} 行 `;
          row.appendChild(line);
        }
        row.appendChild(document.createTextNode(item.message));
        list.appendChild(row);
      });
      box.appendChild(list);
    }
    wrap.appendChild(box);
  }

  function syncExpression(force = false) {
    if (!app.dfa) return;
    if (app.expressionDirty && !force) return;
    dom.expressionInput.value = `${core.formatDSL(app.dfa)}\n`;
    app.expressionDirty = false;
  }

  function focusExpressionLine(lineNo) {
    if (!lineNo || lineNo < 1) return;
    const lines = dom.expressionInput.value.split('\n');
    let start = 0;
    for (let i = 0; i < lineNo - 1 && i < lines.length; i += 1) {
      start += lines[i].length + 1;
    }
    const end = start + (lines[lineNo - 1] || '').length;
    dom.expressionInput.focus();
    dom.expressionInput.setSelectionRange(start, end);
  }

  function autoLayoutPositions(dfa) {
    app.positions = autoLayoutDfa(dfa);
  }

  function applyExpression(options = {}) {
    const { switchToGraph = true, quiet = false, render = true, focusError = true } = options;
    const parsed = core.parseDSL(dom.expressionInput.value);
    if (!parsed.ok) {
      renderExpressionFeedback(
        'error',
        '表达式中有无法解析的地方：',
        parsed.errors
      );
      switchTab('expression');
      if (focusError && parsed.errors[0] && parsed.errors[0].line) {
        focusExpressionLine(parsed.errors[0].line);
      }
      if (!quiet) showToast('表达式解析失败，请查看行内提示', 'error');
      return false;
    }

    stopPlaybackTimer();
    app.run = null;
    app.dfa = parsed.dfa;
    app.selected = null;
    app.connectFrom = null;
    app.tool = 'select';
    autoLayoutPositions(app.dfa);
    app.expressionDirty = false;
    // Keep the user's comments and formatting in the textarea after applying.
    const warningCount = parsed.warnings.length;
    renderExpressionFeedback(
      'ok',
      `已导入 ${app.dfa.states.length} 个状态、${app.dfa.alphabet.length} 个输入字母${warningCount ? `，另有 ${warningCount} 条提示` : ''}。`,
    );
    if (switchToGraph) switchTab('graph');
    if (render) renderAll();
    if (!quiet) showToast('表达式已应用，可以开始化简', 'success');
    return true;
  }

  /* =========================================================
     Run lifecycle + playback
     ========================================================= */

  function getCurrentStep() {
    if (!app.run) return null;
    return app.run.steps[app.run.index] || null;
  }

  function getResultStepIndex(run) {
    if (!run) return -1;
    return run.steps.findIndex((step) => step.kind === 'result');
  }

  function stopPlaybackTimer() {
    if (playbackTimer !== null) {
      window.clearTimeout(playbackTimer);
      playbackTimer = null;
    }
  }

  function stepDuration(step) {
    if (!step) return 900;
    if (step.kind === 'mark') return step.phase === 'initialize' ? 680 : 1120;
    if (step.kind === 'merge') return 1000;
    if (step.kind === 'result') return 1200;
    if (step.phase === 'setup' || step.phase === 'initialize') return 850;
    return 920;
  }

  function schedulePlayback() {
    stopPlaybackTimer();
    if (!app.run || !app.run.playing) return;
    const step = getCurrentStep();
    const lastIndex = app.run.steps.length - 1;
    if (!step || app.run.index >= lastIndex) {
      app.run.playing = false;
      renderRunUi();
      return;
    }
    const delay = Math.max(230, stepDuration(step) / (app.run.speed || 1));
    playbackTimer = window.setTimeout(() => {
      playbackTimer = null;
      if (!app.run || !app.run.playing) return;
      if (app.run.index >= app.run.steps.length - 1) {
        app.run.playing = false;
        renderRunUi();
        return;
      }
      app.run.index += 1;
      if (app.run.index >= getResultStepIndex(app.run)) app.run.view = 'result';
      renderRunUi();
      if (app.run.playing) schedulePlayback();
    }, delay);
  }

  function setPlaying(playing, options = {}) {
    if (!app.run) return;
    const { restartIfDone = false } = options;
    const lastIndex = app.run.steps.length - 1;
    if (playing && restartIfDone && app.run.index >= lastIndex) {
      app.run.index = 0;
      app.run.view = 'input';
    }
    app.run.playing = playing;
    stopPlaybackTimer();
    renderRunUi();
    if (playing) schedulePlayback();
  }

  function togglePlayback() {
    if (!app.run) return;
    if (app.run.playing) {
      setPlaying(false);
    } else {
      setPlaying(true, { restartIfDone: app.run.index >= app.run.steps.length - 1 });
    }
  }

  function goToStep(index, options = {}) {
    if (!app.run) return;
    const { pause = true, rerender = true } = options;
    if (pause) {
      app.run.playing = false;
      stopPlaybackTimer();
    }
    const lastIndex = app.run.steps.length - 1;
    const next = clamp(index, 0, lastIndex);
    const oldView = app.run.view;
    app.run.index = next;
    if (next >= getResultStepIndex(app.run)) {
      app.run.view = 'result';
    } else if (oldView === 'result') {
      app.run.view = 'input';
    }
    if (rerender) renderRunUi();
    if (next >= lastIndex && pause) {
      app.run.playing = false;
    }
  }

  function startMinimization() {
    if (!app.dfa || !app.dfa.states.length) {
      showToast('先添加至少一个状态，再开始化简', 'warning');
      return;
    }

    if (app.activeTab === 'expression' && app.expressionDirty) {
      const applied = applyExpression({ switchToGraph: false, quiet: true, render: false, focusError: true });
      if (!applied) return;
    }

    let analysis;
    try {
      analysis = core.analyzeDFA(app.dfa);
    } catch (error) {
      showToast(error.message || '自动机无法化简，请检查输入。', 'error', 4200);
      return;
    }

    stopPlaybackTimer();
    ensureAugmentedPositions(analysis);
    app.selected = null;
    app.connectFrom = null;
    app.tool = 'select';
    app.run = {
      analysis,
      steps: analysis.steps,
      index: 0,
      playing: true,
      speed: Number(dom.speedSelect.value) || 1,
      view: 'input',
      resultPositions: computeResultPositions(analysis),
      resultStepIndex: analysis.steps.findIndex((step) => step.kind === 'result')
    };
    dom.resultCard.hidden = true;
    renderAll();
    schedulePlayback();
    showToast(`区分表已建立：${analysis.pairCount} 个状态对等待检查`, 'info', 2200);
  }

  function invalidateRun() {
    stopPlaybackTimer();
    if (app.run) {
      app.run.playing = false;
      app.run = null;
    }
    app.symbolPending = null;
    if (dom.resultCard) dom.resultCard.hidden = true;
  }

  /* =========================================================
     Mutations
     ========================================================= */

  function structuralUpdate(message, options = {}) {
    const { select = app.selected, toastType = 'success' } = options;
    invalidateRun();
    app.selected = select;
    if (app.selected && app.selected.type === 'edge') {
      const symbols = app.dfa.alphabet.filter((symbol) => core.getTarget(app.dfa, app.selected.from, symbol) === app.selected.to);
      if (!symbols.length) app.selected = null;
    }
    if (app.selected && app.selected.type === 'state' && !app.dfa.states.includes(app.selected.id)) {
      app.selected = null;
    }
    app.expressionDirty = false;
    ensurePositions(app.dfa);
    syncExpression(true);
    clearExpressionFeedback();
    renderAll();
    if (message) showToast(message, toastType);
  }

  function addAlphabetSymbol(raw, options = {}) {
    const { keepDialog = false } = options;
    const symbol = String(raw || '').trim();
    const error = core.validateSymbol(symbol);
    if (error) {
      showToast(error, 'error');
      return false;
    }
    if (app.dfa.alphabet.includes(symbol)) {
      showToast(`字母「${symbol}」已经在字母表中`, 'warning');
      return false;
    }
    if (app.dfa.alphabet.length >= core.MAX_ALPHABET) {
      showToast(`最多支持 ${core.MAX_ALPHABET} 个输入字母`, 'warning');
      return false;
    }
    app.dfa.alphabet.push(symbol);
    structuralUpdate(`已添加输入字母「${symbol}」`);
    if (keepDialog) renderSymbolDialogOptions();
    return true;
  }

  async function removeAlphabetSymbol(symbol) {
    if (!app.dfa.alphabet.includes(symbol)) return;
    let used = 0;
    app.dfa.states.forEach((state) => {
      if (core.getTarget(app.dfa, state, symbol) !== undefined) used += 1;
    });
    const ok = await askConfirm({
      title: '移除输入字母',
      message: used
        ? `移除「${symbol}」会同时删除 ${used} 条使用它的转移。要继续吗？`
        : `要从字母表中移除「${symbol}」吗？`,
      confirmLabel: '移除字母',
      danger: true
    });
    if (!ok) return;
    app.dfa.alphabet = app.dfa.alphabet.filter((item) => item !== symbol);
    app.dfa.states.forEach((state) => {
      core.removeTransition(app.dfa, state, symbol);
    });
    structuralUpdate(`已移除输入字母「${symbol}」`);
  }

  function nextStateName() {
    let index = 0;
    while (app.dfa.states.includes(`q${index}`)) index += 1;
    return `q${index}`;
  }

  function addState() {
    if (app.dfa.states.length >= core.MAX_STATES) {
      showToast(`最多支持 ${core.MAX_STATES} 个状态`, 'warning');
      return;
    }
    const name = nextStateName();
    const position = findFreePosition();
    app.dfa.states.push(name);
    core.ensureTransitionRow(app.dfa, name);
    app.positions[name] = position;
    if (!app.dfa.start) app.dfa.start = name;
    app.selected = { type: 'state', id: name };
    app.expressionDirty = false;
    invalidateRun();
    ensurePositions(app.dfa);
    syncExpression(true);
    clearExpressionFeedback();
    renderAll();
    showToast(`已添加状态「${name}」`);
  }

  function removeState(stateId) {
    const dfa = app.dfa;
    const index = dfa.states.indexOf(stateId);
    if (index < 0) return;
    dfa.states.splice(index, 1);
    delete dfa.transitions[stateId];
    dfa.states.forEach((from) => {
      const row = dfa.transitions[from];
      if (!row) return;
      Object.keys(row).forEach((symbol) => {
        if (row[symbol] === stateId) delete row[symbol];
      });
    });
    dfa.finals = dfa.finals.filter((state) => state !== stateId);
    if (dfa.start === stateId) dfa.start = dfa.states[0] || '';
    delete app.positions[stateId];
    if (app.selected && app.selected.type === 'state' && app.selected.id === stateId) app.selected = null;
    if (app.connectFrom === stateId) app.connectFrom = null;
    structuralUpdate(`已删除状态「${stateId}」`, { select: app.selected });
  }

  function renameState(oldName, rawNewName) {
    const newName = String(rawNewName || '').trim();
    if (newName === oldName) return true;
    const error = core.validateStateName(newName);
    if (error) {
      showToast(error, 'error');
      return false;
    }
    if (app.dfa.states.includes(newName)) {
      showToast(`状态「${newName}」已存在`, 'error');
      return false;
    }
    const index = app.dfa.states.indexOf(oldName);
    if (index < 0) return false;
    app.dfa.states[index] = newName;
    if (app.dfa.start === oldName) app.dfa.start = newName;
    app.dfa.finals = app.dfa.finals.map((state) => (state === oldName ? newName : state));

    const newTransitions = Object.create(null);
    app.dfa.states.forEach((state) => {
      const oldRow = state === newName
        ? (app.dfa.transitions[oldName] || {})
        : (app.dfa.transitions[state] || {});
      const row = Object.create(null);
      Object.keys(oldRow || {}).forEach((symbol) => {
        row[symbol] = oldRow[symbol] === oldName ? newName : oldRow[symbol];
      });
      newTransitions[state] = row;
    });
    app.dfa.transitions = newTransitions;
    if (hasValidPosition(app.positions[oldName])) {
      app.positions[newName] = app.positions[oldName];
    }
    delete app.positions[oldName];
    if (app.selected && app.selected.type === 'state' && app.selected.id === oldName) {
      app.selected = { type: 'state', id: newName };
    }
    if (app.connectFrom === oldName) app.connectFrom = newName;
    structuralUpdate(`状态已重命名为「${newName}」`, { select: app.selected });
    return true;
  }

  function setStartState(stateId) {
    if (app.dfa.start === stateId) return;
    app.dfa.start = stateId;
    structuralUpdate(`开始状态已设为「${stateId}」`, {
      select: { type: 'state', id: stateId }
    });
  }

  function toggleFinalState(stateId) {
    if (app.dfa.finals.includes(stateId)) {
      app.dfa.finals = app.dfa.finals.filter((state) => state !== stateId);
      structuralUpdate(`「${stateId}」已取消终态`);
    } else {
      app.dfa.finals.push(stateId);
      structuralUpdate(`「${stateId}」已设为终态`);
    }
  }

  function removeTransition(from, to, symbol) {
    if (symbol) {
      if (core.getTarget(app.dfa, from, symbol) !== to) return;
      core.removeTransition(app.dfa, from, symbol);
      let selected = app.selected;
      if (selected && selected.type === 'edge' && selected.from === from && selected.to === to) {
        const remaining = app.dfa.alphabet.filter((sym) => core.getTarget(app.dfa, from, sym) === to);
        if (!remaining.length) selected = null;
      }
      structuralUpdate(`已删除转移 ${from} -${symbol}-> ${to}`, { select: selected });
      return;
    }
    let count = 0;
    app.dfa.alphabet.forEach((sym) => {
      if (core.getTarget(app.dfa, from, sym) === to) {
        core.removeTransition(app.dfa, from, sym);
        count += 1;
      }
    });
    if (count) {
      structuralUpdate(`已删除 ${from} → ${to} 的 ${count} 条转移`, { select: null });
    }
  }

  async function deleteSelectedEdge(from, to) {
    const count = app.dfa.alphabet.filter((symbol) => core.getTarget(app.dfa, from, symbol) === to).length;
    if (!count) return;
    const ok = await askConfirm({
      title: '删除转移',
      message: `删除 ${from} → ${to} 上的 ${count} 条转移（${app.dfa.alphabet.filter((symbol) => core.getTarget(app.dfa, from, symbol) === to).join('、')}）吗？`,
      confirmLabel: '删除转移',
      danger: true
    });
    if (!ok) return;
    removeTransition(from, to, null);
  }

  /* =========================================================
     Graph connection dialog
     ========================================================= */

  function openSymbolDialog(from, to) {
    app.symbolPending = { from, to };
    app.symbolSelected = new Set();
    dom.symbolDialogTitle.textContent = `${from} → ${to}`;
    dom.dialogSymbolInput.value = '';
    renderSymbolDialogOptions();
    if (typeof dom.symbolDialog.showModal === 'function') {
      dom.symbolDialog.showModal();
    } else {
      dom.symbolDialog.setAttribute('open', '');
    }
    const firstAvailable = dom.symbolOptions.querySelector('.symbol-option:not(:disabled)');
    window.setTimeout(() => {
      if (firstAvailable) firstAvailable.focus();
      else dom.dialogSymbolInput.focus();
    }, 50);
  }

  function updateSymbolConfirmState() {
    const selectedCount = [...app.symbolSelected].filter((symbol) => app.dfa.alphabet.includes(symbol)).length;
    dom.confirmSymbolBtn.disabled = selectedCount === 0;
    dom.confirmSymbolBtn.textContent = selectedCount
      ? `添加 ${selectedCount} 条转移`
      : '添加选中的转移';
  }

  function renderSymbolDialogOptions() {
    if (!app.symbolPending) return;
    const { from, to } = app.symbolPending;
    dom.symbolOptions.innerHTML = '';
    if (!app.dfa.alphabet.length) {
      const empty = document.createElement('div');
      empty.className = 'symbol-empty';
      empty.textContent = '字母表还是空的，先在下方加入一个输入字母。';
      dom.symbolOptions.appendChild(empty);
      updateSymbolConfirmState();
      return;
    }
    let availableCount = 0;
    app.dfa.alphabet.forEach((symbol) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'symbol-option';
      button.textContent = symbol;
      const existing = core.getTarget(app.dfa, from, symbol) !== undefined;
      if (existing) {
        button.disabled = true;
        button.title = `已存在：${from} -${symbol}-> ${core.getTarget(app.dfa, from, symbol)}`;
      } else {
        availableCount += 1;
        if (app.symbolSelected.has(symbol)) button.classList.add('is-selected');
        button.addEventListener('click', () => {
          if (app.symbolSelected.has(symbol)) app.symbolSelected.delete(symbol);
          else app.symbolSelected.add(symbol);
          button.classList.toggle('is-selected');
          updateSymbolConfirmState();
        });
      }
      dom.symbolOptions.appendChild(button);
    });
    if (!availableCount && app.dfa.alphabet.length) {
      const note = document.createElement('div');
      note.className = 'symbol-empty';
      note.textContent = '所有字母在这对状态上都有转移了。可以添加一个新字母，或先删除已有转移。';
      dom.symbolOptions.appendChild(note);
    }
    updateSymbolConfirmState();
  }

  function addSymbolFromDialog() {
    const symbol = dom.dialogSymbolInput.value.trim();
    if (!symbol) return;
    if (app.dfa.alphabet.length >= core.MAX_ALPHABET) {
      showToast(`最多支持 ${core.MAX_ALPHABET} 个输入字母`, 'warning');
      return;
    }
    if (app.dfa.alphabet.includes(symbol)) {
      showToast(`字母「${symbol}」已经在字母表中`, 'warning');
      return;
    }
    const error = core.validateSymbol(symbol);
    if (error) {
      showToast(error, 'error');
      return;
    }
    app.dfa.alphabet.push(symbol);
    app.symbolSelected.add(symbol);
    dom.dialogSymbolInput.value = '';
    stopPlaybackTimer();
    app.run = null;
    app.expressionDirty = false;
    ensurePositions(app.dfa);
    syncExpression(true);
    renderAll();
    renderSymbolDialogOptions();
    showToast(`已添加输入字母「${symbol}」`);
  }

  function confirmSymbolDialog() {
    if (!app.symbolPending) {
      closeSymbolDialog();
      return;
    }
    const { from, to } = app.symbolPending;
    const selected = [...app.symbolSelected].filter((symbol) => app.dfa.alphabet.includes(symbol));
    if (!selected.length) {
      showToast('请至少选择一个输入字母', 'warning');
      return;
    }
    const added = [];
    selected.forEach((symbol) => {
      if (core.getTarget(app.dfa, from, symbol) !== undefined) return;
      core.setTarget(app.dfa, from, symbol, to);
      added.push(symbol);
    });
    closeSymbolDialog();
    if (!added.length) {
      showToast('选中的字母已经有转移了', 'warning');
      return;
    }
    // 让新转移出现在图中，并在检查器中选中它。
    app.connectFrom = null;
    app.selected = { type: 'edge', from, to };
    structuralUpdate(`已添加 ${from} -${added.join(',')}-> ${to}`, { select: { type: 'edge', from, to } });
  }

  function closeSymbolDialog() {
    if (dom.symbolDialog.open) dom.symbolDialog.close();
    else dom.symbolDialog.removeAttribute('open');
    app.symbolPending = null;
    app.symbolSelected = new Set();
  }

  /* =========================================================
     Tool state + tab switching
     ========================================================= */

  function setTool(tool) {
    app.tool = tool;
    if (tool !== 'connect') app.connectFrom = null;
    renderToolState();
    renderGraph();
  }

  function cancelConnection() {
    app.connectFrom = null;
    renderToolState();
    renderGraph();
  }

  function switchTab(tab) {
    if (tab !== 'graph' && tab !== 'expression') return;
    app.activeTab = tab;
    const expr = tab === 'expression';
    dom.graphPane.hidden = expr;
    dom.expressionPane.hidden = !expr;
    dom.graphTab.classList.toggle('is-active', !expr);
    dom.expressionTab.classList.toggle('is-active', expr);
    dom.graphTab.setAttribute('aria-selected', String(!expr));
    dom.expressionTab.setAttribute('aria-selected', String(expr));
    if (expr && !dom.expressionInput.value.trim() && !app.expressionDirty) {
      syncExpression(true);
    }
    if (expr) {
      window.setTimeout(() => {
        dom.expressionInput.focus({ preventScroll: true });
        if (!app.expressionDirty) {
          dom.expressionInput.setSelectionRange(0, 0);
          dom.expressionInput.scrollTop = 0;
          dom.expressionInput.scrollLeft = 0;
        }
      }, 60);
    }
  }

  /* =========================================================
     Main render cycle
     ========================================================= */

  function renderAll() {
    if (!app.dfa) return;
    ensurePositions(app.dfa);
    renderEditor();
    renderGraph();
    renderPairTable();
    renderProcess();
    updateViewToggle();
    updateHeaderState();
  }

  function renderRunUi() {
    renderGraph();
    renderPairTable();
    renderProcess();
    updateViewToggle();
    updateHeaderState();
  }

  function updateHeaderState() {
    if (!dom.inputStatus) return;
    const done = app.run && app.run.index >= app.run.steps.length - 1;
    const running = app.run && !done;
    dom.inputStatus.classList.toggle('is-done', Boolean(done));
    dom.inputStatus.classList.toggle('is-running', Boolean(running));
    dom.inputStatus.innerHTML = `<i></i>${done ? '已化简' : running ? '化简中' : '可编辑'}`;
  }

  function updateViewToggle() {
    const canResult = Boolean(
      app.run &&
      app.run.index >= app.run.resultStepIndex &&
      app.run.resultStepIndex >= 0
    );
    const activeView = app.run && canResult ? app.run.view : 'input';
    if (app.run && !canResult) app.run.view = 'input';
    dom.viewButtons.forEach((button) => {
      const view = button.dataset.view;
      const disabled = view === 'result' && !canResult;
      button.disabled = disabled;
      button.classList.toggle('is-active', view === activeView);
      button.setAttribute('aria-selected', String(view === activeView));
    });
  }

  function renderToolState() {
    const connect = app.tool === 'connect';
    dom.selectToolBtn.classList.toggle('is-active', !connect);
    dom.connectToolBtn.classList.toggle('is-active', connect);
    dom.selectToolBtn.setAttribute('aria-pressed', String(!connect));
    dom.connectToolBtn.setAttribute('aria-pressed', String(connect));
    dom.graphSvg.classList.toggle('is-connecting', connect);
    dom.connectHint.hidden = !connect;
    dom.cancelConnectBtn.hidden = false;
    dom.toolHint.classList.toggle('is-connect', connect);
    const hintText = dom.toolHint.querySelector('span:last-child');
    if (hintText) {
      if (!connect) {
        hintText.textContent = '拖动状态调整布局；点选状态或转移标签可编辑。';
      } else if (app.connectFrom) {
        hintText.textContent = `起点已选择「${app.connectFrom}」，再点击终点；点自己可创建自环。`;
      } else {
        hintText.textContent = '点击起点状态，再点击终点。';
      }
    }
    if (connect) {
      dom.connectHintText.textContent = app.connectFrom
        ? `起点 ${app.connectFrom} · 选择终点`
        : '点击起点状态';
    }
  }

  /* =========================================================
     Editor rendering
     ========================================================= */

  function renderEditor() {
    if (!app.dfa) return;
    renderToolState();
    renderAlphabet();
    renderOverview();
    renderInspector();
    updateHeaderState();
  }

  function renderAlphabet() {
    dom.alphabetCount.textContent = `${app.dfa.alphabet.length} 个字母`;
    dom.alphabetChips.innerHTML = '';
    if (!app.dfa.alphabet.length) {
      const empty = document.createElement('span');
      empty.className = 'chips-empty';
      empty.textContent = '暂无字母，先添加 a 或 0。';
      dom.alphabetChips.appendChild(empty);
      return;
    }
    app.dfa.alphabet.forEach((symbol) => {
      const chip = document.createElement('span');
      chip.className = 'alphabet-chip';
      const label = document.createElement('span');
      label.textContent = symbol;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.removeSymbol = symbol;
      remove.textContent = '×';
      remove.title = `移除字母 ${symbol}`;
      remove.setAttribute('aria-label', `移除输入字母 ${symbol}`);
      chip.append(label, remove);
      dom.alphabetChips.appendChild(chip);
    });
  }

  function countTransitions() {
    let count = 0;
    app.dfa.states.forEach((state) => {
      app.dfa.alphabet.forEach((symbol) => {
        if (core.getTarget(app.dfa, state, symbol) !== undefined) count += 1;
      });
    });
    return count;
  }

  function renderOverview() {
    const reachable = core.reachableFrom(app.dfa.start, app.dfa.transitions);
    const reachableCount = app.dfa.states.filter((state) => reachable.has(state)).length;
    const warnings = core.collectWarnings(app.dfa);
    if (!app.dfa.states.length) {
      warnings.unshift('自动机还没有状态。请添加状态，或载入一个示例。');
    } else if (!app.dfa.start) {
      warnings.unshift('缺少开始状态：请选择一个状态并设为开始。');
    }
    dom.overviewBadge.textContent = warnings.length ? '含提示' : '完整';
    const stats = [
      { label: '状态', value: app.dfa.states.length, accent: false },
      { label: '字母', value: app.dfa.alphabet.length, accent: false },
      { label: '终态', value: app.dfa.finals.length, accent: false },
      { label: '可达', value: `${reachableCount}/${app.dfa.states.length}`, accent: true }
    ];
    dom.dfaStats.innerHTML = stats
      .map((item) => `<div class="stat-card${item.accent ? ' accent' : ''}"><span>${item.label}</span><strong>${item.value}</strong></div>`)
      .join('');

    dom.warnings.innerHTML = '';
    warnings.forEach((warning) => {
      const row = document.createElement('div');
      row.className = 'warning-item';
      const dot = document.createElement('i');
      const text = document.createElement('span');
      text.textContent = warning;
      row.append(dot, text);
      dom.warnings.appendChild(row);
    });
  }

  function renderInspector() {
    const dfa = app.dfa;
    const selection = app.selected;
    dom.inspector.innerHTML = '';
    dom.selectionBadge.textContent = '未选择';

    if (selection && selection.type === 'state' && dfa.states.includes(selection.id)) {
      const state = selection.id;
      dom.selectionBadge.textContent = '状态';
      const isStart = dfa.start === state;
      const isFinal = dfa.finals.includes(state);
      let incoming = 0;
      let outgoing = 0;
      dfa.states.forEach((from) => {
        dfa.alphabet.forEach((symbol) => {
          const target = core.getTarget(dfa, from, symbol);
          if (target === undefined) return;
          if (from === state) outgoing += 1;
          if (target === state) incoming += 1;
        });
      });
      const status = isStart && isFinal ? '开始 / 终态' : isStart ? '开始状态' : isFinal ? '终态' : '普通状态';
      dom.inspector.innerHTML = `
        <div class="state-editor">
          <div class="inspector-id-row">
            <span class="state-pill">${escapeHTML(status)}</span>
            <input id="stateNameInput" class="state-name-input" value="${escapeAttr(state)}" maxlength="${core.MAX_NAME_LENGTH}" spellcheck="false" aria-label="状态名称">
          </div>
          <div class="inspector-actions">
            <button type="button" class="mini-btn${isStart ? ' is-on' : ''}" data-action="set-start" ${isStart ? 'disabled' : ''} title="设为开始状态">${icon('arrow')}开始</button>
            <button type="button" class="mini-btn${isFinal ? ' is-on' : ''}" data-action="toggle-final" title="${isFinal ? '取消终态' : '设为终态'}">${icon('check')}${isFinal ? '取消终态' : '设为终态'}</button>
            <button type="button" class="mini-btn danger" data-action="delete-state" title="删除此状态">${icon('trash')}删除</button>
          </div>
          <div class="field-label">入边 ${incoming} · 出边 ${outgoing} · Enter 保存名称</div>
        </div>`;

      const nameInput = dom.inspector.querySelector('#stateNameInput');
      let renameDone = false;
      function commitRename() {
        if (renameDone) return;
        renameDone = true;
        const ok = renameState(state, nameInput.value);
        if (!ok) {
          renameDone = false;
          nameInput.value = state;
        }
      }
      nameInput.addEventListener('change', commitRename);
      nameInput.addEventListener('blur', commitRename);
      nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          nameInput.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          nameInput.value = state;
          nameInput.blur();
        }
      });

      dom.inspector.querySelector('[data-action="set-start"]').addEventListener('click', () => setStartState(state));
      dom.inspector.querySelector('[data-action="toggle-final"]').addEventListener('click', () => toggleFinalState(state));
      dom.inspector.querySelector('[data-action="delete-state"]').addEventListener('click', async () => {
        const ok = await askConfirm({
          title: '删除状态',
          message: `删除「${state}」以及所有指向它的转移？${dfa.states.length === 1 ? '这是最后一个状态。' : ''}`,
          confirmLabel: '删除状态',
          danger: true
        });
        if (ok) removeState(state);
      });
      return;
    }

    if (selection && selection.type === 'edge') {
      const { from, to } = selection;
      const symbols = dfa.alphabet.filter((symbol) => core.getTarget(dfa, from, symbol) === to);
      if (!dfa.states.includes(from) || !dfa.states.includes(to) || !symbols.length) {
        app.selected = null;
        renderInspector();
        return;
      }
      dom.selectionBadge.textContent = '转移';
      dom.inspector.innerHTML = `
        <div class="edge-editor">
          <div class="edge-route">
            <svg class="icon" aria-hidden="true"><use href="#i-arrow"></use></svg>
            <span>${escapeHTML(from)}</span>
            <b>→</b>
            <span>${escapeHTML(to)}</span>
          </div>
          <div class="edge-symbols">
            ${symbols.map((symbol) => `
              <span class="edge-symbol">${escapeHTML(symbol)}<button type="button" data-action="remove-edge-symbol" data-symbol="${escapeAttr(symbol)}" title="删除这条转移" aria-label="删除 ${escapeAttr(symbol)} 转移">×</button></span>
            `).join('')}
          </div>
          <div class="inspector-actions">
            <button type="button" class="mini-btn" data-action="add-edge-symbols">${icon('plus')}加字母</button>
            <button type="button" class="mini-btn danger" data-action="delete-edge">${icon('trash')}删除转移</button>
          </div>
          <div class="field-label">点击图中的转移标签可重新选中</div>
        </div>`;

      dom.inspector.querySelector('[data-action="add-edge-symbols"]').addEventListener('click', () => openSymbolDialog(from, to));
      dom.inspector.querySelector('[data-action="delete-edge"]').addEventListener('click', () => deleteSelectedEdge(from, to));
      dom.inspector.querySelectorAll('[data-action="remove-edge-symbol"]').forEach((button) => {
        button.addEventListener('click', () => removeTransition(from, to, button.dataset.symbol));
      });
      return;
    }

    app.selected = null;
    dom.selectionBadge.textContent = '未选择';
    const placeholder = document.createElement('div');
    placeholder.className = 'inspector-empty';
    placeholder.innerHTML = `
      <span class="empty-glyph">q</span>
      <p>点选状态或转移标签进行编辑。<br>开始、终态与字母表都可以在这里调整。</p>`;
    dom.inspector.appendChild(placeholder);
  }

  /* =========================================================
     Graph rendering
     ========================================================= */

  function getMarksUpTo(index) {
    const map = new Map();
    if (!app.run) return map;
    for (let i = 0; i <= index && i < app.run.steps.length; i += 1) {
      const step = app.run.steps[i];
      if (step.kind === 'mark') {
        map.set(step.pairKey, { category: step.category, step });
      }
    }
    return map;
  }

  function isResultViewAvailable() {
    return Boolean(app.run && app.run.resultStepIndex >= 0 && app.run.index >= app.run.resultStepIndex);
  }

  function getGraphMode() {
    return app.run && app.run.view === 'result' && isResultViewAvailable() ? 'result' : 'input';
  }

  function getGraphContext() {
    if (!app.dfa) return null;
    const mode = getGraphMode();
    if (mode === 'result') {
      const positions = { ...app.run.resultPositions };
      app.run.analysis.classes.forEach((cls) => {
        if (!hasValidPosition(positions[cls.label])) positions[cls.label] = { x: 480, y: 300 };
      });
      return {
        mode,
        dfa: app.run.analysis.minimal,
        positions,
        unreachable: new Set(),
        sinkName: '',
        analysis: app.run.analysis
      };
    }
    if (app.run) {
      ensureAugmentedPositions(app.run.analysis);
      const unreachable = new Set(app.run.analysis.preparation.unreachable);
      return {
        mode: 'input',
        dfa: app.run.analysis.augmented,
        positions: app.positions,
        unreachable,
        sinkName: app.run.analysis.preparation.sinkName,
        analysis: app.run.analysis
      };
    }
    ensurePositions(app.dfa);
    const reachable = core.reachableFrom(app.dfa.start, app.dfa.transitions);
    const unreachable = new Set(app.dfa.states.filter((state) => !reachable.has(state)));
    return {
      mode,
      dfa: app.dfa,
      positions: app.positions,
      unreachable,
      sinkName: '',
      analysis: null
    };
  }

  function getStepHighlights(context) {
    const empty = {
      focus: new Set(),
      witness: new Set(),
      group: new Set(),
      transitions: new Set(),
      step: null
    };
    if (!app.run || context.mode !== 'input') return empty;
    const step = getCurrentStep();
    if (!step) return empty;
    const focus = new Set();
    const witness = new Set();
    const group = new Set();
    const transitions = new Set();
    if (step.kind === 'mark') {
      (step.pair || []).forEach((state) => focus.add(state));
      (step.witness || []).forEach((state) => witness.add(state));
      if (step.symbol && step.witness && step.pair) {
        transitions.add(`${step.pair[0]}\u0001${step.witness[0]}\u0001${step.symbol}`);
        transitions.add(`${step.pair[1]}\u0001${step.witness[1]}\u0001${step.symbol}`);
      }
    } else if (step.kind === 'merge') {
      (step.group || []).forEach((state) => group.add(state));
    }
    return { focus, witness, group, transitions, step };
  }

  function buildEdgeGroups(dfa) {
    const groups = new Map();
    const stateSet = new Set(dfa.states);
    dfa.states.forEach((from) => {
      const row = dfa.transitions[from];
      if (!row) return;
      dfa.alphabet.forEach((symbol) => {
        const to = core.getTarget(dfa, from, symbol);
        if (!to || !stateSet.has(to)) return;
        const key = `${from}\u0001${to}`;
        if (!groups.has(key)) {
          groups.set(key, { from, to, symbols: [] });
        }
        groups.get(key).symbols.push(symbol);
      });
    });
    return [...groups.values()];
  }

  function makeMarkers(defs) {
    const ns = 'http://www.w3.org/2000/svg';
    const colors = {
      default: '#8ba3ab',
      highlight: '#72e7cf',
      witness: '#80b8ff',
      selected: '#f7c86c',
      start: '#80b8ff'
    };
    Object.keys(colors).forEach((key) => {
      const marker = svgEl('marker', {
        id: `arrow-${key}`,
        viewBox: '0 0 10 10',
        refX: '9',
        refY: '5',
        markerWidth: '7',
        markerHeight: '7',
        markerUnits: 'userSpaceOnUse',
        orient: 'auto'
      });
      const path = svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: colors[key] });
      marker.appendChild(path);
      defs.appendChild(marker);
    });
  }

  function edgeGeometry(fromPos, toPos, hasReverse) {
    if (fromPos.x === toPos.x && fromPos.y === toPos.y) {
      const start = {
        x: fromPos.x - NODE_R * 0.76,
        y: fromPos.y - NODE_R * 0.62
      };
      const end = {
        x: fromPos.x + NODE_R * 0.76,
        y: fromPos.y - NODE_R * 0.62
      };
      const c1 = { x: fromPos.x - 68, y: fromPos.y - 105 };
      const c2 = { x: fromPos.x + 68, y: fromPos.y - 105 };
      const label = { x: fromPos.x, y: fromPos.y - 105 };
      return {
        path: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
        label,
        hint: { x: fromPos.x, y: fromPos.y }
      };
    }

    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const distance = Math.hypot(dx, dy) || 1;
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const offset = hasReverse ? 29 : 0;
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const ctrl = {
      x: midX + normalX * offset,
      y: midY + normalY * offset
    };
    const startDir = { x: ctrl.x - fromPos.x, y: ctrl.y - fromPos.y };
    const endDir = { x: ctrl.x - toPos.x, y: ctrl.y - toPos.y };
    const startLen = Math.hypot(startDir.x, startDir.y) || 1;
    const endLen = Math.hypot(endDir.x, endDir.y) || 1;
    const start = {
      x: fromPos.x + (startDir.x / startLen) * (NODE_R + 2),
      y: fromPos.y + (startDir.y / startLen) * (NODE_R + 2)
    };
    const end = {
      x: toPos.x + (endDir.x / endLen) * (NODE_R + 2),
      y: toPos.y + (endDir.y / endLen) * (NODE_R + 2)
    };
    const label = {
      x: 0.25 * start.x + 0.5 * ctrl.x + 0.25 * end.x,
      y: 0.25 * start.y + 0.5 * ctrl.y + 0.25 * end.y
    };
    return {
      path: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${ctrl.x.toFixed(2)} ${ctrl.y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
      label,
      hint: { x: ctrl.x, y: ctrl.y }
    };
  }

  function drawEdges(svg, context, highlights) {
    const { dfa, positions, unreachable } = context;
    const edges = buildEdgeGroups(dfa);
    const edgeKeys = new Set(edges.map((edge) => `${edge.from}\u0001${edge.to}`));
    const selected = app.selected && app.selected.type === 'edge' ? app.selected : null;

    const edgeMeta = edges.map((edge) => {
      const edgeSelected = Boolean(selected && selected.from === edge.from && selected.to === edge.to);
      const highlighted = edge.symbols.some((symbol) => highlights.transitions.has(`${edge.from}\u0001${edge.to}\u0001${symbol}`));
      const unreachableEdge = context.mode === 'input' && (unreachable.has(edge.from) || unreachable.has(edge.to));
      return { ...edge, edgeSelected, highlighted, unreachableEdge };
    });
    edgeMeta.sort((a, b) => {
      const priority = (edge) => (edge.edgeSelected ? 3 : edge.highlighted ? 2 : edge.unreachableEdge ? 0 : 1);
      return priority(a) - priority(b);
    });

    edgeMeta.forEach((edge) => {
      const fromPos = positions[edge.from];
      const toPos = positions[edge.to];
      if (!hasValidPosition(fromPos) || !hasValidPosition(toPos)) return;
      const hasReverse = edge.from !== edge.to && edgeKeys.has(`${edge.to}\u0001${edge.from}`);
      const geometry = edgeGeometry(fromPos, toPos, hasReverse);
      const group = svgEl('g', {
        class: `edge-group${edge.edgeSelected ? ' edge-selected' : ''}`,
        'data-edge-from': edge.from,
        'data-edge-to': edge.to
      });
      const title = svgEl('title', {}, `${edge.from} → ${edge.to}：${edge.symbols.join('、')}`);
      group.appendChild(title);

      let marker = 'arrow-default';
      if (edge.edgeSelected) marker = 'arrow-selected';
      else if (edge.highlighted) marker = 'arrow-highlight';

      const path = svgEl('path', {
        class: `edge-path${edge.highlighted ? ' is-highlight' : ''}${edge.unreachableEdge ? ' is-muted' : ''}`,
        d: geometry.path,
        'marker-end': `url(#${marker})`
      });
      const hit = svgEl('path', {
        class: 'edge-hit',
        d: geometry.path
      });
      group.append(path, hit);

      const labelText = edge.symbols.join(' · ');
      const width = Math.max(24, measureLabel(labelText));
      const labelGroup = svgEl('g', {
        class: `edge-label-group${edge.highlighted ? ' is-highlight' : ''}${edge.edgeSelected ? ' is-selected-label' : ''}`,
        transform: `translate(${geometry.label.x.toFixed(2)}, ${geometry.label.y.toFixed(2)})`
      });
      const box = svgEl('rect', {
        class: 'edge-label-box',
        x: (-width / 2).toFixed(2),
        y: '-9',
        width: width.toFixed(2),
        height: '18',
        rx: '9'
      });
      const text = svgEl('text', { class: 'edge-label', x: '0', y: '0.5' }, labelText);
      labelGroup.append(box, text);
      group.appendChild(labelGroup);
      svg.appendChild(group);
    });
  }

  function truncateMiddle(text, max = 14) {
    const chars = Array.from(String(text));
    if (chars.length <= max) return text;
    const keep = Math.floor((max - 1) / 2);
    return `${chars.slice(0, keep).join('')}…${chars.slice(-keep).join('')}`;
  }

  function drawNodes(svg, context, highlights) {
    const { dfa, positions, unreachable } = context;
    const selectedState = app.selected && app.selected.type === 'state' ? app.selected.id : null;
    const resultMode = context.mode === 'result';
    const classesByLabel = new Map();
    if (resultMode && context.analysis) {
      context.analysis.classes.forEach((cls) => classesByLabel.set(cls.label, cls));
    }

    dfa.states.forEach((state) => {
      const pos = positions[state];
      if (!hasValidPosition(pos)) return;
      const isStart = dfa.start === state;
      const isFinal = dfa.finals.includes(state);
      const isSelected = selectedState === state && context.mode === 'input';
      const isFocused = highlights.focus.has(state);
      const isWitness = highlights.witness.has(state);
      const isGroup = highlights.group.has(state);
      const isUnreachable = context.mode === 'input' && unreachable.has(state);
      const isSink = context.mode === 'input' && state === context.sinkName;
      const isConnectSource = app.tool === 'connect' && app.connectFrom === state && context.mode === 'input';
      const cls = classesByLabel.get(state) || null;
      const color = cls ? classColor(cls.index) : null;

      const groupClasses = ['state-group'];
      if (isStart) groupClasses.push('is-start');
      if (isFinal) groupClasses.push('is-final');
      if (isSelected) groupClasses.push('is-selected');
      if (isFocused) groupClasses.push('is-focus');
      if (isWitness) groupClasses.push('is-witness');
      if (isGroup) groupClasses.push('is-group');
      if (isUnreachable) groupClasses.push('is-unreachable');
      if (isSink) groupClasses.push('is-sink');
      if (isConnectSource) groupClasses.push('is-connect-source');
      if (resultMode) groupClasses.push('is-result');
      if (app.tool === 'connect' && context.mode === 'input') groupClasses.push('is-connect');
      if (app.drag && app.drag.stateId === state) groupClasses.push('is-dragging');

      const group = svgEl('g', {
        class: groupClasses.join(' '),
        transform: `translate(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`,
        'data-state-id': state,
        tabindex: resultMode ? '-1' : '0',
        role: resultMode ? 'img' : 'button'
      });

      let titleText = `状态 ${state}`;
      if (isStart) titleText += ' · 开始状态';
      if (isFinal) titleText += ' · 终态';
      if (isUnreachable) titleText += ' · 不可达';
      if (isSink) titleText += ' · 自动补全的陷阱状态';
      if (cls) {
        titleText = `等价类 ${cls.label} = { ${cls.memberStates.join(', ')} }`;
        if (cls.isStart) titleText += ' · 开始状态';
        if (cls.isFinal) titleText += ' · 终态';
      }
      group.appendChild(svgEl('title', {}, titleText));
      group.setAttribute('aria-label', titleText);

      if (isStart) {
        const line = svgEl('line', {
          class: 'start-line',
          x1: '-63',
          y1: '0',
          x2: '-32',
          y2: '0',
          'marker-end': 'url(#arrow-start)'
        });
        const caption = svgEl('text', { class: 'start-caption', x: '-63', y: '-8' }, 'start');
        group.append(line, caption);
      }

      group.appendChild(svgEl('circle', { class: 'state-halo', r: '37.5' }));
      if (isSelected) group.appendChild(svgEl('circle', { class: 'state-selected', r: '37' }));
      if (isFinal) group.appendChild(svgEl('circle', { class: 'state-final-ring', r: '34.5' }));
      const base = svgEl('circle', { class: 'state-base', r: String(NODE_R) });
      if (resultMode && color) {
        base.setAttribute('fill', hexToRgba(color, 0.12));
        base.setAttribute('stroke', color);
      } else if (isConnectSource) {
        base.setAttribute('fill', 'rgba(52, 39, 23, 0.92)');
        base.setAttribute('stroke', '#f7c86c');
      }
      group.appendChild(base);

      if (resultMode && cls) {
        const label = svgEl('text', { class: 'state-label', x: '0', y: '-3' }, cls.label);
        label.setAttribute('font-size', '13');
        group.appendChild(label);
        const memberText = truncateMiddle(cls.memberStates.join('·'), 9);
        const memberLabel = svgEl('text', { class: 'state-sublabel', x: '0', y: '12' }, memberText);
        if (Array.from(memberText).length > 6) memberLabel.setAttribute('font-size', '6.4');
        group.appendChild(memberLabel);
      } else {
        const shownName = truncateMiddle(state, 8);
        const label = svgEl('text', { class: 'state-label', x: '0', y: '1' }, shownName);
        if (Array.from(shownName).length > 6) label.setAttribute('font-size', '10.5');
        if (Array.from(shownName).length > 8) label.setAttribute('font-size', '9.5');
        group.appendChild(label);
        if (isUnreachable) {
          group.appendChild(svgEl('circle', {
            class: 'sink-dash',
            r: '34.5',
            fill: 'none',
            stroke: 'rgba(130, 154, 166, 0.25)',
            'stroke-width': '1'
          }));
        }
      }

      if (isSink) {
        const badgeWidth = 28;
        const badge = svgEl('g', { transform: 'translate(0, 40)' });
        badge.appendChild(svgEl('rect', {
          class: 'state-badge-bg',
          x: String(-badgeWidth / 2),
          y: '-7',
          width: String(badgeWidth),
          height: '14',
          rx: '7'
        }));
        badge.appendChild(svgEl('text', { class: 'state-badge-text', x: '0', y: '0' }, 'sink'));
        group.appendChild(badge);
      }

      svg.appendChild(group);
    });
  }

  function renderGraphChrome(context) {
    const mode = context.mode;
    const dfa = context.dfa;
    const finalCount = dfa.finals.length;
    const transitionCount = countTransitionsFor(dfa);
    const unreachableCount = context.unreachable.size;

    dom.graphTitle.textContent = mode === 'result' ? '最小 DFA' : '自动机视图';
    dom.graphBadge.classList.remove('is-running', 'is-done');
    dom.graphEmpty.hidden = dfa.states.length > 0;

    if (!app.run) {
      dom.graphBadge.textContent = `${dfa.states.length} 状态 · ${finalCount} 终态`;
      dom.graphStats.innerHTML = `
        <span><b>${dfa.states.length}</b> 状态</span><span class="dot"></span>
        <span><b>${transitionCount}</b> 转移</span><span class="dot"></span>
        <span><b>${finalCount}</b> 终态</span>
        ${unreachableCount ? `<span class="dot"></span><span style="color:var(--amber)">${unreachableCount} 不可达</span>` : ''}`;
      return;
    }

    if (mode === 'result') {
      const analysis = context.analysis;
      dom.graphBadge.classList.add('is-done');
      dom.graphBadge.textContent = `MINIMIZED · ${analysis.minimal.states.length} STATES`;
      dom.graphStats.innerHTML = `
        <span><b>${analysis.minimal.states.length}</b> 最小状态</span><span class="dot"></span>
        <span><b>${analysis.stats.mergedClasses}</b> 组合并</span><span class="dot"></span>
        <span><b>${analysis.stats.unreachableRemoved}</b> 不可达移除</span>`;
      return;
    }

    const step = getCurrentStep();
    const marks = getMarksUpTo(app.run.index);
    const analysis = app.run.analysis;
    dom.graphBadge.classList.add('is-running');
    dom.graphBadge.textContent = step
      ? step.phase === 'scan'
        ? `ROUND ${step.round} · 第 ${app.run.index + 1} 步`
        : `步骤 ${app.run.index + 1} / ${app.run.steps.length}`
      : '执行中';
    dom.graphStats.innerHTML = `
      <span><b>${analysis.states.length}</b> 可达状态</span><span class="dot"></span>
      <span><b>${marks.size}</b> / ${analysis.pairCount} 对已区分</span><span class="dot"></span>
      <span><b>${unreachableCount}</b> 不可达</span>
      ${analysis.stats.missingCompleted ? '<span class="dot"></span><span style="color:var(--amber)">陷阱已补全</span>' : ''}`;
  }

  function countTransitionsFor(dfa) {
    let count = 0;
    dfa.states.forEach((state) => {
      dfa.alphabet.forEach((symbol) => {
        if (core.getTarget(dfa, state, symbol) !== undefined) count += 1;
      });
    });
    return count;
  }

  function renderGraph() {
    if (!app.dfa) return;
    const context = getGraphContext();
    if (!context) return;
    const svg = dom.graphSvg;
    svg.innerHTML = '';
    const defs = svgEl('defs', {});
    makeMarkers(defs);
    svg.appendChild(defs);

    const highlights = getStepHighlights(context);
    if (context.dfa.states.length) {
      drawEdges(svg, context, highlights);
      drawNodes(svg, context, highlights);
    }

    const positions = context.positions;
    if (app.drag && app.drag.fixedViewBox) {
      svg.setAttribute('viewBox', app.drag.fixedViewBox);
      app.lastViewBox = app.drag.fixedViewBox;
    } else {
      const box = computeViewBox(positions, context.dfa.states);
      applyViewBox(box);
    }
    svg.setAttribute('aria-label', context.mode === 'result' ? '最小化后的 DFA 状态转移图' : '输入 DFA 状态转移图');
    renderGraphChrome(context);
    renderToolState();
  }

  /* =========================================================
     Pair table rendering
     ========================================================= */

  function setTableEmptyState(title, description) {
    dom.tableEmpty.innerHTML = `
      <span class="empty-matrix" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(description)}</p></div>`;
  }

  function ensureVisibleInScroller(scroller, target) {
    if (!scroller || !target) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (targetRect.top < scrollerRect.top + 4) {
      scroller.scrollTop -= scrollerRect.top + 4 - targetRect.top;
    } else if (targetRect.bottom > scrollerRect.bottom - 4) {
      scroller.scrollTop += targetRect.bottom - (scrollerRect.bottom - 4);
    }
    if (targetRect.left < scrollerRect.left + 4) {
      scroller.scrollLeft -= scrollerRect.left + 4 - targetRect.left;
    } else if (targetRect.right > scrollerRect.right - 4) {
      scroller.scrollLeft += targetRect.right - (scrollerRect.right - 4);
    }
  }

  function renderPairTable() {
    const run = app.run;
    const analysis = run ? run.analysis : null;
    const n = analysis ? analysis.n : 0;

    if (!run) {
      dom.pairTableScroll.hidden = true;
      dom.tableEmpty.hidden = false;
      setTableEmptyState(
        '区分表等待生成',
        '开始化简后，每一对状态的区分证据会在这里逐格出现。'
      );
      renderCurrentReason();
      return;
    }

    if (n < 2) {
      dom.pairTableScroll.hidden = true;
      dom.tableEmpty.hidden = false;
      setTableEmptyState(
        '没有需要配对的状态',
        '可达状态不足两个，标记法无需建立区分表，最小 DFA 就是当前状态。'
      );
      renderCurrentReason();
      return;
    }

    dom.pairTableScroll.hidden = false;
    dom.tableEmpty.hidden = true;
    const table = dom.pairTable;
    table.innerHTML = '';
    const step = getCurrentStep();
    const marks = getMarksUpTo(run.index);
    const marksShown = step && ['finalize', 'merge', 'result'].includes(step.phase);
    const currentPairKey = step && step.kind === 'mark' ? step.pairKey : null;
    const witnessPairKey = step && step.kind === 'mark' ? step.witnessPairKey : null;
    const mergePairKeys = new Set();
    if (step && step.kind === 'merge' && step.groupIndices) {
      for (let a = 0; a < step.groupIndices.length; a += 1) {
        for (let b = a + 1; b < step.groupIndices.length; b += 1) {
          mergePairKeys.add(core.pairKey(step.groupIndices[a], step.groupIndices[b]));
        }
      }
    }

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'pt-corner';
    corner.setAttribute('aria-label', '状态对');
    corner.scope = 'col';
    headRow.appendChild(corner);
    for (let j = 0; j < n - 1; j += 1) {
      const th = document.createElement('th');
      th.className = 'pt-colhead';
      th.scope = 'col';
      if (analysis.working.finals.includes(analysis.states[j])) th.classList.add('is-final');
      if (analysis.working.start === analysis.states[j]) th.classList.add('is-start');
      th.textContent = analysis.states[j];
      th.title = `${analysis.states[j]}${analysis.working.start === analysis.states[j] ? '（开始）' : ''}${analysis.working.finals.includes(analysis.states[j]) ? '（终态）' : ''}`;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 1; i < n; i += 1) {
      const row = document.createElement('tr');
      const rowHead = document.createElement('th');
      rowHead.className = 'pt-rowhead';
      rowHead.scope = 'row';
      if (analysis.working.finals.includes(analysis.states[i])) rowHead.classList.add('is-final');
      if (analysis.working.start === analysis.states[i]) rowHead.classList.add('is-start');
      rowHead.textContent = analysis.states[i];
      rowHead.title = `${analysis.states[i]}${analysis.working.start === analysis.states[i] ? '（开始）' : ''}${analysis.working.finals.includes(analysis.states[i]) ? '（终态）' : ''}`;
      row.appendChild(rowHead);

      for (let j = 0; j < n - 1; j += 1) {
        const cell = document.createElement('td');
        if (j >= i) {
          cell.className = 'pt-diag';
          row.appendChild(cell);
          continue;
        }
        const key = core.pairKey(j, i);
        const markInfo = marks.get(key);
        const pairNames = [analysis.states[j], analysis.states[i]];
        cell.className = 'pt-cell';
        cell.dataset.pairKey = key;
        cell.setAttribute('title', `(${pairNames[0]}, ${pairNames[1]})`);
        if (markInfo) {
          cell.classList.add('is-marked');
          if (markInfo.category === 'initial') cell.classList.add('is-initial');
          cell.textContent = '×';
          cell.title += markInfo.category === 'initial' ? ' · 终态差异' : ' · 已找到区分证据';
        } else if (marksShown) {
          const eqClass = getClassForPair(analysis, j, i);
          if (eqClass) {
            cell.classList.add('is-equivalent');
            cell.style.setProperty('--eq-color', classColor(eqClass.index));
            const glyph = document.createElement('span');
            glyph.className = 'eq-glyph';
            glyph.textContent = '≡';
            const label = document.createElement('span');
            label.className = 'eq-label';
            label.textContent = eqClass.label;
            cell.append(glyph, label);
            cell.title += ` · 等价，属于等价类 ${eqClass.label}`;
          }
        } else {
          cell.classList.add('is-empty');
          cell.title += ' · 未标记';
        }
        if (key === currentPairKey) {
          cell.classList.add('is-current', 'just-marked');
          if (marksShown) cell.classList.add('is-equivalent-current');
        }
        if (key === witnessPairKey) cell.classList.add('is-witness');
        if (mergePairKeys.has(key)) cell.classList.add('is-equivalent-current');
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    renderCurrentReason();

    window.requestAnimationFrame(() => {
      const current = dom.pairTable.querySelector('.pt-cell.is-current');
      if (current) ensureVisibleInScroller(dom.pairTableScroll, current);
    });
  }

  function renderCurrentReason() {
    const reason = dom.currentReason;
    const mark = reason.querySelector('.reason-mark');
    const text = reason.querySelector('p');
    reason.classList.remove('is-active', 'is-result');
    if (!app.run) {
      mark.textContent = 'i';
      text.textContent = '标记法从终态差异出发，不断寻找「转移到已区分状态对」的证据。';
      return;
    }
    const step = getCurrentStep();
    if (!step) return;
    if (step.kind === 'mark') {
      reason.classList.add('is-active');
      mark.textContent = '×';
      text.textContent = `${step.title}。${step.detail}`;
    } else if (step.kind === 'merge' || step.kind === 'result') {
      reason.classList.add('is-result');
      mark.textContent = step.kind === 'merge' ? '∪' : '✓';
      text.textContent = `${step.title}。${step.detail}`;
    } else {
      mark.textContent = 'i';
      text.textContent = step.detail || step.title;
    }
  }

  /* =========================================================
     Process panel rendering
     ========================================================= */

  function renderEmptyProcess() {
    dom.processStatus.textContent = '待开始';
    dom.processStatus.className = 'status-chip muted';
    dom.phaseLabel.textContent = '尚未化简';
    dom.stepCounter.textContent = '0 / 0';
    dom.progressBar.style.width = '0%';
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
    dom.playBtn.disabled = true;
    dom.skipBtn.disabled = true;
    setUseIcon(dom.playBtn, 'play');
    dom.playBtn.classList.remove('is-paused');
    dom.playBtn.title = '播放 / 暂停（空格）';
    dom.playBtn.setAttribute('aria-label', '播放');
    dom.logCount.textContent = '未开始';
    dom.activeStep.className = 'active-step';
    dom.activeStep.innerHTML = `
      <span class="active-step-index">READY</span>
      <h3>准备好开始了吗？</h3>
      <p>输入一个自动机，然后按下「开始化简」。这里会解释每一次标记的理由。</p>`;
    dom.stepsLog.innerHTML = `
      <div class="log-placeholder">
        <span class="placeholder-line"></span>
        <span class="placeholder-line short"></span>
        <span class="placeholder-line"></span>
        <p>等待算法启动</p>
      </div>`;
    dom.resultCard.hidden = true;
  }

  function phaseLabelForStep(step) {
    if (!step) return '尚未化简';
    if (step.phase === 'setup') return '预处理';
    if (step.phase === 'initialize') return step.kind === 'info' ? '建立区分表' : '初始标记';
    if (step.phase === 'scan') return `第 ${step.round} 轮扫描`;
    if (step.phase === 'finalize') return '扫描完成';
    if (step.phase === 'merge') return '合并等价类';
    if (step.phase === 'result') return '完成';
    return '化简中';
  }

  function stepMetaText(step) {
    if (step.kind === 'mark') {
      return step.category === 'initial' ? 'INITIAL MARK' : `ROUND ${step.round}`;
    }
    if (step.kind === 'merge') return 'MERGE CLASSES';
    if (step.kind === 'result') return 'RESULT';
    if (step.phase === 'finalize') return 'FIXED POINT';
    if (step.phase === 'setup') return 'PREPARE';
    return 'SETUP';
  }

  function stepDotText(step) {
    if (step.kind === 'mark') return '×';
    if (step.kind === 'merge') return '∪';
    if (step.kind === 'result') return '✓';
    return 'i';
  }

  function renderActiveStep(step) {
    if (!step) return;
    dom.activeStep.className = `active-step is-${step.kind}`;
    dom.activeStep.innerHTML = '';
    const kicker = document.createElement('span');
    kicker.className = 'active-step-index';
    kicker.textContent = `STEP ${String(app.run.index + 1).padStart(2, '0')} · ${stepMetaText(step)}`;
    const title = document.createElement('h3');
    title.textContent = step.title;
    const detail = document.createElement('p');
    detail.textContent = step.detail;
    dom.activeStep.append(kicker, title, detail);
    if (step.hint) {
      const hint = document.createElement('span');
      hint.className = 'active-step-hint';
      hint.textContent = step.hint;
      dom.activeStep.appendChild(hint);
    }
  }

  function renderStepsLog() {
    if (!app.run) return;
    const run = app.run;
    dom.stepsLog.innerHTML = '';
    run.steps.forEach((step, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `step-item kind-${step.kind}${index === run.index ? ' is-active' : ''}${index > run.index ? ' is-future' : ''}`;
      button.dataset.stepIndex = String(index);
      button.setAttribute('aria-label', `${index + 1}. ${step.title}`);

      const rail = document.createElement('span');
      rail.className = 'step-rail';
      const dot = document.createElement('span');
      dot.className = 'step-dot';
      dot.textContent = stepDotText(step);
      rail.appendChild(dot);

      const body = document.createElement('span');
      body.className = 'step-body';
      const meta = document.createElement('span');
      meta.className = 'step-meta';
      const metaText = document.createElement('span');
      metaText.textContent = stepMetaText(step);
      meta.appendChild(metaText);
      if (step.kind === 'mark' && step.pair) {
        const pair = document.createElement('span');
        pair.className = 'step-round-badge';
        pair.textContent = `· ${step.pair.join(' / ')}`;
        meta.appendChild(pair);
      }
      const title = document.createElement('span');
      title.className = 'step-title';
      title.textContent = step.title;
      body.append(meta, title);
      if (index === run.index) {
        const detail = document.createElement('span');
        detail.className = 'step-detail';
        detail.textContent = step.detail;
        body.appendChild(detail);
      }
      button.append(rail, body);
      button.addEventListener('click', () => {
        goToStep(index);
      });
      dom.stepsLog.appendChild(button);
    });
  }

  function scrollActiveStepIntoView() {
    const active = dom.stepsLog.querySelector('.step-item.is-active');
    if (!active) return;
    window.requestAnimationFrame(() => {
      ensureVisibleInScroller(dom.stepsLog, active);
    });
  }

  function renderResultCard() {
    if (!app.run) {
      dom.resultCard.hidden = true;
      return;
    }
    const show = app.run.index >= app.run.resultStepIndex && app.run.resultStepIndex >= 0;
    dom.resultCard.hidden = !show;
    if (!show) return;
    const analysis = app.run.analysis;
    dom.resultCount.textContent = `${analysis.minimal.states.length} STATES`;
    dom.resultSummary.innerHTML = `
      <div class="result-stat"><span>可达→最小</span><strong>${analysis.stats.reachableStates}→${analysis.stats.minimalStates}<em> 个</em></strong></div>
      <div class="result-stat"><span>可区分对</span><strong>${analysis.stats.totalMarkedPairs}</strong></div>
      <div class="result-stat"><span>合并类</span><strong>${analysis.stats.mergedClasses}</strong></div>`;
    const notes = [];
    if (analysis.stats.missingCompleted) {
      notes.push(`已补全 ${analysis.stats.missingCompleted} 处缺失转移，并引入陷阱状态「${analysis.stats.sinkName}」。`);
    }
    if (analysis.stats.unreachableRemoved) {
      notes.push(`已移除 ${analysis.stats.unreachableRemoved} 个不可达状态。`);
    }
    dom.resultNotes.hidden = notes.length === 0;
    dom.resultNotes.innerHTML = '';
    notes.forEach((note) => {
      const row = document.createElement('div');
      row.className = 'result-note';
      row.textContent = note;
      dom.resultNotes.appendChild(row);
    });
    const list = document.getElementById('classList');
    list.innerHTML = '';
    analysis.classes.forEach((cls) => {
      const chip = document.createElement('span');
      chip.className = 'class-chip';
      chip.style.setProperty('--class-color', classColor(cls.index));
      const dot = document.createElement('i');
      dot.style.background = classColor(cls.index);
      const label = document.createElement('b');
      label.textContent = cls.label;
      const members = document.createElement('span');
      members.textContent = cls.memberStates.join(', ');
      chip.append(dot, label, members);
      const flags = [];
      if (cls.isStart) flags.push('开始状态');
      if (cls.isFinal) flags.push('终态');
      chip.title = `等价类 ${cls.label} = { ${cls.memberStates.join(', ')} }${flags.length ? ` · ${flags.join(' / ')}` : ''}`;
      list.appendChild(chip);
    });
  }

  function renderProcess() {
    if (!app.run) {
      renderEmptyProcess();
      return;
    }
    const run = app.run;
    const step = getCurrentStep();
    const lastIndex = run.steps.length - 1;
    const done = run.index >= lastIndex;
    dom.processStatus.textContent = done ? '已完成' : run.playing ? '播放中' : '已暂停';
    dom.processStatus.className = `status-chip${done ? ' is-done' : run.playing ? ' is-running' : ' muted'}`;
    dom.phaseLabel.textContent = phaseLabelForStep(step);
    dom.stepCounter.textContent = `${run.index + 1} / ${run.steps.length}`;
    dom.progressBar.style.width = `${((run.index + 1) / run.steps.length) * 100}%`;
    dom.prevBtn.disabled = run.index <= 0;
    dom.nextBtn.disabled = done;
    dom.playBtn.disabled = false;
    dom.skipBtn.disabled = done;
    setUseIcon(dom.playBtn, run.playing ? 'pause' : 'play');
    dom.playBtn.classList.toggle('is-paused', !run.playing);
    dom.playBtn.title = run.playing ? '暂停（空格）' : '播放（空格）';
    dom.playBtn.setAttribute('aria-label', run.playing ? '暂停' : '播放');
    dom.speedSelect.value = String(run.speed);
    dom.logCount.textContent = `共 ${run.steps.length} 步`;
    renderActiveStep(step);
    renderStepsLog();
    renderResultCard();
    scrollActiveStepIntoView();
  }

  /* =========================================================
     Example loading + graph interactions
     ========================================================= */

  function buildExampleOptions() {
    dom.exampleSelect.innerHTML = '';
    EXAMPLES.forEach((example) => {
      const option = document.createElement('option');
      option.value = example.id;
      option.textContent = example.name;
      dom.exampleSelect.appendChild(option);
    });
  }

  function loadExample(id, options = {}) {
    const { silent = false, autoplay = false } = options;
    const example = EXAMPLES.find((item) => item.id === id) || EXAMPLES[0];
    const parsed = core.parseDSL(example.dsl);
    if (!parsed.ok) {
      showToast('示例自动机解析失败，请检查源码。', 'error', 4500);
      return;
    }
    stopPlaybackTimer();
    app.run = null;
    app.dfa = parsed.dfa;
    app.positions = {};
    Object.assign(app.positions, example.positions || {});
    ensurePositions(app.dfa);
    app.selectedExampleId = example.id;
    app.selected = null;
    app.connectFrom = null;
    app.tool = 'select';
    app.expressionDirty = false;
    dom.exampleSelect.value = example.id;
    syncExpression(true);
    clearExpressionFeedback();
    switchTab('graph');
    renderAll();
    if (!silent) showToast(`已载入：${example.name}`, 'info', 2200);
    if (autoplay) {
      window.setTimeout(() => {
        startMinimization();
      }, 300);
    }
  }

  function selectStateForEditing(stateId) {
    if (!app.dfa.states.includes(stateId)) {
      if (app.run && stateId === app.run.analysis.preparation.sinkName) {
        showToast('这是系统补全的陷阱状态，不能直接编辑', 'info');
      }
      return;
    }
    app.selected = { type: 'state', id: stateId };
    renderEditor();
    renderGraph();
  }

  function selectEdgeForEditing(from, to) {
    app.selected = { type: 'edge', from, to };
    renderEditor();
    renderGraph();
  }

  function activateState(stateId) {
    if (app.tool === 'connect') {
      if (!app.connectFrom) {
        app.connectFrom = stateId;
        renderToolState();
        renderGraph();
      } else {
        const from = app.connectFrom;
        app.connectFrom = null;
        renderToolState();
        renderGraph();
        openSymbolDialog(from, stateId);
      }
      return;
    }
    selectStateForEditing(stateId);
  }

  function handleGraphPointerDown(event) {
    if (event.button !== 0) return;
    if (getGraphMode() === 'result') return;
    if (app.tool !== 'select') return;
    const group = event.target.closest('.state-group');
    if (!group) return;
    const stateId = group.dataset.stateId;
    const pos = app.positions[stateId];
    if (!hasValidPosition(pos)) return;
    const point = clientToSvg(event.clientX, event.clientY);
    app.drag = {
      stateId,
      offsetX: point.x - pos.x,
      offsetY: point.y - pos.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      fixedViewBox: getCurrentViewBoxString()
    };
    window.addEventListener('pointermove', handleGraphDragMove);
    window.addEventListener('pointerup', handleGraphDragEnd);
    window.addEventListener('pointercancel', handleGraphDragCancel);
  }

  function scheduleDragRender() {
    if (dragRaf) return;
    dragRaf = window.requestAnimationFrame(() => {
      dragRaf = 0;
      if (app.drag) renderGraph();
    });
  }

  function handleGraphDragMove(event) {
    if (!app.drag) return;
    const dx = event.clientX - app.drag.startClientX;
    const dy = event.clientY - app.drag.startClientY;
    if (!app.drag.moved && Math.hypot(dx, dy) < 3.5) return;
    app.drag.moved = true;
    event.preventDefault();
    const point = clientToSvg(event.clientX, event.clientY);
    app.positions[app.drag.stateId] = {
      x: clamp(point.x - app.drag.offsetX, 20, 940),
      y: clamp(point.y - app.drag.offsetY, 30, 570)
    };
    scheduleDragRender();
  }

  function cleanupGraphDrag() {
    window.removeEventListener('pointermove', handleGraphDragMove);
    window.removeEventListener('pointerup', handleGraphDragEnd);
    window.removeEventListener('pointercancel', handleGraphDragCancel);
    if (dragRaf) {
      window.cancelAnimationFrame(dragRaf);
      dragRaf = 0;
    }
  }

  function handleGraphDragEnd() {
    if (!app.drag) {
      cleanupGraphDrag();
      return;
    }
    const moved = app.drag.moved;
    cleanupGraphDrag();
    app.drag = null;
    if (moved) {
      app.suppressGraphClick = true;
      window.setTimeout(() => {
        app.suppressGraphClick = false;
      }, 100);
      if (app.run) {
        app.run.resultPositions = computeResultPositions(app.run.analysis);
      }
      renderGraph();
    }
  }

  function handleGraphDragCancel() {
    if (app.drag) {
      app.drag = null;
      cleanupGraphDrag();
      renderGraph();
    }
  }

  function handleGraphClick(event) {
    if (app.suppressGraphClick) {
      app.suppressGraphClick = false;
      return;
    }
    if (getGraphMode() === 'result') return;
    const node = event.target.closest('.state-group');
    if (node) {
      activateState(node.dataset.stateId);
      return;
    }
    const edge = event.target.closest('.edge-group');
    if (edge) {
      if (app.tool === 'connect') return;
      selectEdgeForEditing(edge.dataset.edgeFrom, edge.dataset.edgeTo);
      return;
    }
    if (app.tool === 'connect' && app.connectFrom) {
      cancelConnection();
      return;
    }
    if (app.selected) {
      app.selected = null;
      renderEditor();
      renderGraph();
    }
  }

  function handleGraphKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (getGraphMode() === 'result') return;
    const node = event.target.closest('.state-group');
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    activateState(node.dataset.stateId);
  }

  function autoLayoutCurrentGraph() {
    if (getGraphMode() === 'result') {
      showToast('最小 DFA 视图使用自动布局；切回输入图后可手动整理', 'info');
      return;
    }
    const context = getGraphContext();
    if (!context) return;
    const layout = autoLayoutDfa(context.dfa);
    Object.assign(app.positions, layout);
    if (app.run) {
      app.run.resultPositions = computeResultPositions(app.run.analysis);
    }
    renderGraph();
    showToast('布局已整理', 'info', 1800);
  }

  /* =========================================================
     Copy helpers
     ========================================================= */

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // fall through to the legacy path
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', 'readonly');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      area.style.top = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (error) {
      return false;
    }
  }

  async function copyResultExpression() {
    if (!app.run || app.run.index < app.run.resultStepIndex) return;
    const text = core.buildResultDSL(app.run.analysis);
    const ok = await copyText(text);
    if (ok) {
      showToast('最小 DFA 的转移表达式已复制', 'success');
    } else {
      showToast('复制失败，请手动选择表达式文本', 'error');
    }
  }

  /* =========================================================
     Event wiring
     ========================================================= */

  function bindEvents() {
    dom.exampleSelect.addEventListener('change', () => {
      loadExample(dom.exampleSelect.value);
    });
    dom.resetSampleBtn.addEventListener('click', () => {
      loadExample(app.selectedExampleId || EXAMPLES[0].id);
    });
    dom.minimizeBtn.addEventListener('click', startMinimization);

    dom.graphTab.addEventListener('click', () => switchTab('graph'));
    dom.expressionTab.addEventListener('click', () => switchTab('expression'));

    dom.selectToolBtn.addEventListener('click', () => setTool('select'));
    dom.connectToolBtn.addEventListener('click', () => setTool('connect'));
    dom.addStateBtn.addEventListener('click', addState);
    dom.layoutBtn.addEventListener('click', autoLayoutCurrentGraph);
    dom.cancelConnectBtn.addEventListener('click', () => setTool('select'));

    dom.addSymbolForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = dom.symbolInput.value.trim();
      if (!value) return;
      if (addAlphabetSymbol(value)) dom.symbolInput.value = '';
    });
    dom.symbolInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        dom.addSymbolForm.requestSubmit();
      }
    });
    dom.alphabetChips.addEventListener('click', (event) => {
      const target = event.target.closest('button[data-remove-symbol]');
      if (!target) return;
      removeAlphabetSymbol(target.dataset.removeSymbol);
    });

    dom.expressionInput.addEventListener('input', () => {
      app.expressionDirty = true;
      clearExpressionFeedback();
    });
    dom.syncExpressionBtn.addEventListener('click', () => {
      app.expressionDirty = false;
      syncExpression(true);
      clearExpressionFeedback();
      showToast('已用当前图形覆盖表达式', 'info', 2000);
    });
    dom.applyExpressionBtn.addEventListener('click', () => {
      applyExpression({ switchToGraph: true, quiet: false, render: true });
    });
    dom.viewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (!app.run) return;
        const view = button.dataset.view;
        if (view === 'result' && !isResultViewAvailable()) return;
        app.run.view = view;
        renderGraph();
        updateViewToggle();
      });
    });

    dom.prevBtn.addEventListener('click', () => {
      if (!app.run) return;
      goToStep(app.run.index - 1);
    });
    dom.nextBtn.addEventListener('click', () => {
      if (!app.run) return;
      goToStep(app.run.index + 1);
    });
    dom.playBtn.addEventListener('click', togglePlayback);
    dom.skipBtn.addEventListener('click', () => {
      if (!app.run) return;
      goToStep(app.run.steps.length - 1);
    });
    dom.speedSelect.addEventListener('change', () => {
      if (!app.run) return;
      app.run.speed = Number(dom.speedSelect.value) || 1;
      if (app.run.playing) schedulePlayback();
    });

    dom.copyResultBtn.addEventListener('click', copyResultExpression);

    dom.graphSvg.addEventListener('pointerdown', handleGraphPointerDown);
    dom.graphSvg.addEventListener('click', handleGraphClick);
    dom.graphSvg.addEventListener('keydown', handleGraphKeyDown);

    dom.helpBtn.addEventListener('click', () => openHelpDialog());
    dom.closeHelpBtn.addEventListener('click', () => dom.helpDialog.close());
    dom.helpDialog.addEventListener('click', (event) => {
      if (event.target === dom.helpDialog) dom.helpDialog.close();
    });

    dom.closeSymbolBtn.addEventListener('click', closeSymbolDialog);
    dom.cancelSymbolBtn.addEventListener('click', closeSymbolDialog);
    dom.dialogAddSymbolBtn.addEventListener('click', addSymbolFromDialog);
    dom.confirmSymbolBtn.addEventListener('click', confirmSymbolDialog);
    dom.dialogSymbolInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addSymbolFromDialog();
      }
    });
    dom.symbolDialog.addEventListener('click', (event) => {
      if (event.target === dom.symbolDialog) closeSymbolDialog();
    });
    dom.symbolDialog.addEventListener('close', () => {
      app.symbolPending = null;
      app.symbolSelected = new Set();
    });

    dom.helpDialog.addEventListener('close', () => {
      dom.helpBtn.focus();
    });

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('resize', () => {
      if (app.layoutRaf) window.cancelAnimationFrame(app.layoutRaf);
      app.layoutRaf = window.requestAnimationFrame(() => {
        app.layoutRaf = 0;
        renderGraph();
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && app.run && app.run.playing) {
        setPlaying(false);
      }
    });
  }

  function openHelpDialog() {
    if (!dom.helpDialog.open) dom.helpDialog.showModal();
  }

  function handleGlobalKeyDown(event) {
    const anyDialogOpen = Boolean(document.querySelector('dialog[open]'));
    if (anyDialogOpen) return;
    const target = event.target;
    const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    const isFormField = tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'summary' || (target && target.isContentEditable);

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      startMinimization();
      return;
    }
    if (isFormField) return;

    if (event.key === 'Escape') {
      if (app.connectFrom) {
        cancelConnection();
        event.preventDefault();
        return;
      }
      if (app.tool === 'connect') {
        setTool('select');
        event.preventDefault();
        return;
      }
      if (app.selected) {
        app.selected = null;
        renderEditor();
        renderGraph();
        event.preventDefault();
      }
      return;
    }

    if (!app.run) return;
    if (event.key === ' ') {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToStep(app.run.index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToStep(app.run.index + 1);
    }
  }

  function setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (app.layoutRaf) return;
        app.layoutRaf = window.requestAnimationFrame(() => {
          app.layoutRaf = 0;
          renderGraph();
        });
      });
      observer.observe(dom.graphStage);
    }
  }

  /* =========================================================
     Boot
     ========================================================= */

  function init() {
    buildExampleOptions();
    bindEvents();
    setupResizeObserver();
    const params = new URLSearchParams(window.location.search);
    const requestedExample = params.get('example');
    const example = EXAMPLES.find((item) => item.id === requestedExample);
    loadExample(example ? example.id : EXAMPLES[0].id, {
      silent: true,
      autoplay: params.get('autoplay') === '1'
    });
    // A tiny debug surface is useful for automated screenshots and teaching demos.
    window.DFAStudio = {
      app,
      startMinimization,
      goToStep,
      loadExample,
      getCurrentStep
    };
  }

  init();
})();




