// Minimal Unreal Engine 4.26 .pak reader/writer (pak version 11, unencrypted).
// Reads: the primary index + full directory index, Zlib or uncompressed entries.
// Writes: an uncompressed v11 pak with a full directory index only (no path-hash index),
// which UE 4.26 accepts. Encrypted paks are refused: this tool never decrypts anything.
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

const MAGIC = 0x5a6f12e1;
const VERSION = 11;
const NAME_SLOTS = 5;
const FOOTER_SIZE = 16 + 1 + 4 + 4 + 8 + 8 + 20 + NAME_SLOTS * 32; // 221

function readAt(fd, pos, len) {
  const b = Buffer.alloc(len);
  let done = 0;
  while (done < len) {
    const n = fs.readSync(fd, b, done, len - done, pos + done);
    if (n === 0) throw new Error('Unexpected end of pak');
    done += n;
  }
  return b;
}

class R {
  constructor(b) { this.b = b; this.p = 0; }
  u8() { return this.b[this.p++]; }
  u32() { const v = this.b.readUInt32LE(this.p); this.p += 4; return v; }
  i32() { const v = this.b.readInt32LE(this.p); this.p += 4; return v; }
  u64() { const v = this.b.readBigUInt64LE(this.p); this.p += 8; return Number(v); }
  bytes(n) { const v = this.b.subarray(this.p, this.p + n); this.p += n; return v; }
  fstring() {
    const len = this.i32();
    if (len === 0) return '';
    if (len > 0) { const s = this.b.toString('latin1', this.p, this.p + len - 1); this.p += len; return s; }
    const s = this.b.toString('utf16le', this.p, this.p + (-len - 1) * 2); this.p += -len * 2; return s;
  }
}

function readFooter(fd, size) {
  const f = new R(readAt(fd, size - FOOTER_SIZE, FOOTER_SIZE));
  f.bytes(16); // encryption key guid
  const encryptedIndex = f.u8() !== 0;
  if (f.u32() !== MAGIC) throw new Error('Not a pak v11 file (magic not found)');
  const version = f.u32();
  const indexOffset = f.u64();
  const indexSize = f.u64();
  f.bytes(20);
  const methods = [];
  for (let i = 0; i < NAME_SLOTS; i++) {
    const name = f.bytes(32).toString('latin1').replace(/\0.*$/s, '');
    if (name) methods.push(name);
  }
  return { encryptedIndex, version, indexOffset, indexSize, methods };
}

// The full FPakEntry as serialized (index "unencodable" entries and the header before data).
function readEntryRecord(r) {
  const e = {};
  e.offset = r.u64();
  e.size = r.u64();
  e.uncompressedSize = r.u64();
  e.method = r.u32();
  e.hash = r.bytes(20);
  e.blocks = [];
  if (e.method !== 0) {
    const n = r.u32();
    for (let i = 0; i < n; i++) e.blocks.push({ start: r.u64(), end: r.u64() });
  }
  e.flags = r.u8();
  e.blockSize = r.u32();
  return e;
}

// Only the data offset is needed from an encoded entry; the full header sits before the data.
function decodeOffset(buf, pos) {
  const value = buf.readUInt32LE(pos);
  let p = pos + 4;
  if ((value & 0x3f) === 0x3f) p += 4;
  if ((value & 0x80000000) !== 0) return buf.readUInt32LE(p);
  return Number(buf.readBigUInt64LE(p));
}

/** Opens a pak; returns { files: Map<path, offset>, read(path) -> Buffer, close() }. */
function openPak(file) {
  const fd = fs.openSync(file, 'r');
  const size = fs.fstatSync(fd).size;
  const info = readFooter(fd, size);
  if (info.version !== VERSION) throw new Error(`Pak version ${info.version}, expected ${VERSION}`);
  if (info.encryptedIndex) throw new Error('This pak is encrypted. Tirgumim does not decrypt game files.');

  const r = new R(readAt(fd, info.indexOffset, info.indexSize));
  const mountPoint = r.fstring();
  r.i32(); // entry count
  r.u64(); // path hash seed
  if (r.u32()) r.bytes(8 + 8 + 20); // path hash index (not used)
  if (!r.u32()) throw new Error('Pak has no full directory index');
  const dirOffset = r.u64();
  const dirSize = r.u64();
  r.bytes(20);
  const encodedSize = r.i32();
  const encoded = r.bytes(encodedSize);
  const unencoded = [];
  const n = r.i32();
  for (let i = 0; i < n; i++) unencoded.push(readEntryRecord(r));

  const d = new R(readAt(fd, dirOffset, dirSize));
  const files = new Map();
  const dirCount = d.i32();
  for (let i = 0; i < dirCount; i++) {
    let dir = d.fstring();
    if (dir === '/') dir = '';
    const count = d.i32();
    for (let j = 0; j < count; j++) {
      const name = d.fstring();
      const loc = d.i32();
      const offset = loc >= 0 ? decodeOffset(encoded, loc) : unencoded[-loc - 1].offset;
      files.set(dir + name, offset);
    }
  }

  function read(p) {
    if (!files.has(p)) throw new Error(`${p} is not in ${file}`);
    const offset = files.get(p);
    const head = readEntryRecord(new R(readAt(fd, offset, Math.min(4096, size - offset))));
    if (head.flags & 1) throw new Error(`${p} is encrypted. Tirgumim does not decrypt game files.`);
    const headerSize = 53 + (head.method ? 4 + head.blocks.length * 16 : 0);
    if (head.method === 0) return readAt(fd, offset + headerSize, head.size);
    const method = info.methods[head.method - 1];
    if (!/^zlib$/i.test(method)) throw new Error(`${p} uses ${method} compression (only Zlib is supported)`);
    const parts = head.blocks.map((b) => zlib.inflateSync(readAt(fd, offset + b.start, b.end - b.start)));
    const out = Buffer.concat(parts);
    if (out.length !== head.uncompressedSize) throw new Error(`${p}: size mismatch after inflate`);
    return out;
  }

  return { mountPoint, files, read, close: () => fs.closeSync(fd) };
}

class W {
  constructor() { this.parts = []; this.length = 0; }
  push(b) { this.parts.push(b); this.length += b.length; }
  u8(v) { this.push(Buffer.from([v])); }
  u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); this.push(b); }
  i32(v) { const b = Buffer.alloc(4); b.writeInt32LE(v); this.push(b); }
  u64(v) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); this.push(b); }
  fstring(s) {
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7f]*$/.test(s)) { this.i32(s.length + 1); this.push(Buffer.from(`${s}\0`, 'latin1')); }
    else { this.i32(-(s.length + 1)); this.push(Buffer.from(`${s}\0`, 'utf16le')); }
  }
  buf() { return Buffer.concat(this.parts); }
}

function entryRecord(offset, data, hash) {
  const w = new W();
  w.u64(offset); w.u64(data.length); w.u64(data.length);
  w.u32(0); // no compression
  w.push(hash);
  w.u8(0); // not encrypted
  w.u32(0);
  return w.buf();
}

const sha1 = (b) => crypto.createHash('sha1').update(b).digest();

/** files: [{ path: 'Nuts/Content/...', data: Buffer }], written uncompressed. */
function writePak(outFile, files, mountPoint = '../../../') {
  const body = new W();
  const records = [];
  for (const f of files) {
    const hash = sha1(f.data);
    const offset = body.length;
    body.push(entryRecord(0, f.data, hash)); // in-data header has offset 0, as UnrealPak writes it
    body.push(f.data);
    records.push(entryRecord(offset, f.data, hash));
  }

  // Full directory index: every directory (with its parents, root "/") -> file name -> location.
  const dirs = new Map([['/', []]]);
  files.forEach((f, i) => {
    const parts = f.path.split('/');
    const name = parts.pop();
    let cur = '';
    for (const part of parts) { cur += `${part}/`; if (!dirs.has(cur)) dirs.set(cur, []); }
    dirs.get(cur || '/').push({ name, loc: -(i + 1) });
  });
  const dw = new W();
  dw.i32(dirs.size);
  for (const [dir, list] of dirs) {
    dw.fstring(dir);
    dw.i32(list.length);
    for (const e of list) { dw.fstring(e.name); dw.i32(e.loc); }
  }
  const dirIndex = dw.buf();

  const indexOffset = body.length;
  // Primary index size is needed for the directory index offset: build it twice.
  const primary = (dirOffset) => {
    const w = new W();
    w.fstring(mountPoint);
    w.i32(files.length);
    w.u64(0); // path hash seed
    w.u32(0); // no path hash index
    w.u32(1); // has full directory index
    w.u64(dirOffset); w.u64(dirIndex.length); w.push(sha1(dirIndex));
    w.i32(0); // no encoded entries
    w.i32(records.length);
    for (const rec of records) w.push(rec);
    return w.buf();
  };
  const probe = primary(0);
  const index = primary(indexOffset + probe.length);

  const footer = new W();
  footer.push(Buffer.alloc(16));
  footer.u8(0);
  footer.u32(MAGIC);
  footer.u32(VERSION);
  footer.u64(indexOffset);
  footer.u64(index.length);
  footer.push(sha1(index));
  footer.push(Buffer.alloc(NAME_SLOTS * 32));

  fs.writeFileSync(outFile, Buffer.concat([body.buf(), index, dirIndex, footer.buf()]));
}

module.exports = { openPak, writePak };
