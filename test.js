// node --test test.js  (no game files needed)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openPak, writePak } = require('./tools/pak');
const { parseLocres, writeLocres, MAGIC } = require('./tools/locres');
const { computeCoverage } = require('./tools/coverage');
const { checkBatch } = require('./tools/check-batch');
const { toVisual } = require('./tools/rtl');
const { coverage, natural } = require('./build');

function sampleLocres() {
  const parts = [];
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); parts.push(b); };
  const i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v); parts.push(b); };
  const str = (s) => { if (!s) { i32(0); return; } i32(s.length + 1); parts.push(Buffer.from(`${s}\0`, 'latin1')); };
  parts.push(MAGIC, Buffer.from([3]));
  const offsetAt = parts.reduce((n, b) => n + b.length, 0);
  parts.push(Buffer.alloc(8));
  u32(3); u32(2);
  u32(0x1111); str('Menu'); u32(2);
  u32(0xa1); str('Play'); u32(0xb1); i32(0);
  u32(0xa2); str('Quit'); u32(0xb2); i32(1);
  u32(0x2222); str(''); u32(1);
  u32(0xa3); str('Again'); u32(0xb3); i32(0);
  const strOffset = parts.reduce((n, b) => n + b.length, 0);
  i32(2); str('Play'); i32(2); str('Quit'); i32(1);
  const buf = Buffer.concat(parts);
  buf.writeBigInt64LE(BigInt(strOffset), offsetAt);
  return buf;
}

test('locres: parse + write unchanged is byte-identical', () => {
  const buf = sampleLocres();
  assert.ok(writeLocres(parseLocres(buf)).equals(buf));
});

test('locres: Hebrew round-trips, hashes kept', () => {
  const d = parseLocres(sampleLocres());
  d.namespaces[0].keys[0].value = 'שחק';
  const again = parseLocres(writeLocres(d));
  assert.strictEqual(again.namespaces[0].keys[0].value, 'שחק');
  assert.strictEqual(again.namespaces[0].keys[0].hash, 0xa1);
  assert.strictEqual(again.namespaces[1].keys[0].value, 'Play');
});

test('pak: written pak reads back (paths, bytes, Hebrew-safe)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pak-'));
  const file = path.join(tmp, 'x_P.pak');
  const files = [
    { path: 'Nuts/Content/Localization/Nuts/en/Nuts.locres', data: sampleLocres() },
    { path: 'Nuts/Content/GUI/Fonts/Poppins-Medium.ufont', data: Buffer.from('font bytes') },
    { path: 'root.txt', data: Buffer.alloc(0) },
  ];
  writePak(file, files);
  const pak = openPak(file);
  assert.strictEqual(pak.mountPoint, '../../../');
  assert.deepStrictEqual([...pak.files.keys()].sort(), files.map((f) => f.path).sort());
  for (const f of files) assert.ok(pak.read(f.path).equals(f.data), f.path);
  pak.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('coverage: missing, token errors, stale, letterless strings', () => {
  const en = { Menu: { a: 'Play', b: 'Quit', c: '{0}', d: 'Hi {Name}' }, HUD: { e: 'Jump' } };
  const c = computeCoverage(en, { Menu: { a: 'שחק', d: 'היי' }, Old: { z: 'ישן' } });
  assert.deepStrictEqual(c.missing.map((m) => m.key), ['b', 'e']);
  assert.deepStrictEqual(c.tokenErrors.map((m) => m.key), ['d']);
  assert.strictEqual(c.stale.length, 1);
  const full = computeCoverage(en, { Menu: { a: 'שחק', b: 'יציאה', d: 'היי {Name}' }, HUD: { e: 'קפיצה' } });
  assert.strictEqual(full.complete, true);
});

test('coverage across tables keeps table names', () => {
  const c = coverage({ Nuts: { NS: { k: 'Hello' } } }, {});
  assert.deepStrictEqual(c.missing, [{ table: 'Nuts', ns: 'NS', key: 'k', en: 'Hello' }]);
});

test('check-batch: flags missing, tokens, breaks, extra keys', () => {
  const en = { Nuts: { NS: { a: '- Hi {0}', b: 'Two\nlines', c: 'Jump' } } };
  const ok = checkBatch(en, { Nuts: { NS: { a: '- היי {0}', b: 'שתי\nשורות', c: 'קפיצה' } } });
  assert.deepStrictEqual(ok.problems, []);
  const bad = checkBatch(en, { Nuts: { NS: { a: '- היי', b: 'שתי שורות', x: 'עודף' } } });
  assert.strictEqual(bad.problems.length, 4);
});

test('natural sort keeps dialogue order', () => {
  assert.deepStrictEqual(['Line_10', 'Line_2', 'Line_1'].sort(natural), ['Line_1', 'Line_2', 'Line_10']);
});

test('rtl fallback (only used with --reverse)', () => {
  assert.strictEqual(toVisual('שלום'), 'םולש');
  assert.strictEqual(toVisual('היי {0}'), '{0} ייה');
});

test('pack config and catalog entry are consistent', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'pack', 'pack.config.json'), 'utf8'));
  const entry = JSON.parse(fs.readFileSync(path.join(__dirname, 'pack', 'catalog-entry.json'), 'utf8'));
  assert.strictEqual(cfg.gameId, entry.id);
  assert.strictEqual(cfg.activation.mode, 'swap');
  assert.ok(entry.detect.processNames.includes('ItTakesTwo.exe'));
  assert.strictEqual(entry.detect.steamAppId, '1426210');
});

test('every translation file is valid JSON in { table: { ns: { key: text } } } shape', () => {
  const dir = path.join(__dirname, 'translation');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const nss of Object.values(data)) for (const keys of Object.values(nss)) for (const v of Object.values(keys)) assert.strictEqual(typeof v, 'string', f);
  }
});
