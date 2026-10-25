import { useState } from 'react';
import { Banner, Button, Tag } from '../../ds';
import { useApp } from '../../app/useApp';
import { PASSAGES } from '../../game/content';
import { GameFrame } from '../../game/GameFrame';
import { startRun } from '../../game/runs';
import { ThemeScope } from '../../game/theme';
import { headingFont } from '../../game/themeVars';
import { useGameContent } from '../../game/useGameContent';
import { errorMessage } from '../../lib/supabase';
import { BackLink, Screen } from '../../shell/ui';
import { card, eyebrow } from '../../shell/styles';

export function Play() {
  const { set, go } = useApp();
  const { game, live, loading } = useGameContent();
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const concept = live?.content.concept;

  if (!game || !live || !concept) {
    return (
      <Screen label="Player · In game">
        <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
        <Banner tone="info">{loading ? 'Loading…' : 'This game isn’t available.'}</Banner>
      </Screen>
    );
  }

  const start = async () => {
    setBusy(true);
    setError(null);
    try { setRunId((await startRun(game.key, live.version, false)).id); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <ThemeScope tokens={concept.look.tokens} page>
      <Screen label="Player · In game" narrow={runId ? undefined : 860} gap={14}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <BackLink onClick={() => go('library')}>{runId ? '← Leave' : '← Back to your games'}</BackLink>
          {runId ? <span style={{ fontSize: 12, color: 'var(--tc-ink-3)' }}>{concept.title}</span> : null}
        </div>
        {runId ? (
          <>
            {error ? <Banner tone="warning" title="Your score wasn’t saved">{error}</Banner> : null}
            <GameFrame gameKey={game.key} content={live.content} runId={runId} test={false} onFinished={() => set({ resultsRunId: runId, screen: 'results' })} onScoreFailed={setError} />
          </>
        ) : (
          <div style={{ ...card, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={eyebrow}>{concept.mode === 'common_goal' ? 'Common goal' : 'Solo'}{concept.aiRole ? ` · ${concept.aiRole.kind === 'opponent' ? 'against the AI' : 'with an AI game master'}` : ''}</div>
            <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, margin: 0, ...headingFont }}>{concept.title}</h1>
            <div style={{ color: 'var(--tc-ink-3)', fontSize: 14, lineHeight: 1.5, maxWidth: 640 }}>{concept.pitch}</div>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {concept.howToPlay.map(step => <li key={step}>{step}</li>)}
            </ol>
            <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}><b>To win:</b> {concept.winCondition} · <b>Scoring:</b> {concept.scoring}</div>
            {concept.mode === 'common_goal' && concept.goal ? <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}><b>Together:</b> {concept.goal.description} ({concept.goal.target} {concept.goal.unit})</div> : null}
            {concept.sources.length ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--tc-ink-3)' }}>
                <span>Grounded in</span>
                {PASSAGES.filter(p => concept.sources.includes(p.id)).map(p => <Tag key={p.id} tone="source">{p.heading}</Tag>)}
              </div>
            ) : null}
            {error ? <Banner tone="warning">{error}</Banner> : null}
            <div><Button variant="primary" size="xl" onClick={() => void start()} disabled={busy}>{busy ? 'Starting…' : 'Start'}</Button></div>
          </div>
        )}
      </Screen>
    </ThemeScope>
  );
}
