#!/usr/bin/env node
// It Takes Two – Hebrew. Builds everything from YOUR OWN install; nothing of the game is in this repo.
//
//   node build.js export   [--game-dir <dir>]   English text -> work/strings-en.json, work/todo/*.json
//   node build.js coverage                       lists every untranslated string (exit 1 if not 100%)
//   node build.js pak      [--game-dir <dir>] [--allow-partial] [--reverse]
//        -> work/files/Nuts/Content/Paks/zzz_Tirgumim_Hebrew_P.pak  (the pack's only file)
//
// The pak holds the game's English .locres tables with Hebrew text (from translation/*.json)
// and the Latin UI fonts replaced by fonts with Hebrew glyphs (fonts/fonts.json).
// The game's paks are v11, unencrypted, Zlib: read with tools/pak.js. Nothing is decrypted.
const fs = require('fs');
const path = require('path');
const { openPak, writePak } = require('./tools/pak');
const { parseLocres, writeLocres } = require('./tools/locres');
const { computeCoverage } = require('./tools/coverage');
const { toVisual } = require('./tools/rtl');

const ROOT = __dirname;
const WORK = path.join(ROOT, 'work');
const PAK_REL = 'Nuts/Content/Paks/zzz_Tirgumim_Hebrew_P.pak';
// Player-visible game text. Engine.locres / OnlineSubsystem*.locres are Unreal's own (editor) text.
const TARGETS = {
  Nuts: 'Nuts/Content/Localization/Nuts/en/Nuts.locres',
  Nuts_Sage: 'Nuts/Content/Localization/Nuts_Sage/en/Nuts_Sage.locres',
};

function args() {
  const a = process.argv.slice(2);
  const o = { cmd: a[0], allowPartial: a.includes('--allow-partial'), reverse: a.includes('--reverse') };
  const i = a.indexOf('--game-dir');
  if (i >= 0) o.gameDir = a[i + 1];
  return o;
}

function findSteamGame() {
  const roots = ['C:\\Program Files (x86)\\Steam'];
  try {
    const out = require('child_process').execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8' });
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/);
    if (m) roots.unshift(path.normalize(m[1].trim()));
  } catch {}
  for (const root of roots) {
    const vdf = path.join(root, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdf)) continue;
    const libs = [...fs.readFileSync(vdf, 'utf8').matchAll(/"path"\s+"([^"]+)"/g)].map((m) => m[1].replace(/\\\\/g, '\\'));
    for (const lib of libs) {
      const dir = path.join(lib, 'steamapps', 'common', 'ItTakesTwo');
      if (fs.existsSync(path.join(dir, 'Nuts', 'Content', 'Paks'))) return dir;
    }
  }
  return null;
}

function gameDir(o) {
  const dir = o.gameDir || findSteamGame();
  if (!dir || !fs.existsSync(path.join(dir, 'Nuts', 'Content', 'Paks'))) {
    throw new Error('It Takes Two not found. Pass --game-dir "<folder with Nuts\\Content\\Paks>".');
  }
  return dir;
}

// Finds which of the game's paks holds each wanted file (the newest pak wins, as in UE).
function locate(dir, wanted) {
  const paksDir = path.join(dir, 'Nuts', 'Content', 'Paks');
  const paks = fs.readdirSync(paksDir).filter((f) => f.endsWith('.pak') && !f.startsWith('zzz_Tirgumim')).sort();
  const found = new Map();
  const opened = [];
  for (const f of paks) {
    const pak = openPak(path.join(paksDir, f));
    opened.push(pak);
    for (const p of pak.files.keys()) if (wanted(p)) found.set(p, pak);
  }
  return { found, close: () => opened.forEach((p) => p.close()) };
}

function readTables(dir) {
  const want = new Set(Object.values(TARGETS));
  const { found, close } = locate(dir, (p) => want.has(p));
  const tables = {};
  for (const [name, p] of Object.entries(TARGETS)) {
    if (!found.has(p)) throw new Error(`${p} not found in the game paks`);
    tables[name] = parseLocres(found.get(p).read(p));
  }
  close();
  return tables;
}

function toEnglish(tables) {
  const en = {};
  for (const [t, data] of Object.entries(tables)) {
    for (const ns of data.namespaces) for (const k of ns.keys) ((en[t] ||= {})[ns.name] ||= {})[k.key] = k.value;
  }
  return en;
}

// translation/*.json: { "<table>": { "<namespace>": { "<key>": "עברית" } } }, merged in file-name order.
function loadHebrew() {
  const he = {};
  const dir = path.join(ROOT, 'translation');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [t, nss] of Object.entries(data)) {
      for (const [ns, keys] of Object.entries(nss)) Object.assign(((he[t] ||= {})[ns] ||= {}), keys);
    }
  }
  return he;
}

// Coverage across all tables: flatten "<table>\u0001<namespace>" into one namespace level.
function flatten(obj) {
  const out = {};
  for (const [t, nss] of Object.entries(obj)) for (const [ns, keys] of Object.entries(nss)) out[`${t}\u0001${ns}`] = keys;
  return out;
}

function coverage(en, he) {
  const c = computeCoverage(flatten(en), flatten(he));
  const fix = (list) => list.map(({ ns, ...rest }) => { const [table, namespace] = ns.split('\u0001'); return { table, ns: namespace, ...rest }; });
  return { ...c, missing: fix(c.missing), tokenErrors: fix(c.tokenErrors), stale: fix(c.stale) };
}

// Line_12 sorts after Line_9; dialogue batches stay in story order and whole namespaces stay together.
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });

function cmdExport(o) {
  const en = toEnglish(readTables(gameDir(o)));
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(path.join(WORK, 'strings-en.json'), JSON.stringify(en, null, 1));
  const c = coverage(en, loadHebrew());
  // Batches of ~250 strings, never splitting a namespace (a cutscene keeps its context).
  const todoDir = path.join(WORK, 'todo');
  fs.rmSync(todoDir, { recursive: true, force: true });
  fs.mkdirSync(todoDir, { recursive: true });
  const byNs = new Map();
  for (const m of c.missing) {
    const id = `${m.table}\u0001${m.ns}`;
    if (!byNs.has(id)) byNs.set(id, []);
    byNs.get(id).push(m);
  }
  let batch = {};
  let count = 0;
  let n = 0;
  const flush = () => {
    if (!count) return;
    n++;
    fs.writeFileSync(path.join(todoDir, `batch-${String(n).padStart(3, '0')}.json`), JSON.stringify(batch, null, 1));
    batch = {};
    count = 0;
  };
  for (const id of [...byNs.keys()].sort(natural)) {
    const list = byNs.get(id).sort((a, b) => natural(a.key, b.key));
    if (count && count + list.length > 250) flush();
    for (const m of list) ((batch[m.table] ||= {})[m.ns] ||= {})[m.key] = m.en;
    count += list.length;
  }
  flush();
  console.log(`Exported ${c.total} strings; ${c.missing.length} untranslated in ${n} batch file(s) under work/todo/.`);
}

function cmdCoverage() {
  const enFile = path.join(WORK, 'strings-en.json');
  if (!fs.existsSync(enFile)) throw new Error('Run "node build.js export" first.');
  const c = coverage(JSON.parse(fs.readFileSync(enFile, 'utf8')), loadHebrew());
  fs.writeFileSync(path.join(WORK, 'untranslated.json'), JSON.stringify({ missing: c.missing, tokenErrors: c.tokenErrors, stale: c.stale }, null, 1));
  console.log(`Coverage: ${c.translated}/${c.total} (${c.percent}%)`);
  for (const m of c.missing.slice(0, 40)) console.log(`  missing [${m.table}/${m.ns}] ${m.key}: ${JSON.stringify(m.en)}`);
  if (c.missing.length > 40) console.log(`  ... ${c.missing.length - 40} more in work/untranslated.json`);
  for (const t of c.tokenErrors) console.log(`  TOKENS  [${t.table}/${t.ns}] ${t.key}: keep the tokens of ${JSON.stringify(t.en)}`);
  if (c.stale.length) console.log(`  ${c.stale.length} Hebrew line(s) not in the game any more (work/untranslated.json)`);
  return c;
}

function cmdPak(o) {
  const c = cmdCoverage();
  if (!c.complete && !o.allowPartial) throw new Error('Translation is not complete. Use --allow-partial for a test build.');
  const dir = gameDir(o);
  const tables = readTables(dir);
  const he = loadHebrew();
  const files = [];
  for (const [t, data] of Object.entries(tables)) {
    for (const ns of data.namespaces) {
      for (const k of ns.keys) {
        const v = he[t]?.[ns.name]?.[k.key];
        if (typeof v === 'string' && v.trim()) k.value = o.reverse ? toVisual(v) : v;
      }
    }
    files.push({ path: TARGETS[t], data: writeLocres(data) });
  }
  // Fonts: each cooked .ufont is the raw font file; fonts/fonts.json maps game face -> our TTF.
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'fonts', 'fonts.json'), 'utf8'));
  const { found, close } = locate(dir, (p) => p.endsWith('.ufont'));
  close();
  for (const p of found.keys()) {
    const face = path.basename(p, '.ufont');
    if (!map[face]) continue;
    files.push({ path: p, data: fs.readFileSync(path.join(ROOT, 'fonts', map[face])) });
  }
  const out = path.join(WORK, 'files', ...PAK_REL.split('/'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writePak(out, files);
  console.log(`Built work/files/${PAK_REL} (${files.length} files, ${fs.statSync(out).size} bytes).`);
}

module.exports = { coverage, natural, TARGETS, PAK_REL };

if (require.main === module) {
  const o = args();
  const cmds = { export: cmdExport, coverage: cmdCoverage, pak: cmdPak };
  try {
    if (!cmds[o.cmd]) throw new Error('Usage: node build.js export|coverage|pak [--game-dir <dir>]');
    const r = cmds[o.cmd](o);
    if (o.cmd === 'coverage' && !r.complete) process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
