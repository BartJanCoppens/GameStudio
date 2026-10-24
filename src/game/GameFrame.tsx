import { useEffect, useMemo, useRef, useState } from 'react';
import { safeTokens } from './themeVars';
import { buildSrcdoc, fontsCssFor } from './bridge/srcdoc';
import { useBridgeHost } from './bridge/useBridgeHost';
import type { GameContent } from './content';

/** A short, cheap fingerprint of the page, so a changed game gets a fresh frame. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const LEFT_MESSAGE = 'This game tried to leave the platform and was stopped.';

interface Props {
  gameKey: string;
  content: GameContent;
  runId: string | null;
  test: boolean;
  onFinished?: (score: number | null) => void;
  height?: number | string;
}

/**
 * A game in the sealed-off frame: sandbox without same-origin (no cookies, storage or Supabase), a strict
 * content security policy inside, and the bridge as its only way out. If the frame navigates away from the
 * page it was given, it is stopped.
 */
export function GameFrame({ gameKey, content, runId, test, onFinished, height = 'calc(100dvh - 190px)' }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [fontsCss, setFontsCss] = useState<string | null>(null);
  // Which page (and run) was stopped for leaving; a new page or run starts clean.
  const [leftKey, setLeftKey] = useState<string | null>(null);
  const loads = useRef({ key: '', count: 0 });
  const tokens = safeTokens(content.concept?.look.tokens);

  useEffect(() => {
    let cancelled = false;
    fontsCssFor(tokens).then(css => { if (!cancelled) setFontsCss(css); });
    return () => { cancelled = true; };
  }, [tokens?.bodyFont, tokens?.headingFont]); // eslint-disable-line react-hooks/exhaustive-deps

  const srcDoc = useMemo(() => (fontsCss === null || !content.files ? null : buildSrcdoc(content.files, { fontsCss })), [content.files, fontsCss]);
  const frameKey = `${runId ?? 'preview'}:${srcDoc?.length ?? 0}:${srcDoc ? hash(srcDoc) : ''}`;
  const left = leftKey === frameKey;

  useBridgeHost(frame, {
    gameKey, runId, test, content,
    onLeft: () => setLeftKey(frameKey),
    onFinished: score => onFinished?.(score),
  });

  if (left) return <div role="alert" style={{ padding: 24, border: '1px solid var(--tc-red)', borderRadius: 8, background: 'var(--tc-red-bg-soft)', color: 'var(--tc-red-text)', fontWeight: 600 }}>{LEFT_MESSAGE}</div>;
  if (!srcDoc) return <div style={{ padding: 24, color: 'var(--tc-ink-5)' }}>{content.files ? 'Loading the game…' : 'This game has no code yet.'}</div>;
  return (
    <iframe
      ref={frame}
      key={frameKey}
      title="Game"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      // The first load is the game's own page; any further load means it navigated away.
      onLoad={() => {
        if (loads.current.key !== frameKey) loads.current = { key: frameKey, count: 0 };
        loads.current.count += 1;
        if (loads.current.count > 1) setLeftKey(frameKey);
      }}
      style={{ width: '100%', height, border: '1px solid var(--tc-line-soft)', borderRadius: 'var(--game-radius, 8px)', background: tokens?.surface ?? '#fff', display: 'block' }}
    />
  );
}

/** A static mock-up: rendered in the same sealed-off way, with scripts blocked entirely. */
export function MockupFrame({ html, height = 420 }: { html: string; height?: number | string }) {
  const srcDoc = useMemo(() => buildSrcdoc({ 'index.html': html }, { fontsCss: '', scripts: false }), [html]);
  return <iframe title="Mock-up" sandbox="" srcDoc={srcDoc} style={{ width: '100%', height, border: '1px solid var(--tc-line-soft)', borderRadius: 8, background: '#fff', display: 'block' }} />;
}
