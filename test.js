/* Test suite for svg-grid-builder.
 *
 * Rather than importing the app (it is one self-contained HTML file with no
 * module boundary), this pulls the real functions and the real keydown
 * listener out of index.html by their source text and exercises those. That
 * way the tests run against shipped code, not a retyped copy that could
 * silently drift away from it.
 *
 * Run with:  node test.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
const src = fs.readFileSync(file, 'utf8');

function slice(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to);
  if (a < 0) throw new Error(`marker not found: ${from}`);
  if (b < 0) throw new Error(`marker not found: ${to}`);
  if (b <= a) throw new Error(`bad order: ${from} / ${to}`);
  return src.slice(a, b);
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? '  -> ' + extra : ''}`); }
}

/* ---- 1. SVG writer -------------------------------------------------- */
const svgCode = slice('  function mergedRects()', '  function updateOutput()');
const makeSvg = new Function('S', svgCode + '\nreturn { mergedRects, buildSVG };');

function grid(cols, rows, filled) {
  const cells = new Array(cols * rows).fill('');
  for (const [x, y, c] of filled) cells[y * cols + x] = c;
  return { cols, rows, cells };
}
function rectsOf(g) {
  const { mergedRects } = makeSvg(g);
  const out = [];
  for (const [color, list] of mergedRects()) {
    for (const r of list) out.push({ color, ...r });
  }
  return out;
}
const key = r => `${r.color} ${r.x},${r.y} ${r.w}x${r.h}`;

console.log('\nSVG merge pass');

let r = rectsOf(grid(4, 4, []));
check('empty grid emits no rects', r.length === 0);

r = rectsOf(grid(4, 4, []).cells.map(() => 0) && grid(4, 4,
  [0,1,2,3].flatMap(x => [0,1,2,3].map(y => [x, y, '#f00']))));
check('solid 4x4 collapses to exactly 1 rect',
  r.length === 1 && r[0].w === 4 && r[0].h === 4, JSON.stringify(r.map(key)));

r = rectsOf(grid(6, 3, [[0,0,'#f00'], [1,0,'#f00'], [2,0,'#f00']]));
check('horizontal run of 3 -> 1 rect 3x1',
  r.length === 1 && r[0].w === 3 && r[0].h === 1, JSON.stringify(r.map(key)));

r = rectsOf(grid(6, 4, [
  [1,1,'#0f0'], [2,1,'#0f0'], [3,1,'#0f0'],
  [1,2,'#0f0'], [2,2,'#0f0'], [3,2,'#0f0'],
]));
check('identical runs stack vertically -> 1 rect 3x2',
  r.length === 1 && r[0].w === 3 && r[0].h === 2, JSON.stringify(r.map(key)));

r = rectsOf(grid(2, 2, [[0,0,'#111'], [1,1,'#111']]));
check('diagonal cells stay separate (2 rects)', r.length === 2, JSON.stringify(r.map(key)));

// checkerboard: same colour is vertically adjacent, so the vertical pass
// collapses each column into one 1x2 bar -> 2 rects, not 4.
r = rectsOf(grid(2, 2, [[0,0,'#f00'], [1,0,'#00f'], [0,1,'#f00'], [1,1,'#00f']]));
check('checkerboard 2x2 -> 2 vertical bars',
  r.length === 2 && r.every(x => x.w === 1 && x.h === 2), JSON.stringify(r.map(key)));

// genuinely alternating, nothing adjacent: no merge possible
r = rectsOf(grid(3, 3, [
  [0,0,'#f00'], [1,1,'#f00'], [2,2,'#f00'],
]));
check('isolated diagonal-only cells -> 3 rects', r.length === 3, JSON.stringify(r.map(key)));

r = rectsOf(grid(4, 4, [
  [0,0,'#abc'], [1,0,'#abc'],
  [0,1,'#abc'],
]));
check('L-shape -> 2 rects', r.length === 2, JSON.stringify(r.map(key)));

r = rectsOf(grid(4, 4, [
  [0,0,'#abc'], [1,0,'#abc'],
  [0,1,'#abc'], [1,1,'#abc'], [2,1,'#abc'],
]));
check('wider row below blocks the merge (no over-merge)',
  r.length === 2, JSON.stringify(r.map(key)));

/* colour separation */
r = rectsOf(grid(3, 1, [[0,0,'#f00'], [1,0,'#00f'], [2,0,'#f00']]));
check('same colour separated by another colour stays split',
  r.length === 3, JSON.stringify(r.map(key)));

/* merged output must be no worse than one-rect-per-cell */
const big = [];
for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) big.push([x, y, '#123456']);
const solid32 = rectsOf(grid(32, 32, big));
check('32x32 solid: 1024 cells -> 1 rect (1024x fewer)',
  solid32.length === 1, `${solid32.length} rects`);

/* union check: merged area must equal the filled area, and never overlap */
function areaCheck(g, label) {
  const rs = rectsOf(g);
  const want = g.cells.filter(Boolean).length;
  const got = rs.reduce((n, x) => n + x.w * x.h, 0);
  const seen = new Set();
  let overlap = false;
  for (const x of rs) {
    for (let i = 0; i < x.w; i++) for (let j = 0; j < x.h; j++) {
      const k = `${x.x + i},${x.y + j}`;
      if (seen.has(k)) overlap = true;
      seen.add(k);
    }
  }
  check(`${label}: area preserved and no overlaps`,
    want === got && !overlap && seen.size === want,
    `want ${want}, got ${got}, overlap ${overlap}, unique ${seen.size}`);
}
areaCheck(grid(8, 8, (() => {
  const f = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    if ((x * 7 + y * 3) % 5 < 2) f.push([x, y, (x + y) % 2 ? '#111' : '#222']);
  }
  return f;
})()), 'pseudo-random 8x8');

/* SVG document shape */
const { buildSVG } = makeSvg(grid(3, 2, [[0,0,'#ff0000']]));
const doc = buildSVG();
check('svg has xml declaration-free root with viewBox', doc.startsWith('<svg ') && doc.includes('viewBox="0 0 3 2"'));
check('svg declares crispEdges', doc.includes('shape-rendering="crispEdges"'));
check('svg closes', doc.trim().endsWith('</svg>'));
check('svg groups by colour', doc.includes('<g fill="#ff0000">'));
check('svg rect uses merged w/h', doc.includes('<rect x="0" y="0" width="1" height="1"/>'));
check('empty grid still yields valid svg',
  (() => { const d = makeSvg(grid(2,2,[])).buildSVG; return d().startsWith('<svg ') && d().includes('</svg>'); })());

/* ---- 2. JSON load validation ---------------------------------------- */
console.log('\nJSON load');
const jsonCode = slice('  function applyGrid(', '  function loadLocal()');
function makeLoader() {
  const S = { cols: 0, rows: 0, cells: [] };
  const fns = new Function('S', 'HEX_RE', 'syncSizeInputs', 'buildGrid', 'schedule',
    jsonCode + '\nreturn { loadJSON };')(
    S, /^#([0-9a-f]{3}|[0-9a-f]{6})$/i, () => {}, () => {}, () => {});
  return { S, loadJSON: fns.loadJSON };
}

let L = makeLoader();
L.loadJSON(JSON.stringify({ width: 2, height: 2, pixels: ['#ff0000', null, '', '#0f0'] }));
check('valid grid loads', L.S.cols === 2 && L.S.rows === 2 && L.S.cells.length === 4);
check('null and "" both become empty', L.S.cells[1] === '' && L.S.cells[2] === '');
check('short hex lowercased', L.S.cells[3] === '#0f0');

const bad = [
  ['wrong pixel count', { width: 2, height: 2, pixels: ['#fff'] }],
  ['zero width', { width: 0, height: 2, pixels: [] }],
  ['oversized grid', { width: 999, height: 2, pixels: [] }],
  ['non-integer size', { width: 2.5, height: 2, pixels: [] }],
  ['bad colour string', { width: 1, height: 1, pixels: ['red'] }],
  ['injection attempt', { width: 1, height: 1, pixels: ['"/><script>alert(1)</script>'] }],
];
for (const [label, obj] of bad) {
  let threw = false;
  try { makeLoader().loadJSON(JSON.stringify(obj)); } catch (_) { threw = true; }
  check(`rejects ${label}`, threw);
}

/* ---- 4. DOM wiring: every $('id') must exist in the markup ------------- */
console.log('\nDOM wiring');
const scriptBody = src.slice(src.indexOf('<script>') + 8, src.lastIndexOf('</script>'));
const htmlPart = src.slice(0, src.indexOf('<script>'));
const ids = new Set([...htmlPart.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const refs = [...scriptBody.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]);
const missing = [...new Set(refs)].filter(id => !ids.has(id));
check(`all ${new Set(refs).size} referenced ids exist in the markup`,
  missing.length === 0, missing.join(', '));

// ids referenced before boot would throw at load; report unused ones as info
const unused = [...ids].filter(id => !refs.includes(id));
console.log(`  info ${ids.size} ids declared, ${unused.length} not referenced by $(): ${unused.join(', ') || 'none'}`);

// every button/checkbox the sidebar promises exists
for (const id of ['toolPaint', 'toolErase', 'fillAll', 'clearAll', 'flipH', 'flipV',
                  'rot', 'undo', 'redo', 'cols', 'rows', 'zoom', 'lines',
                  'color', 'palette', 'preset', 'saveJsonBtn', 'loadJsonBtn',
                  'loadJsonFile', 'statRects']) {
  check(`has #${id}`, ids.has(id));
}

/* ---- 5. script compiles as a whole ---------------------------------- */
/* ---- 5. keyboard shortcuts (runs the real listener) ------------------ */
/* ---- 5. canvas centring ---------------------------------------------- */
console.log('\nCanvas centring');
const css = src.slice(src.indexOf('<style>'), src.indexOf('</style>'));
function ruleBody(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}
const areaRule = ruleBody('.canvas-area');
const gridRule = ruleBody('.grid');

check('found .canvas-area and .grid rules', !!areaRule && !!gridRule);
check('.canvas-area centres vertically (align-items:center)',
  /align-items\s*:\s*center/.test(areaRule), areaRule.trim());
check('.canvas-area centres horizontally (justify-content:center)',
  /justify-content\s*:\s*center/.test(areaRule), areaRule.trim());
check('no leftover flex-start top-alignment',
  !/align-items\s*:\s*flex-start/.test(areaRule));
check('.canvas-area still scrolls when the grid outgrows it',
  /overflow\s*:\s*auto/.test(areaRule));
// margin:auto is load-bearing: it is what keeps an oversized grid reachable
// by scroll. Swapping it for align/justify centring alone clips the top-left.
check('.grid centres with margin:auto, not alignment alone',
  /margin\s*:\s*auto/.test(gridRule), gridRule.trim());
check('.grid keeps its own hit-testing userselect/touch rules',
  /user-select\s*:\s*none/.test(gridRule) && /touch-action\s*:\s*none/.test(gridRule));

console.log('\nKeyboard shortcuts');
const kdStart = src.indexOf("document.addEventListener('keydown'");
const kdEnd = src.indexOf('\n  });', kdStart) + '\n  });'.length;
const kdCode = src.slice(kdStart, kdEnd);
check('extracted the keydown listener', kdCode.includes('switch') && kdEnd > kdStart);

function freshHandler() {
  const calls = { sync: 0, clear: 0, undo: 0, redo: 0, prevented: 0 };
  const S = { tool: 'paint' };
  let handler = null;
  const fakeDocument = { addEventListener: (t, fn) => { if (t === 'keydown') handler = fn; } };
  class FakeElement { matches() { return false; } }
  class FakeInput extends FakeElement { matches() { return true; } }

  new Function('document', 'S', 'syncToolButtons', 'clearGrid', 'undo', 'redo', 'Element', kdCode)(
    fakeDocument, S,
    () => calls.sync++, () => calls.clear++, () => calls.undo++, () => calls.redo++, FakeElement);

  return {
    Input: FakeInput, S, calls,
    press(key, opts = {}) {
      const ev = {
        key, ctrlKey: !!opts.ctrlKey, metaKey: !!opts.metaKey, altKey: !!opts.altKey,
        shiftKey: !!opts.shiftKey,
        target: opts.target || new FakeElement(),
        preventDefault() { calls.prevented++; },
      };
      handler(ev);
    },
  };
}

let h = freshHandler();
h.press('p');
check('P selects paint', h.S.tool === 'paint');

h = freshHandler();
h.press('e');
check('E selects erase', h.S.tool === 'erase');

h = freshHandler();
h.press('c');
check('C clears the grid', h.calls.clear === 1);

h = freshHandler();
h.press('C');
check('C is case-insensitive', h.calls.clear === 1);

h = freshHandler();
h.press('b');
check('B still aliases paint', h.S.tool === 'paint');

h = freshHandler();
h.press('e');
check('E refreshes the tool buttons', h.calls.sync === 1);

/* the important regression: Ctrl+C is Copy, not Clear */
h = freshHandler();
h.press('c', { ctrlKey: true });
check('Ctrl+C does NOT clear (copy chord)', h.calls.clear === 0);

h = freshHandler();
h.press('c', { metaKey: true });
check('Cmd+C does NOT clear', h.calls.clear === 0);

h = freshHandler();
h.press('c', { altKey: true });
check('Alt+C does NOT clear', h.calls.clear === 0);

h = freshHandler();
h.press('e', { ctrlKey: true });
check('Ctrl+E does not switch tool', h.S.tool === 'paint');

h = freshHandler();
h.press('c', { target: new h.Input() });
check('typing C into a form field does not clear', h.calls.clear === 0);

h = freshHandler();
h.press('z', { ctrlKey: true });
check('Ctrl+Z undoes', h.calls.undo === 1);

h = freshHandler();
h.press('z', { ctrlKey: true, shiftKey: true });
check('Ctrl+Shift+Z redoes', h.calls.redo === 1);

h = freshHandler();
h.press('y', { ctrlKey: true });
check('Ctrl+Y redoes', h.calls.redo === 1);

h = freshHandler();
h.press('x');
check('unrelated keys are ignored',
  h.calls.clear === 0 && h.calls.undo === 0 && h.calls.redo === 0 && h.S.tool === 'paint');

/* clearGrid must exist once and be shared by the button and the key */
check('clearGrid defined exactly once',
  (scriptBody.match(/function clearGrid\(/g) || []).length === 1);
check('Clear button is wired to clearGrid',
  /\$\('clearAll'\)\.addEventListener\('click', clearGrid\)/.test(scriptBody));
check('clearGrid pushes history before wiping',
  /function clearGrid\(\)\s*\{\s*pushHistory\(\);/.test(scriptBody));
check('shortcut hint documents P / E / C',
  /<b>P<\/b>[\s\S]*<b>E<\/b>[\s\S]*<b>C<\/b>/.test(htmlPart));

console.log('\nWhole-script syntax');
try {
  new Function(scriptBody);
  check('inline script parses', true);
} catch (e) {
  check('inline script parses', false, e.message);
}
check('no leftover reference to old per-cell writer',
  !scriptBody.includes('groups.get(v).push'));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
