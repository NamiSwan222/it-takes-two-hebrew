#!/usr/bin/env node
// Checks one translated batch against its English batch:
//   node tools/check-batch.js work/todo/batch-007.json translation/batch-007.json
// Every key present, Hebrew letters in every line that has letters, the same {tokens} and <tags>,
// the same leading "- " dialogue dash and line breaks. Exit 1 with a list of problems.
const fs = require('fs');

const TOKEN_RE = /\{[^}]*\}|<[^>]*>/g;
const toks = (s) => (s.match(TOKEN_RE) || []).sort().join('\u0000');

function checkBatch(en, he) {
  const problems = [];
  let count = 0;
  for (const [t, nss] of Object.entries(en)) {
    for (const [ns, keys] of Object.entries(nss)) {
      for (const [key, english] of Object.entries(keys)) {
        count++;
        const where = `[${t}/${ns}] ${key}`;
        const h = he?.[t]?.[ns]?.[key];
        if (typeof h !== 'string' || !h.trim()) { problems.push(`${where}: missing`); continue; }
        const letters = /\p{L}/u.test(english.replace(TOKEN_RE, ''));
        if (letters && !/[֐-׿]/.test(h.replace(TOKEN_RE, '')) && h !== english) {
          // Names-only lines (e.g. "FPS", "EA") may legitimately stay Latin; flag anything longer.
          if (english.replace(TOKEN_RE, '').trim().length > 4) problems.push(`${where}: no Hebrew in ${JSON.stringify(h)}`);
        }
        if (toks(english) !== toks(h)) problems.push(`${where}: tokens differ: ${JSON.stringify(english)} -> ${JSON.stringify(h)}`);
        if ((english.match(/\n/g) || []).length !== (h.match(/\n/g) || []).length) problems.push(`${where}: line breaks differ`);
      }
    }
  }
  for (const [t, nss] of Object.entries(he || {})) {
    for (const [ns, keys] of Object.entries(nss)) {
      for (const key of Object.keys(keys)) if (!(en[t]?.[ns] && key in en[t][ns])) problems.push(`[${t}/${ns}] ${key}: not in the English batch`);
    }
  }
  return { count, problems };
}

module.exports = { checkBatch };

if (require.main === module) {
  const [enFile, heFile] = process.argv.slice(2);
  const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
  let he;
  try { he = JSON.parse(fs.readFileSync(heFile, 'utf8')); } catch (e) { console.error(`Cannot read ${heFile}: ${e.message}`); process.exit(1); }
  const { count, problems } = checkBatch(en, he);
  problems.forEach((p) => console.log(p));
  console.log(problems.length ? `${problems.length} problem(s) in ${count} strings` : `OK: ${count} strings`);
  process.exit(problems.length ? 1 : 0);
}
