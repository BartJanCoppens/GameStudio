import { useEffect, useState } from 'react';
import { Button, StatusChip, Tag } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import type { GameContent } from '../../game/content';
import type { GameMeta } from '../../game/games';
import { useGameContent } from '../../game/useGameContent';
import { useFinishedRuns, type RunRow } from '../../game/runs';
import { ThemeScope } from '../../game/theme';
import { headingFont } from '../../game/themeVars';
import { supabase } from '../../lib/supabase';
import { PageHead, Screen } from '../../shell/ui';
import { playableGames } from './playable';

/** Every published game's live content, by game key. */
function useLiveContents(): Map<string, GameContent> | null {
  const [contents, setContents] = useState<Map<string, GameContent> | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.from('game_content').select('game_key, content').eq('stage', 'live').then(({ data }) => {
      if (!cancelled) setContents(new Map((data ?? []).map(r => [r.game_key as string, r.content as GameContent])));
    });
    return () => { cancelled = true; };
  }, []);
  return contents;
}

function GameCard({ game, content, mine }: { game: GameMeta; content: GameContent; mine: RunRow[] }) {
  const { set, openGame } = useApp();
  const concept = content.concept;
  const best = mine.reduce<number | null>((b, r) => Math.max(b ?? -Infinity, r.score ?? 0), null);
  const status = best !== null
    ? { st: 'accepted' as const, label: concept?.leaderboard ? `Played · best ${best}` : 'Played' }
    : { st: 'not-started' as const, label: 'Not started' };

  return (
    <ThemeScope tokens={concept?.look.tokens} style={{ display: 'flex', maxWidth: 520 }}>
      <div style={{ flex: 1, background: 'var(--tc-surface)', border: '1px solid var(--tc-line-soft)', borderRadius: 'var(--game-radius, 6px)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Tag tone="neutral">{concept?.mode === 'common_goal' ? 'Common goal' : 'Solo'}</Tag>
            {concept?.aiRole ? <Tag tone="neutral">{concept.aiRole.kind === 'opponent' ? 'Play against AI' : 'AI game master'}</Tag> : null}
            {concept?.leaderboard ? <Tag tone="muted">Leaderboard</Tag> : null}
          </div>
          <StatusChip status={status.st} label={status.label} size="xs" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25, ...headingFont }}>{concept?.title ?? game.title}</div>
          <div style={{ color: 'var(--tc-ink-3)', marginTop: 4 }}>{concept?.pitch ?? game.description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--tc-line-hair)' }}>
          {concept?.sources.length ? <Tag tone="bundle">Belgian VAT</Tag> : <span />}
          <div style={{ display: 'flex', gap: 6 }}>
            {mine.length ? <Button variant="secondary" size="md" onClick={() => { openGame(game.key, 'results'); set({ resultsRunId: null }); }}>Results</Button> : null}
            <Button variant="primary" size="md" onClick={() => openGame(game.key, 'play')}>{mine.length ? 'Play again' : 'Play'}</Button>
          </div>
        </div>
      </div>
    </ThemeScope>
  );
}

export function Library() {
  const { profile } = useSignedIn();
  const { games } = useGameContent();
  const { runs } = useFinishedRuns();
  const contents = useLiveContents();
  const mine = (runs ?? []).filter(r => r.user_id === profile.id);
  const playable = contents ? playableGames(games, new Set(contents.keys())) : [];

  return (
    <Screen label="Player · Library">
      <PageHead
        title="Your games"
        lead={contents ? `${playable.length} ${playable.length === 1 ? 'game' : 'games'} · ${mine.length ? `played ${mine.length} ${mine.length === 1 ? 'time' : 'times'}` : 'not played yet'}` : 'Loading…'}
      />
      {contents && !playable.length ? <div style={{ color: 'var(--tc-ink-5)' }}>No games yet. They appear here once a creator publishes one.</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
        {playable.map(g => <GameCard key={g.key} game={g} content={contents!.get(g.key)!} mine={mine.filter(r => r.game_key === g.key)} />)}
      </div>
    </Screen>
  );
}
