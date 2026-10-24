import { useEffect, useState } from 'react';
import { Button, StatusChip, Tag } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { DEFAULT_CONTENT, GAME, type GameContent } from '../../game/content';
import { DEMO_GAME_KEY, type GameMeta } from '../../game/games';
import { useGameContent } from '../../game/useGameContent';
import { useFinishedRuns, type RunRow } from '../../game/runs';
import { ThemeScope } from '../../game/theme';
import { headingFont } from '../../game/themeVars';
import { supabase } from '../../lib/supabase';
import { PageHead, Screen } from '../../shell/ui';

/** Every published game's live content, by game key (the demo game falls back to its built-in content). */
function useLiveContents(): Map<string, GameContent> | null {
  const [contents, setContents] = useState<Map<string, GameContent> | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.from('game_content').select('game_key, content').eq('stage', 'live').then(({ data }) => {
      if (cancelled) return;
      const m = new Map((data ?? []).map(r => [r.game_key as string, r.content as GameContent]));
      if (!m.has(DEMO_GAME_KEY)) m.set(DEMO_GAME_KEY, DEFAULT_CONTENT);
      setContents(m);
    });
    return () => { cancelled = true; };
  }, []);
  return contents;
}

function GameCard({ game, content, mine }: { game: GameMeta; content: GameContent; mine: RunRow[] }) {
  const { s, set, openGame } = useApp();
  const run = s.run?.gameKey === game.key ? s.run : null;
  const best = mine.reduce<number | null>((b, r) => Math.max(b ?? 0, r.invoices_correct ?? 0), null);
  const status = run
    ? { st: 'in-progress' as const, label: `In progress · invoice ${run.index + 1} of ${run.content.invoices.length}` }
    : best !== null
      ? { st: 'accepted' as const, label: `Completed · best ${best}/${content.invoices.length}` }
      : { st: 'not-started' as const, label: 'Not started' };

  return (
    <ThemeScope tokens={content.design?.tokens} style={{ display: 'flex', maxWidth: 520 }}>
      <div style={{ flex: 1, background: 'var(--tc-surface)', border: '1px solid var(--tc-line-soft)', borderRadius: 'var(--game-radius, 6px)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Tag tone="neutral">{GAME.type}</Tag>
            <Tag tone="muted">Browser · large screen</Tag>
          </div>
          <StatusChip status={status.st} label={status.label} size="xs" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25, ...headingFont }}>{game.title}</div>
          <div style={{ color: 'var(--tc-ink-3)', marginTop: 4 }}>
            {game.description || 'Mistakes against the Belgian mandatory invoice mentions.'} Find them all and name the rule each one breaks.
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tc-ink-5)' }}>{content.invoices.length} invoices · {content.errors.length} errors to find · {GAME.minutes} min · leaderboard</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--tc-line-hair)' }}>
          <Tag tone="bundle">{GAME.domain}</Tag>
          <div style={{ display: 'flex', gap: 6 }}>
            {mine.length ? <Button variant="secondary" size="md" onClick={() => { openGame(game.key, 'results'); set({ resultsRunId: null }); }}>Results</Button> : null}
            <Button variant="primary" size="md" onClick={() => openGame(game.key, 'play')}>{run ? 'Continue' : mine.length ? 'Play again' : 'Play'}</Button>
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
  const playable = games.filter(g => contents?.has(g.key));

  return (
    <Screen label="Player · Library">
      <PageHead
        title="Your games"
        lead={contents ? `${playable.length} assigned to you · ${mine.length ? `played ${mine.length} ${mine.length === 1 ? 'time' : 'times'}` : 'not played yet'}` : 'Loading…'}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
        {playable.map(g => <GameCard key={g.key} game={g} content={contents!.get(g.key)!} mine={mine.filter(r => r.game_key === g.key)} />)}
      </div>
    </Screen>
  );
}
