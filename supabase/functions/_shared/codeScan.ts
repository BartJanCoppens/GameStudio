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

const FILE_NAMES = ['index.html', 'game.js', 'style.css'];

/** The files value must be an object of text under the known names: anything else could slip past the scan. */
export function filesProblems(files: unknown): string[] {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return ['The game has no code yet'];
  const p: string[] = [];
  for (const [name, text] of Object.entries(files)) {
    if (!FILE_NAMES.includes(name)) p.push(`Unexpected file ${name.slice(0, 40)}: a game has index.html, game.js and style.css only`);
    else if (typeof text !== 'string') p.push(`${name} must be text`);
  }
  return p;
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
    // Matched in the raw text, comments included: no comment parser for a game to trick.
    const url = text.match(URL_PATTERN);
    if (url) problems.push(`${name} contains a web address (${url[0].trim().slice(0, 40)})`);
  }
  return problems;
}
