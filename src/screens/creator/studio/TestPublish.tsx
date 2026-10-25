import { useCallback, useEffect, useState } from 'react';
import { Banner, Button, Select } from '../../../ds';
import { useSignedIn } from '../../../auth/useAuth';
import type { GameContent } from '../../../game/content';
import { exportGame } from '../../../game/exportZip';
import type { GameMeta } from '../../../game/games';
import { useGameContent } from '../../../game/useGameContent';
import { callFunction, errorMessage, supabase } from '../../../lib/supabase';
import { card } from '../../../shell/styles';

interface GameAdmin { id: string; full_name: string }

interface Check {
  passed: boolean;
  reasons: string[];
  checked_at: string;
}

/** Check house rules, publish, export: the last step before players see the game. */
export function TestPublish({ game, content, draftUpdatedAt, onUndo }: { game: GameMeta; content: GameContent; draftUpdatedAt: string | null; onUndo: () => Promise<void> }) {
  const { permissions } = useSignedIn();
  const { publish, published, live, draftBehind, takeInLive } = useGameContent();
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState<null | 'checking' | 'publishing'>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [gameAdmins, setGameAdmins] = useState<GameAdmin[]>([]);
  const [chosen, setChosen] = useState('');
  useEffect(() => {
    if (!permissions.has('workflow.publish')) return;
    let cancelled = false;
    supabase.rpc('game_admins_to_choose').then(({ data }) => { if (!cancelled) setGameAdmins((data ?? []) as GameAdmin[]); });
    return () => { cancelled = true; };
  }, [permissions]);
  const gameAdminName = game.game_admin ? gameAdmins.find(a => a.id === game.game_admin)?.full_name ?? 'someone who can no longer look after games' : 'not set';

  const loadCheck = useCallback(async () => {
    const { data } = await supabase.from('game_checks').select('passed, reasons, checked_at').eq('game_key', game.key).order('id', { ascending: false }).limit(1).maybeSingle<Check>();
    setCheck(data ?? null);
  }, [game.key]);
  useEffect(() => {
    let cancelled = false;
    supabase.from('game_checks').select('passed, reasons, checked_at').eq('game_key', game.key).order('id', { ascending: false }).limit(1).maybeSingle<Check>()
      .then(({ data }) => { if (!cancelled) setCheck(data ?? null); });
    return () => { cancelled = true; };
  }, [game.key]);

  // A check belongs to the version it saw; any later save means checking again (the database enforces it).
  const stale = !!check && !!draftUpdatedAt && new Date(draftUpdatedAt) > new Date(check.checked_at);
  const live_ = published && live && JSON.stringify(live.content) === JSON.stringify(content);

  const runCheck = async () => {
    setBusy('checking');
    setMessage(null);
    try { await callFunction('game-check', { game_key: game.key }); await loadCheck(); } catch (e) { setMessage({ tone: 'warning', text: errorMessage(e) }); } finally { setBusy(null); }
  };
  const doPublish = async () => {
    setBusy('publishing');
    setMessage(null);
    const first = !published;
    try { await publish(first ? chosen : undefined); setMessage({ tone: 'success', text: first ? 'Published · the game admin decides who may play it' : 'Published · players get this version in their next game' }); } catch (e) { setMessage({ tone: 'warning', text: errorMessage(e) }); } finally { setBusy(null); }
  };

  return (
    <div style={{ ...card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="md" onClick={() => void runCheck()} disabled={!!busy}>{busy === 'checking' ? 'Checking…' : 'Check house rules'}</Button>
        {!published && permissions.has('workflow.publish') ? (
          <Select
            aria-label="Game admin"
            value={chosen}
            disabled={!!busy}
            onChange={e => setChosen(e.target.value)}
            options={[{ value: '', label: 'Choose a game admin…' }, ...gameAdmins.map(a => ({ value: a.id, label: a.full_name }))]}
          />
        ) : null}
        <Button variant="primary" size="md" onClick={() => void doPublish()} disabled={!!busy || !permissions.has('workflow.publish') || (!published && !chosen)} title={permissions.has('workflow.publish') ? undefined : 'Needs “Approve and publish a version”'}>
          {busy === 'publishing' ? 'Publishing…' : 'Publish to players'}
        </Button>
        {permissions.has('users.manage') ? <Button variant="secondary" size="md" onClick={() => exportGame(game, content)} disabled={!!busy}>Export code</Button> : null}
        {content.previous ? <Button variant="secondary" size="md" onClick={() => void onUndo()} disabled={!!busy}>Undo last change</Button> : null}
        <span style={{ fontSize: 12.5, color: 'var(--tc-ink-4)', marginLeft: 'auto' }}>{live_ ? 'Live: players have this version' : published ? 'Live: an earlier version' : 'Not published yet'}</span>
      </div>
      {published ? <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>Game admin: {gameAdminName} · they decide who may play it</div> : null}
      {game.offline_at ? <Banner tone="warning" title="Offline · taken offline by the game admin">Players can’t play it until the game admin brings it back. Publishing a new version doesn’t change that.</Banner> : null}
      {draftBehind ? (
        <Banner
          tone="info"
          title="A game admin added content to the live game. Take it into your draft first."
          actions={<Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void takeInLive().then(() => setMessage({ tone: 'success', text: 'The live content is in your draft. Check it against the house rules, then publish.' }), e => setMessage({ tone: 'warning', text: errorMessage(e) }))}>Take in the live content</Button>}
        >
          This replaces your draft’s content (questions, levels, cases) with the live content; your code stays as it is.
        </Banner>
      ) : null}
      {check && !stale ? (
        check.passed
          ? <div style={{ fontSize: 13, color: 'var(--tc-green-text)', fontWeight: 600 }}>✓ Passed the house-rules check</div>
          : <Banner tone="warning" title="Didn’t pass the house-rules check">{check.reasons.map(r => <div key={r}>· {r}</div>)}</Banner>
      ) : null}
      {stale ? <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>The game changed since the last check. Check again before publishing.</div> : null}
      {!check ? <div style={{ fontSize: 13, color: 'var(--tc-ink-3)' }}>Check the game against the house rules, then publish it.</div> : null}
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
    </div>
  );
}
