// Translation coverage: which English strings still have no Hebrew, and which Hebrew lines
// broke a format token ({0}, <Tag>, </>) the game needs.
const TOKEN_RE = /\{[^}]*\}|<[^>]*>/g;
const HAS_LETTERS = /\p{L}/u;

function tokens(s) {
  return (s.match(TOKEN_RE) || []).sort();
}

/**
 * en: { namespace: { key: english } } (build/strings-en.json)
 * he: { namespace: { key: hebrew } }  (patch/he.json)
 * Strings without letters ("", "{0}", "100%") count as done: they look the same in Hebrew.
 */
function computeCoverage(en, he) {
  const missing = [];
  const tokenErrors = [];
  const stale = [];
  let total = 0;
  let translated = 0;
  for (const [ns, keys] of Object.entries(en)) {
    for (const [key, english] of Object.entries(keys)) {
      total++;
      const hebrew = he[ns]?.[key];
      if (!HAS_LETTERS.test(english.replace(TOKEN_RE, ''))) { translated++; continue; }
      if (typeof hebrew !== 'string' || !hebrew.trim()) { missing.push({ ns, key, en: english }); continue; }
      if (tokens(english).join('\u0000') !== tokens(hebrew).join('\u0000')) {
        tokenErrors.push({ ns, key, en: english, he: hebrew });
        continue;
      }
      translated++;
    }
  }
  for (const [ns, keys] of Object.entries(he)) {
    for (const key of Object.keys(keys)) if (!(en[ns] && key in en[ns])) stale.push({ ns, key });
  }
  return {
    total,
    translated,
    percent: total ? Math.floor((translated / total) * 10000) / 100 : 0,
    complete: total > 0 && translated === total,
    missing,
    tokenErrors,
    stale,
  };
}

module.exports = { computeCoverage };
