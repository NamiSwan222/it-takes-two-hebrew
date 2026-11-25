// Reads and writes Unreal Engine 4 .locres files (versions 1-3, which covers UE 4.26).
// Only the localized strings are changed; namespace/key hashes are kept from the original
// file, so we never need to recompute UE's CityHash.
const MAGIC = Buffer.from([
  0x0e, 0x14, 0x74, 0x75, 0x67, 0x4a, 0x03, 0xfc, 0x4a, 0x15, 0x90, 0x9d, 0xc3, 0x37, 0x7f, 0x1b,
]);

class Reader {
  constructor(buf) { this.buf = buf; this.pos = 0; }
  u8() { return this.buf.readUInt8(this.pos++); }
  u32() { const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  i32() { const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  i64() { const v = this.buf.readBigInt64LE(this.pos); this.pos += 8; return Number(v); }
  fstring() {
    const len = this.i32();
    if (len === 0) return '';
    if (len > 0) {
      const s = this.buf.toString('latin1', this.pos, this.pos + len - 1);
      this.pos += len;
      return s;
    }
    const n = -len;
    const s = this.buf.toString('utf16le', this.pos, this.pos + (n - 1) * 2);
    this.pos += n * 2;
    return s;
  }
}

class Writer {
  constructor() { this.parts = []; this.length = 0; }
  push(b) { this.parts.push(b); this.length += b.length; }
  u8(v) { const b = Buffer.alloc(1); b.writeUInt8(v); this.push(b); }
  u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); this.push(b); }
  i32(v) { const b = Buffer.alloc(4); b.writeInt32LE(v); this.push(b); }
  i64(v) { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(v)); this.push(b); }
  fstring(s) {
    if (s === '') { this.i32(0); return; }
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7f]*$/.test(s)) {
      this.i32(s.length + 1);
      this.push(Buffer.concat([Buffer.from(s, 'latin1'), Buffer.alloc(1)]));
    } else {
      this.i32(-(s.length + 1));
      this.push(Buffer.concat([Buffer.from(s, 'utf16le'), Buffer.alloc(2)]));
    }
  }
  toBuffer() { return Buffer.concat(this.parts); }
}

/**
 * Returns { version, namespaces: [{ name, hash, keys: [{ key, hash, sourceHash, value }] }] }
 */
function parseLocres(buf) {
  const r = new Reader(buf);
  if (buf.length < 17 || !buf.subarray(0, 16).equals(MAGIC)) {
    throw new Error('Not a versioned .locres file (legacy v0 files are not supported)');
  }
  r.pos = 16;
  const version = r.u8();
  if (version < 1 || version > 3) throw new Error(`Unsupported .locres version ${version}`);
  const stringsOffset = r.i64();
  if (version >= 2) r.u32(); // total entry count, recomputed on write

  // String table first, so keys can resolve their index.
  const save = r.pos;
  r.pos = stringsOffset;
  const stringCount = r.i32();
  const strings = [];
  for (let i = 0; i < stringCount; i++) {
    strings.push(r.fstring());
    if (version >= 2) r.i32(); // ref count
  }
  r.pos = save;

  const namespaces = [];
  const nsCount = r.u32();
  for (let n = 0; n < nsCount; n++) {
    const hash = version >= 2 ? r.u32() : 0;
    const name = r.fstring();
    const keyCount = r.u32();
    const keys = [];
    for (let k = 0; k < keyCount; k++) {
      const keyHash = version >= 2 ? r.u32() : 0;
      const key = r.fstring();
      const sourceHash = r.u32();
      const index = r.i32();
      keys.push({ key, hash: keyHash, sourceHash, value: strings[index] ?? '' });
    }
    namespaces.push({ name, hash, keys });
  }
  return { version, namespaces };
}

function writeLocres({ version, namespaces }) {
  const w = new Writer();
  w.push(MAGIC);
  w.u8(version);
  const offsetPos = w.length;
  w.i64(0); // placeholder for string table offset

  const strings = [];
  const refs = [];
  const indexOf = new Map();
  const intern = (s) => {
    if (indexOf.has(s)) { refs[indexOf.get(s)]++; return indexOf.get(s); }
    indexOf.set(s, strings.length);
    strings.push(s);
    refs.push(1);
    return strings.length - 1;
  };

  let entryCount = 0;
  for (const ns of namespaces) entryCount += ns.keys.length;
  if (version >= 2) w.u32(entryCount);

  w.u32(namespaces.length);
  for (const ns of namespaces) {
    if (version >= 2) w.u32(ns.hash);
    w.fstring(ns.name);
    w.u32(ns.keys.length);
    for (const k of ns.keys) {
      if (version >= 2) w.u32(k.hash);
      w.fstring(k.key);
      w.u32(k.sourceHash);
      w.i32(intern(k.value));
    }
  }

  const stringsOffset = w.length;
  w.i32(strings.length);
  strings.forEach((s, i) => {
    w.fstring(s);
    if (version >= 2) w.i32(refs[i]);
  });

  const out = w.toBuffer();
  out.writeBigInt64LE(BigInt(stringsOffset), offsetPos);
  return out;
}

module.exports = { parseLocres, writeLocres, MAGIC };
