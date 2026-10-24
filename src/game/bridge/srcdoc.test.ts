import { describe, expect, it } from 'vitest';
import tiny from '../../../e2e/fixtures/tiny-game.json';
import { BRIDGE_SCRIPT } from './bridgeScript';
import { CSP, buildSrcdoc } from './srcdoc';


describe('buildSrcdoc', () => {
  it('puts the CSP meta first in head', () => {
    const doc = buildSrcdoc({ 'index.html': '<!doctype html><html><head><title>x</title></head><body><p>hi</p></body></html>' }, { fontsCss: '' });
    expect(doc).toMatch(new RegExp(`<head>\\s*<meta http-equiv="Content-Security-Policy" content="${CSP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
  });
  it('inlines style.css, the bridge and game.js in that order', () => {
    const doc = buildSrcdoc({ 'index.html': '<p id="x"></p>', 'style.css': 'p{color:red}', 'game.js': 'GameStudio.ready();' }, { fontsCss: '@font-face{}' });
    const style = doc.indexOf('p{color:red}'), bridge = doc.indexOf(BRIDGE_SCRIPT.slice(0, 40)), game = doc.indexOf('GameStudio.ready();');
    expect(style).toBeGreaterThan(-1);
    expect(bridge).toBeGreaterThan(style);
    expect(game).toBeGreaterThan(bridge);
    expect(doc.indexOf('@font-face{}')).toBeGreaterThan(-1);
  });
  it('wraps a body-only index.html in a full document', () => {
    const doc = buildSrcdoc({ 'index.html': '<p>only body</p>' }, { fontsCss: '' });
    expect(doc).toMatch(/^<!doctype html>/i);
    expect(doc).toContain('<head>');
    expect(doc).toMatch(/<body>[\s\S]*<p>only body<\/p>[\s\S]*<\/body>/);
  });
  it('keeps a closing script tag inside game.js from ending the script early', () => {
    const doc = buildSrcdoc({ 'index.html': '<p></p>', 'game.js': 'const s = "</script><img src=x>";' }, { fontsCss: '' });
    expect(doc).not.toContain('"</script><img');
  });
  it('produces no web address for the tiny game', () => {
    expect(buildSrcdoc(tiny.files, { fontsCss: '' })).not.toMatch(/https?:\/\//);
  });
  it('can block scripts entirely (mock-ups)', () => {
    expect(buildSrcdoc({ 'index.html': '<p></p>' }, { fontsCss: '', scripts: false })).toContain("script-src 'none'");
  });
});

describe('buildSrcdoc with hostile markup', () => {
  const start = (doc: string) => doc.slice(0, 120);
  it('builds its own head: the CSP is first even when <header> comes before <head>', () => {
    const doc = buildSrcdoc({ 'index.html': '<header>x</header><head><title>t</title></head><body><p>b</p></body>' }, { fontsCss: '' });
    expect(start(doc)).toMatch(/^<!doctype html><html><head><meta http-equiv="Content-Security-Policy"/i);
  });
  it('builds its own head when markup precedes <head>', () => {
    const doc = buildSrcdoc({ 'index.html': '<script>alert(1)</script><head></head><body></body>' }, { fontsCss: '' });
    expect(start(doc)).toMatch(/^<!doctype html><html><head><meta http-equiv="Content-Security-Policy"/i);
  });
  it('removes the author’s own http-equiv metas and base tags', () => {
    const doc = buildSrcdoc({ 'index.html': '<head><meta http-equiv="refresh" content="0;url=x"><base href="x"></head><body></body>' }, { fontsCss: '' });
    expect(doc).not.toMatch(/http-equiv="refresh"|<base/i);
    expect(doc.match(/http-equiv/gi)).toHaveLength(1);
  });
});

describe('the content security policy', () => {
  it('blocks WebRTC where browsers support it', () => expect(CSP).toContain("webrtc 'block'"));
});
