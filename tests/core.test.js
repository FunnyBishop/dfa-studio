/* Node test runner: node tests/core.test.js */
'use strict';

const assert = require('node:assert/strict');
const core = require('../js/core.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.stack ? error.stack.split('\n').slice(0, 5).join('\n    ') : error.message}`);
  }
}

function parse(dsl) {
  const result = core.parseDSL(dsl);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result;
}

function makeRandomDfa(seed, count, alphabetSize, finalDensity = 0.3) {
  let value = seed >>> 0;
  function random() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  }
  const states = Array.from({ length: count }, (_, index) => `s${index}`);
  const alphabet = Array.from({ length: alphabetSize }, (_, index) => String.fromCharCode(97 + index));
  const transitions = Object.create(null);
  states.forEach((from) => {
    transitions[from] = Object.create(null);
    alphabet.forEach((symbol) => {
      transitions[from][symbol] = states[Math.floor(random() * count)];
    });
  });
  const finals = states.filter(() => random() < finalDensity);
  return {
    states,
    alphabet,
    start: states[0],
    finals,
    transitions
  };
}

function referencePairs(dfa) {
  const { states, alphabet, finals, transitions } = dfa;
  const finalSet = new Set(finals);
  const marked = new Set();
  const keyOf = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (let i = 0; i < states.length; i += 1) {
    for (let j = i + 1; j < states.length; j += 1) {
      if (finalSet.has(states[i]) !== finalSet.has(states[j])) marked.add(keyOf(i, j));
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        const key = keyOf(i, j);
        if (marked.has(key)) continue;
        for (const symbol of alphabet) {
          const a = states.indexOf(transitions[states[i]][symbol]);
          const b = states.indexOf(transitions[states[j]][symbol]);
          if (a === b) continue;
          if (marked.has(keyOf(a, b))) {
            marked.add(key);
            changed = true;
            break;
          }
        }
      }
    }
  }
  return marked;
}

function reachableCount(dfa) {
  return core.reachableFrom(dfa.start, dfa.transitions).size;
}

function countReferenceClasses(states, marked) {
  const parent = states.map((_, index) => index);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }
  for (let i = 0; i < states.length; i += 1) {
    for (let j = i + 1; j < states.length; j += 1) {
      if (!marked.has(core.pairKey(i, j))) union(i, j);
    }
  }
  return new Set(states.map((_, index) => find(index))).size;
}

console.log('\nDFACore tests\n');

test('parses headers, comments and arrow transitions', () => {
  const { dfa, warnings } = parse(`# demo
states: q0, q1, q2
alphabet: a b
start: q0
finals: q2

q0 -a-> q1
q0 -b-> q0
q1 -a-> q2
q1 -b-> q0
q2 -a-> q2
q2 -b-> q2`);
  assert.deepEqual(dfa.states, ['q0', 'q1', 'q2']);
  assert.deepEqual(dfa.alphabet, ['a', 'b']);
  assert.equal(dfa.start, 'q0');
  assert.deepEqual(dfa.finals, ['q2']);
  assert.equal(core.getTarget(dfa, 'q1', 'a'), 'q2');
  assert.deepEqual(warnings, []);
});

test('supports compact arrow and three-token transition forms', () => {
  const compact = parse(`start:q0\nfinals:q1\nq0-a->q1\nq1-a->q0`).dfa;
  assert.equal(core.getTarget(compact, 'q0', 'a'), 'q1');
  const spaced = parse(`start: q0\nfinals: q1\nq0 a q1\nq1 a q0`).dfa;
  assert.equal(core.getTarget(spaced, 'q1', 'a'), 'q0');
});

test('infers states and alphabet when declarations are omitted', () => {
  const { dfa } = parse(`start: odd
finals: even
odd -x-> even
even -x-> odd
even -y-> even`);
  assert.deepEqual(dfa.states, ['odd', 'even']);
  assert.deepEqual(dfa.alphabet, ['x', 'y']);
  assert.deepEqual(dfa.finals, ['even']);
});

test('supports multiple symbols in one transition and full-width punctuation', () => {
  const { dfa } = parse(`states：a b c
alphabet：x，y
start：a
finals：c
a -x,y-> b
b -x-> c
b -y-> a
c -x,y-> c`);
  assert.equal(core.getTarget(dfa, 'a', 'x'), 'b');
  assert.equal(core.getTarget(dfa, 'a', 'y'), 'b');
  assert.deepEqual(dfa.alphabet, ['x', 'y']);
});

test('allows an empty finals list', () => {
  const { dfa, warnings } = parse(`states: a b
alphabet: 0
start: a
finals: ∅
a -0-> b
b -0-> a`);
  assert.deepEqual(dfa.finals, []);
  assert(warnings.some((warning) => warning.includes('没有终态')));
});

test('reports duplicate and conflicting transitions with line numbers', () => {
  const duplicate = core.parseDSL(`states: a b c
alphabet: 0
start: a
finals: c
a -0-> b
a -0-> c
b -0-> a
c -0-> c`);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.errors[0].line, 6);
  assert(duplicate.errors[0].message.includes('冲突'));

  const unknown = core.parseDSL(`states: a b
alphabet: 0
start: a
finals: b
a -0-> x`);
  assert.equal(unknown.ok, false);
  assert(unknown.errors.some((error) => error.message.includes('未在 states')));
});

test('rejects invalid names, symbols and epsilon', () => {
  const badName = core.parseDSL(`states: q@0\nstart: q@0\nfinals: q@0\nq@0 -a-> q@0`);
  assert.equal(badName.ok, false);
  const badSymbol = core.parseDSL(`states: a\nstart: a\nfinals: a\na -ε-> a`);
  assert.equal(badSymbol.ok, false);
  assert(badSymbol.errors.some((error) => error.message.includes('ε')));
});

test('marks every distinguishable pair for a canonical language', () => {
  const { dfa } = parse(`states: A B C D
alphabet: 0 1
start: A
finals: D
A -0-> B
A -1-> C
B -0-> A
B -1-> D
C -0-> D
C -1-> A
D -0-> D
D -1-> D`);
  const analysis = core.analyzeDFA(dfa);
  assert.equal(analysis.pairCount, 6);
  assert.equal(analysis.marks.size, 6);
  assert.equal(analysis.classes.length, 4);
  assert.equal(analysis.stats.mergedClasses, 0);
  assert.equal(analysis.minimal.states.length, 4);
  assert.deepEqual(analysis.minimal.finals, ['D']);
});

test('merges equivalent states and builds a consistent quotient DFA', () => {
  const { dfa } = parse(`states: q0 q1 q2 q3 q4 q5
alphabet: a b
start: q0
finals: q3 q4
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
q5 -b-> q5`);
  const analysis = core.analyzeDFA(dfa);
  assert.equal(analysis.stats.originalStates, 6);
  assert.equal(analysis.stats.minimalStates, 4);
  assert.equal(analysis.stats.mergedClasses, 2);
  const grouped = analysis.classes.map((cls) => cls.memberStates.join('+')).sort();
  assert.deepEqual(grouped, ['q0', 'q1+q2', 'q3+q4', 'q5']);
  assert.equal(analysis.minimal.start, 'A');
  assert.deepEqual(analysis.minimal.finals, ['C']);
  // Every class transition must lead to a class whose member is the target of any representative.
  analysis.classes.forEach((cls) => {
    const from = cls.memberStates[0];
    dfa.alphabet.forEach((symbol) => {
      const actual = core.getTarget(dfa, from, symbol);
      const clsTarget = analysis.minimal.transitions[cls.label][symbol];
      const targetClass = analysis.classes.find((item) => item.label === clsTarget);
      assert(targetClass.memberStates.includes(actual));
    });
  });
});

test('matches a naive fixed-point table-filling reference on random DFAs', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const dfa = makeRandomDfa(seed, 3 + (seed % 6), 1 + (seed % 3), (seed % 7) / 10);
    const analysis = core.analyzeDFA(dfa);
    // Unreachable states are deliberately removed before table filling,
    // so the reference must run on the same reachable automaton.
    const expected = referencePairs(analysis.working);
    assert.equal(analysis.marks.size, expected.size, `marked count for seed ${seed}`);
    for (let i = 0; i < analysis.working.states.length; i += 1) {
      for (let j = i + 1; j < analysis.working.states.length; j += 1) {
        const key = core.pairKey(i, j);
        assert.equal(analysis.marks.has(key), expected.has(key), `pair ${i},${j} seed ${seed}`);
      }
    }
    assert.equal(
      analysis.classes.length,
      countReferenceClasses(analysis.working.states, expected),
      `class count for seed ${seed}`
    );
    const reachable = reachableCount(dfa);
    assert.equal(analysis.states.length, reachable);
    assert.equal(analysis.minimal.states.length, analysis.classes.length);
  }
});

test('completes missing transitions with a reachable sink', () => {
  const { dfa, warnings } = parse(`states: A B C
alphabet: 0 1
start: A
finals: B
A -0-> B
B -0-> B
B -1-> A
C -0-> A
C -1-> B`);
  assert(warnings.some((warning) => warning.includes('缺失')));
  const analysis = core.analyzeDFA(dfa);
  const sink = analysis.preparation.sinkName;
  assert.equal(sink, 'sink');
  assert(analysis.working.states.includes(sink));
  assert.equal(core.getTarget(analysis.working, sink, '0'), sink);
  assert.equal(core.getTarget(analysis.working, 'A', '1'), sink);
  assert.deepEqual(analysis.preparation.unreachable, ['C']);
  assert.equal(analysis.stats.unreachableRemoved, 1);
  assert.equal(analysis.stats.minimalStates, 3);
});

test('removes unreachable states before table filling', () => {
  const { dfa } = parse(`states: s0 s1 s2 s3
alphabet: a b
start: s0
finals: s1
s0 -a-> s1
s0 -b-> s0
s1 -a-> s1
s1 -b-> s0
s2 -a-> s3
s2 -b-> s2
s3 -a-> s3
s3 -b-> s3`);
  const analysis = core.analyzeDFA(dfa);
  assert.deepEqual(analysis.states.sort(), ['s0', 's1']);
  assert.deepEqual(analysis.preparation.unreachable, ['s2', 's3']);
  assert.equal(analysis.pairCount, 1);
  assert.equal(analysis.stats.minimalStates, 2);
});

test('handles one reachable state and empty table', () => {
  const { dfa } = parse(`states: only
alphabet: a b
start: only
finals: only
only -a-> only
only -b-> only`);
  const analysis = core.analyzeDFA(dfa);
  assert.equal(analysis.pairCount, 0);
  assert.equal(analysis.classes.length, 1);
  assert.deepEqual(analysis.minimal.states, ['A']);
  assert.deepEqual(analysis.minimal.finals, ['A']);
  assert(analysis.steps.some((step) => step.kind === 'result'));
});

test('merges all states when every state has the same finality', () => {
  const { dfa } = parse(`states: q0 q1 q2
alphabet: a
start: q0
finals: ∅
q0 -a-> q1
q1 -a-> q2
q2 -a-> q0`);
  const analysis = core.analyzeDFA(dfa);
  assert.equal(analysis.classes.length, 1);
  assert.equal(analysis.marks.size, 0);
  const allFinal = parse(`states: q0 q1
alphabet: a
start: q0
finals: q0 q1
q0 -a-> q1
q1 -a-> q0`).dfa;
  assert.equal(core.analyzeDFA(allFinal).classes.length, 1);
});

test('supports an empty alphabet and removes states unreachable without symbols', () => {
  const dfa = {
    states: ['x', 'y'],
    alphabet: [],
    start: 'x',
    finals: ['y'],
    transitions: { x: Object.create(null), y: Object.create(null) }
  };
  const analysis = core.analyzeDFA(dfa);
  assert.deepEqual(analysis.states, ['x']);
  assert.equal(analysis.pairCount, 0);
  assert.equal(analysis.classes.length, 1);
  assert.equal(analysis.minimal.start, 'A');
  assert.deepEqual(analysis.minimal.finals, []);
  assert.deepEqual(analysis.augmented.states, ['x', 'y']);
});

test('formats deterministic DSL and can round-trip its output', () => {
  const { dfa } = parse(`states: x y
alphabet: 0 1
start: x
finals: y
x -0-> x
x -1-> y
y -0-> x
y -1-> y`);
  const text = core.formatDSL(dfa);
  const again = core.parseDSL(text);
  assert.equal(again.ok, true);
  assert.deepEqual(again.dfa.states, dfa.states);
  assert.deepEqual(again.dfa.alphabet, dfa.alphabet);
  assert.deepEqual(again.dfa.finals, dfa.finals);
});

test('parses the blank template with an empty alphabet marker', () => {
  const parsed = core.parseDSL(`states: q0
alphabet: ∅
start: q0
finals: ∅`);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.dfa.states, ['q0']);
  assert.deepEqual(parsed.dfa.alphabet, []);
  assert.deepEqual(parsed.dfa.finals, []);
  const roundTrip = core.parseDSL(core.formatDSL(parsed.dfa));
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.dfa.alphabet, []);
});

test('buildResultDSL includes the equivalence-class map', () => {
  const { dfa } = parse(`states: q0 q1 q2 q3 q4 q5
alphabet: a b
start: q0
finals: q3 q4
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
q5 -b-> q5`);
  const analysis = core.analyzeDFA(dfa);
  const text = core.buildResultDSL(analysis);
  assert(text.includes('# B = { q1, q2 }'));
  assert(text.includes('# C = { q3, q4 }'));
  const parsedBack = core.parseDSL(text);
  assert.equal(parsedBack.ok, true);
  assert.equal(parsedBack.dfa.states.length, 4);
});

test('generates a unique sink name if the user already has "sink"', () => {
  const { dfa } = parse(`states: sink q1
alphabet: 0 1
start: sink
finals: q1
sink -0-> q1
q1 -0-> q1`);
  const analysis = core.analyzeDFA(dfa);
  assert.equal(analysis.preparation.sinkName, 'sink1');
  assert(analysis.working.states.includes('sink1'));
});

test('rejects excessive state counts and invalid starts', () => {
  const many = Array.from({ length: 21 }, (_, index) => `s${index}`);
  const dsl = `states: ${many.join(' ')}\nalphabet: a\nstart: s0\nfinals: s1\ns0 -a-> s0`;
  const parsed = core.parseDSL(dsl);
  assert.equal(parsed.ok, false);
  assert(parsed.errors.some((error) => error.message.includes('最多支持')));
});

test('sample list is parseable and every example minimizes successfully', () => {
  // Keep in sync with the user-facing samples (duplicated intentionally so tests do not touch the DOM).
  const samples = [
    `states: q0, q1, q2, q3, q4, q5
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
    `states: r0, r1, r2
alphabet: 0, 1
start: r0
finals: r0
r0 -0-> r0
r0 -1-> r1
r1 -0-> r2
r1 -1-> r0
r2 -0-> r1
r2 -1-> r2`,
    `states: s0, s1, s2, s3
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
    `states: q0, q1, q2
alphabet: 0, 1
start: q0
finals: q2
q0 -0-> q1
q1 -0-> q2
q1 -1-> q0
q2 -0-> q2`,
    `states: q0
alphabet: ∅
start: q0
finals: ∅`
  ];
  samples.forEach((sample) => {
    const parsed = parse(sample);
    const analysis = core.analyzeDFA(parsed.dfa);
    assert(analysis.steps.length > 0);
    assert(analysis.minimal.states.length >= 1);
  });
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
