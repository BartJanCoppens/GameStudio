// A static scan of an AI-built game's files for what a sealed-off game must never do. Shared by the
// game-builder and game-check functions and by the app's tests. Plain TypeScript, no imports.
//
// It is a second line of defence: the frame's sandbox and content security policy already block network
// access, so the scan's job is readable reasons ("contacts another website") and catching attempts to
// leave the page, which no browser policy can block.

export const MAX_FILE_BYTES = 300_000;

const RULES: { what: string; pattern: RegExp }[] = [
  { what: 'contacts another website', pattern: /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|RTCPeerConnection/ },
  { what: 'loads code from elsewhere', pattern: /\bimport\s*\(|importScripts|<script\b[^>]*\bsrc\s*=|<link\b|@import|<iframe\b|<object\b|<embed\b/i },
  { what: 'leaves the page', pattern: /window\.open\s*\(|\blocation\s*\.\s*(href\s*=(?!=)|assign\s*\(|replace\s*\()|\b(top|parent|document|window)\s*\.\s*location\s*=(?!=)|(^|[^.\w])location\s*=(?!=)|<meta\b[^>]*http-equiv|<a\b[^>]*\btarget\s*=/i },
  { what: 'submits a form', pattern: /<form\b|\.submit\s*\(|requestSubmit/i },
  { what: 'uses browser storage', pattern: /document\s*\.\s*cookie|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bcaches\s*\./ },
  { what: 'runs code from text', pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bset(Timeout|Interval)\s*\(\s*['"`]/ },
];

const URL_PATTERN = /\b(https?|wss?|ftp):\/\/|(^|[\s"'(=,`])\/\/[a-z0-9-]+\.[a-z]{2,}/i;

/** The text without comments (JS/CSS block and line comments, HTML comments), keeping string literals intact. */
export function withoutComments(text: string): string {
  const src = text.replace(/<!--[\s\S]*?-->/g, ' ');
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], next = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += next ?? ''; i++; } else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; continue; }
    if (c === '/' && next === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 1; out += ' '; continue; }
    // A line comment, but not the "//" of a web address such as "https://".
    if (c === '/' && next === '/' && src[i - 1] !== ':') { const end = src.indexOf('\n', i); i = end < 0 ? src.length : end - 1; continue; }
    out += c;
  }
  return out;
}

/** Readable problems with a game's files; empty when the scan finds nothing. */
export function scanGameFiles(files: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  if (!files['index.html']) problems.push('The game has no index.html');
  for (const [name, text] of Object.entries(files)) {
    if (typeof text !== 'string') continue;
    if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) { problems.push(`${name} is too large (over 300 KB)`); continue; }
    for (const r of RULES) {
      const m = text.match(r.pattern);
      if (m) problems.push(`${name} ${r.what} (${m[0].trim().slice(0, 40)})`);
    }
    const url = withoutComments(text).match(URL_PATTERN);
    if (url) problems.push(`${name} contains a web address (${url[0].trim().slice(0, 40)})`);
  }
  return problems;
}
