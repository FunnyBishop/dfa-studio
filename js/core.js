/*
 * DFA Studio — core
 * 纯逻辑：DSL 解析、DFA 完整性预处理、标记法（区分表法）最小化。
 * 同时兼容浏览器 <script> 与 Node require，方便算法单元测试。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.DFACore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_STATES = 20;
  const MAX_ALPHABET = 10;
  const MAX_NAME_LENGTH = 18;
  const MAX_SYMBOL_LENGTH = 5;

  const HEADER_ALIASES = {
    states: [
      'states', 'state', 'q', '状态', '状态集合', '状态集'
    ],
    alphabet: [
      'alphabet', 'sigma', 'symbols', 'alphabet表', '字母表', '字母集', '输入字母表', '符号表'
    ],
    start: [
      'start', 'initial', 'init', 'begin', '初态', '开始', '起始状态', '开始状态', '初始状态'
    ],
    finals: [
      'finals', 'final', 'accept', 'accepting', 'accepts', '终态', '接受态', '接受状态', '终止状态'
    ],
    transitions: [
      'transitions', 'transition', 'transitions:', '转移', '转移函数', '转移表', '转移关系'
    ]
  };

  const HEADER_BY_KEY = (() => {
    const map = Object.create(null);
    Object.keys(HEADER_ALIASES).forEach((kind) => {
      HEADER_ALIASES[kind].forEach((alias) => {
        map[alias.toLowerCase()] = kind;
      });
    });
    return map;
  })();

  function createMap() {
    return Object.create(null);
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function uniquePush(arr, value) {
    if (!arr.includes(value)) arr.push(value);
  }

  function splitList(value) {
    return String(value || '')
      .split(/[\s,，、]+/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitSymbols(value) {
    return String(value || '')
      .split(/[\s,，|、]+/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function validateStateName(name) {
    if (typeof name !== 'string' || !name.trim()) return '状态名不能为空。';
    if (name.length > MAX_NAME_LENGTH) return `状态名最多 ${MAX_NAME_LENGTH} 个字符。`;
    if (/\s/u.test(name)) return '状态名不能包含空格。';
    if (/[,，:：;；|>#\-=]/u.test(name)) return '状态名不能包含逗号、冒号、分号、竖线、箭头或连字符。';
    if (!/^[\p{L}\p{N}_.·]+$/u.test(name)) return '状态名只能包含文字、数字、下划线、点或间隔号。';
    return null;
  }

  function validateSymbol(symbol) {
    if (typeof symbol !== 'string' || !symbol.trim()) return '输入字母不能为空。';
    if (symbol.length > MAX_SYMBOL_LENGTH) return `输入字母最多 ${MAX_SYMBOL_LENGTH} 个字符。`;
    if (/\s/u.test(symbol)) return '输入字母不能包含空格。';
    if (/[,，:：;；|>#\-=]/u.test(symbol)) return '输入字母不能包含逗号、冒号、分号、竖线、箭头或连字符。';
    if (symbol === 'ε' || symbol === 'ϵ' || symbol.toLowerCase() === 'epsilon') {
      return 'DFA 不允许 ε 转移，请使用普通输入字母。';
    }
    return null;
  }

  function makeEmptyDfa() {
    return {
      states: [],
      alphabet: [],
      start: '',
      finals: [],
      transitions: createMap()
    };
  }

  function ensureTransitionRow(dfa, state) {
    if (!dfa.transitions) dfa.transitions = createMap();
    if (!hasOwn(dfa.transitions, state)) dfa.transitions[state] = createMap();
    return dfa.transitions[state];
  }

  function cloneDfa(dfa) {
    const out = {
      states: [...(dfa.states || [])],
      alphabet: [...(dfa.alphabet || [])],
      start: dfa.start || '',
      finals: [...(dfa.finals || [])],
      transitions: createMap()
    };
    out.states.forEach((state) => {
      out.transitions[state] = createMap();
      const row = dfa.transitions && dfa.transitions[state] ? dfa.transitions[state] : {};
      out.alphabet.forEach((symbol) => {
        if (hasOwn(row, symbol)) out.transitions[state][symbol] = row[symbol];
      });
    });
    return out;
  }

  function getTarget(dfa, state, symbol) {
    if (!dfa.transitions || !hasOwn(dfa.transitions, state)) return undefined;
    const row = dfa.transitions[state];
    return row && hasOwn(row, symbol) ? row[symbol] : undefined;
  }

  function setTarget(dfa, state, symbol, target) {
    const row = ensureTransitionRow(dfa, state);
    row[symbol] = target;
  }

  function removeTransition(dfa, state, symbol) {
    if (dfa.transitions && hasOwn(dfa.transitions, state)) {
      delete dfa.transitions[state][symbol];
    }
  }

  function reachableFrom(start, transitions) {
    const seen = new Set();
    if (!start) return seen;
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const current = queue.shift();
      const row = transitions && hasOwn(transitions, current) ? transitions[current] : null;
      if (!row) continue;
      Object.keys(row).forEach((symbol) => {
        const next = row[symbol];
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    return seen;
  }

  function countMissingTransitions(dfa) {
    const missing = [];
    dfa.states.forEach((state) => {
      dfa.alphabet.forEach((symbol) => {
        if (getTarget(dfa, state, symbol) === undefined) {
          missing.push({ state, symbol });
        }
      });
    });
    return missing;
  }

  function collectWarnings(dfa) {
    const warnings = [];
    if (!dfa.finals.length) {
      warnings.push('没有终态：该自动机接受空语言 ∅。');
    }
    if (!dfa.alphabet.length) {
      warnings.push('字母表为空。');
    }
    const reachable = reachableFrom(dfa.start, dfa.transitions);
    const unreachable = dfa.states.filter((state) => !reachable.has(state));
    if (unreachable.length) {
      warnings.push(`存在 ${unreachable.length} 个不可达状态：${unreachable.join('、')}。化简时会自动移除。`);
    }
    const missing = countMissingTransitions(dfa);
    if (missing.length) {
      warnings.push(`有 ${missing.length} 个「状态 × 字母」转移缺失。化简时会自动补入陷阱状态。`);
    }
    return warnings;
  }

  function validateDfaShape(dfa) {
    const errors = [];
    if (!dfa || !Array.isArray(dfa.states) || !dfa.states.length) {
      errors.push('自动机至少需要一个状态。');
      return errors;
    }
    if (dfa.states.length > MAX_STATES) {
      errors.push(`最多支持 ${MAX_STATES} 个状态。`);
    }
    const stateSet = new Set();
    dfa.states.forEach((state) => {
      const nameError = validateStateName(state);
      if (nameError) errors.push(nameError);
      if (stateSet.has(state)) errors.push(`状态名「${state}」重复。`);
      stateSet.add(state);
    });
    if (!dfa.start) {
      errors.push('自动机缺少开始状态。');
    } else if (!stateSet.has(dfa.start)) {
      errors.push(`开始状态「${dfa.start}」不在状态集合中。`);
    }
    if (!Array.isArray(dfa.alphabet)) {
      errors.push('字母表格式不正确。');
    } else {
      if (dfa.alphabet.length > MAX_ALPHABET) errors.push(`最多支持 ${MAX_ALPHABET} 个输入字母。`);
      const symbolSet = new Set();
      dfa.alphabet.forEach((symbol) => {
        const symbolError = validateSymbol(symbol);
        if (symbolError) errors.push(symbolError);
        if (symbolSet.has(symbol)) errors.push(`输入字母「${symbol}」重复。`);
        symbolSet.add(symbol);
      });
    }
    const finalSet = new Set();
    (dfa.finals || []).forEach((state) => {
      if (!stateSet.has(state)) errors.push(`终态「${state}」不在状态集合中。`);
      if (finalSet.has(state)) errors.push(`终态「${state}」重复。`);
      finalSet.add(state);
    });
    if (dfa.transitions) {
      Object.keys(dfa.transitions).forEach((from) => {
        if (!stateSet.has(from)) {
          errors.push(`转移起点「${from}」不在状态集合中。`);
          return;
        }
        const row = dfa.transitions[from];
        Object.keys(row || {}).forEach((symbol) => {
          if (!dfa.alphabet.includes(symbol)) {
            errors.push(`转移符号「${symbol}」不在字母表中。`);
          }
          if (!stateSet.has(row[symbol])) {
            errors.push(`转移目标「${row[symbol]}」不在状态集合中。`);
          }
        });
      });
    }
    return [...new Set(errors)];
  }

  function parseTransitionLine(line) {
    let match = line.match(/^([^\s\-]+)\s*-+\s*([^\s\-]+)\s*-+>\s*([^\s\-]+)$/u);
    if (match) {
      return { from: match[1], symbols: splitSymbols(match[2]), to: match[3] };
    }
    // 宽松备用写法：q0 a q1
    match = line.match(/^([^\s\-]+)\s+([^\s\-]+)\s+([^\s\-]+)$/u);
    if (match) {
      return { from: match[1], symbols: splitSymbols(match[2]), to: match[3] };
    }
    return null;
  }

  /**
   * 解析转移表达式。
   * @returns {{ok:boolean, dfa?:object, errors:Array<{line:number,message:string}>, warnings:string[]}}
   */
  function parseDSL(text) {
    const errors = [];
    const warnings = [];
    const source = String(text || '').replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
    const lines = source.split('\n');

    const states = [];
    const stateSet = new Set();
    const alphabet = [];
    const symbolSet = new Set();
    const finals = [];
    const finalSet = new Set();
    const transitionRecords = [];
    const seenHeaders = createMap();
    let start = '';
    let startLine = 0;
    let hasStatesHeader = false;
    let hasAlphabetHeader = false;

    function addState(name, lineNo) {
      const error = validateStateName(name);
      if (error) {
        errors.push({ line: lineNo, message: error });
        return;
      }
      if (stateSet.has(name)) {
        errors.push({ line: lineNo, message: `状态「${name}」重复声明。` });
        return;
      }
      states.push(name);
      stateSet.add(name);
    }

    function addSymbol(symbol, lineNo) {
      const error = validateSymbol(symbol);
      if (error) {
        errors.push({ line: lineNo, message: error });
        return;
      }
      if (symbolSet.has(symbol)) {
        errors.push({ line: lineNo, message: `输入字母「${symbol}」重复声明。` });
        return;
      }
      alphabet.push(symbol);
      symbolSet.add(symbol);
    }

    lines.forEach((rawLine, idx) => {
      const lineNo = idx + 1;
      const line = rawLine.trim();
      if (!line) return;
      if (line.startsWith('#') || line.startsWith('//')) return;

      const headerMatch = line.match(/^([^\s:：=]+)\s*[:：=]\s*(.*)$/u);
      if (headerMatch) {
        const rawKey = headerMatch[1].trim();
        const value = headerMatch[2].trim();
        const kind = HEADER_BY_KEY[rawKey.toLowerCase()];
        if (!kind) {
          errors.push({ line: lineNo, message: `未知字段「${rawKey}」。可用字段：states、alphabet、start、finals、transitions。` });
          return;
        }
        if (kind === 'transitions') {
          if (seenHeaders.transitions) {
            errors.push({ line: lineNo, message: 'transitions 字段重复声明。' });
          }
          seenHeaders.transitions = true;
          if (value) {
            errors.push({ line: lineNo, message: 'transitions: 后请留空，转移写在下一行，例如 q0 -a-> q1。' });
          }
          return;
        }
        if (seenHeaders[kind]) {
          errors.push({ line: lineNo, message: `${rawKey} 字段重复声明。` });
          return;
        }
        seenHeaders[kind] = true;

        if (kind === 'states') {
          const emptyMarkers = new Set(['∅', '无', 'none', '-', '空']);
          const items = splitList(value);
          if (!items.length) errors.push({ line: lineNo, message: 'states 列表不能为空。' });
          hasStatesHeader = true;
          if (!(items.length === 1 && emptyMarkers.has(items[0]))) {
            items.forEach((item) => addState(item, lineNo));
          }
          return;
        }
        if (kind === 'alphabet') {
          const emptyMarkers = new Set(['∅', '无', 'none', '-', '空']);
          const items = splitList(value);
          hasAlphabetHeader = true;
          if (!(items.length === 1 && emptyMarkers.has(items[0]))) {
            items.forEach((item) => addSymbol(item, lineNo));
          }
          return;
        }
        if (kind === 'start') {
          if (!value) {
            errors.push({ line: lineNo, message: 'start 需要一个状态名，例如 start: q0。' });
            return;
          }
          const tokens = splitList(value);
          if (tokens.length !== 1) {
            errors.push({ line: lineNo, message: 'start 只能指定一个开始状态。' });
            return;
          }
          start = tokens[0];
          startLine = lineNo;
          return;
        }
        if (kind === 'finals') {
          const emptyMarkers = new Set(['∅', '无', 'none', '-', '空']);
          if (!value || emptyMarkers.has(value)) return;
          const items = splitList(value);
          items.forEach((item) => {
            const error = validateStateName(item);
            if (error) {
              errors.push({ line: lineNo, message: error });
              return;
            }
            if (!finalSet.has(item)) {
              finals.push(item);
              finalSet.add(item);
            }
          });
          return;
        }
      }

      const transition = parseTransitionLine(line);
      if (!transition) {
        errors.push({
          line: lineNo,
          message: '无法解析这一行。转移请写成 q0 -a-> q1（也支持 q0 a q1）。'
        });
        return;
      }
      if (!transition.symbols.length) {
        errors.push({ line: lineNo, message: '转移缺少输入字母。' });
        return;
      }
      if (!transition.from || !transition.to) {
        errors.push({ line: lineNo, message: '转移的起点或终点为空。' });
        return;
      }
      const fromError = validateStateName(transition.from);
      const toError = validateStateName(transition.to);
      if (fromError) errors.push({ line: lineNo, message: `转移起点：${fromError}` });
      if (toError) errors.push({ line: lineNo, message: `转移终点：${toError}` });
      transition.symbols.forEach((symbol) => {
        const symbolError = validateSymbol(symbol);
        if (symbolError) errors.push({ line: lineNo, message: symbolError });
      });
      transitionRecords.push({ ...transition, lineNo });
    });

    if (!hasStatesHeader) {
      if (start) addState(start, startLine);
      finals.forEach((state) => {
        if (!stateSet.has(state)) addState(state, 0);
      });
      transitionRecords.forEach((record) => {
        if (!stateSet.has(record.from) && !validateStateName(record.from)) addState(record.from, record.lineNo);
        if (!stateSet.has(record.to) && !validateStateName(record.to)) addState(record.to, record.lineNo);
      });
    } else {
      if (start && !stateSet.has(start)) {
        errors.push({ line: startLine, message: `开始状态「${start}」不在 states 列表中。` });
      }
      finals.forEach((state) => {
        if (!stateSet.has(state)) {
          errors.push({ line: 0, message: `终态「${state}」不在 states 列表中。` });
        }
      });
      transitionRecords.forEach((record) => {
        if (!stateSet.has(record.from)) {
          errors.push({ line: record.lineNo, message: `转移起点「${record.from}」未在 states 中声明。` });
        }
        if (!stateSet.has(record.to)) {
          errors.push({ line: record.lineNo, message: `转移终点「${record.to}」未在 states 中声明。` });
        }
      });
    }

    if (!start && !startLine) {
      errors.push({ line: 0, message: '缺少开始状态。请添加一行 start: q0。' });
    }
    if (!hasAlphabetHeader) {
      transitionRecords.forEach((record) => {
        record.symbols.forEach((symbol) => {
          if (!symbolSet.has(symbol) && !validateSymbol(symbol)) {
            alphabet.push(symbol);
            symbolSet.add(symbol);
          }
        });
      });
    } else {
      transitionRecords.forEach((record) => {
        record.symbols.forEach((symbol) => {
          if (!symbolSet.has(symbol) && !validateSymbol(symbol)) {
            errors.push({ line: record.lineNo, message: `转移字母「${symbol}」不在 alphabet 中。` });
          }
        });
      });
    }

    if (states.length > MAX_STATES) {
      errors.push({ line: 0, message: `最多支持 ${MAX_STATES} 个状态，当前有 ${states.length} 个。` });
    }
    if (alphabet.length > MAX_ALPHABET) {
      errors.push({ line: 0, message: `最多支持 ${MAX_ALPHABET} 个输入字母，当前有 ${alphabet.length} 个。` });
    }

    if (errors.length) {
      return { ok: false, errors, warnings: [] };
    }

    const dfa = makeEmptyDfa();
    dfa.states = states;
    dfa.alphabet = alphabet;
    dfa.start = start;
    dfa.finals = finals;
    states.forEach((state) => {
      dfa.transitions[state] = createMap();
    });

    transitionRecords.forEach((record) => {
      if (!stateSet.has(record.from) || !stateSet.has(record.to)) return;
      record.symbols.forEach((symbol) => {
        if (!symbolSet.has(symbol)) return;
        const previous = getTarget(dfa, record.from, symbol);
        if (previous !== undefined && previous !== record.to) {
          errors.push({
            line: record.lineNo,
            message: `冲突：δ(${record.from}, ${symbol}) 同时被定义为 ${previous} 和 ${record.to}。`
          });
          return;
        }
        setTarget(dfa, record.from, symbol, record.to);
      });
    });

    if (errors.length) {
      return { ok: false, errors, warnings: [] };
    }

    warnings.push(...collectWarnings(dfa));
    return { ok: true, dfa, errors: [], warnings };
  }

  function formatDSL(dfa, options = {}) {
    const stateNames = dfa.states || [];
    const alphabet = dfa.alphabet || [];
    const finals = dfa.finals || [];
    const lines = [];
    if (options.comments !== false) {
      lines.push('# DFA 转移表达式');
      if (options.note) lines.push(`# ${options.note}`);
      lines.push('');
    }
    lines.push(`states: ${stateNames.join(', ') || '∅'}`);
    lines.push(`alphabet: ${alphabet.join(', ') || '∅'}`);
    lines.push(`start: ${dfa.start || '∅'}`);
    lines.push(`finals: ${finals.length ? finals.join(', ') : '∅'}`);
    lines.push('');
    if (options.comments !== false) {
      lines.push('# 转移：起点 -输入字母-> 终点');
    }
    stateNames.forEach((state) => {
      alphabet.forEach((symbol) => {
        const target = getTarget(dfa, state, symbol);
        if (target !== undefined) {
          lines.push(`${state} -${symbol}-> ${target}`);
        }
      });
    });
    return lines.join('\n');
  }

  function generateSinkName(taken) {
    const base = 'sink';
    if (!taken.has(base)) return base;
    let index = 1;
    while (taken.has(`${base}${index}`)) index += 1;
    return `${base}${index}`;
  }

  /**
   * 补全缺失转移、剔除不可达状态，生成真正参与最小化的完整 DFA。
   * augmented 保留不可达状态以便图中对照；working 只含可达状态（可能含 sink）。
   */
  function prepareDFA(dfa) {
    const errors = validateDfaShape(dfa);
    if (errors.length) throw new Error(errors[0]);

    const base = cloneDfa(dfa);
    const reachableSet = reachableFrom(base.start, base.transitions);
    const reachableStates = base.states.filter((state) => reachableSet.has(state));
    const unreachable = base.states.filter((state) => !reachableSet.has(state));
    const missing = [];
    reachableStates.forEach((state) => {
      base.alphabet.forEach((symbol) => {
        if (getTarget(base, state, symbol) === undefined) {
          missing.push({ state, symbol });
        }
      });
    });

    const augmented = cloneDfa(base);
    let sinkName = '';
    if (missing.length) {
      sinkName = generateSinkName(new Set(base.states));
      augmented.states.push(sinkName);
      augmented.transitions[sinkName] = createMap();
      augmented.alphabet.forEach((symbol) => {
        augmented.transitions[sinkName][symbol] = sinkName;
      });
      missing.forEach(({ state, symbol }) => {
        setTarget(augmented, state, symbol, sinkName);
      });
    }

    const workingStates = [...reachableStates];
    if (sinkName) workingStates.push(sinkName);
    const working = {
      states: workingStates,
      alphabet: [...base.alphabet],
      start: base.start,
      finals: base.finals.filter((state) => reachableSet.has(state)),
      transitions: createMap()
    };
    workingStates.forEach((state) => {
      working.transitions[state] = createMap();
      base.alphabet.forEach((symbol) => {
        const target = getTarget(augmented, state, symbol);
        if (target !== undefined) working.transitions[state][symbol] = target;
      });
    });

    return {
      base,
      augmented,
      working,
      reachableStates,
      unreachable,
      missing,
      missingCount: missing.length,
      sinkName
    };
  }

  function pairKey(i, j) {
    return i < j ? `${i}:${j}` : `${j}:${i}`;
  }

  function makeClassesFromMarks(states, finals, marks) {
    const parent = states.map((_, i) => i);
    function find(x) {
      let root = x;
      while (parent[root] !== root) root = parent[root];
      while (parent[x] !== x) {
        const next = parent[x];
        parent[x] = root;
        x = next;
      }
      return root;
    }
    function union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return;
      if (ra < rb) parent[rb] = ra;
      else parent[ra] = rb;
    }
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        if (!marks.has(pairKey(i, j))) union(i, j);
      }
    }
    const groups = new Map();
    states.forEach((state, index) => {
      const root = find(index);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(index);
    });
    const finalSet = new Set(finals);
    const ordered = [...groups.values()].sort((a, b) => a[0] - b[0]);
    const labels = ordered.map((_, index) => {
      const letter = String.fromCharCode(65 + (index % 26));
      const suffix = index >= 26 ? Math.floor(index / 26) : '';
      return `${letter}${suffix}`;
    });
    const memberOf = createMap();
    ordered.forEach((members, classIndex) => {
      members.forEach((memberIndex) => {
        memberOf[states[memberIndex]] = classIndex;
      });
    });
    const classes = ordered.map((members, index) => {
      const memberStates = members.map((memberIndex) => states[memberIndex]);
      return {
        label: labels[index],
        index,
        members,
        memberStates,
        isStart: false,
        isFinal: memberStates.some((state) => finalSet.has(state))
      };
    });
    return { classes, labels, memberOf };
  }

  function makeMinimalDfa(classes, labels, alphabet, transitions, memberOf, start) {
    const startClass = classes.find((cls) => cls.memberStates.includes(start));
    if (!startClass) throw new Error('找不到开始状态对应的等价类。');
    const minimal = {
      states: [...labels],
      alphabet: [...alphabet],
      start: startClass.label,
      finals: classes.filter((cls) => cls.isFinal).map((cls) => cls.label),
      transitions: createMap()
    };
    classes.forEach((cls) => {
      const row = createMap();
      const representative = cls.memberStates[0];
      alphabet.forEach((symbol) => {
        const target = transitions[representative][symbol];
        const targetClassIndex = memberOf[target];
        row[symbol] = labels[targetClassIndex];
      });
      minimal.transitions[cls.label] = row;
    });
    return minimal;
  }

  function listPreview(items, limit = 5) {
    if (items.length <= limit) return items.join('、');
    return `${items.slice(0, limit).join('、')} 等 ${items.length} 项`;
  }

  /**
   * 标记法（区分表法）完整推演。
   * @returns 完整分析结果与逐步动画数据。
   */
  function analyzeDFA(rawDfa) {
    const prep = prepareDFA(rawDfa);
    const { working, augmented } = prep;
    const states = [...working.states];
    const alphabet = [...working.alphabet];
    const n = states.length;
    const indexOf = new Map(states.map((state, index) => [state, index]));
    const finalSet = new Set(working.finals);
    const marks = new Set();
    const initialMarked = new Set();
    const steps = [];
    const pairCount = (n * (n - 1)) / 2;

    function addStep(step) {
      steps.push({ id: steps.length, ...step });
    }

    addStep({
      kind: 'info',
      phase: 'setup',
      title: '开始化简',
      detail: `采用标记法：先区分终态与非终态，再根据输入字母逐步标记可区分的状态对，最后合并所有未标记对。`,
      hint: '每一格都是一个状态对 (p, q)。'
    });

    if (prep.missingCount) {
      addStep({
        kind: 'info',
        phase: 'setup',
        title: '补全缺失转移',
        detail: `检测到 ${prep.missingCount} 处转移缺失，已引入陷阱状态「${prep.sinkName}」；它会对所有输入回到自身。`,
        tone: 'warning'
      });
    }
    if (prep.unreachable.length) {
      addStep({
        kind: 'info',
        phase: 'setup',
        title: '移除不可达状态',
        detail: `状态 ${listPreview(prep.unreachable)} 无法从开始状态到达，不参与最小化。`,
        tone: 'warning'
      });
    }
    addStep({
      kind: 'info',
      phase: 'initialize',
      title: '建立区分表',
      detail: `对 ${n} 个可达状态两两配对，共 ${pairCount} 对。终态标记为 ◎，其余为非终态。`,
      hint: pairCount ? '接下来逐对标记必然可区分的状态。' : '只有一个可达状态，区分表为空。'
    });

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const first = states[i];
        const second = states[j];
        const firstFinal = finalSet.has(first);
        const secondFinal = finalSet.has(second);
        if (firstFinal !== secondFinal) {
          const key = pairKey(i, j);
          marks.add(key);
          initialMarked.add(key);
          const finalState = firstFinal ? first : second;
          const nonFinalState = firstFinal ? second : first;
          addStep({
            kind: 'mark',
            phase: 'initialize',
            round: 0,
            pairIndices: [i, j],
            pair: [first, second],
            pairKey: key,
            category: 'initial',
            title: `初始标记 (${first}, ${second})`,
            detail: `${finalState} 是终态，${nonFinalState} 不是终态：到达它们之后的接受结果已经不同，所以这一对必然可区分。`
          });
        }
      }
    }

    let round = 0;
    const roundSummaries = [];
    while (true) {
      round += 1;
      const previousMarks = new Set(marks);
      const discoveries = [];
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          const key = pairKey(i, j);
          if (previousMarks.has(key)) continue;
          const first = states[i];
          const second = states[j];
          for (const symbol of alphabet) {
            const firstTarget = working.transitions[first][symbol];
            const secondTarget = working.transitions[second][symbol];
            if (firstTarget === secondTarget) continue;
            const firstTargetIndex = indexOf.get(firstTarget);
            const secondTargetIndex = indexOf.get(secondTarget);
            const targetKey = pairKey(firstTargetIndex, secondTargetIndex);
            if (previousMarks.has(targetKey)) {
              discoveries.push({
                i,
                j,
                key,
                symbol,
                first,
                second,
                firstTarget,
                secondTarget,
                firstTargetIndex,
                secondTargetIndex,
                targetKey
              });
              break;
            }
          }
        }
      }
      if (!discoveries.length) {
        round -= 1;
        break;
      }
      roundSummaries.push({ round, discovered: discoveries.length });
      discoveries.forEach((found) => {
        marks.add(found.key);
        addStep({
          kind: 'mark',
          phase: 'scan',
          round,
          pairIndices: [found.i, found.j],
          pair: [found.first, found.second],
          pairKey: found.key,
          category: 'iteration',
          symbol: found.symbol,
          witness: [found.firstTarget, found.secondTarget],
          witnessPairIndices: [found.firstTargetIndex, found.secondTargetIndex],
          witnessPairKey: found.targetKey,
          title: `第 ${round} 轮 · 标记 (${found.first}, ${found.second})`,
          detail: `输入 ${found.symbol} 时，${found.first} → ${found.firstTarget}，${found.second} → ${found.secondTarget}。而 (${found.firstTarget}, ${found.secondTarget}) 已经可区分，所以 (${found.first}, ${found.second}) 也可区分。`
        });
      });
    }

    // 找到全部等价对
    const equivalentPairs = [];
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const key = pairKey(i, j);
        if (!marks.has(key)) {
          equivalentPairs.push({ key, indices: [i, j], states: [states[i], states[j]] });
        }
      }
    }

    addStep({
      kind: 'info',
      phase: 'finalize',
      title: '区分表稳定',
      detail: round
        ? `共进行 ${round} 轮扫描，标记了 ${marks.size} 对可区分状态；剩余 ${equivalentPairs.length} 对状态无法区分。`
        : `初始标记后已没有新的区分证据；剩余 ${equivalentPairs.length} 对状态无法区分。`,
      hint: '下一阶段：把等价状态合并成等价类。'
    });

    // 合并等价类：标记法结束后未标记对构成等价关系
    const built = makeClassesFromMarks(states, working.finals, marks);
    let classes = built.classes;
    classes.forEach((cls) => {
      cls.isStart = cls.memberStates.includes(working.start);
    });
    const minimal = makeMinimalDfa(classes, built.labels, alphabet, working.transitions, built.memberOf, working.start);

    const mergeClasses = classes.filter((cls) => cls.members.length > 1);
    if (mergeClasses.length) {
      mergeClasses.forEach((cls) => {
        addStep({
          kind: 'merge',
          phase: 'merge',
          classIndex: cls.index,
          classLabel: cls.label,
          group: cls.memberStates,
          groupIndices: cls.members,
          title: `合并等价类 ${cls.label}`,
          detail: `${cls.memberStates.join(' ≡ ')}，它们两两不可区分，合并为状态 ${cls.label}。`,
          hint: cls.isStart ? '该等价类包含开始状态。' : (cls.isFinal ? '该等价类包含终态。' : '')
        });
      });
    } else {
      addStep({
        kind: 'info',
        phase: 'merge',
        title: '无需合并',
        detail: '每一个等价类都只包含一个状态，原自动机已经是最小的。',
      });
    }

    addStep({
      kind: 'result',
      phase: 'result',
      title: '最小 DFA 生成完毕',
      detail: `${states.length} 个可达状态 → ${classes.length} 个等价类。${prep.unreachable.length ? `另有 ${prep.unreachable.length} 个不可达状态被移除。` : ''}${prep.sinkName ? ' 包含自动补全的陷阱状态。' : ''}`,
      hint: '红框中的状态对已区分；未被标记的等价状态已合并。',
      classes,
      minimal
    });

    return {
      raw: cloneDfa(rawDfa),
      preparation: prep,
      augmented,
      working,
      states,
      alphabet,
      indexOf,
      n,
      pairCount,
      steps,
      marks,
      initialMarked,
      equivalentPairs,
      rounds: roundSummaries,
      classes,
      minimal,
      stats: {
        originalStates: rawDfa.states.length,
        reachableStates: states.length,
        minimalStates: classes.length,
        initialPairsMarked: initialMarked.size,
        totalMarkedPairs: marks.size,
        equivalentPairs: equivalentPairs.length,
        unreachableRemoved: prep.unreachable.length,
        missingCompleted: prep.missingCount,
        sinkName: prep.sinkName,
        mergedClasses: mergeClasses.length,
        rounds: roundSummaries.length
      }
    };
  }

  function getTablePairs(states) {
    const pairs = [];
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        pairs.push({ i, j, key: pairKey(i, j) });
      }
    }
    return pairs;
  }

  function buildResultDSL(analysis) {
    const labelToMembers = createMap();
    analysis.classes.forEach((cls) => {
      labelToMembers[cls.label] = cls.memberStates;
    });
    const mappingLines = analysis.classes
      .map((cls) => `# ${cls.label} = { ${cls.memberStates.join(', ')} }${cls.isStart ? '  ← 开始状态' : ''}${cls.isFinal ? '  ← 终态' : ''}`)
      .join('\n');
    return `${mappingLines}\n\n${formatDSL(analysis.minimal, { note: '标记法最小化结果' })}`;
  }

  return {
    MAX_STATES,
    MAX_ALPHABET,
    MAX_NAME_LENGTH,
    MAX_SYMBOL_LENGTH,
    parseDSL,
    formatDSL,
    buildResultDSL,
    prepareDFA,
    analyzeDFA,
    validateDfaShape,
    validateStateName,
    validateSymbol,
    collectWarnings,
    countMissingTransitions,
    reachableFrom,
    cloneDfa,
    makeEmptyDfa,
    getTarget,
    setTarget,
    removeTransition,
    ensureTransitionRow,
    pairKey,
    getTablePairs,
    splitList,
    splitSymbols
  };
});
