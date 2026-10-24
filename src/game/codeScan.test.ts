import { describe, expect, it } from 'vitest';
import { filesProblems, scanGameFiles } from '../../supabase/functions/_shared/codeScan.ts';

const clean = { 'index.html': '<div id="app"></div>', 'game.js': 'GameStudio.ready();' };
const withJs = (js: string) => scanGameFiles({ ...clean, 'game.js': js });

describe('scanGameFiles', () => {
  it('passes a clean game', () => expect(scanGameFiles(clean)).toEqual([]));

  it.each([
    ['fetch("https://x.y")', 'contacts another website'],
    ['new XMLHttpRequest()', 'contacts another website'],
    ['new WebSocket("wss://x")', 'contacts another website'],
    ['new EventSource("/x")', 'contacts another website'],
    ['navigator.sendBeacon("/x")', 'contacts another website'],
    ['import("./x.js")', 'loads code from elsewhere'],
    ['const u = "https://evil.example/collect";', 'contains a web address'],
    ['window.open("x")', 'leaves the page'],
    ['location.href = "x"', 'leaves the page'],
    ['location.assign("x")', 'leaves the page'],
    ['location.replace("x")', 'leaves the page'],
    ['top.location = "x"', 'leaves the page'],
    ['parent.location = "x"', 'leaves the page'],
    ['document.querySelector("form").submit()', 'submits a form'],
    ['document.cookie', 'uses browser storage'],
    ['localStorage.setItem("a", 1)', 'uses browser storage'],
    ['sessionStorage.getItem("a")', 'uses browser storage'],
    ['indexedDB.open("x")', 'uses browser storage'],
    ['eval("1+1")', 'runs code from text'],
    ['new Function("return 1")', 'runs code from text'],
  ])('reports %s', (js, message) => {
    const problems = withJs(js);
    expect(problems.join(' | ')).toContain(message);
  });

  it('reports external scripts, stylesheets and forms in HTML', () => {
    expect(scanGameFiles({ 'index.html': '<script src="x.js"></script>' }).join(' ')).toContain('loads code from elsewhere');
    expect(scanGameFiles({ 'index.html': '<link rel="stylesheet" href="x.css">' }).join(' ')).toContain('loads code from elsewhere');
    expect(scanGameFiles({ 'index.html': '<style>@import "x.css";</style>' }).join(' ')).toContain('loads code from elsewhere');
    expect(scanGameFiles({ 'index.html': '<form><input></form>' }).join(' ')).toContain('submits a form');
  });

  it('reports a web address even inside a comment (no comment parsing to trick)', () => {
    expect(withJs('// docs: https://example.com\nGameStudio.ready();').join(' ')).toContain('contains a web address');
    expect(scanGameFiles({ 'index.html': '<!-- https://example.com --><div></div>' }).join(' ')).toContain('contains a web address');
    expect(withJs('const s = "/*"; const u = "//evil.example/x"; const e = "*/";').join(' ')).toContain('contains a web address');
  });

  it('reports a missing index.html', () => expect(scanGameFiles({ 'game.js': '1' }).join(' ')).toContain('has no index.html'));

  it('reports a file over 300 KB', () => expect(withJs('x'.repeat(300_001)).join(' ')).toContain('too large'));
});

describe('the e2e tiny game fixture', () => {
  it('passes the scan and the concept checks', async () => {
    const { conceptProblems } = await import('../../supabase/functions/_shared/gameModel.ts');
    const tiny = (await import('../../e2e/fixtures/tiny-game.json')).default;
    expect(scanGameFiles(tiny.files)).toEqual([]);
    expect(conceptProblems(tiny.concept)).toEqual([]);
  });
});

describe('filesProblems', () => {
  it('accepts the known files as text', () => expect(filesProblems({ 'index.html': '<p></p>', 'game.js': '', 'style.css': '' })).toEqual([]));
  it('rejects unknown file names', () => expect(filesProblems({ 'index.html': '<p></p>', 'evil.html': 'x' }).join(' ')).toContain('evil.html'));
  it('rejects files that are not text', () => expect(filesProblems({ 'index.html': { toString: 'x' } }).join(' ')).toContain('index.html'));
  it('rejects a missing or non-object files value', () => {
    expect(filesProblems(null).join(' ')).toContain('no code');
    expect(filesProblems('x').join(' ')).toContain('no code');
  });
});
