import { useState } from 'react';
import { Banner, Button, Field, Textarea } from '../../ds';
import { useApp } from '../../app/useApp';
import { GameFrame } from '../../game/GameFrame';
import type { GameMeta } from '../../game/games';
import { startRun } from '../../game/runs';
import { streamFunction } from '../../game/studio/sse';
import type { StoredContent } from '../../game/useGameContent';
import { useGameContent } from '../../game/useGameContent';
import { contentLists } from '../../game/contentLists';
import { callFunction, errorMessage } from '../../lib/supabase';
import { card, cardHead } from '../../shell/styles';

const EXAMPLE = 'Add two harder cases where the supplier’s VAT number is valid but the customer’s is missing.';

/** More content for a live game, written by the AI in the game's own shape, checked, then published. */
export function ContentTab({ game, live }: { game: GameMeta; live: StoredContent }) {
  const { toast } = useApp();
  const { reloadContent } = useGameContent();
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState<null | 'generating' | 'publishing'>(null);
  const [streamed, setStreamed] = useState('');
  const [proposal, setProposal] = useState<{ data: unknown; reply: string } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'warning'; text: string; reasons?: string[] } | null>(null);

  const before = contentLists(live.content.data);
  const after = proposal ? contentLists(proposal.data) : [];

  const generate = async () => {
    setBusy('generating');
    setOutcome(null);
    setProposal(null);
    setRunId(null);
    setStreamed('');
    try {
      const result = await streamFunction('game-builder', { game_key: game.key, step: 'extend', instruction: request.trim() }, d => setStreamed(s => s + d)) as { data: unknown; reply: string };
      setProposal(result);
    } catch (e) {
      setOutcome({ tone: 'warning', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!proposal) return;
    setBusy('publishing');
    setOutcome(null);
    try {
      const r = await callFunction<{ passed: boolean; reasons: string[] }>('game-content', { game_key: game.key, data: proposal.data });
      if (r.passed) {
        setOutcome({ tone: 'success', text: 'Published · players get the new content in their next game' });
        setProposal(null);
        setRequest('');
        await reloadContent();
        toast('New content published');
      } else {
        setOutcome({ tone: 'warning', text: 'The new content didn’t pass the house-rules check, so nothing was published.', reasons: r.reasons });
      }
    } catch (e) {
      setOutcome({ tone: 'warning', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
        <div style={cardHead}>What the game is made of now</div>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          {before.length ? before.map(l => <span key={l.name}>{l.name} · {l.count} items</span>) : <span style={{ color: 'var(--tc-ink-4)' }}>This game’s content has no lists to add to.</span>}
        </div>
      </div>
      <div style={{ ...card, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="What should be added?" hint="New items are written in the same shape as the existing ones, so the game picks them up as they are.">
          <Textarea value={request} onChange={e => setRequest(e.target.value.slice(0, 2000))} rows={3} placeholder={EXAMPLE} disabled={!!busy} />
        </Field>
        <div><Button variant="primary" size="lg" onClick={() => void generate()} disabled={!!busy || request.trim().length < 5}>{busy === 'generating' ? 'Writing…' : 'Generate'}</Button></div>
        {busy === 'generating' ? (
          <pre aria-label="Content being written" style={{ margin: 0, maxHeight: 160, overflow: 'auto', background: '#14171a', color: '#d6e2c4', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {streamed.slice(-2000) || 'Starting…'}
          </pre>
        ) : null}
      </div>
      {outcome ? (
        <Banner tone={outcome.tone}>
          {outcome.text}
          {outcome.reasons?.map(r => <div key={r}>· {r}</div>)}
        </Banner>
      ) : null}
      {proposal ? (
        <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
          <div style={cardHead}>Preview</div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>{proposal.reply}</div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
              {after.map(l => {
                const was = before.find(b => b.name === l.name)?.count ?? 0;
                return <span key={l.name} style={{ fontWeight: l.count > was ? 600 : 400 }}>{l.name} · {was} → {l.count}</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button variant="secondary" size="md" disabled={!!busy} onClick={() => void startRun(game.key, live.version, true).then(r => setRunId(r.id), e => toast(errorMessage(e)))}>{runId ? 'Restart test' : 'Play test'}</Button>
              <Button variant="primary" size="md" disabled={!!busy} onClick={() => void publish()}>{busy === 'publishing' ? 'Checking…' : 'Check and publish'}</Button>
              <span style={{ fontSize: 12.5, color: 'var(--tc-ink-4)' }}>Test plays never count. Publishing runs the house-rules check first.</span>
            </div>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            <GameFrame key={runId ?? 'preview'} gameKey={game.key} content={{ ...live.content, data: proposal.data }} runId={runId} test height={520} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
