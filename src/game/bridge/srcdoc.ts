import { FONTS, type DesignTokens, type FontId } from '../../../supabase/functions/_shared/design.ts';
import type { GameFiles } from '../content';
import { BRIDGE_SCRIPT } from './bridgeScript';

// The page a game runs as: its files inlined, the bridge before its code, and a content security policy
// that allows no network, no forms, no outside fonts or images. The frame's sandbox does the rest.

export const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; webrtc 'block'";

/** Text inside <script> or <style> can't close its own element. */
const inScript = (code: string) => code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const inStyle = (css: string) => css.replace(/<\/(style)/gi, '<\\/$1');

/** The author's head and body content, without anything that could override the platform's policy or base URL. */
function authorParts(index: string): { head: string; body: string } {
  const strip = (s: string) => s.replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '').replace(/<base\b[^>]*>/gi, '');
  const head = index.match(/<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const bodyMatch = index.match(/<body(?:\s[^>]*)?>([\s\S]*)<\/body>/i);
  const body = bodyMatch
    ? bodyMatch[1]
    : index.replace(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i, '').replace(/<!doctype[^>]*>|<\/?(html|head|body)(?:\s[^>]*)?>/gi, '');
  return { head: strip(head), body: strip(body) };
}

/**
 * The full page for a game. The platform builds the document itself, so its policy is always the first
 * element of the one real <head>, before any of the author's markup. scripts: false for a mock-up, which may
 * show but never run anything.
 */
export function buildSrcdoc(files: GameFiles, opts: { fontsCss: string; scripts?: boolean }): string {
  const scripts = opts.scripts ?? true;
  const csp = scripts ? CSP : CSP.replace("script-src 'unsafe-inline'", "script-src 'none'");
  const author = authorParts(files['index.html'] ?? '');
  return [
    '<!doctype html><html><head>',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style>${inStyle(opts.fontsCss)}\n${inStyle(files['style.css'] ?? '')}</style>`,
    scripts ? `<script>${inScript(BRIDGE_SCRIPT)}</script>` : '',
    author.head,
    '</head><body>',
    author.body,
    scripts && files['game.js'] ? `<script>${inScript(files['game.js'])}</script>` : '',
    '</body></html>',
  ].join('\n').replace(/^<!doctype html><html><head>\n/, '<!doctype html><html><head>');
}

/** The look's fonts as data: URLs, read from the app's own /fonts (the frame may load nothing from outside). */
const fontCache = new Map<string, Promise<string>>();

async function fontFace(id: FontId, weight: 400 | 600): Promise<string> {
  const key = `${id}-${weight}`;
  if (!fontCache.has(key)) {
    fontCache.set(key, (async () => {
      const res = await fetch(`/fonts/${key}.woff2`);
      if (!res.ok) return '';
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const family = FONTS.find(f => f.id === id)?.family ?? id;
      return `@font-face{font-family:'${family}';font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2')}`;
    })().catch(() => ''));
  }
  return fontCache.get(key)!;
}

export async function fontsCssFor(tokens: DesignTokens | undefined): Promise<string> {
  if (!tokens) return '';
  const ids = [...new Set([tokens.bodyFont, tokens.headingFont])];
  return (await Promise.all(ids.flatMap(id => [fontFace(id, 400), fontFace(id, 600)]))).join('\n');
}
