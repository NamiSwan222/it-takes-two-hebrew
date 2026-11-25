// Fallback for engines that draw Hebrew left-to-right: stores each line in visual order.
// UE 4.26 normally lays out right-to-left text itself (ICU bidi), so the build only uses
// this with --reverse, if the first in-game test shows backwards Hebrew.
const HEBREW = /[֐-׿יִ-ﭏ]/;
// Format arguments ({0}, {Name}) and rich-text tags (<Tag>, </>) must stay intact.
const TOKEN = /(\{[^}]*\}|<[^>]*>)/;

function reverseLine(line) {
  if (!HEBREW.test(line)) return line;
  // Split into tokens and runs: Hebrew/neutral runs are reversed, LTR runs (Latin, digits,
  // format tokens) keep their internal order but swap position with the rest.
  const pieces = [];
  for (const part of line.split(TOKEN)) {
    if (!part) continue;
    if (TOKEN.test(part) && part.match(TOKEN)[0] === part) { pieces.push({ ltr: true, text: part }); continue; }
    const runs = part.match(/[A-Za-z0-9][A-Za-z0-9.,:%'\-]*[A-Za-z0-9%]|[A-Za-z0-9]|[^A-Za-z0-9]+/g) || [];
    for (const run of runs) pieces.push({ ltr: /[A-Za-z0-9]/.test(run), text: run });
  }
  return pieces
    .reverse()
    .map((p) => (p.ltr ? p.text : [...p.text].reverse().map(mirror).join('')))
    .join('');
}

const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<', '{': '}', '}': '{' };
function mirror(ch) { return MIRROR[ch] || ch; }

function toVisual(text) {
  return text.split(/(\r?\n)/).map((s) => (/\r?\n/.test(s) ? s : reverseLine(s))).join('');
}

module.exports = { toVisual, reverseLine };
